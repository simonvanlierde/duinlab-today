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

/** `body` with every YYYY-MM-DD moved by the days from `base` to today, so "this week" stays this week. */
function redated(body, base) {
	const ms = (d) => Date.parse(`${d}T12:00:00Z`);
	const by = ms(today()) - ms(base);
	return body.replace(/\b(20\d\d-\d\d-\d\d)(?=T)/g, (d) =>
		new Date(ms(d) + by).toISOString().slice(0, 10),
	);
}

const RECIPE_HOSTS = {
	"www.theguardian.com": "The Guardian",
	"www.bbcgoodfood.com": "Good Food",
	"www.loveandlemons.com": "Love and Lemons",
};
const recipeRss = (host) =>
	`<?xml version="1.0"?><rss version="2.0"><channel><title>${RECIPE_HOSTS[host]}</title>` +
	// Good Food's feed mixes in reviews, which the parser skips
	(host === "www.bbcgoodfood.com"
		? `<item><title>Good Food fixture review</title><link>https://${host}/review/fixture-pan</link></item>`
		: "") +
	`<item><title>${RECIPE_HOSTS[host]} fixture recipe: dune bread</title>` +
	`<link>https://${host}/recipes/fixture-bread</link></item></channel></rss>`;

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
	"iiif.micr.io": () => ["image/png", png],
	"api.artic.edu": () => ["application/json", text("aic-search.json")],
	"data.rijksmuseum.nl": () => [
		"application/ld+json",
		text("rijks-search.json"),
	],
	"id.rijksmuseum.nl": () => ["application/ld+json", text("rijks-object.json")],
	"opentdb.com": () => ["application/json", text("opentdb.json")],
	"zenquotes.io": () => ["application/json", text("zenquotes.json")],
	"api.open-meteo.com": () => ["application/json", text("open-meteo.json")],
	"gpsgadget.buienradar.nl": () => ["text/plain", text("buienradar.txt")],
	// both recorded on 2026-11-09
	"ddapi20-waterwebservices.rijkswaterstaat.nl": () => [
		"application/json",
		redated(text("tides.json"), "2026-11-09"),
	],
	"www.paard.nl": () => [
		"text/html",
		redated(text("paard.html"), "2026-11-09"),
	],
	"api.inaturalist.org": () => ["application/json", text("inaturalist.json")],
	...Object.fromEntries(
		Object.keys(RECIPE_HOSTS).map((h) => [
			h,
			() => ["application/rss+xml", recipeRss(h)],
		]),
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
