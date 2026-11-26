import { DurableObject, type env } from "cloudflare:workers";
import { allFailed, buildDay, type Day, incomplete, mergeDay } from "./build";
import { configKey } from "./config";
import { isoLocal, localDay, shift } from "./day";
import { httpsUrl } from "./util";

const keyFor = (date: string) => `day/v3/${configKey}/${date}`;

/** Whether every string under a `url` or `*Url` key is an https URL, so a planted mirror day can't add a `javascript:` link. */
const linksSafe = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.every(linksSafe)
    : typeof value !== "object" || value === null
      ? true
      : Object.entries(value).every(([key, v]) =>
          /^url$|Url$/.test(key) && typeof v === "string" ? !!httpsUrl(v) : linksSafe(v),
        );

/** The mirror's copy of `date`, or null when it is for another date, lacks its sections or carries an unsafe link. */
const mirrorDay = (value: unknown, date: string): Day | null => {
  const d = value as Day | null;
  return d?.date === date && Array.isArray(d.pictures) && Array.isArray(d.didYouKnow) && linksSafe(d) ? d : null;
};

/** One durable owner publishes each day; requests never read the eventually consistent mirror. */
export class DayCoordinator extends DurableObject<typeof env> {
  private building?: Promise<Day>;

  read(date: string): Promise<Day | null> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Day>("day");
      if (stored) return stored;
      // A failed mirror read must stop publication: it may conceal an existing quiz.
      const mirrored = await this.env.DAYS.get(keyFor(date), "json");
      const day = mirrorDay(mirrored, date);
      if (mirrored && !day) console.warn(`kv mirror ${date} rejected`);
      if (day) await this.save(day);
      return day;
    });
  }

  refresh(instant: string): Promise<Day> {
    if (!this.building) {
      this.building = this.rebuild(new Date(instant)).finally(() => {
        this.building = undefined;
      });
    }
    return this.building;
  }

  private async rebuild(now: Date): Promise<Day> {
    const date = localDay(now);
    const prev = await this.read(date);
    if (prev && !incomplete(prev, !!this.env.NASA_API_KEY)) return prev;
    const day = mergeDay(prev, await buildDay(date, now, this.env.NASA_API_KEY, prev));
    // Persist before returning a quiz, so a restart cannot publish a different one.
    await this.save(day);
    return day;
  }

  private async save(day: Day): Promise<void> {
    const end = shift(day.date, 2);
    const midnight = `${end}T00:00:00`;
    const initial = Date.parse(`${midnight}${isoLocal(new Date(`${midnight}Z`)).slice(-6)}`);
    const corrected = Date.parse(`${midnight}${isoLocal(new Date(initial)).slice(-6)}`);
    // Use the offset at local midnight; a forward jump can make midnight itself nonexistent.
    const boundary = localDay(new Date(corrected)) < end ? initial : corrected;
    const expiration = allFailed(day) ? Date.now() + 60_000 : boundary;
    await this.ctx.storage.transaction(async (storage) => {
      await storage.put("day", day);
      await storage.setAlarm(expiration);
    });
    try {
      await this.env.DAYS.put(keyFor(day.date), JSON.stringify(day), {
        // KV refuses an expiration less than 60 s ahead, which an all-failed day's retry is
        expiration: Math.floor(Math.max(expiration, Date.now() + 65_000) / 1000),
      });
    } catch (err) {
      console.warn(`kv mirror ${day.date} failed: ${err}`);
    }
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
