import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Day } from "../../src/lib/build";

const store = new Map<string, string>();
const kv = {
	get: vi.fn(async (key: string) => {
		const v = store.get(key);
		return v ? JSON.parse(v) : null;
	}),
	put: vi.fn(async (key: string, value: string) => {
		store.set(key, value);
	}),
};
vi.mock("cloudflare:workers", () => ({
	env: { DAYS: kv, NASA_API_KEY: "" },
	waitUntil: () => {},
}));

const buildDay = vi.fn();
vi.mock("../../src/lib/build", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/build")>()),
	buildDay: (...args: unknown[]) => buildDay(...args),
}));

const { refreshDay } = await import("../../src/lib/today");

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
const storedQuiz = () => JSON.parse(store.get(KEY) ?? "null")?.quiz.id;

beforeEach(() => {
	store.clear();
	buildDay.mockReset();
});

describe("refreshDay", () => {
	it("keeps the quiz another isolate stored during the build", async () => {
		buildDay.mockImplementation(async () => {
			store.set(KEY, JSON.stringify(day("stored-meanwhile")));
			return day("ours");
		});
		await refreshDay(NOW);
		expect(storedQuiz()).toBe("stored-meanwhile");
	});

	it("builds once for concurrent requests", async () => {
		buildDay.mockResolvedValue(day("ours"));
		const [a, b] = await Promise.all([refreshDay(NOW), refreshDay(NOW)]);
		expect(buildDay).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
	});
});
