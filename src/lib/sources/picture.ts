import type { Picture } from "../types";
import { getJson, httpsUrl, safe, seededRandom, upstream } from "../util";

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

interface Aic {
	id?: number;
	title?: string;
	artist_display?: string;
	date_display?: string;
	image_id?: string;
	is_public_domain?: boolean;
	thumbnail?: { width?: number; height?: number; alt_text?: string };
}

export function parseAic(a: Aic): Picture | null {
	if (!a.is_public_domain || !a.image_id || !a.title || !a.id) return null;
	// "Georges Seurat (French, 1859-1891)\nmore lines": the first line is the name
	const by = a.artist_display?.split("\n")[0]?.trim() || null;
	const pageUrl = `https://www.artic.edu/artworks/${a.id}`;
	return {
		kind: "aic",
		title: a.title,
		by,
		date: a.date_display?.trim() || null,
		imageUrl: `https://www.artic.edu/iiif/2/${encodeURIComponent(a.image_id)}/full/843,/0/default.jpg`,
		width: a.thumbnail?.width ?? null,
		height: a.thumbnail?.height ?? null,
		alt: a.thumbnail?.alt_text?.trim() || a.title,
		pageUrl,
		credit: {
			name: "Art Institute of Chicago (CC0)",
			url: "https://www.artic.edu/open-access/open-access-images",
		},
	};
}

const AIC_SEARCH =
	"https://api.artic.edu/api/v1/artworks/search?query[bool][must][0][term][is_public_domain]=true&query[bool][must][1][exists][field]=image_id";
const AIC_FIELDS =
	"id,title,artist_display,date_display,image_id,is_public_domain,thumbnail";
/** The API refuses a result window past about 1000 entries. */
const AIC_WINDOW = 900;
const AIC_TRIES = 5;

const fetchAic = (date: string) =>
	safe("aic", async () => {
		const from = Math.floor(seededRandom(`aic:${date}`)() * AIC_WINDOW);
		const { data } = await getJson<{ data?: Aic[] }>(
			`${AIC_SEARCH}&from=${from}&limit=${AIC_TRIES}&fields=${AIC_FIELDS}`,
		);
		for (const a of data ?? []) {
			const p = parseAic(a);
			if (p) return p;
		}
		return null;
	});

// Linked Art: only the fields read below are typed.
interface LaName {
	content?: string;
	classified_as?: { id?: string }[];
	language?: { id?: string }[];
}
interface RijksObject {
	identified_by?: LaName[];
	produced_by?: {
		part?: {
			carried_out_by?: {
				notation?: { "@language"?: string; "@value"?: string }[];
			}[];
		}[];
		timespan?: { identified_by?: { content?: string }[] };
	};
	subject_of?: {
		digitally_carried_by?: {
			access_point?: { id?: string }[];
			format?: string;
			referred_to_by?: { content?: string }[];
		}[];
	}[];
}

const AAT_PRIMARY_TITLE = "http://vocab.getty.edu/aat/300417200";
const AAT_ENGLISH = "http://vocab.getty.edu/aat/300388277";
const PUBLIC_DOMAIN = /creativecommons\.org\/publicdomain\/(mark|zero)\//;

export function parseRijks(o: RijksObject): Picture | null {
	const carriers = (o.subject_of ?? []).flatMap(
		(s) => s.digitally_carried_by ?? [],
	);
	const licence = carriers
		.flatMap((c) => c.referred_to_by ?? [])
		.some((r) => PUBLIC_DOMAIN.test(r.content ?? ""));
	const iiif = carriers
		.flatMap((c) => c.access_point ?? [])
		.map((a) => a.id)
		.find((id) => id?.includes("/full/max/"));
	const imageUrl = httpsUrl(iiif?.replace("/full/max/", "/full/960,/"));
	const pageUrl = httpsUrl(
		carriers.find((c) => c.format === "text/html")?.access_point?.[0]?.id,
	);
	const titles = (o.identified_by ?? []).filter((n) =>
		n.classified_as?.some((c) => c.id === AAT_PRIMARY_TITLE),
	);
	const title = (
		titles.find((n) => n.language?.some((l) => l.id === AAT_ENGLISH)) ??
		titles[0]
	)?.content?.trim();
	if (!licence || !imageUrl || !pageUrl || !title) return null;
	const by =
		o.produced_by?.part
			?.flatMap((p) => p.carried_out_by ?? [])
			.flatMap((c) => c.notation ?? [])
			.find((n) => n["@language"] === "en")
			?.["@value"]?.trim() || null;
	return {
		kind: "rijks",
		title,
		by,
		date: o.produced_by?.timespan?.identified_by?.[0]?.content?.trim() || null,
		imageUrl,
		width: null,
		height: null,
		alt: by ? `${title}, by ${by}` : title,
		pageUrl,
		credit: {
			name: "Rijksmuseum (public domain)",
			url: "https://www.rijksmuseum.nl/en/rijksstudio",
		},
	};
}

