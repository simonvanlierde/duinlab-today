// Plain text for the page: times, dates and the weather and sun lines.
import { shift } from "./day";
import { sunPasses, sunTimes } from "./sun";
import type { Sun, Today, Weather } from "./types";

const TZ = "Europe/Amsterdam";

/** "HH:MM" on the Amsterdam clock, from an ISO instant or a Date. */
export function clock(at: string | Date): string {
	const d = typeof at === "string" ? new Date(at) : at;
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: TZ,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(d);
}

/** "Friday 6 November 2026" from a YYYY-MM-DD day. */
export function longDate(day: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "UTC",
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	})
		.format(new Date(`${day}T12:00:00Z`))
		.replace(",", "");
}

const BEAUFORT = [
	"calm",
	"light air",
	"light breeze",
	"gentle breeze",
	"moderate breeze",
	"fresh breeze",
	"strong breeze",
	"near gale",
	"gale",
	"strong gale",
	"storm",
	"violent storm",
	"hurricane",
];

const COMPASS: Record<string, string> = {
	N: "north",
	NE: "north-east",
	E: "east",
	SE: "south-east",
	S: "south",
	SW: "south-west",
	W: "west",
	NW: "north-west",
};

export function windLine(w: Weather["now"]): string {
	const from = COMPASS[w.windFrom] ?? w.windFrom;
	const name = BEAUFORT[Math.min(12, Math.max(0, w.windBeaufort))];
	return `Wind from the ${from}, force ${w.windBeaufort} (${name}), ${Math.round(w.windKmh)} km/h`;
}

export function rainLine(steps: Weather["rainNext2h"]): string {
	if (steps.length === 0) return "";
	// the first step is the current one: 5 minutes from Buienradar, 15 from Open-Meteo
	if ((steps[0]?.mm ?? 0) > 0) return "Rain now";
	const wet = steps.find((s) => s.mm > 0);
	return wet ? `Dry until ${wet.time}` : "Dry for 2 hours";
}

/** "9 h 18 min of daylight, −3 min": the day's length and its change since yesterday. */
export function daylight(today: Sun, yesterday: Sun): string {
	const len = (s: Sun) => Date.parse(s.sunset) - Date.parse(s.sunrise);
	const mins = Math.round(len(today) / 60000);
	const delta = Math.round((len(today) - len(yesterday)) / 60000);
	const change =
		delta === 0 ? "" : `, ${delta < 0 ? "\u2212" : "+"}${Math.abs(delta)} min`;
	return `${Math.floor(mins / 60)} h ${mins % 60} min of daylight${change}`;
}

const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1);

/** The almanac's lines and the end-of-paper sunrise, for the day `day`. */
export function sunLines(day: Pick<Today, "date" | "sun" | "moon">) {
	const lit = Math.round(
		((1 - Math.cos(2 * Math.PI * day.moon.phase)) / 2) * 100,
	);
	return {
		sunrise: clock(day.sun.sunrise),
		sunset: clock(day.sun.sunset),
		golden: clock(sunPasses(day.date, 6, false)),
		daylight: daylight(day.sun, sunTimes(shift(day.date, -1))),
		nextSunrise: clock(sunTimes(shift(day.date, 1)).sunrise),
		moonName: cap(day.moon.name),
		moon: `${cap(day.moon.name)}, ${lit}% lit`,
	};
}

/** "Today", "Tomorrow" or the short weekday ("Thu") of `day`, seen from `today` (both YYYY-MM-DD). */
export function weekday(day: string, today: string): string {
	if (day === today) return "Today";
	if (day === shift(today, 1)) return "Tomorrow";
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "UTC",
		weekday: "short",
	}).format(new Date(`${day}T12:00:00Z`));
}
