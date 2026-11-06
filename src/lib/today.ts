import { env } from "cloudflare:workers";
import { buildDay, dayTtl } from "./build";
import { cached } from "./cache";
import { games } from "./games";
import { fetchWeather } from "./sources/weather";
import type { Today } from "./types";
import { amsterdamDate } from "./util";

const WEATHER_TTL = 15 * 60;
/** Failed weather is retried after a minute, not on every request. */
const FAILED_TTL = 60;

export async function getToday(now: Date = new Date()): Promise<Today> {
	const date = amsterdamDate(now);
	const cache = (caches as unknown as { default: Cache }).default;
	const apiKey = env.NASA_API_KEY;
	const [day, weather] = await Promise.all([
		cached(
			cache,
			// bump the version when the Day shape changes: entries outlive a deploy
			`day/v1/${date}`,
			() => buildDay(date, now, apiKey),
			(d) => dayTtl(d, now, !!apiKey),
		),
		cached(
			cache,
			"weather",
			() => fetchWeather(now),
			(w) => (w ? WEATHER_TTL : FAILED_TTL),
		),
	]);
	// games are static: added here so a change to the list shows without waiting for midnight
	return { ...day, games, weather };
}
