import type { Moon, Sun } from "./types";
import { isoAmsterdam } from "./util";

const LAT = 52.08;
const LON = 4.31;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** NOAA solar calculator: UTC minutes of the day when the sun crosses `zenith` degrees, for `date` (YYYY-MM-DD). */
function crossing(date: string, zenith: number, rising: boolean): Date {
	const [y, m, d] = date.split("-").map(Number) as [number, number, number];
	const noonUtc = Date.UTC(y, m - 1, d, 12);
	const jc = (noonUtc / 86400000 + 2440587.5 - 2451545) / 36525;
	const l0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
	const mean = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
	const ecc = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
	const center =
		Math.sin(rad(mean)) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
		Math.sin(rad(2 * mean)) * (0.019993 - 0.000101 * jc) +
		Math.sin(rad(3 * mean)) * 0.000289;
	const omega = 125.04 - 1934.136 * jc;
	const lambda = l0 + center - 0.00569 - 0.00478 * Math.sin(rad(omega));
	const obliq =
		23 +
		(26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60 +
		0.00256 * Math.cos(rad(omega));
	const decl = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(lambda))));
	const yy = Math.tan(rad(obliq / 2)) ** 2;
	const eqTime =
		4 *
		deg(
			yy * Math.sin(2 * rad(l0)) -
				2 * ecc * Math.sin(rad(mean)) +
				4 * ecc * yy * Math.sin(rad(mean)) * Math.cos(2 * rad(l0)) -
				0.5 * yy * yy * Math.sin(4 * rad(l0)) -
				1.25 * ecc * ecc * Math.sin(2 * rad(mean)),
		);
	const ha = deg(
		Math.acos(
			Math.cos(rad(zenith)) / (Math.cos(rad(LAT)) * Math.cos(rad(decl))) -
				Math.tan(rad(LAT)) * Math.tan(rad(decl)),
		),
	);
	const minutes = 720 - 4 * LON - eqTime + (rising ? -4 * ha : 4 * ha);
	return new Date(Date.UTC(y, m - 1, d) + minutes * 60000);
}

/** Dawn and dusk are civil twilight (sun 6 degrees down); rise and set use the standard 0.833 degrees. */
export function sunTimes(date: string): Sun {
	return {
		dawn: isoAmsterdam(crossing(date, 96, true)),
		sunrise: isoAmsterdam(crossing(date, 90.833, true)),
		sunset: isoAmsterdam(crossing(date, 90.833, false)),
		dusk: isoAmsterdam(crossing(date, 96, false)),
	};
}

const SYNODIC_DAYS = 29.530588853;
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14);
const MOON_NAMES = [
	"new moon",
	"waxing crescent",
	"first quarter",
	"waxing gibbous",
	"full moon",
	"waning gibbous",
	"last quarter",
	"waning crescent",
];

/** Mean-synodic-month phase: good to about a day, which is enough for a name. */
export function moonAt(at: Date): Moon {
	const cycles = (at.getTime() - NEW_MOON_2000) / 86400000 / SYNODIC_DAYS;
	const phase = cycles - Math.floor(cycles);
	return { phase, name: MOON_NAMES[Math.floor(phase * 8 + 0.5) % 8] as string };
}
