import { env } from "cloudflare:workers";
import { allFailed, buildDay, type Day, incomplete, mergeDay } from "./build";
import { cached } from "./cache";
import { amsterdamDay, shift } from "./day";
import { games } from "./games";
import { withAgenda } from "./sources/events";
import { fetchNews, fetchRecipes } from "./sources/news";
import { fetchWeather } from "./sources/weather";
import type { Today } from "./types";

const WEATHER_TTL = 15 * 60;
const NEWS_TTL = 30 * 60;
const RECIPES_TTL = 3 * 60 * 60;
/** A failed fetch is retried after a minute, not on every request. */
const FAILED_TTL = 60;
/** A request rebuilds an incomplete day at most this often; the hourly refresh does the rest. */
const RETRY_MS = 10 * 60 * 1000;
/** Keep two days in KV, so a day is never dropped while it is still today somewhere. */
const KEEP_SECONDS = 2 * 86400;

// bump the version when the Day shape changes: entries outlive a deploy
const keyFor = (date: string) => `day/v2/${date}`;

const hasApodKey = () => !!env.NASA_API_KEY;

/**
 * Builds the day, keeps what an earlier build of it already had, and stores it in KV. A complete
 * stored day is returned untouched. Called hourly by the cron and by a request that finds no day.
 */
export function refreshDay(now: Date): Promise<Day> {
	const date = amsterdamDay(now);
	let build = building.get(date);
	if (!build) {
		build = rebuild(date, now).finally(() => building.delete(date));
		building.set(date, build);
	}
	return build;
}

/** One build per day at a time in this isolate, so a burst of requests does not each rebuild. */
const building = new Map<string, Promise<Day>>();

async function rebuild(date: string, now: Date): Promise<Day> {
	const prev = await readDay(date);
	if (prev && !incomplete(prev, hasApodKey())) return prev;
	const built = mergeDay(
		prev,
		await buildDay(date, now, env.NASA_API_KEY, prev),
	);
	// another isolate (the cron or a request) may have stored the day during the build: its
	// sections win, so the quiz never changes under someone halfway through it
	const day = mergeDay(await readDay(date), built);
	try {
		await env.DAYS.put(keyFor(date), JSON.stringify(day), {
			// a total outage is kept a minute only, so the next request tries again
			expirationTtl: allFailed(day) ? FAILED_TTL : KEEP_SECONDS,
		});
	} catch (err) {
		console.warn(`kv put ${date} failed: ${err}`);
	}
	return day;
}

async function readDay(date: string): Promise<Day | null> {
	try {
		return await env.DAYS.get<Day>(keyFor(date), "json");
	} catch {
		return null;
	}
}

/** Yesterday's stored day, or null once KV has dropped it (it keeps two days). */
export const getYesterday = (now: Date = new Date()) =>
	readDay(shift(amsterdamDay(now), -1));

async function getDay(now: Date): Promise<Day> {
	const stored = await readDay(amsterdamDay(now));
	const fresh =
		stored &&
		(!incomplete(stored, hasApodKey()) ||
			now.getTime() - Date.parse(stored.generatedAt) < RETRY_MS);
	return fresh ? stored : refreshDay(now);
}

/** The homelab agenda job's events; it changes twice a month, so KV's edge copy may be an hour old. */
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
	const [day, agenda, weather, news, recipes] = await Promise.all([
		getDay(now),
		readAgenda(),
		cached(
			cache,
			"weather",
			() => fetchWeather(now),
			(w) => (w ? WEATHER_TTL : FAILED_TTL),
		),
		cached(
			cache,
			"news",
			() => fetchNews(),
			(n) => (n.length > 0 ? NEWS_TTL : FAILED_TTL),
		),
		cached(
			cache,
			"recipes",
			() => fetchRecipes(),
			(r) => (r.length > 0 ? RECIPES_TTL : FAILED_TTL),
		),
	]);
	// games are static: added here so a change to the list shows without waiting for midnight
	return {
		...day,
		events: withAgenda(day.events, agenda, day.date),
		games,
		weather,
		news,
		recipes,
	};
}
