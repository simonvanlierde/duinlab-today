import { env, waitUntil } from "cloudflare:workers";
import { type Day, incomplete } from "./build";
import { cached } from "./cache";
import { configKey, site } from "./config";
import { localDay, shift } from "./day";
import { games } from "./games";
import { withAgenda } from "./sources/events";
import { fetchRecipes } from "./sources/recipes";
import { fetchSea } from "./sources/sea";
import { fetchWeather, withKnmiRain } from "./sources/weather";
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
const coordinatorName = (date: string) => `${configKey}/${date}`;

/** Each configuration has one durable coordinator per local day. */
export function refreshDay(now: Date): Promise<Day> {
  return env.DAY_COORDINATOR.getByName(coordinatorName(localDay(now))).refresh(now.toISOString());
}

function readDay(date: string): Promise<Day | null> {
  return env.DAY_COORDINATOR.getByName(coordinatorName(date)).read(date);
}

/** Yesterday's stored day, or null after its two-day retention. */
export const getYesterday = (now: Date = new Date()) => readDay(shift(localDay(now), -1));

async function getDay(now: Date): Promise<Day> {
  const stored = await readDay(localDay(now));
  const fresh =
    stored && (!incomplete(stored, hasApodKey()) || now.getTime() - Date.parse(stored.generatedAt) < RETRY_MS);
  if (stored) {
    if (!fresh) {
      waitUntil(refreshDay(now).catch((err) => console.warn(`day refresh failed: ${err}`)));
    }
    return stored;
  }
  return refreshDay(now);
}

/** The agenda job's events; it refreshes weekly, so KV's edge copy may be an hour old. */
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

/** The KNMI nowcast job's 2-hour rain steps; refreshes every few minutes. */
async function readKnmiRain() {
  try {
    return await env.DAYS.get("rain/v1", {
      type: "json",
      cacheTtl: 300,
    });
  } catch {
    return null;
  }
}

/**
 * Today, or a 503 the page can return as is. The first read of a day can fail on KV or the
 * coordinator; the next request retries.
 */
export async function todayOrUnavailable(now: Date): Promise<Today | Response> {
  try {
    return await getToday(now);
  } catch (err) {
    console.warn(`front page failed: ${err}`);
    return new Response("Today's page is unavailable for a moment. Try again in half a minute.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "30", "cache-control": "no-store" },
    });
  }
}

export async function getToday(now: Date = new Date()): Promise<Today> {
  const cache = (caches as unknown as { default: Cache }).default;
  const [day, agenda, knmiRain, weather, sea, recipes] = await Promise.all([
    getDay(now),
    site.content.events ? readAgenda() : Promise.resolve(null),
    site.content.radar === "knmi" ? readKnmiRain() : Promise.resolve(null),
    cached(
      cache,
      `weather/${localDay(now)}`,
      () => fetchWeather(now),
      (w) => (w ? WEATHER_LIFE : FAILED),
      waitUntil,
    ),
    site.content.sea
      ? cached(
          cache,
          "sea",
          () => fetchSea(),
          (x) => (x ? SEA_LIFE : FAILED),
          waitUntil,
        )
      : Promise.resolve(null),
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
    events: site.content.events ? withAgenda(day.events, agenda, day.date) : null,
    games,
    weather: withKnmiRain(weather, knmiRain, now),
    sea,
    recipes,
  };
}
