import type { Picture } from "../types";
import { dayOfYear, getJson, httpsUrl, safe, seededRandom } from "../util";

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

/** The day's preferred source; the other stands in. */
export async function fetchPicture(
	date: string,
	apiKey: string | undefined,
): Promise<Picture | null> {
	const [apod, met] = await Promise.all([
		fetchApod(date, apiKey),
		fetchMet(date),
	]);
	return preferredPicture(date) === "apod" ? (apod ?? met) : (met ?? apod);
}
