import type { SkyPhase } from "../lib/sun";
import type { Moon, Weather } from "../lib/types";

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

/** Chroma multiplier for the sky: full colour when clear, a greyer sky (not a grey one) when overcast. */
export function saturation(weather: Weather | null): number {
	if (!weather) return 1;
	const cover = Math.min(100, Math.max(0, weather.now.cloudCover)) / 100;
	return Number((1 - 0.35 * cover).toFixed(2));
}

/** SVG path for the lit part of the moon disc; `r` is the radius, centred on (r, r). Self-contained: the layout inlines it. */
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

/**
 * Where the sun, the moon and a bright star sit in the masthead, and which of them show.
 * All three share the sun's mapping: across by hour angle (the sun's own sunrise-to-sunset
 * fraction, so the moon on the meridian is where the sun is at noon) and up by altitude.
 * The sun shows while it is nearly up, the moon while it is above the horizon, the star only
 * when neither does, so the masthead always has one way into the almanac.
 * Self-contained: the layout inlines it into the page; the sky functions come in as arguments.
 */
export function bodiesAt<
	M extends { alt: number; h: number },
	S extends { alt: number; h: number },
>(
	sun: { sunrise: string; sunset: string },
	now: number,
	sunAlt: number,
	moonNow: (now: number) => M,
	starNow: (now: number) => S,
) {
	const rise = Date.parse(sun.sunrise);
	const set = Date.parse(sun.sunset);
	const across = (h: number) =>
		Math.min(1, Math.max(0, 0.5 + h / (((set - rise) / 86400000) * 360)));
	const moon = moonNow(now);
	const star = starNow(now);
	const sunShow = sunAlt > -3;
	const moonShow = moon.alt > -0.5;
	return {
		sun: {
			show: sunShow,
			alt: sunAlt,
			x: Math.min(1, Math.max(0, (now - rise) / (set - rise))),
		},
		moon: Object.assign({}, moon, { show: moonShow, x: across(moon.h) }),
		star: Object.assign({}, star, {
			show: !sunShow && !moonShow,
			x: across(star.h),
		}),
	};
}

/**
 * Hand-tuned sky colours by sun altitude in degrees (art direction, not physics): four
 * masthead stops from zenith to horizon (`k`), the reading ground (`g`), and whether that
 * ground is dark. Each table has a dark/light ground pair 0.01 degrees apart, so the ground
 * jumps past the middle greys where neither ink reaches AA instead of fading through them.
 */
interface SkyStop {
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
