import type { Credit, Fact, Featured, OnThisDay } from "../types";
import { getJson, httpsUrl, safe, stripTags } from "../util";

const CREDIT: Credit = { name: "Wikipedia", url: "https://en.wikipedia.org/" };
const GRIM =
	/\b(war|wars|killed|kills|massacre|murder|bomb|bombing|attack|battle|invasion|invaded|executed|assassinat\w*|suicide|genocide|terror\w*|shot|dead|deaths?|casualt\w*|earthquakes?|disaster|crash)\b/i;

const MAX_EXTRACT = 280;

interface Feed {
	tfa?: {
		titles?: { normalized?: string };
		extract?: string;
		content_urls?: { desktop?: { page?: string } };
	};
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
			/<b[^>]*>\s*<a[^>]*href="(https:[^"]+)"/.exec(item.html)?.[1] ??
			/href="(https:[^"]+)"/.exec(item.html)?.[1];
		const text = item.text.replace(/^\.\.\. that,?\s*/, "").trim();
		if (url && text) out.push({ text, url, credit: CREDIT });
		if (out.length === count) break;
	}
	return out;
}

export function parseOnThisDay(feed: Feed): OnThisDay | null {
	const usable = (feed.onthisday ?? []).filter((e) =>
		httpsUrl(e.pages?.[0]?.content_urls?.desktop?.page),
	);
	const pick = usable.find((e) => !GRIM.test(e.text)) ?? usable[0];
	const url = pick?.pages?.[0]?.content_urls?.desktop?.page;
	if (!pick || !url) return null;
	return { year: pick.year, text: stripTags(pick.text), url, credit: CREDIT };
}

/** Up to two whole sentences within MAX_EXTRACT; a longer first sentence is cut at a word. */
export function shortExtract(text: string): string {
	const sentences = [
		...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text),
	].map((s) => s.segment);
	let out = "";
	for (const s of sentences.slice(0, 2)) {
		if ((out + s).trim().length > MAX_EXTRACT) break;
		out += s;
	}
	if (out) return out.trim();
	return `${text.slice(0, MAX_EXTRACT).replace(/\s+\S*$/, "")}…`;
}

export function parseFeatured(feed: Feed): Featured | null {
	const t = feed.tfa;
	const url = httpsUrl(t?.content_urls?.desktop?.page);
	const title = t?.titles?.normalized;
	const extract = stripTags(t?.extract ?? "");
	if (!url || !title || !extract) return null;
	return { title, extract: shortExtract(extract), url, credit: CREDIT };
}

async function feed(date: string): Promise<Feed> {
	return getJson<Feed>(
		`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${date.replaceAll("-", "/")}`,
	);
}

/** One request feeds all three sections; a failure drops all three. */
export async function fetchWikipedia(date: string): Promise<{
	didYouKnow: Fact[];
	onThisDay: OnThisDay | null;
	featured: Featured | null;
}> {
	// parsing inside `safe`: a malformed feed drops the sections, never the page
	const got = await safe("wikipedia", async () => {
		const f = await feed(date);
		return {
			didYouKnow: parseFacts(f),
			onThisDay: parseOnThisDay(f),
			featured: parseFeatured(f),
		};
	});
	return got ?? { didYouKnow: [], onThisDay: null, featured: null };
}
