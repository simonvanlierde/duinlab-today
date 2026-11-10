// Server side only (astronomy-engine). Sky events for the occasions line: full moons,
// meteor shower peaks, solstices and equinoxes, and eclipses visible from The Hague.
import {
	Body,
	Equator,
	Horizon,
	NextLocalSolarEclipse,
	NextLunarEclipse,
	Observer,
	SearchLocalSolarEclipse,
	SearchLunarEclipse,
	SearchMoonPhase,
	Seasons,
} from "astronomy-engine";
import { amsterdamDay } from "./day";
import { clock } from "./format";
import type { Occasion } from "./occasions";

const HERE = new Observer(52.08, 4.31, 0);

/** Peak dates (month, day) of the main showers; the true peak shifts by a day from year to year. */
const METEORS: [string, number, number][] = [
	["Quadrantid", 1, 3],
	["Lyrid", 4, 22],
	["Perseid", 8, 12],
	["Orionid", 10, 21],
	["Leonid", 11, 17],
	["Geminid", 12, 14],
];

const iso = (y: number, m: number, d: number) =>
	new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Every sky occasion on an Amsterdam calendar day of year `y`, unsorted. */
export function skyYear(y: number): Occasion[] {
	const out: Occasion[] = [];
	const inYear = (d: string) => d.startsWith(`${y}-`);

	for (const [name, m, d] of METEORS)
		out.push({
			date: iso(y, m, d),
			name: `${name} peak`,
			today: `${name}s peak tonight`,
		});

	const s = Seasons(y);
	for (const [at, name, today] of [
		[s.mar_equinox, "March equinox", "day and night about equal"],
		[s.jun_solstice, "June solstice", "the longest day"],
		[s.sep_equinox, "September equinox", "day and night about equal"],
		[s.dec_solstice, "December solstice", "the shortest day"],
	] as const)
		out.push({
			date: amsterdamDay(at.date),
			name,
			today: `${name}: ${today}`,
		});

	for (
		let moon = SearchMoonPhase(180, new Date(Date.UTC(y - 1, 11, 25)), 40);
		moon && amsterdamDay(moon.date) <= `${y}-12-31`;
		moon = SearchMoonPhase(180, moon.AddDays(20), 40)
	) {
		const date = amsterdamDay(moon.date);
		if (inYear(date))
			out.push({ date, name: "Full moon", today: "Full moon today" });
	}

	let lunar = SearchLunarEclipse(new Date(Date.UTC(y - 1, 11, 25)));
	for (; amsterdamDay(lunar.peak.date) <= `${y}-12-31`; ) {
		const date = amsterdamDay(lunar.peak.date);
		const moonAlt = Horizon(
			lunar.peak,
			HERE,
			...radec(Body.Moon, lunar.peak.date),
			"normal",
		).altitude;
		// a penumbral eclipse is a faint shading nobody sees
		if (inYear(date) && lunar.kind !== "penumbral" && moonAlt > 0) {
			const name = `${lunar.kind === "total" ? "Total" : "Partial"} lunar eclipse`;
			out.push({
				date,
				name,
				today: `${name}, peaking at ${clock(lunar.peak.date)}`,
			});
		}
		lunar = NextLunarEclipse(lunar.peak);
	}

	let solar = SearchLocalSolarEclipse(new Date(Date.UTC(y - 1, 11, 25)), HERE);
	for (; amsterdamDay(solar.peak.time.date) <= `${y}-12-31`; ) {
		const date = amsterdamDay(solar.peak.time.date);
		if (inYear(date) && solar.peak.altitude > 0) {
			const name = `${solar.kind[0]?.toUpperCase()}${solar.kind.slice(1)} solar eclipse`;
			out.push({
				date,
				name,
				today: `${name}, peaking at ${clock(solar.peak.time.date)}. Use eclipse glasses.`,
			});
		}
		solar = NextLocalSolarEclipse(solar.peak.time, HERE);
	}
	return out.map((o) => ({ ...o, sky: true as const }));
}

function radec(body: Body, at: Date): [number, number] {
	const q = Equator(body, at, HERE, true, true);
	return [q.ra, q.dec];
}
