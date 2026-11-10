// Server side only: astronomy-engine stays out of the browser, which gets right ascension and
// declination for the day and works out altitude itself (`planetsAt` in moon.ts).
import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import { shift } from "./day";
import { clock } from "./format";
import { sunTimes } from "./sun";

const HERE = new Observer(52.08, 4.31, 0);
const PLANETS = [
	["Mercury", Body.Mercury],
	["Venus", Body.Venus],
	["Mars", Body.Mars],
	["Jupiter", Body.Jupiter],
	["Saturn", Body.Saturn],
] as const;
const DIRECTIONS = [
	"north",
	"north-east",
	"east",
	"south-east",
	"south",
	"south-west",
	"west",
	"north-west",
];
/** Low enough to count as up, high enough to clear rooftops. */
const MIN_ALT = 5;
const STEP_MS = 10 * 60 * 1000;

interface PlanetWindow {
	name: string;
	line: string;
}

/** Name, right ascension (degrees, of date) and declination (degrees) of each bright planet at `at`. */
export function planetPositions(at: Date): [string, number, number][] {
	return PLANETS.map(([name, body]) => {
		const q = Equator(body, at, HERE, true, true);
		return [name, Number((q.ra * 15).toFixed(3)), Number(q.dec.toFixed(3))];
	});
}

/**
 * Each bright planet's name and observing sentence (e.g. "Jupiter in the east from 19:40")
 * for the dark hours between `from` and `to`, or [] when none clears 5 degrees. The direction is
 * where the planet rises, or else where it stands highest. A planet moves under two degrees a day, so one position for
 * the whole night is enough.
 */
export function planetsBetween(from: Date, to: Date): PlanetWindow[] {
	const mid = new Date((from.getTime() + to.getTime()) / 2);
	const parts: PlanetWindow[] = [];
	for (const [name, ra, dec] of planetPositions(mid)) {
		let first: { at: number; az: number } | undefined;
		let top = { alt: 0, az: 0 };
		let last = 0;
		for (let t = from.getTime(); t <= to.getTime(); t += STEP_MS) {
			const h = Horizon(new Date(t), HERE, ra / 15, dec, "normal");
			if (h.altitude < MIN_ALT) continue;
			first ??= { at: t, az: h.azimuth };
			if (h.altitude > top.alt) top = { alt: h.altitude, az: h.azimuth };
			last = t;
		}
		if (!first) continue;
		const rises = first.at - from.getTime() >= STEP_MS;
		const sets = to.getTime() - last >= STEP_MS;
		const when =
			rises && sets
				? ` from ${clock(new Date(first.at))} until ${clock(new Date(last))}`
				: rises
					? ` from ${clock(new Date(first.at))}`
					: sets
						? ` until ${clock(new Date(last))}`
						: " all night";
		const az = rises ? first.az : top.az;
		const dir = DIRECTIONS[Math.round(az / 45) % 8];
		parts.push({ name, line: `${name} in the ${dir}${when}` });
	}
	return parts;
}

/**
 * The bright planets over the dark hours of `date`'s night: the coming one in the daytime or
 * evening, the one in progress before dawn. Dark means the sun below 6 degrees (`sunTimes`'s
 * dawn and dusk); the window starts no earlier than `now`.
 */
export function planetsTonight(date: string, now: Date): PlanetWindow[] {
	const t = now.getTime();
	const dawn = Date.parse(sunTimes(date).dawn);
	const before = t < dawn;
	const start = Date.parse(sunTimes(before ? shift(date, -1) : date).dusk);
	const end = before ? dawn : Date.parse(sunTimes(shift(date, 1)).dawn);
	return planetsBetween(new Date(Math.max(t, start)), new Date(end));
}
