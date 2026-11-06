import type { Picture } from "../types";
import { dayOfYear, getJson, safe, seededRandom } from "../util";

interface Apod {
	title?: string;
	url?: string;
	hdurl?: string;
	thumbnail_url?: string;
	media_type?: string;
	copyright?: string;
	date?: string;
}

export function parseApod(a: Apod): Picture | null {
	const imageUrl = a.media_type === "video" ? a.thumbnail_url : a.url;
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

export const fetchApod = (apiKey: string | undefined) =>
	safe("apod", async () => {
		if (!apiKey) return null;
		const url = `https://api.nasa.gov/planetary/apod?thumbs=true&api_key=${encodeURIComponent(apiKey)}`;
		return parseApod(await getJson<Apod>(url));
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
	if (!o.isPublicDomain || !o.primaryImageSmall || !o.title || !o.objectURL)
		return null;
	const by = o.artistDisplayName?.trim() || null;
	return {
		kind: "met",
		title: o.title,
		by,
		date: o.objectDate?.trim() || null,
		imageUrl: o.primaryImageSmall,
		width: null,
		height: null,
		alt: by ? `${o.title}, by ${by}` : o.title,
		pageUrl: o.objectURL,
		credit: {
			name: "The Metropolitan Museum of Art (public domain)",
			url: "https://www.metmuseum.org/art/collection",
		},
	};
}

const MET = "https://collectionapi.metmuseum.org/public/collection/v1";
const MET_SEARCH = `${MET}.1/search?isHighlight=true&hasImages=true&q=*`;
const MET_TRIES = 6;

export const fetchMet = (date: string) =>
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

/** APOD on even days of the year, The Met on odd days; each stands in for the other. */
export async function fetchPicture(
	date: string,
	apiKey: string | undefined,
): Promise<Picture | null> {
	const [apod, met] = await Promise.all([fetchApod(apiKey), fetchMet(date)]);
	return dayOfYear(date) % 2 === 0 ? (apod ?? met) : (met ?? apod);
}
