import type { Weather } from "../types";
import { getJson, safe } from "../util";

const URL =
	"https://api.open-meteo.com/v1/forecast?latitude=52.08&longitude=4.31" +
	"&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m" +
	"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
	"&minutely_15=precipitation&forecast_minutely_15=8&timezone=Europe/Amsterdam&forecast_days=1";

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
			mm: r.minutely_15.precipitation[i] as number,
		})),
		fetchedAt: fetchedAt.toISOString(),
		credit: { name: "Open-Meteo", url: "https://open-meteo.com/" },
	};
}

export const fetchWeather = (now: Date) =>
	safe("open-meteo", async () => parseWeather(await getJson<Raw>(URL), now));
