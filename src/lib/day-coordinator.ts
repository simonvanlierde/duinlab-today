import { DurableObject, type env } from "cloudflare:workers";
import { allFailed, buildDay, type Day, incomplete, mergeDay } from "./build";
import { amsterdamDay, isoAmsterdam, shift } from "./day";

const keyFor = (date: string) => `day/v2/${date}`;

/** One durable owner publishes each day; requests never read the eventually consistent mirror. */
export class DayCoordinator extends DurableObject<typeof env> {
	private building?: Promise<Day>;

	read(date: string): Promise<Day | null> {
		return this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<Day>("day");
			if (stored) return stored;
			// A failed legacy read must stop publication: it may conceal an existing quiz.
			const legacy = await this.env.DAYS.get<Day>(keyFor(date), "json");
			if (legacy) await this.save(legacy);
			return legacy;
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
		const date = amsterdamDay(now);
		const prev = await this.read(date);
		if (prev && !incomplete(prev, !!this.env.NASA_API_KEY)) return prev;
		const day = mergeDay(
			prev,
			await buildDay(date, now, this.env.NASA_API_KEY, prev),
		);
		// Persist before returning a quiz, so a restart cannot publish a different one.
		await this.save(day);
		return day;
	}

	private async save(day: Day): Promise<void> {
		const end = shift(day.date, 2);
		const offset = isoAmsterdam(new Date(`${end}T00:00:00Z`)).slice(-6);
		const expiration = allFailed(day)
			? Date.now() + 60_000
			: Date.parse(`${end}T00:00:00${offset}`);
		await this.ctx.storage.transaction(async (storage) => {
			await storage.put("day", day);
			await storage.setAlarm(expiration);
		});
		try {
			await this.env.DAYS.put(keyFor(day.date), JSON.stringify(day), {
				expiration: Math.floor(expiration / 1000),
			});
		} catch (err) {
			console.warn(`kv mirror ${day.date} failed: ${err}`);
		}
	}

	async alarm(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}
