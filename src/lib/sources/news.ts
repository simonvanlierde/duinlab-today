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

/** One recipe from each of these, in this order: the newest recipe item of each site's feed. */
const RECIPE_FEEDS = [
	{
		name: "The Guardian",
		url: "https://www.theguardian.com/tone/recipes/rss",
	},
	// a mixed feed of reviews, news and paywalled premium items: only /recipes/ links count
	{
		name: "Good Food",
		url: "https://www.bbcgoodfood.com/feed",
		only: /\/recipes\//,
	},
	{ name: "Love and Lemons", url: "https://www.loveandlemons.com/feed/" },
];

const tag = (xml: string, name: string) =>
	new RegExp(
		`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`,
	).exec(xml)?.[1];

/** The first item of an RSS feed (the first whose link matches `only`, if given), or null. */
export function parseTopItem(
	rss: string,
	source: string,
	only?: RegExp,
): Headline | null {
	for (const [item] of rss.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
		const title = stripTags(tag(item, "title") ?? "");
		const url = httpsUrl(tag(item, "link")?.trim());
		if (title && url && (!only || only.test(url)))
			return { title, url, source };
	}
	return null;
}

async function fetchTop(
	kind: string,
	feeds: { name: string; url: string; only?: RegExp }[],
): Promise<Headline[]> {
	const items = await Promise.all(
		feeds.map((f) =>
			safe(`${kind} ${f.name}`, async () =>
				parseTopItem(
					await getText(f.url, "application/rss+xml"),
					f.name,
					f.only,
				),
			),
		),
	);
	return items.filter((h): h is Headline => h !== null);
}

export const fetchNews = () => fetchTop("news", FEEDS);
export const fetchRecipes = () => fetchTop("recipes", RECIPE_FEEDS);
