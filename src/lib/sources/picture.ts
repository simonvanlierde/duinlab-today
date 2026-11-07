import type { Picture } from "../types";
import {
	dayOfYear,
	getJson,
	httpsUrl,
	safe,
	seededRandom,
	upstream,
} from "../util";

interface Apod {
	title?: string;
	url?: string;
	hdurl?: string;
	thumbnail_url?: string;
	media_type?: string;
	copyright?: string;
	date?: string;
}

/** Null unless it is `date`'s picture: APOD turns over at US Eastern midnight, ~06:00 here. */
export function parseApod(a: Apod, date: string): Picture | null {
	if (a.date !== date) return null;
	const imageUrl = httpsUrl(
		a.media_type === "video"
			? a.thumbnail_url
			: a.media_type === "image"
				? a.url
				: undefined,
	);
	// The API has answered with NASA's site logo in place of the day's picture.
	if (!a.title || !imageUrl || /nasa-logo/.test(imageUrl)) return null;
	return {
		kind: "apod",
		title: a.title,
		by: a.copyright?.replace(/\s+/g, " ").trim() || null,
		date: null,
		imageUrl,
		width: null,
		height: null,
		alt: a.title,
		pageUrl: "https://science.nasa.gov/apod/",
		credit: { name: "NASA APOD", url: "https://science.nasa.gov/apod/" },
	};
}

const fetchApod = (date: string, apiKey: string | undefined) =>
	safe("apod", async () => {
		if (!apiKey) return null;
		const url = `https://api.nasa.gov/planetary/apod?thumbs=true&date=${date}&api_key=${encodeURIComponent(apiKey)}`;
		return parseApod(await getJson<Apod>(url), date);
	});

interface MetObject {
	objectID: number;
	isPublicDomain?: boolean;
	primaryImageSmall?: string;
	title?: string;
	artistDisplayName?: string;
	objectDate?: string;
	objectURL?: string;
}

export function parseMet(o: MetObject): Picture | null {
	const imageUrl = httpsUrl(o.primaryImageSmall);
	const pageUrl = httpsUrl(o.objectURL);
	if (!o.isPublicDomain || !imageUrl || !o.title || !pageUrl) return null;
	const by = o.artistDisplayName?.trim() || null;
	return {
		kind: "met",
		title: o.title,
		by,
		date: o.objectDate?.trim() || null,
		imageUrl,
		width: null,
		height: null,
		alt: by ? `${o.title}, by ${by}` : o.title,
		pageUrl,
		credit: {
			name: "The Metropolitan Museum of Art (public domain)",
			url: "https://www.metmuseum.org/art/collection",
		},
	};
}

const MET = "https://collectionapi.metmuseum.org/public/collection/v1";
const MET_SEARCH = `${MET}.1/search?isHighlight=true&hasImages=true&q=*`;
const MET_TRIES = 6;

const fetchMet = (date: string) =>
	safe("met", async () => {
		const { total } = await getJson<{ total: number }>(`${MET_SEARCH}&limit=1`);
		if (!total) return null;
		const offset = Math.floor(seededRandom(`met:${date}`)() * total);
		const { objectIDs } = await getJson<{ objectIDs: number[] | null }>(
			`${MET_SEARCH}&offset=${offset}&limit=${MET_TRIES}`,
		);
		const objects = await Promise.all(
			(objectIDs ?? []).map((id) =>
				safe("met-object", () => getJson<MetObject>(`${MET}/objects/${id}`)),
			),
		);
		for (const o of objects) {
			const p = o && parseMet(o);
			if (p) return p;
		}
		return null;
	});

/** APOD on even days of the year, The Met on odd days. */
export const preferredPicture = (date: string): Picture["kind"] =>
	dayOfYear(date) % 2 === 0 ? "apod" : "met";

/** Width and height from the header of a JPEG, PNG or GIF; null for anything else. */
export function imageSize(
	b: Uint8Array,
): { width: number; height: number } | null {
	const u16 = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
	const u32 = (i: number) => u16(i) * 65536 + u16(i + 2);
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
		return { width: u32(16), height: u32(20) };
	if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
		return {
			width: (b[6] ?? 0) | ((b[7] ?? 0) << 8),
			height: (b[8] ?? 0) | ((b[9] ?? 0) << 8),
		};
	if (b[0] !== 0xff || b[1] !== 0xd8) return null;
	// JPEG: walk the segments to the first start-of-frame marker
	let i = 2;
	while (i + 9 < b.length) {
		if (b[i] !== 0xff) return null;
		const marker = b[i + 1] ?? 0;
		if (marker === 0xff) {
			i++;
			continue;
		}
		const sof =
			marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
		if (sof) {
			const size = { width: u16(i + 7), height: u16(i + 5) };
			return size.width > 0 && size.height > 0 ? size : null;
		}
		i += 2 + u16(i + 2);
	}
	return null;
}

/** The first 128 KiB of an image: enough for the header, whether or not the host honours Range. */
async function imageHead(url: string): Promise<Uint8Array> {
	const res = await fetch(await upstream(url), {
		headers: { range: "bytes=0-131071" },
		signal: AbortSignal.timeout(5000),
	});
	if (!res.ok || !res.body)
		throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
	const reader = res.body.getReader();
	const parts: Uint8Array[] = [];
	let got = 0;
	while (got < 131072) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		got += value.length;
	}
	await reader.cancel();
	const out = new Uint8Array(got);
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

/** The Met asks for a search and then up to several objects: this caps a source, not one request. */
const SOURCE_DEADLINE_MS = 5000;

/** The source's answer, or null once `ms` have passed. */
function deadline<T>(work: Promise<T | null>, ms: number): Promise<T | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), ms);
	});
	return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** The day's preferred source; the other stands in. Its size lets the page hold the space before it loads. */
export async function fetchPicture(
	date: string,
	apiKey: string | undefined,
	deadlineMs = SOURCE_DEADLINE_MS,
): Promise<Picture | null> {
	const apod = () => fetchApod(date, apiKey);
	const met = () => fetchMet(date);
	const [first, second] =
		preferredPicture(date) === "apod" ? [apod, met] : [met, apod];
	// the stand-in is asked only when the preferred source fails or misses its deadline
	const pick =
		(await deadline(first(), deadlineMs)) ??
		(await deadline(second(), deadlineMs));
	if (!pick) return null;
	const size = await safe("picture-size", async () =>
		imageSize(await imageHead(pick.imageUrl)),
	);
	return size ? { ...pick, ...size } : pick;
}
