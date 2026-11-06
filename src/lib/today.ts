import { env } from "cloudflare:workers";
import { allFailed, buildDay, missingSections } from "./build";
import { cached } from "./cache";
import { fetchWeather } from "./sources/weather";
import type { Today } from "./types";
import { amsterdamDate, secondsUntilMidnight } from "./util";

export const WEATHER_TTL = 15 * 60;
/** A day with a source missing is rebuilt soon, so a passing outage does not last until midnight. */
const PARTIAL_TTL = 10 * 60;

export async function getToday(now: Date = new Date()): Promise<Today> {
	const date = amsterdamDate(now);
	const cache = (caches as unknown as { default: Cache }).default;
	const apiKey = env.NASA_API_KEY;
	const [day, weather] = await Promise.all([
		cached(
			cache,
			`day/${date}`,
			() => buildDay(date, now, apiKey),
			(d) =>
				allFailed(d)
					? null
					: missingSections(d) > 0
						? PARTIAL_TTL
						: secondsUntilMidnight(now),
		),
		cached(
			cache,
			"weather",
			() => fetchWeather(now),
			(w) => (w ? WEATHER_TTL : null),
		),
	]);
	return { ...day, weather };
}
