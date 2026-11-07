// Canned upstream answers for e2e. The Worker runs with FIXTURE_ORIGIN pointing here, and
// getText (src/lib/util.ts) asks `${FIXTURE_ORIGIN}/<host>/<path>?<query>` in place of
// `https://<host>/<path>?<query>`. An unknown host answers 404, like a source that is down.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.FIXTURE_PORT ?? 4332);
const unit = new URL("../test/unit/fixtures/", import.meta.url);
const text = (name) => readFileSync(new URL(name, unit), "utf8");
const png = readFileSync(new URL("fixtures/picture.png", import.meta.url));

/** Today in Amsterdam, the day the Worker builds: the word feed must have an entry for it. */
const today = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(
		new Date(),
	);

/** The 2026-11-06 entry of the recorded feed, re-dated to today. */
function wordFeed() {
	const atom = text("wiktionary.atom");
	const [head] = atom.split("<entry>");
	const entry = atom.split("<entry>").find((e) => e.includes("/wotd/20261106"));
	const dated = entry
		?.split("</feed>")[0]
		.replaceAll("20261106", today().replaceAll("-", ""));
	return `${head}<entry>${dated}</feed>`;
}

const PAPERS = {
	"feeds.nos.nl": "NOS",
	"www.nrc.nl": "NRC",
	"feeds.bbci.co.uk": "BBC",
	"www.theguardian.com": "The Guardian",
	"rss.nytimes.com": "NYT",
};
const rss = (host) =>
	`<?xml version="1.0"?><rss version="2.0"><channel><title>${PAPERS[host]}</title>` +
	`<item><title><![CDATA[${PAPERS[host]} fixture headline: sand dunes grow a metre]]></title>` +
	`<link>https://${host}/fixture-story</link></item></channel></rss>`;

const metObject = () => text("met-object.json");

/** host -> (path) -> [content type, body] */
const HOSTS = {
	"api.wikimedia.org": () => ["application/json", text("wikipedia.json")],
	"en.wiktionary.org": () => ["application/atom+xml", wordFeed()],
	"collectionapi.metmuseum.org": (path) =>
		path.includes("/search")
			? ["application/json", '{"total":1,"objectIDs":[436535]}']
			: ["application/json", metObject()],
	"images.metmuseum.org": () => ["image/png", png],
	"opentdb.com": () => ["application/json", text("opentdb.json")],
	"zenquotes.io": () => ["application/json", text("zenquotes.json")],
	"api.open-meteo.com": () => ["application/json", text("open-meteo.json")],
	"gpsgadget.buienradar.nl": () => ["text/plain", text("buienradar.txt")],
	...Object.fromEntries(
		Object.keys(PAPERS).map((h) => [h, () => ["application/rss+xml", rss(h)]]),
	),
};

createServer((req, res) => {
	const url = new URL(req.url ?? "/", "http://fixture");
	if (url.pathname === "/") return res.end("ok");
	const [, host = "", ...rest] = url.pathname.split("/");
	const route = HOSTS[host];
	if (!route) {
		console.error(`fixture-server: no fixture for ${url.pathname}`);
		res.statusCode = 404;
		return res.end();
	}
	const [type, body] = route(`/${rest.join("/")}`);
	res.setHeader("content-type", type);
	res.end(body);
}).listen(port, "127.0.0.1");