const RIJKS_SEARCH =
	"https://data.rijksmuseum.nl/search/collection?imageAvailable=true&type=painting";
const RIJKS_TRIES = 4;
/** Paintings dated in these years are plentiful; a page is 100 objects of one year. */
const RIJKS_YEARS = [1550, 1899] as const;
const LD = "application/ld+json";

const fetchRijks = (date: string) =>
	safe("rijks", async () => {
		const rand = seededRandom(`rijks:${date}`);
		const year =
			RIJKS_YEARS[0] +
			Math.floor(rand() * (RIJKS_YEARS[1] - RIJKS_YEARS[0] + 1));
		const { orderedItems } = await getJson<{ orderedItems?: { id: string }[] }>(
			`${RIJKS_SEARCH}&creationDate=${year}`,
			LD,
		);
		const items = orderedItems ?? [];
		if (items.length === 0) return null;
		const start = Math.floor(rand() * items.length);
		const objects = await Promise.all(
			Array.from({ length: Math.min(RIJKS_TRIES, items.length) }, (_, i) => {
				const id = items[(start + i) % items.length]?.id;
				return safe("rijks-object", () =>
					id && httpsUrl(id)
						? getJson<RijksObject>(id, LD)
						: Promise.resolve(null),
				);
			}),
		);
		for (const o of objects) {
			const p = o && parseRijks(o);
			if (p) return p;
		}
		return null;
	});

/** The order the strip shows; a stored picture keeps its source's place. */
export const PICTURE_ORDER: Picture["kind"][] = [
	"apod",
	"met",
	"wikipedia",
	"aic",
	"rijks",
];

/** One picture per source, the first list's winning, in PICTURE_ORDER. */
export function mergePictures(...lists: Picture[][]): Picture[] {
	const byKind = new Map<Picture["kind"], Picture>();
	for (const p of lists.flat()) if (!byKind.has(p.kind)) byKind.set(p.kind, p);
	return PICTURE_ORDER.flatMap((k) => byKind.get(k) ?? []);
}

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

/**
 * The sources `have` lacks, each failing or timing out on its own. Wikipedia's picture comes
 * with its feed, not from here. A size lets the page hold the space before an image loads.
 */
export async function fetchPictures(
	date: string,
	apiKey: string | undefined,
	have: Picture["kind"][] = [],
	deadlineMs = SOURCE_DEADLINE_MS,
): Promise<Picture[]> {
	const sources: [Picture["kind"], () => Promise<Picture | null>][] = [
		["apod", () => fetchApod(date, apiKey)],
		["met", () => fetchMet(date)],
		["aic", () => fetchAic(date)],
		["rijks", () => fetchRijks(date)],
	];
	const got = await Promise.all(
		sources
			.filter(([kind]) => !have.includes(kind))
			.map(([, run]) => deadline(run(), deadlineMs)),
	);
	return Promise.all(got.flatMap((p) => (p ? [p] : [])).map(sized));
}

async function sized(p: Picture): Promise<Picture> {
	if (p.width && p.height) return p;
	const size = await safe("picture-size", async () =>
		imageSize(await imageHead(p.imageUrl)),
	);
	return size ? { ...p, ...size } : p;
}
