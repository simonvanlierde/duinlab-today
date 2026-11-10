import type { Credit, Weather } from "../types";
import { getJson, getText, safe } from "../util";

const URL =
	"https://api.open-meteo.com/v1/forecast?latitude=52.08&longitude=4.31" +
	"&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m" +
	"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
	"&minutely_15=precipitation&forecast_minutely_15=8&timezone=Europe/Amsterdam&forecast_days=1";

const AIR =
	"https://air-quality-api.open-meteo.com/v1/air-quality?latitude=52.08&longitude=4.31" +
	"&current=european_aqi,grass_pollen,birch_pollen,alder_pollen,ragweed_pollen,mugwort_pollen";

// Buienradar's radar nowcast: 5-minute steps for the next two hours.
const RADAR =
	"https://gpsgadget.buienradar.nl/data/raintext?lat=52.08&lon=4.31";
const BUIENRADAR: Credit = {
	name: "Buienradar",
	url: "https://www.buienradar.nl/",
};
const OPEN_METEO: Credit = {
	name: "Open-Meteo",
	url: "https://open-meteo.com/",
};

const WMO: Record<number, string> = {
	0: "clear sky",
	1: "mostly clear",
	2: "partly cloudy",
	3: "overcast",
	45: "fog",
	48: "freezing fog",
	51: "light drizzle",
	53: "drizzle",
	55: "heavy drizzle",
	56: "freezing drizzle",
	57: "heavy freezing drizzle",
	61: "light rain",
	63: "rain",
	65: "heavy rain",
	66: "freezing rain",
	67: "heavy freezing rain",
	71: "light snow",
	73: "snow",
	75: "heavy snow",
	77: "snow grains",
	80: "light showers",
	81: "showers",
	82: "heavy showers",
	85: "light snow showers",
	86: "heavy snow showers",
	95: "thunderstorm",
	96: "thunderstorm with hail",
	99: "thunderstorm with heavy hail",
};

// Lower bound in km/h of Beaufort 1..12.
const BEAUFORT_FLOOR = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export const beaufort = (kmh: number) =>
	BEAUFORT_FLOOR.filter((f) => kmh >= f).length;
export const compass = (deg: number) =>
	POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] as string;

interface Raw {
	current: {
		temperature_2m: number;
		weather_code: number;
		cloud_cover: number;
		wind_speed_10m: number;
		wind_direction_10m: number;
	};
	daily: {
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_probability_max: number[];
	};
	minutely_15: { time: string[]; precipitation: number[] };
}

export function parseWeather(r: Raw, fetchedAt: Date): Weather {
	const c = r.current;
	return {
		now: {
			temperatureC: c.temperature_2m,
			code: c.weather_code,
			description: WMO[c.weather_code] ?? "unsettled",
			cloudCover: c.cloud_cover,
			windKmh: c.wind_speed_10m,
			windBeaufort: beaufort(c.wind_speed_10m),
			windFrom: compass(c.wind_direction_10m),
		},
		today: {
			maxC: r.daily.temperature_2m_max[0] as number,
			minC: r.daily.temperature_2m_min[0] as number,
			rainChanceMax: r.daily.precipitation_probability_max[0] as number,
		},
		rainNext2h: r.minutely_15.time.map((t, i) => ({
			time: t.slice(11, 16),
			// mm per quarter hour, as mm per hour like Buienradar's
			mm: (r.minutely_15.precipitation[i] as number) * 4,
		})),
		rainCredit: OPEN_METEO,
		air: null,
		fetchedAt: fetchedAt.toISOString(),
		credit: OPEN_METEO,
	};
}

/** Lines of `VVV|HH:MM`; VVV is 0-255 and mm/h = 10^((VVV-109)/32). Other lines are skipped. */
export function parseRaintext(text: string): Weather["rainNext2h"] {
	return text.split("\n").flatMap((line) => {
		const m = /^(\d{1,3})\|(\d{2}:\d{2})\s*$/.exec(line);
		if (!m) return [];
		// rounding to 0.01 mm/h turns the scale's floor (VVV 0 is 0.0004) into a dry 0
		const mm = Math.round(10 ** ((Number(m[1]) - 109) / 32) * 100) / 100;
		return [{ time: m[2] as string, mm }];
	});
}

/** European AQI from which the air counts as poor (EAQI "poor" starts at 60). */
const AQI_POOR = 60;
// Where "high" starts, in pollen/m3: MeteoSwiss's load classes ("Threshold values for pollen
// load classes of allergenic pollen types", 2024), set for daily means; olive does not grow here.
const POLLEN = [
	["grass", "grass_pollen", 50],
	["birch", "birch_pollen", 70],
	["alder", "alder_pollen", 70],
	["mugwort", "mugwort_pollen", 15],
	["ragweed", "ragweed_pollen", 11],
] as const;

type AirRaw = { current: Record<string, number | null> };

/** One short line when the air is poor or a pollen count is high, else null. */
export function airLine(r: AirRaw): string | null {
	const c = r.current;
	const aqi = c.european_aqi;
	const high = POLLEN.filter(([, key, limit]) => (c[key] ?? 0) >= limit).map(
		([name]) => name,
	);
	const parts = [
		high.length > 0 &&
			`${high.join(" and ").replace(/^./, (x) => x.toUpperCase())} pollen high today`,
		typeof aqi === "number" &&
			aqi >= AQI_POOR &&
			`Air quality poor (AQI ${Math.round(aqi)})`,
	].filter(Boolean);
	return parts.length > 0 ? parts.join(" · ") : null;
}

/** Open-Meteo for the weather; the rain line from Buienradar's radar when it answers. */
export async function fetchWeather(now: Date): Promise<Weather | null> {
	const [weather, radar, air] = await Promise.all([
		safe("open-meteo", async () => parseWeather(await getJson<Raw>(URL), now)),
		safe("buienradar", async () => {
			const steps = parseRaintext(await getText(RADAR, "text/plain"));
			if (steps.length === 0) throw new Error("no rain steps");
			return steps;
		}),
		safe("open-meteo air", async () => airLine(await getJson<AirRaw>(AIR))),
	]);
	if (!weather) return null;
	return radar
		? { ...weather, rainNext2h: radar, rainCredit: BUIENRADAR, air }
		: { ...weather, air };
}
