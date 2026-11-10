import { env, waitUntil } from "cloudflare:workers";
import { type Day, incomplete } from "./build";
import { cached } from "./cache";
import { amsterdamDay, shift } from "./day";
import { games } from "./games";
import { withAgenda } from "./sources/events";
import { fetchRecipes } from "./sources/recipes";
import { fetchSea } from "./sources/sea";
import { fetchWeather } from "./sources/weather";
import type { Today } from "./types";

// stale: how long past its ttl an entry is still served while a request refreshes it. Weather
// gets 2 h, after which the temperature would be wrong; recipes only change daily.
const WEATHER_LIFE = { ttl: 15 * 60, stale: 2 * 60 * 60 };
// sea temperature moves slowly: an hour, and served stale for six more
const SEA_LIFE = { ttl: 60 * 60, stale: 6 * 60 * 60 };
const RECIPES_LIFE = { ttl: 3 * 60 * 60, stale: 6 * 60 * 60 };
/** A failed fetch is retried after a minute, not on every request, and never served stale. */
const FAILED = { ttl: 60, stale: 0 };
/** A request rebuilds an incomplete day at most this often; the hourly refresh does the rest. */
const RETRY_MS = 10 * 60 * 1000;
const hasApodKey = () => !!env.NASA_API_KEY;

/** All locations use the same durable coordinator for each Amsterdam day. */
export function refreshDay(now: Date): Promise<Day> {
	return env.DAY_COORDINATOR.getByName(amsterdamDay(now)).refresh(
		now.toISOString(),
	);
}

function readDay(date: string): Promise<Day | null> {
	return env.DAY_COORDINATOR.getByName(date).read(date);
}

/** Yesterday's stored day, or null after its two-day retention. */
export const getYesterday = (now: Date = new Date()) =>
	readDay(shift(amsterdamDay(now), -1));

async function getDay(now: Date): Promise<Day> {
	const stored = await readDay(amsterdamDay(now));
	const fresh =
		stored &&
		(!incomplete(stored, hasApodKey()) ||
			now.getTime() - Date.parse(stored.generatedAt) < RETRY_MS);
	if (stored) {
		if (!fresh) {
			waitUntil(
				refreshDay(now).catch((err) =>
					console.warn(`day refresh failed: ${err}`),
				),
			);
		}
		return stored;
	}
	return refreshDay(now);
}

/** The homelab agenda job's events; it refreshes weekly, so KV's edge copy may be an hour old. */
async function readAgenda() {
	try {
		return await env.DAYS.get<Parameters<typeof withAgenda>[1]>("agenda/v1", {
			type: "json",
			cacheTtl: 3600,
		});
	} catch {
		return null;
	}
}

export async function getToday(now: Date = new Date()): Promise<Today> {
	const cache = (caches as unknown as { default: Cache }).default;
	const [day, agenda, weather, sea, recipes] = await Promise.all([
		getDay(now),
		readAgenda(),
		cached(
			cache,
			"weather",
			() => fetchWeather(new Date()),
			(w) => (w ? WEATHER_LIFE : FAILED),
			waitUntil,
		),
		cached(
			cache,
			"sea",
			() => fetchSea(),
			(x) => (x ? SEA_LIFE : FAILED),
			waitUntil,
		),
		cached(
			cache,
			"recipes",
			() => fetchRecipes(),
			(r) => (r.length > 0 ? RECIPES_LIFE : FAILED),
			waitUntil,
		),
	]);
	// games are static: added here so a change to the list shows without waiting for midnight
	return {
		...day,
		events: withAgenda(day.events, agenda, day.date),
		games,
		weather,
		sea,
		recipes,
	};
}
