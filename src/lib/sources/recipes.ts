import type { Recipe } from "../types";
import { getText, httpsUrl, safe, stripTags } from "../util";

/** The newest recipes from each of these feeds. */
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

/** Up to three recipes from a feed, skipping invalid links, duplicates and non-recipe items. */
export function parseRecipes(
	rss: string,
	source: string,
	only?: RegExp,
): Recipe[] {
	const recipes: Recipe[] = [];
	for (const [item] of rss.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
		const title = stripTags(tag(item, "title") ?? "");
		const url = httpsUrl(tag(item, "link")?.trim());
		if (
			title &&
			url &&
			(!only || only.test(url)) &&
			!recipes.some((r) => r.url === url)
		)
			recipes.push({ title, url, source });
		if (recipes.length === 3) break;
	}
	return recipes;
}

export async function fetchRecipes(): Promise<Recipe[]> {
	const items = await Promise.all(
		RECIPE_FEEDS.map((f) =>
			safe(`recipes ${f.name}`, async () =>
				parseRecipes(
					await getText(f.url, "application/rss+xml"),
					f.name,
					f.only,
				),
			),
		),
	);
	return [0, 1, 2].flatMap((n) =>
		items.flatMap((recipes) => (recipes?.[n] ? [recipes[n]] : [])),
	);
}
