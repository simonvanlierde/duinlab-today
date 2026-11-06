import type { Moon, Sun, Today, Weather } from "../lib/types";

export const PHASES = ["night", "first-light", "dawn", "day", "dusk"] as const;
export type SkyPhase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<SkyPhase, string> = {
	night: "night",
	"first-light": "first light",
	dawn: "dawn",
	day: "day",
	dusk: "dusk",
};

export const PHASE_LINE: Record<SkyPhase, string> = {
	night: "Still dark out. The paper is awake anyway.",
	"first-light": "Good morning. The sky is still deciding.",
	dawn: "The sun is nearly up. The coffee is ready.",
	day: "Daylight. Take a minute before it takes you.",
	dusk: "The light is going. A good time for the paper.",
};

/**
 * Phase at an instant. Self-contained on purpose: the layout inlines this function's source
 * into the page so the server and the browser clock agree.
 */
export function phaseAt(
	sun: { dawn: string; sunrise: string; sunset: string; dusk: string },
	now: number,
): SkyPhase {
	const dawn = Date.parse(sun.dawn);
	const rise = Date.parse(sun.sunrise);
	const set = Date.parse(sun.sunset);
	const dusk = Date.parse(sun.dusk);
	const half = 30 * 60 * 1000;
	if (now < dawn || now >= dusk) return "night";
	if (now < (dawn + rise) / 2) return "first-light";
	if (now < rise + half) return "dawn";
	if (now < set - half) return "day";
	return "dusk";
}

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

/** Chroma multiplier for the sky: full colour when clear, mostly grey when overcast. */
export function saturation(weather: Weather | null): number {
	if (!weather) return 1;
	const cover = Math.min(100, Math.max(0, weather.now.cloudCover)) / 100;
	return Number((1 - 0.7 * cover).toFixed(2));
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
	const wet = steps.find((s) => s.mm > 0);
	return wet ? `Dry until ${wet.time}` : "Dry for the next two hours";
}

/** The sections that exist, numbered in reading order with no gaps. */
export function numbering(t: Today): Record<string, number> {
	const present: [string, boolean][] = [
		["picture", !!t.picture],
		["didYouKnow", t.didYouKnow.length > 0],
		["word", !!t.word],
		["quiz", !!t.quiz && t.quiz.questions.length > 0],
		["games", t.games.length > 0],
		["onThisDay", !!t.onThisDay],
	];
	const out: Record<string, number> = {};
	let n = 0;
	for (const [key, ok] of present) if (ok) out[key] = ++n;
	return out;
}

/** SVG path for the lit part of the moon disc; `r` is the radius, centred on (r, r). */
export function moonPath(m: Moon, r = 9): string {
	const p = ((m.phase % 1) + 1) % 1;
	const waxing = p < 0.5;
	const k = Math.cos(p * 2 * Math.PI); // 1 new, -1 full
	const rx = Math.abs(k) * r;
	const limb = waxing ? 1 : 0;
	// the terminator bulges toward the dark side while crescent, toward the lit side while gibbous
	const term = (waxing ? 1 : 0) ^ (k > 0 ? 1 : 0) ? 1 : 0;
	return `M ${r} 0 A ${r} ${r} 0 0 ${limb} ${r} ${2 * r} A ${rx.toFixed(2)} ${r} 0 0 ${term} ${r} 0 Z`;
}

export type { Sun };
