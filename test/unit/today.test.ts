import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Day } from "../../src/lib/build";

const store = new Map<string, string>();
const durable = new Map<string, Day>();
const kv = {
	get: vi.fn(async (key: string) => {
		const value = store.get(key);
		return value ? JSON.parse(value) : null;
	}),
	put: vi.fn(async (key: string, value: string) => {
		store.set(key, value);
	}),
};
const storage = {
	get: vi.fn(async (key: string) => durable.get(key)),
	put: vi.fn(async (key: string, value: Day) => {
		durable.set(key, value);
	}),
	setAlarm: vi.fn(async (_at: number) => {}),
	deleteAll: vi.fn(async () => durable.clear()),
	transaction: vi.fn(
		async (
			fn: (store: {
				put(key: string, value: Day): Promise<void>;
				setAlarm(at: number): Promise<void>;
			}) => Promise<void>,
		) => fn(storage),
	),
};
const namespace = { getByName: vi.fn() };
const waitUntil = vi.fn();
vi.mock("cloudflare:workers", () => ({
	env: { DAYS: kv, DAY_COORDINATOR: namespace, NASA_API_KEY: "" },
	waitUntil: (promise: Promise<unknown>) => waitUntil(promise),
	DurableObject: class {
		constructor(
			public ctx: unknown,
			public env: unknown,
		) {}
	},
}));
const cached = vi.fn(
	async (_c: unknown, key: string): Promise<unknown> =>
		key === "recipes" ? [] : null,
);
vi.mock("../../src/lib/cache", () => ({
	cached: (c: unknown, key: string) => cached(c, key),
}));
const buildDay = vi.fn();
vi.mock("../../src/lib/build", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/build")>()),
	buildDay: (...args: unknown[]) => buildDay(...args),
}));

const { DayCoordinator } = await import("../../src/lib/day-coordinator");
const { env } = await import("cloudflare:workers");
const { refreshDay, getToday, getYesterday } = await import(
	"../../src/lib/today"
);

const NOW = new Date("2026-11-10T08:00:00Z");
const KEY = "day/v2/2026-11-10";
const day = (quiz: string) =>
	({
		date: "2026-11-10",
		generatedAt: NOW.toISOString(),
		didYouKnow: [],
		pictures: [],
		quiz: { questions: [], id: quiz },
	}) as unknown as Day;
const coordinator = () => {
	let pending = Promise.resolve();
	return new DayCoordinator(
		{
			storage,
			blockConcurrencyWhile<T>(fn: () => Promise<T>) {
				const result = pending.then(fn);
				pending = result.then(
					() => {},
					() => {},
				);
				return result;
			},
		} as unknown as DurableObjectState,
		env,
	);
};
let owner = coordinator();

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("caches", { default: {} });
	store.clear();
	durable.clear();
	buildDay.mockReset();
	owner = coordinator();
	namespace.getByName.mockImplementation(() => owner);
});

