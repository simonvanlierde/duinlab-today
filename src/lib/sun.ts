import { isoAmsterdam } from "./day";
import { moonNow } from "./moon";
import type { Moon, Sun } from "./types";

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

/** When the sun passes `altitude` degrees on `date`, in the morning or the evening, in Amsterdam time. */
export const sunPasses = (date: string, altitude: number, morning: boolean) =>
	isoAmsterdam(crossing(date, 90 - altitude, morning));

/** The moon's phase and its name at `at` (see `moonNow`). */
export function moonAt(at: Date): Moon {
	const { phase, name } = moonNow(at.getTime());
	return { phase, name };
}

export const PHASES = ["night", "first-light", "dawn", "day", "dusk"] as const;
export type SkyPhase = (typeof PHASES)[number];

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
