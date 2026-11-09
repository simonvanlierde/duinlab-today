import { shift } from "../day";
import type { Credit, NearYou, Sighting } from "../types";
import { getJson, safe } from "../util";

const LAT = 52.08;
const LNG = 4.3;
const RADIUS_KM = 15;
const TOP = 3;

// research grade drops unconfirmed IDs (and humans); captive=false drops zoo and garden plants
const area = (date: string) =>
	new URLSearchParams({
		lat: String(LAT),
		lng: String(LNG),
		radius: String(RADIUS_KM),
		d1: shift(date, -6),
		d2: date,
		quality_grade: "research",
		captive: "false",
	});

interface Taxon {
	id?: unknown;
	name?: unknown;
	preferred_common_name?: unknown;
}
interface Body {
	results?: { count?: unknown; taxon?: Taxon }[];
}

export function parseNearYou(body: unknown, date: string): NearYou | null {
	const results = (body as Body | null)?.results;
	if (!Array.isArray(results)) return null;
	const species: Sighting[] = [];
	for (const r of results) {
		const t = r?.taxon;
		if (
			typeof r?.count !== "number" ||
			typeof t?.id !== "number" ||
			typeof t.name !== "string"
		)
			continue;
		const common =
			typeof t.preferred_common_name === "string"
				? t.preferred_common_name
				: "";
		species.push({
			name: common || t.name,
			scientific: t.name,
			count: r.count,
			url: `https://www.inaturalist.org/taxa/${t.id}`,
		});
	}
	if (species.length === 0) return null;
	return {
		species: species.slice(0, TOP),
		url: `https://www.inaturalist.org/observations?${area(date)}&view=species`,
		credit: { name: "iNaturalist", url: "https://www.inaturalist.org" },
	};
}

export const fetchNearYou = (date: string) =>
	safe("nature", async () => {
		const q = area(date);
		q.set("locale", "en");
		q.set("per_page", String(TOP));
		return parseNearYou(
			await getJson(
				`https://api.inaturalist.org/v1/observations/species_counts?${q}`,
			),
			date,
		);
	});
