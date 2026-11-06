import type { Credit, Fact, OnThisDay } from "../types";
import { getJson, safe, stripTags } from "../util";

const CREDIT: Credit = { name: "Wikipedia", url: "https://en.wikipedia.org/" };
const GRIM =
	/\b(war|wars|killed|kills|massacre|murder|bomb|bombing|attack|battle|invasion|invaded|executed|assassinat\w*|suicide|genocide|terror\w*|shot|dead|deaths?|casualt\w*|earthquakes?|disaster|crash)\b/i;

interface Feed {
	dyk?: { html: string; text: string }[];
	onthisday?: {
		year: number;
		text: string;
		pages?: { content_urls?: { desktop?: { page?: string } } }[];
	}[];
}

export function parseFacts(feed: Feed, count = 2): Fact[] {
	const out: Fact[] = [];
	for (const item of feed.dyk ?? []) {
		// The bold link is the article the hook is about; fall back to any link.
		const url =
			/<b[^>]*>\s*<a[^>]*href="([^"]+)"/.exec(item.html)?.[1] ??
			/href="(https:[^"]+)"/.exec(item.html)?.[1];
		const text = item.text.replace(/^\.\.\. that,?\s*/, "").trim();
		if (url && text) out.push({ text, url, credit: CREDIT });
		if (out.length === count) break;
	}
	return out;
}

export function parseOnThisDay(feed: Feed): OnThisDay | null {
	const usable = (feed.onthisday ?? []).filter(
		(e) => e.pages?.[0]?.content_urls?.desktop?.page,
	);
	const pick = usable.find((e) => !GRIM.test(e.text)) ?? usable[0];
	const url = pick?.pages?.[0]?.content_urls?.desktop?.page;
	if (!pick || !url) return null;
	return { year: pick.year, text: stripTags(pick.text), url, credit: CREDIT };
}

async function feed(date: string): Promise<Feed> {
	return getJson<Feed>(
		`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${date.replaceAll("-", "/")}`,
	);
}

/** One request feeds both sections; a failure drops both. */
export async function fetchWikipedia(
	date: string,
): Promise<{ didYouKnow: Fact[]; onThisDay: OnThisDay | null }> {
	const f = await safe("wikipedia", () => feed(date));
	return {
		didYouKnow: f ? parseFacts(f) : [],
		onThisDay: f ? parseOnThisDay(f) : null,
	};
}
