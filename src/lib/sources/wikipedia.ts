import type { Credit, Fact, Featured, OnThisDay, Picture } from "../types";
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
	image?: {
		title?: string;
		thumbnail?: { source?: string; width?: number; height?: number };
		file_page?: string;
		artist?: { text?: string };
		license?: { type?: string; url?: string };
		description?: { text?: string };
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
		// A hook starts "... that"; the feed sometimes carries a maintenance notice instead.
		const hook = /^\.{3,4}\s*that\b,?\s*/.exec(item.text);
		if (!hook) continue;
		// The bold link is the article the hook is about; fall back to any link.
		const url =
			/<b[^>]*>\s*<a[^>]*href="(https:[^"]+)"/.exec(item.html)?.[1] ??
			/href="(https:[^"]+)"/.exec(item.html)?.[1];
		const text = item.text.slice(hook[0].length).trim();
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
	const sentences: string[] = [];
	for (const { segment } of new Intl.Segmenter("en", {
		granularity: "sentence",
	}).segment(text)) {
		// Sentence segmentation can separate an author's initials from their surname.
		if (sentences.length && /\b[A-Z]\.\s*$/.test(sentences.at(-1) ?? ""))
			sentences[sentences.length - 1] += segment;
		else sentences.push(segment);
	}
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

/** The picture of the day; its file page is the credit. */
export function parseImage(feed: Feed): Picture | null {
	const i = feed.image;
	const imageUrl = httpsUrl(i?.thumbnail?.source);
	const pageUrl = httpsUrl(i?.file_page);
	// "File:Some_name.jpg" is all the feed gives as a title
	const title = i?.title
		?.replace(/^File:/, "")
		.replace(/\.\w+$/, "")
		.replaceAll("_", " ")
		.trim();
	if (!imageUrl || !pageUrl || !title) return null;
	const licence = i?.license?.type;
	const description = stripTags(i?.description?.text ?? "");
	return {
		kind: "wikipedia",
		title,
		by: i?.artist?.text?.trim() || null,
		date: null,
		imageUrl,
		width: i?.thumbnail?.width ?? null,
		height: i?.thumbnail?.height ?? null,
		alt: description ? shortExtract(description) : title,
		pageUrl,
		credit: {
			name: licence ? `Wikimedia Commons (${licence})` : "Wikimedia Commons",
			url: httpsUrl(i?.license?.url) ?? pageUrl,
		},
	};
}

async function feed(date: string): Promise<Feed> {
	return getJson<Feed>(
		`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${date.replaceAll("-", "/")}`,
	);
}

/** One request feeds all four sections; a failure drops all four. */
export async function fetchWikipedia(date: string): Promise<{
	didYouKnow: Fact[];
	onThisDay: OnThisDay | null;
	featured: Featured | null;
	image: Picture | null;
}> {
	// parsing inside `safe`: a malformed feed drops the sections, never the page
	const got = await safe("wikipedia", async () => {
		const f = await feed(date);
		return {
			didYouKnow: parseFacts(f),
			onThisDay: parseOnThisDay(f),
			featured: parseFeatured(f),
			image: parseImage(f),
		};
	});
	return (
		got ?? { didYouKnow: [], onThisDay: null, featured: null, image: null }
	);
}
