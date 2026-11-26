import { type Page, test } from "@playwright/test";
import { site } from "../src/lib/config";
import { localDay } from "../src/lib/day";
import { moonNow as moonPosition, planetsAt, starNow as starPosition } from "../src/lib/moon";
import { planetPositions } from "../src/lib/planets";
import { sunAltitude } from "../src/lib/sun";

const { latitude, longitude } = site.location;
const HALF_HOUR = 1800000;

export const moonNow = (at: number) => moonPosition(at, latitude, longitude);
export const starNow = (at: number) => starPosition(at, latitude, longitude);
export const sunNow = (at: number) => sunAltitude(at, latitude, longitude);
// the page's planets come from the server's real clock; the browser clock only turns the sky under them
const planets = planetPositions(new Date());
export const planetsNow = (at: number) => planetsAt(planets, at, latitude, longitude);

/**
 * Waits out the last 90 s before the real local midnight, so the server's day cannot turn over
 * between a test reading it and loading the page; a page on the old day reloads on every paint.
 */
export async function awayFromMidnight(page: Page) {
  const soon = Date.now() + 90_000;
  if (localDay(new Date(soon)) === localDay()) return;
  test.info().setTimeout(test.info().timeout + 100_000);
  await page.waitForTimeout(soon - Date.now());
}

/** A time near the middle of `date` in the configured city, whatever its UTC offset. */
export function middayOf(date: string): number {
  const start = Date.parse(`${date}T00:00:00Z`) - 14 * 3600000;
  const at = Array.from({ length: 52 }, (_, i) => start + i * 3600000).filter(
    (at) => localDay(new Date(at)) === date,
  );
  return at[Math.floor(at.length / 2)];
}

/**
 * Pins the browser clock to the first half hour of the server's local day where `pick` holds,
 * at least an hour before local midnight so a test that runs on does not reload into the next
 * day, and returns it. The server renders with the real clock; the boot script repaints the sun,
 * moon, star and planets for the pinned time. Reduced motion keeps the orbs from gliding there
 * from the server's positions, which would stack a planet on the moon and move click targets.
 */
export async function pinSky(page: Page, pick: (at: number) => boolean): Promise<number> {
  await awayFromMidnight(page);
  const { date } = await (await page.request.get("/today.json")).json();
  const start = Date.parse(`${date}T00:00:00Z`) - 14 * 3600000;
  const local = (at: number) => localDay(new Date(at)) === date;
  const at = Array.from({ length: 104 }, (_, i) => start + i * HALF_HOUR)
    .filter((at) => local(at) && local(at + 2 * HALF_HOUR))
    .find(pick);
  if (at === undefined) throw new Error(`No sky time on ${date} fits this test`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: at });
  return at;
}

/** A planet well up on the other side of the meridian from the moon (or star), so no orb can hide it. */
export function planetApart(at: number) {
  const moon = moonNow(at);
  const orb = moon.alt > -0.5 ? moon : starNow(at);
  return planetsNow(at).some(
    (p) => p.alt > 8 && Math.abs(p.h) > 20 && Math.abs(orb.h) > 20 && Math.sign(p.h) !== Math.sign(orb.h),
  );
}

/** The moon in its first or last half hour above the horizon: low at the edge of the sky. */
export function moonAtEdge(at: number) {
  return moonNow(at).alt > 2 && (moonNow(at - HALF_HOUR).alt <= 2 || moonNow(at + HALF_HOUR).alt <= 2);
}
