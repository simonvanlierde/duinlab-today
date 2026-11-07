import { sunPasses } from "../lib/sky";
import type { Sun } from "../lib/types";
import { clock } from "./sky";

export type Light = "night" | "blue" | "golden" | "day";

/** Blue hour: the sun 6 to 4 degrees down. Golden hour: 4 down to 6 up. */
const BLUE = -4;
const GOLDEN = 6;

const COLOR: Record<Light, string> = {
	night: "#161c3d",
	blue: "#3f5fbf",
	golden: "#f2b45c",
	day: "#c6dcff",
};

/** Minutes after Amsterdam midnight. shortcut: a DST day has 23 or 25 hours; the band treats it as 24. */
const minutes = (iso: string) => {
	const [h, m] = clock(iso).split(":").map(Number) as [number, number];
	return h * 60 + m;
};

/** The day's light, midnight to midnight: The Hague's sun never stays above 6 degrees or below -6 all day. */
export function dayBand(date: string, sun: Sun) {
	const at = (alt: number, morning: boolean) => sunPasses(date, alt, morning);
	const edges: [Light, string][] = [
		["blue", sun.dawn],
		["golden", at(BLUE, true)],
		["day", at(GOLDEN, true)],
		["golden", at(GOLDEN, false)],
		["blue", at(BLUE, false)],
		["night", sun.dusk],
	];
	let from = 0;
	let kind: Light = "night";
	const stops: string[] = [];
	for (const [next, iso] of edges) {
		const to = (minutes(iso) / 1440) * 100;
		stops.push(`${COLOR[kind]} ${from.toFixed(2)}% ${to.toFixed(2)}%`);
		from = to;
		kind = next;
	}
	stops.push(`${COLOR[kind]} ${from.toFixed(2)}% 100%`);
	return {
		/** A CSS gradient with hard stops, one per stretch of light. */
		gradient: `linear-gradient(to right, ${stops.join(", ")})`,
		/** The evening golden hour, HH:MM to HH:MM. */
		golden: [clock(edges[3]?.[1] ?? ""), clock(edges[4]?.[1] ?? "")] as const,
	};
}
