import { afterEach, describe, expect, it, vi } from "vitest";
import { allFailed, buildDay } from "../../src/lib/build";
import { cached } from "../../src/lib/cache";
import {
	fetchPicture,
	parseApod,
	parseMet,
} from "../../src/lib/sources/picture";
import { parseQuote } from "../../src/lib/sources/quote";
import { parseQuiz } from "../../src/lib/sources/trivia";
import { beaufort, compass, parseWeather } from "../../src/lib/sources/weather";
import { parseFacts, parseOnThisDay } from "../../src/lib/sources/wikipedia";
import { parseWord } from "../../src/lib/sources/wiktionary";
import { dayOfYear, secondsUntilMidnight } from "../../src/lib/util";
import apod from "./fixtures/apod.json";
import metObject from "./fixtures/met-object.json";
import metSearch from "./fixtures/met-search.json";
import meteo from "./fixtures/open-meteo.json";
import opentdb from "./fixtures/opentdb.json";
import wikipedia from "./fixtures/wikipedia.json";
import wiktionary from "./fixtures/wiktionary.atom?raw";
import zen from "./fixtures/zenquotes.json";

afterEach(() => vi.unstubAllGlobals());

describe("parsers", () => {
	it("takes two did-you-know items with the hook's article link", () => {
		const facts = parseFacts(wikipedia);
		expect(facts).toHaveLength(2);
		expect(facts[0]?.text).toBe(
			"Cinema '76 adopted three cats named after a series of independent Philippine films?",
		);
		expect(facts[0]?.url).toBe("https://en.wikipedia.org/wiki/Cinema_'76");
		expect(facts[1]?.text.startsWith("when Martin Lehmann")).toBe(true);
	});

	it("prefers an on-this-day item that is not about war or death", () => {
		const item = parseOnThisDay(wikipedia);
		expect(item?.year).toBe(2012);
		expect(item?.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
		const onlyGrim = {
			onthisday: wikipedia.onthisday.filter((e) => e.year === 1939),
		};
		expect(parseOnThisDay(onlyGrim)?.year).toBe(1939);
		expect(parseOnThisDay({})).toBeNull();
	});

	it("reads the word, part of speech and first sense only", () => {
		const w = parseWord(wiktionary, "2026-11-06");
		expect(w).toMatchObject({
			word: "sax",
			partOfSpeech: "noun",
			gloss: "Clipping of saxophone.",
		});
		expect(w?.url).toBe("https://en.wiktionary.org/wiki/sax");
		expect(parseWord("<feed></feed>", "2026-11-06")).toBeNull();
	});

	it("rejects the APOD placeholder and uses a video thumbnail", () => {
		expect(parseApod(apod)).toBeNull();
		const video = parseApod({
			title: "Eclipse",
			media_type: "video",
			url: "https://youtu.be/x",
			thumbnail_url: "https://img/t.jpg",
		});
		expect(video?.imageUrl).toBe("https://img/t.jpg");
		expect(
			parseApod({
				title: "Eclipse",
				media_type: "video",
				url: "https://youtu.be/x",
			}),
		).toBeNull();
		expect(
			parseApod({
				title: "Moon",
				media_type: "image",
				url: "https://img/m.jpg",
				copyright: "A\nB ",
			})?.by,
		).toBe("A B");
	});

	it("takes only public-domain Met objects with an image", () => {
		const p = parseMet(metObject);
		expect(p).toMatchObject({
			kind: "met",
			title: "Wheat Field with Cypresses",
			by: "Vincent van Gogh",
			date: "1889",
		});
		expect(parseMet({ ...metObject, isPublicDomain: false })).toBeNull();
		expect(parseMet({ ...metObject, primaryImageSmall: "" })).toBeNull();
	});

	it("decodes and shuffles the quiz the same way every time", () => {
		const a = parseQuiz(opentdb, "2026-11-06");
		const b = parseQuiz(opentdb, "2026-11-06");
		const c = parseQuiz(opentdb, "2026-11-07");
		expect(a).toEqual(b);
		expect(a?.questions).toHaveLength(5);
		expect(a?.questions[0]?.question).toBe(
			'Which Kingdom Hearts game featured the cast of "The World Ends With You"?',
		);
		for (const [i, q] of (a?.questions ?? []).entries()) {
			const raw = opentdb.results[i];
			expect(q.answers[q.correct]).toBe(
				decodeURIComponent(raw?.correct_answer ?? ""),
			);
			expect([...q.answers].sort()).toEqual(
				[raw?.correct_answer, ...(raw?.incorrect_answers ?? [])]
					.map(decodeURIComponent)
					.sort(),
			);
		}
		expect(c?.questions.map((q) => q.answers)).not.toEqual(
			a?.questions.map((q) => q.answers),
		);
		expect(
			parseQuiz({ ...opentdb, response_code: 5 }, "2026-11-06"),
		).toBeNull();
	});

	it("reads the quote and ignores the rate-limit notice", () => {
		expect(parseQuote(zen)?.author).toBe("Robert Kiyosaki");
		expect(
			parseQuote([{ q: "Too many requests.", a: "Zen Quotes" }]),
		).toBeNull();
	});

	it("maps weather to plain words, Beaufort and compass points", () => {
		const w = parseWeather(meteo, new Date("2026-11-06T20:20:00Z"));
		expect(w.now).toMatchObject({
			description: "overcast",
			windBeaufort: 2,
			windFrom: "E",
			temperatureC: 4.6,
		});
		expect(w.rainNext2h).toHaveLength(8);
		expect(w.rainNext2h[0]?.time).toBe("21:15");
		expect(w.today.maxC).toBe(9.2);
		expect([0.5, 1, 5.9, 6, 28.9, 29, 117, 118, 200].map(beaufort)).toEqual([
			0, 1, 1, 2, 4, 5, 11, 12, 12,
		]);
		expect([0, 22, 23, 90, 359, 360].map(compass)).toEqual([
			"N",
			"N",
			"NE",
			"E",
			"N",
			"N",
		]);
	});
});

describe("picture rule", () => {
	const goodApod = {
		title: "Moon",
		media_type: "image",
		url: "https://img/m.jpg",
		date: "2026-11-06",
	};
	function stubFetch(apodOk: boolean) {
		vi.stubGlobal("fetch", async (url: string) => {
			const json = (b: unknown) => new Response(JSON.stringify(b));
			if (url.includes("api.nasa.gov"))
				return apodOk ? json(goodApod) : new Response("", { status: 500 });
			if (url.includes("v1.1/search"))
				return json(
					url.includes("limit=1&") || url.endsWith("limit=1")
						? { total: 2301, objectIDs: [1] }
						: metSearch,
				);
			return json(metObject);
		});
	}

	it("uses APOD on even days and The Met on odd days", async () => {
		expect(dayOfYear("2026-11-06") % 2).toBe(0); // day 310
		stubFetch(true);
		expect((await fetchPicture("2026-11-06", "k"))?.kind).toBe("apod");
		expect((await fetchPicture("2026-11-07", "k"))?.kind).toBe("met");
	});

	it("falls back to the other source, and to null when both fail", async () => {
		stubFetch(false);
		expect((await fetchPicture("2026-11-06", "k"))?.kind).toBe("met");
		expect((await fetchPicture("2026-11-06", undefined))?.kind).toBe("met");
		vi.stubGlobal("fetch", async () => new Response("", { status: 500 }));
		expect(await fetchPicture("2026-11-06", "k")).toBeNull();
	});
});

describe("day assembly and cache", () => {
	it("drops a failing section without throwing, and flags a total failure", async () => {
		vi.stubGlobal("fetch", async (url: string) =>
			url.includes("zenquotes")
				? new Response(JSON.stringify(zen))
				: new Response("", { status: 503 }),
		);
		const day = await buildDay(
			"2026-11-06",
			new Date("2026-11-06T08:00:00Z"),
			undefined,
		);
		expect(day.quote?.author).toBe("Robert Kiyosaki");
		expect(day.picture).toBeNull();
		expect(day.didYouKnow).toEqual([]);
		expect(day.games.length).toBeGreaterThan(0);
		expect(allFailed(day)).toBe(false);

		vi.stubGlobal("fetch", async () => new Response("", { status: 503 }));
		expect(allFailed(await buildDay("2026-11-06", new Date(), undefined))).toBe(
			true,
		);
	});

	it("stores a result with its TTL, serves the hit, and skips storing when the TTL is null", async () => {
		const store = new Map<string, Response>();
		const cache = {
			match: async (r: Request) => store.get(r.url)?.clone(),
			put: async (r: Request, res: Response) => void store.set(r.url, res),
		} as unknown as Cache;
		const build = vi.fn(async () => ({ n: 1 }));
		expect(await cached(cache, "a", build, () => 60)).toEqual({ n: 1 });
		expect(await cached(cache, "a", build, () => 60)).toEqual({ n: 1 });
		expect(build).toHaveBeenCalledTimes(1);
		expect(store.values().next().value?.headers.get("cache-control")).toBe(
			"public, max-age=60",
		);
		await cached(cache, "b", build, () => null);
		expect(store.size).toBe(1);
	});

	it("counts seconds to the next Amsterdam midnight", () => {
		expect(secondsUntilMidnight(new Date("2026-11-06T22:30:00Z"))).toBe(
			30 * 60,
		); // 23:30 CET
		expect(secondsUntilMidnight(new Date("2026-07-01T22:00:00Z"))).toBe(86400); // 00:00 CEST, a new day
	});
});