describe("canonical day publication", () => {
	it("imports the published KV quiz before filling missing sections", async () => {
		store.set(KEY, JSON.stringify(day("published")));
		buildDay.mockResolvedValue(day("replacement"));
		const result = await refreshDay(NOW);
		expect(result.quiz).toEqual(day("published").quiz);
		expect(durable.get("day")?.quiz).toEqual(result.quiz);
	});

	it("builds once across separate callers and keeps the result after a restart", async () => {
		let release!: (day: Day) => void;
		buildDay.mockReturnValue(
			new Promise<Day>((resolve) => {
				release = resolve;
			}),
		);
		const first = refreshDay(NOW);
		// Separate Worker module instances share only the named Durable Object binding.
		vi.resetModules();
		const other = await import("../../src/lib/today");
		const second = other.refreshDay(NOW);
		await vi.waitFor(() => expect(buildDay).toHaveBeenCalledTimes(1));
		release(day("first"));
		const [a, b] = await Promise.all([first, second]);
		expect(a).toEqual(b);
		expect(namespace.getByName).toHaveBeenCalledWith("2026-11-10");
		owner = coordinator();
		store.set(KEY, JSON.stringify(day("stale-mirror")));
		expect((await owner.read("2026-11-10"))?.quiz).toEqual(a.quiz);
	});

	it("does not publish a replacement when the existing day cannot be read", async () => {
		kv.get.mockRejectedValueOnce(new Error("KV unavailable"));
		buildDay.mockResolvedValue(day("replacement"));
		await expect(refreshDay(NOW)).rejects.toThrow("KV unavailable");
		expect(buildDay).not.toHaveBeenCalled();
		expect(kv.put).not.toHaveBeenCalled();
	});

	it("does not return an unpersisted quiz after a storage write fails", async () => {
		storage.put.mockRejectedValueOnce(new Error("storage unavailable"));
		buildDay.mockResolvedValue(day("replacement"));
		await expect(refreshDay(NOW)).rejects.toThrow("storage unavailable");
		expect(kv.put).not.toHaveBeenCalled();
	});

	it("serves durable content even when the KV mirror fails", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		kv.put.mockRejectedValueOnce(new Error("KV unavailable"));
		buildDay.mockResolvedValue(day("first"));
		const result = await refreshDay(NOW);
		expect((await owner.read("2026-11-10"))?.quiz).toEqual(result.quiz);
		vi.restoreAllMocks();
	});

	it("serves an incomplete stored day while retrying in the background", async () => {
		durable.set("day", {
			...day("published"),
			generatedAt: "2026-11-10T06:00:00Z",
		});
		let release!: (day: Day) => void;
		buildDay.mockReturnValue(
			new Promise<Day>((resolve) => {
				release = resolve;
			}),
		);
		const result = await getToday(NOW);
		expect(result.quiz).toEqual(day("published").quiz);
		expect(waitUntil).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(buildDay).toHaveBeenCalledTimes(1));
		release(day("replacement"));
		await waitUntil.mock.calls[0]?.[0];
		expect(durable.get("day")?.quiz).toEqual(result.quiz);
	});

	it("reads yesterday through its own canonical owner and expires after two Amsterdam days", async () => {
		store.set(
			"day/v2/2026-11-09",
			JSON.stringify({ ...day("yesterday"), date: "2026-11-09" }),
		);
		expect((await getYesterday(NOW))?.quiz).toEqual(day("yesterday").quiz);
		expect(namespace.getByName).toHaveBeenCalledWith("2026-11-09");
		expect(storage.setAlarm).toHaveBeenCalledWith(
			Date.parse("2026-11-11T00:00:00+01:00"),
		);
		await owner.alarm();
		expect(durable.size).toBe(0);
	});

	it("applies fresh rain/v1 from KV in getToday and falls back when KV throws", async () => {
		durable.set("day", day("published"));
		const baseWeather = {
			now: {
				description: "overcast",
				temperatureC: 10,
				windKmh: 12,
				windBeaufort: 3,
				windFrom: "W",
				cloudPct: 80,
			},
			today: { maxC: 12, minC: 8, rainChancePct: 20 },
			rainNext2h: [{ time: "09:00", mm: 0 }],
			rainCredit: { name: "Buienradar", url: "https://www.buienradar.nl/" },
			air: null,
			fetchedAt: NOW.toISOString(),
			credit: { name: "Open-Meteo", url: "https://open-meteo.com/" },
		};
		cached.mockImplementation(async (_c: unknown, key: string) =>
			key === "weather" ? baseWeather : key === "recipes" ? [] : null,
		);
		store.set(
			"rain/v1",
			JSON.stringify({
				issuedAt: "2026-11-10T07:55:00Z",
				steps: [{ time: "09:00", mm: 0.36 }],
			}),
		);
		const withKnmi = await getToday(NOW);
		expect(withKnmi.weather?.rainCredit.name).toBe("KNMI");
		expect(withKnmi.weather?.rainNext2h).toEqual([{ time: "09:00", mm: 0.36 }]);

		kv.get.mockImplementationOnce(async (key: string) => {
			if (key === "rain/v1") throw new Error("KV timeout");
			const value = store.get(key);
			return value ? JSON.parse(value) : null;
		});
		// readAgenda() calls kv.get("agenda/v1") first, then readKnmiRain() calls kv.get("rain/v1")
		kv.get.mockImplementation(async (key: string) => {
			if (key === "rain/v1") throw new Error("KV timeout");
			const value = store.get(key);
			return value ? JSON.parse(value) : null;
		});
		const fallback = await getToday(NOW);
		expect(fallback.weather?.rainCredit.name).toBe("Buienradar");
		cached.mockImplementation(async (_c: unknown, key: string) =>
			key === "recipes" ? [] : null,
		);
	});
});
