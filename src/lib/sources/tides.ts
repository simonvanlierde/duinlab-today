import type { Credit, Tides } from "../types";
import { getText, safe } from "../util";

const URL_PAGE = "https://waterinfo.rws.nl/";
const ENDPOINT =
	"https://ddapi20-waterwebservices.rijkswaterstaat.nl/ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen";

const parts = (ms: number) =>
	Object.fromEntries(
		new Intl.DateTimeFormat("en-GB", {
			timeZone: "Europe/Amsterdam",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		})
			.formatToParts(ms)
			.map((p) => [p.type, p.value]),
	);

interface Series {
	WaarnemingenLijst?: {
		MetingenLijst?: {
			Tijdstip?: string;
			Meetwaarde?: { Waarde_Numeriek?: number };
		}[];
	}[];
}

/**
 * The source lists the predicted extremes without saying which is high and which low, so each
 * one is compared with its neighbour; the request window reaches past the day for that. The
 * offsets in `Tijdstip` are a fixed +01:00 all year, so only the instant is used, never the
 * printed clock.
 */
export function parseTides(body: string, date: string): Tides | null {
	let series: Series;
	try {
		series = JSON.parse(body) as Series;
	} catch {
		return null;
	}
	const raw = series?.WaarnemingenLijst?.[0]?.MetingenLijst;
	if (!Array.isArray(raw)) return null;
	const points = raw
		.map((m) => ({
			ms: Date.parse(m?.Tijdstip ?? ""),
			cm: m?.Meetwaarde?.Waarde_Numeriek,
		}))
		.filter((p) => Number.isFinite(p.ms) && typeof p.cm === "number")
		.sort((a, b) => a.ms - b.ms);
	const events: Tides["events"] = [];
	points.forEach((p, i) => {
		const other = points[i > 0 ? i - 1 : i + 1];
		const t = parts(p.ms);
		if (!other || `${t.year}-${t.month}-${t.day}` !== date) return;
		events.push({
			kind: (p.cm as number) > (other.cm as number) ? "high" : "low",
			at: `${t.hour}:${t.minute}`,
			heightCm: p.cm as number,
		});
	});
	return events.length
		? {
				events,
				credit: { name: "Rijkswaterstaat", url: URL_PAGE },
				url: URL_PAGE,
			}
		: null;
}

export const fetchTides = (date: string) =>
	safe("tides", async () => {
		const noon = Date.parse(`${date}T12:00:00Z`);
		const iso = (ms: number) => new Date(ms).toISOString();
		// 204 is "no data": parseTides sees an empty body and gives null
		const body = await getText(ENDPOINT, "application/json", {
			Locatie: { Code: "scheveningen" },
			AquoPlusWaarnemingMetadata: {
				AquoMetadata: {
					Compartiment: { Code: "OW" },
					Grootheid: { Code: "WATHTE" },
					ProcesType: "astronomisch",
					Groepering: { Code: "GETETBRKD2" },
				},
			},
			Periode: {
				Begindatumtijd: iso(noon - 864e5),
				Einddatumtijd: iso(noon + 864e5),
			},
		});
		return parseTides(body, date);
	});
