import { afterEach, describe, expect, it, vi } from "vitest";
import meteo from "./fixtures/open-meteo.json";

const profile = vi.hoisted(() => ({
	site: { url: "https://example.org" },
	location: {
		name: "Evanston",
		latitude: 42.0451,
		longitude: -87.6877,
		timezone: "America/Chicago",
		country: "US",
	},
	content: {
		pictures: ["wikipedia"],
		tides: false,
		sea: false,
		events: false,
		radar: "none",
	},
}));
vi.mock("../../src/lib/config", () => ({
	site: profile,
	configKey: "test-city",
	usesLegacyDay: false,
}));

const { fetchWeather } = await import("../../src/lib/sources/weather");
const { fetchPictures, mergePictures } = await import(
	"../../src/lib/sources/picture"
);
const { buildDay, incomplete, mergeDay } = await import("../../src/lib/build");
const { cached } = await import("../../src/lib/cache");

afterEach(() => vi.unstubAllGlobals());

describe("city source selection", () => {
	it("requests Evanston coordinates and clocks without Dutch radar", async () => {
		const urls: URL[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | Request) => {
				const url = new URL(typeof input === "string" ? input : input.url);
				urls.push(url);
				return Response.json(
					url.hostname === "api.open-meteo.com" ? meteo : { current: {} },
				);
			}),
		);
		expect(await fetchWeather(new Date("2026-11-14T12:00:00Z"))).not.toBeNull();
		expect(urls).toHaveLength(2);
		for (const url of urls) {
			expect(url.searchParams.get("latitude")).toBe("42.0451");
			expect(url.searchParams.get("longitude")).toBe("-87.6877");
		}
		expect(urls[0]?.searchParams.get("timezone")).toBe("America/Chicago");
	});

	it("requests Utrecht's Dutch radar without inheriting Hague coordinates", async () => {
		const original = structuredClone(profile);
		try {
			Object.assign(profile.location, {
				name: "Utrecht",
				latitude: 52.0907,
				longitude: 5.1214,
				timezone: "Europe/Amsterdam",
				country: "NL",
			});
			profile.content.radar = "buienradar";
			vi.resetModules();
			const weather = await import("../../src/lib/sources/weather");
			const urls: URL[] = [];
			vi.stubGlobal(
				"fetch",
				vi.fn(async (input: string) => {
					const url = new URL(input);
					urls.push(url);
					return url.hostname === "gpsgadget.buienradar.nl"
						? new Response("0|13:00")
						: Response.json(
								url.hostname === "api.open-meteo.com" ? meteo : { current: {} },
							);
				}),
			);
			expect(
				(await weather.fetchWeather(new Date("2026-11-14T12:00:00Z")))
					?.rainCredit.name,
			).toBe("Buienradar");
			expect(
				urls.find((url) => url.hostname === "gpsgadget.buienradar.nl")?.search,
			).toBe("?lat=52.0907&lon=5.1214");
		} finally {
			Object.assign(profile.location, original.location);
			Object.assign(profile.content, original.content);
		}
	});

	it("does not request Hague feeds when assembling an inland city's complete day", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const prev = {
			date: "2026-11-14",
			pictures: [{ kind: "wikipedia" }],
			onThisDay: {},
			featured: {},
			word: {},
			quote: {},
			quiz: {},
			didYouKnow: ["fact"],
			tides: null,
			events: null,
		} as unknown as Parameters<typeof buildDay>[3];
		const day = await buildDay(
			"2026-11-14",
			new Date("2026-11-14T12:00:00Z"),
			undefined,
			prev,
		);
		expect(day).toMatchObject({ tides: null, events: null });
		expect(fetch).not.toHaveBeenCalled();
	});

	it("does not fetch or retain disabled picture providers", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		expect(await fetchPictures("2026-11-14", "unused")).toEqual([]);
		expect(fetch).not.toHaveBeenCalled();
		expect(
			mergePictures([{ kind: "apod" }, { kind: "wikipedia" }] as never),
		).toEqual([{ kind: "wikipedia" }]);
	});

	it("does not retry missing Hague-only sections or restore them from stored content", () => {
		const day = {
			date: "2026-11-14",
			pictures: [{ kind: "wikipedia" }],
			onThisDay: {},
			featured: {},
			word: {},
			quote: {},
			quiz: {},
			didYouKnow: ["fact"],
			tides: null,
			events: null,
		} as unknown as Parameters<typeof incomplete>[0];
		expect(incomplete(day, false)).toBe(false);
		expect(
			mergeDay({ ...day, tides: {} as never, events: {} as never }, day),
		).toMatchObject({ tides: null, events: null });
	});

	it("isolates cached weather by deployment configuration", async () => {
		const match = vi.fn(async (_request: Request) => undefined);
		const put = vi.fn(async () => {});
		await cached(
			{ match, put } as unknown as Cache,
			"weather/2026-11-14",
			async () => ({ city: "Evanston" }),
			() => ({ ttl: 60, stale: 0 }),
			() => {},
		);
		expect(match.mock.calls[0]?.[0].url).toBe(
			"https://example.org/__cache/test-city/weather/2026-11-14",
		);
	});
});
