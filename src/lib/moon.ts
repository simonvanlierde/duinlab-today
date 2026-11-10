/**
 * Moon, bright stars and planets over The Hague. Both functions are self-contained on purpose: the
 * layout inlines their source into the page, so the server render and the browser clock agree.
 */

/**
 * The moon at `now` (ms): topocentric altitude in degrees (parallax, no refraction),
 * hour angle `h` in degrees (west positive, -180..180), phase 0..1 (0 new, 0.5 full) from
 * the sun-moon longitude difference, and the words for it. Low-precision series (the
 * suncalc / Meeus simplified terms): about 1 degree in position.
 */
export function moonNow(now: number) {
	const r = Math.PI / 180;
	const d = now / 86400000 - 10957.5; // days since J2000.0
	const lunarLon = (218.316 + 13.176396 * d) * r;
	const anomaly = (134.963 + 13.064993 * d) * r;
	const node = (93.272 + 13.22935 * d) * r;
	const lon = lunarLon + 6.289 * r * Math.sin(anomaly);
	const lat = 5.128 * r * Math.sin(node);
	const km = 385001 - 20905 * Math.cos(anomaly);
	const tilt = 23.4397 * r;
	const ra = Math.atan2(
		Math.sin(lon) * Math.cos(tilt) - Math.tan(lat) * Math.sin(tilt),
		Math.cos(lon),
	);
	const dec = Math.asin(
		Math.sin(lat) * Math.cos(tilt) +
			Math.cos(lat) * Math.sin(tilt) * Math.sin(lon),
	);
	const h = (280.16 + 360.9856235 * d + 4.31) * r - ra;
	const phi = 52.08 * r;
	const geo = Math.asin(
		Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h),
	);
	const alt = (geo - Math.asin((6378 / km) * Math.cos(geo))) / r;
	const g = (357.529 + 0.98560028 * d) * r;
	const sunLon =
		(280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) *
		r;
	const cycles = (lon - sunLon) / (2 * Math.PI);
	const phase = cycles - Math.floor(cycles);
	const names = [
		"new moon",
		"waxing crescent",
		"first quarter",
		"waxing gibbous",
		"full moon",
		"waning gibbous",
		"last quarter",
		"waning crescent",
	];
	const name = names[Math.floor(phase * 8 + 0.5) % 8] as string;
	const lit = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
	const label = name[0]?.toUpperCase() + name.slice(1);
	return {
		alt,
		h: ((((h / r) % 360) + 540) % 360) - 180,
		phase,
		name,
		label,
		line: `${label}, ${lit}% lit`,
	};
}

/**
 * The bright star highest over The Hague at `now` (ms), for a night without the moon. J2000
 * positions, not precessed: a quarter of a degree off today.
 */
export function starNow(now: number) {
	const r = Math.PI / 180;
	const d = now / 86400000 - 10957.5;
	const lst = 280.16 + 360.9856235 * d + 4.31;
	const phi = 52.08 * r;
	// name, right ascension and declination in degrees
	const stars: [string, number, number][] = [
		["Capella", 79.17, 46],
		["Vega", 279.23, 38.78],
		["Deneb", 310.36, 45.28],
		["Arcturus", 213.92, 19.18],
		["Pollux", 116.33, 28.03],
		["Aldebaran", 68.98, 16.51],
		["Sirius", 101.29, -16.72],
		["Procyon", 114.83, 5.22],
		["Betelgeuse", 88.79, 7.41],
		["Regulus", 152.09, 11.97],
		["Altair", 297.7, 8.87],
	];
	let best = { name: "", alt: -90, h: 0 };
	for (const [name, ra, dec] of stars) {
		const h = (lst - ra) * r;
		const alt =
			Math.asin(
				Math.sin(phi) * Math.sin(dec * r) +
					Math.cos(phi) * Math.cos(dec * r) * Math.cos(h),
			) / r;
		if (alt > best.alt)
			best = { name, alt, h: ((((h / r) % 360) + 540) % 360) - 180 };
	}
	return best;
}

/**
 * Altitude and hour angle (degrees) at `now` (ms) of fixed equatorial positions, for the
 * planets: the server gives right ascension (of date) and declination for the day, and a
 * planet moves under a degree a day (Mercury up to two), enough for a point in the masthead.
 */
export function planetsAt(planets: [string, number, number][], now: number) {
	const r = Math.PI / 180;
	const d = now / 86400000 - 10957.5;
	const lst = 280.16 + 360.9856235 * d + 4.31;
	const phi = 52.08 * r;
	return planets.map(([name, ra, dec]) => {
		const h = (lst - ra) * r;
		const alt =
			Math.asin(
				Math.sin(phi) * Math.sin(dec * r) +
					Math.cos(phi) * Math.cos(dec * r) * Math.cos(h),
			) / r;
		return { name, alt, h: ((((h / r) % 360) + 540) % 360) - 180 };
	});
}
