import type { Recipe } from "../types";
import { getText, httpsUrl, safe, stripTags } from "../util";

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
): Recipe | null {
	for (const [item] of rss.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
		const title = stripTags(tag(item, "title") ?? "");
		const url = httpsUrl(tag(item, "link")?.trim());
		if (title && url && (!only || only.test(url)))
			return { title, url, source };
	}
	return null;
}

export async function fetchRecipes(): Promise<Recipe[]> {
	const items = await Promise.all(
		RECIPE_FEEDS.map((f) =>
			safe(`recipes ${f.name}`, async () =>
				parseTopItem(
					await getText(f.url, "application/rss+xml"),
					f.name,
					f.only,
				),
			),
		),
	);
	return items.filter((h): h is Recipe => h !== null);
}
