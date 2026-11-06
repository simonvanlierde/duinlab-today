import type { Moon, Sun, Weather } from "../lib/types";

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
	night: "Still dark out.",
	"first-light": "Good morning. The sky is still deciding.",
	dawn: "The sun is up, just.",
	day: "Daylight.",
	dusk: "The light is going.",
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

/** Chroma multiplier for the sky: full colour when clear, a greyer sky (not a grey one) when overcast. */
export function saturation(weather: Weather | null): number {
	if (!weather) return 1;
	const cover = Math.min(100, Math.max(0, weather.now.cloudCover)) / 100;
	return Number((1 - 0.35 * cover).toFixed(2));
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
	return wet ? `Dry until ${wet.time}` : "Dry for 2 hours";
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

/**
 * Hand-tuned sky colours by sun altitude in degrees (art direction, not physics): four
 * masthead stops from zenith to horizon (`k`), the reading ground (`g`), and whether that
 * ground is dark. Each table has a dark/light ground pair 0.01 degrees apart, so the ground
 * jumps past the middle greys where neither ink reaches AA instead of fading through them.
 */
export interface SkyStop {
	alt: number;
	k: [string, string, string, string];
	g: string;
	dark: boolean;
}

const NIGHT: SkyStop = {
	alt: -18,
	k: ["#050920", "#0b1440", "#1a2766", "#2d3a80"],
	g: "#0d1129",
	dark: true,
};
const NOON: SkyStop = {
	alt: 30,
	k: ["#1a4fa6", "#2a66c0", "#6fa5e3", "#cfe2f6"],
	g: "#f1f4f8",
	dark: false,
};

export const SKY: { morning: SkyStop[]; evening: SkyStop[] } = {
	morning: [
		NIGHT,
		{
			alt: -10,
			k: ["#070d2c", "#10195a", "#1f3488", "#3b4a9a"],
			g: "#10163a",
			dark: true,
		},
		{
			alt: -6,
			k: ["#0a1030", "#142463", "#2c4fc0", "#e9a3b3"],
			g: "#18204d",
			dark: true,
		},
		{
			alt: -2.01,
			k: ["#101c52", "#22358a", "#6b5fb8", "#f0a5a8"],
			g: "#262b62",
			dark: true,
		},
		{
			alt: -2,
			k: ["#101c52", "#22358a", "#6b5fb8", "#f0a5a8"],
			g: "#f4d9da",
			dark: false,
		},
		{
			alt: 1,
			k: ["#1c2e7c", "#3d4cb0", "#d9839f", "#f7c6b0"],
			g: "#f7e2dc",
			dark: false,
		},
		{
			alt: 6,
			k: ["#1f3f95", "#3b5fc0", "#c99ab8", "#f3d6c8"],
			g: "#f8ebe6",
			dark: false,
		},
		{
			alt: 14,
			k: ["#1d55ad", "#2c69c2", "#7fb1e8", "#d6e7f7"],
			g: "#f4f4f4",
			dark: false,
		},
		NOON,
	],
	evening: [
		NIGHT,
		{
			alt: -10,
			k: ["#0a0b2e", "#151555", "#2a2470", "#4a3a86"],
			g: "#13123a",
			dark: true,
		},
		{
			alt: -6,
			k: ["#120e3a", "#22195e", "#3d2f80", "#7a4e90"],
			g: "#1b1640",
			dark: true,
		},
		{
			alt: -2.01,
			k: ["#1e1650", "#3a2470", "#8a3f7a", "#d98a86"],
			g: "#2c2052",
			dark: true,
		},
		{
			alt: -2,
			k: ["#1e1650", "#3a2470", "#8a3f7a", "#d98a86"],
			g: "#f3d6cf",
			dark: false,
		},
		{
			alt: 1,
			k: ["#24195a", "#4a2f7c", "#b4507e", "#f2a98c"],
			g: "#f6ddd2",
			dark: false,
		},
		{
			alt: 6,
			k: ["#23338a", "#44449e", "#c27a94", "#f4c3ad"],
			g: "#f8e7df",
			dark: false,
		},
		{
			alt: 14,
			k: ["#1d55ad", "#2c69c2", "#7fb1e8", "#d6e7f7"],
			g: "#f4f4f4",
			dark: false,
		},
		NOON,
	],
};

/** A sun altitude and direction for each named phase, for `?phase=` and the white-out. */
export const PHASE_SUN: Record<SkyPhase, { alt: number; rising: boolean }> = {
	night: { alt: -20, rising: true },
	"first-light": { alt: -4, rising: true },
	dawn: { alt: 2, rising: true },
	day: { alt: 25, rising: true },
	dusk: { alt: 2, rising: false },
};

/**
 * Sun altitude in degrees over The Hague (low-precision almanac formula, good to a few
 * tenths of a degree). Self-contained: the layout inlines it into the page.
 */
export function sunAltitude(now: number): number {
	const r = Math.PI / 180;
	const d = now / 86400000 - 10957.5; // days since J2000.0
	const g = (357.529 + 0.98560028 * d) * r;
	const q = 280.459 + 0.98564736 * d;
	const lon = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r;
	const tilt = (23.439 - 0.00000036 * d) * r;
	const dec = Math.asin(Math.sin(tilt) * Math.sin(lon));
	const ra = Math.atan2(Math.cos(tilt) * Math.sin(lon), Math.cos(lon));
	const gmst = (18.697374558 + 24.06570982441908 * d) * 15 * r;
	const ha = gmst + 4.31 * r - ra;
	const lat = 52.08 * r;
	return (
		Math.asin(
			Math.sin(lat) * Math.sin(dec) +
				Math.cos(lat) * Math.cos(dec) * Math.cos(ha),
		) / r
	);
}

/**
 * CSS custom properties for a sun altitude: neighbouring stops blended in Oklab by the
 * browser (`color-mix`), so the sky moves a little every minute instead of in five steps.
 * Self-contained: the layout inlines it into the page.
 */
export function skyAt(
	alt: number,
	rising: boolean,
	table: { morning: SkyStop[]; evening: SkyStop[] },
): { vars: Record<string, string>; dark: boolean } {
	const s = rising ? table.morning : table.evening;
	let i = 0;
	while (i < s.length - 2 && alt > s[i + 1].alt) i++;
	const a = s[i];
	const b = s[i + 1];
	const t = Math.min(1, Math.max(0, (alt - a.alt) / (b.alt - a.alt)));
	const pct = `${(t * 100).toFixed(2)}%`;
	const mix = (x: string, y: string) =>
		`color-mix(in oklab, ${x}, ${y} ${pct})`;
	return {
		vars: {
			"--k0": mix(a.k[0], b.k[0]),
			"--k1": mix(a.k[1], b.k[1]),
			"--k2": mix(a.k[2], b.k[2]),
			"--k3": mix(a.k[3], b.k[3]),
			"--ground": mix(a.g, b.g),
			"--stars": String(Math.min(1, Math.max(0, (-alt - 5) / 7)).toFixed(2)),
		},
		dark: t < 0.5 ? a.dark : b.dark,
	};
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
