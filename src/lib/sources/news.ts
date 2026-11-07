import type { Headline } from "../types";
import { getText, httpsUrl, safe, stripTags } from "../util";

/** One headline from each, in this order: the top item of each paper's front-page feed. */
const FEEDS = [
	{ name: "NOS", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
	{ name: "NRC", url: "https://www.nrc.nl/rss/" },
	{ name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
	{ name: "The Guardian", url: "https://www.theguardian.com/world/rss" },
	{
		name: "NYT",
		url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
	},
];

const tag = (xml: string, name: string) =>
	new RegExp(
		`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`,
	).exec(xml)?.[1];

/** The first item of an RSS feed, or null. */
export function parseTopItem(rss: string, source: string): Headline | null {
	const item = /<item[\s>][\s\S]*?<\/item>/.exec(rss)?.[0];
	if (!item) return null;
	const title = stripTags(tag(item, "title") ?? "");
	const url = httpsUrl(tag(item, "link")?.trim());
	return title && url ? { title, url, source } : null;
}

export async function fetchNews(): Promise<Headline[]> {
	const items = await Promise.all(
		FEEDS.map((f) =>
			safe(`news ${f.name}`, async () =>
				parseTopItem(await getText(f.url, "application/rss+xml"), f.name),
			),
		),
	);
	return items.filter((h): h is Headline => h !== null);
}
