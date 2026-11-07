import { afterEach, describe, expect, it, vi } from "vitest";
import { rainLine } from "../../src/components/sky";
import {
	allFailed,
	buildDay,
	incomplete,
	mergeDay,
	missingSections,
} from "../../src/lib/build";
import { cached } from "../../src/lib/cache";
import { parseTopItem } from "../../src/lib/sources/news";
import {
	fetchPicture,
	imageSize,
	parseApod,
	parseMet,
} from "../../src/lib/sources/picture";
import { parseQuote } from "../../src/lib/sources/quote";
import { parseQuiz } from "../../src/lib/sources/trivia";
import {
	beaufort,
	compass,
	fetchWeather,
	parseRaintext,
	parseWeather,
} from "../../src/lib/sources/weather";
import {
	fetchWikipedia,
	parseFacts,
	parseFeatured,
	parseOnThisDay,
	shortExtract,
} from "../../src/lib/sources/wikipedia";
import { parseWord } from "../../src/lib/sources/wiktionary";
import {
	dayOfYear,
	getText,
	safe,
	secondsUntilMidnight,
} from "../../src/lib/util";
import apod from "./fixtures/apod.json";
import raintext from "./fixtures/buienradar.txt?raw";
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
		// just after Amsterdam midnight the UTC-keyed feed has no entry for today yet
		expect(parseWord(wiktionary, "2026-11-07")).toBeNull();
	});

	it("rejects the APOD placeholder and uses a video thumbnail", () => {
		expect(parseApod(apod, "2026-11-06")).toBeNull();
		const video = parseApod(
			{
				date: "2026-11-06",
				title: "Eclipse",
				media_type: "video",
				url: "https://youtu.be/x",
				thumbnail_url: "https://img/t.jpg",
			},
			"2026-11-06",
		);
		expect(video?.imageUrl).toBe("https://img/t.jpg");
		expect(
			parseApod(
				{
					title: "Eclipse",
					media_type: "video",
					url: "https://youtu.be/x",
					date: "2026-11-06",
				},
				"2026-11-06",
			),
		).toBeNull();
		expect(
			parseApod(
				{
					title: "Moon",
					media_type: "image",
					url: "https://img/m.jpg",
					copyright: "A\nB ",
					date: "2026-11-06",
				},
				"2026-11-06",
			)?.by,
		).toBe("A B");
		const moon = {
			title: "Moon",
			media_type: "image",
			url: "https://img/m.jpg",
		};
		// yesterday's picture before APOD turns over, and pages that are not images
		expect(parseApod({ ...moon, date: "2026-11-05" }, "2026-11-06")).toBeNull();
		expect(
			parseApod(
				{ ...moon, media_type: "other", date: "2026-11-06" },
				"2026-11-06",
			),
		).toBeNull();
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

	it("reads the featured article, cut at a sentence or a word", () => {
		const f = parseFeatured(wikipedia);
		expect(f?.title).toBe("Bill Madden (soldier)");
		expect(f?.url).toBe("https://en.wikipedia.org/wiki/Bill_Madden_(soldier)");
		// two sentences would pass 280 characters
		expect(f?.extract).toMatch(/^Horace William Madden .* at the time\.$/);
		const long = shortExtract(`${"word ".repeat(80)}end.`);
		expect(long.length).toBeLessThanOrEqual(281);
		expect(long).toMatch(/word\u2026$/);
		expect(shortExtract("One. Two. Three.")).toBe("One. Two.");
		expect(shortExtract("Born in the U.S. in 1900. Died.")).toBe(
			"Born in the U.S. in 1900. Died.",
		);
		const page = (p: string) => ({
			tfa: { ...wikipedia.tfa, content_urls: { desktop: { page: p } } },
		});
		expect(parseFeatured(page("javascript:x"))).toBeNull();
		expect(parseFeatured({})).toBeNull();
	});

	it("reads Buienradar's radar text as mm per hour, skipping bad lines", () => {
		expect(parseRaintext(raintext)).toEqual([
			{ time: "10:05", mm: 0 },
			{ time: "10:10", mm: 0 },
			{ time: "10:15", mm: 1 },
			{ time: "10:20", mm: 10 },
			{ time: "10:25", mm: 0.1 },
		]);
		expect(rainLine(parseRaintext(raintext))).toBe("Dry until 10:15");
		// Buienradar ends its lines with CRLF; git stores the fixture with LF
		expect(parseRaintext("000|10:05\r\n141|10:10\r\n")).toEqual([
			{ time: "10:05", mm: 0 },
			{ time: "10:10", mm: 10 },
		]);
	});

	it("takes the rain from Buienradar and falls back to Open-Meteo", async () => {
		const now = new Date("2026-11-06T20:20:00Z");
		vi.stubGlobal("fetch", async (url: string) =>
			url.includes("buienradar")
				? new Response(raintext)
				: new Response(JSON.stringify(meteo)),
		);
		const radar = await fetchWeather(now);
		expect(radar?.rainCredit.name).toBe("Buienradar");
		expect(radar?.rainNext2h).toHaveLength(5);
		expect(radar?.credit.name).toBe("Open-Meteo");

		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.stubGlobal("fetch", async (url: string) =>
			url.includes("buienradar")
				? new Response("", { status: 503 })
				: new Response(JSON.stringify(meteo)),
		);
		const fallback = await fetchWeather(now);
		expect(fallback?.rainCredit.name).toBe("Open-Meteo");
		expect(fallback?.rainNext2h).toHaveLength(8);
		warn.mockRestore();
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
			if (new URL(url).host === "api.nasa.gov")
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
		expect(day.sun.sunrise).toMatch(/^2026-11-06T07:/);
		expect(allFailed(day)).toBe(false);
		// /today.json's public shape (README "Data"): a rename here breaks the digest
		expect(Object.keys(day).sort()).toEqual([
			"date",
			"didYouKnow",
			"featured",
			"generatedAt",
			"moon",
			"onThisDay",
			"picture",
			"quiz",
			"quote",
			"sun",
			"word",
		]);

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

describe("hardening", () => {
	it("drops both Wikipedia sections on a malformed feed instead of throwing", async () => {
		vi.stubGlobal("fetch", async () => new Response('{"dyk":5}'));
		expect(await fetchWikipedia("2026-11-06")).toEqual({
			didYouKnow: [],
			onThisDay: null,
			featured: null,
		});
	});

	it("keeps only https links from upstream", () => {
		const html = (href: string) => ({
			dyk: [{ html: `<b><a href="${href}">X</a></b>`, text: "... that X." }],
		});
		expect(parseFacts(html("javascript:alert(1)"))).toEqual([]);
		expect(parseFacts(html("./Foo"))).toEqual([]);
		const otd = (page: string) => ({
			onthisday: [
				{
					year: 1,
					text: "A",
					pages: [{ content_urls: { desktop: { page } } }],
				},
			],
		});
		expect(parseOnThisDay(otd("javascript:x"))).toBeNull();
		expect(parseMet({ ...metObject, objectURL: "javascript:x" })).toBeNull();
	});

	it("keeps the query string, and so the API key, out of the logged error", async () => {
		vi.stubGlobal("fetch", async () => new Response("", { status: 429 }));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await safe("apod", () =>
			getText("https://api.nasa.gov/planetary/apod?api_key=SECRET"),
		);
		expect(warn.mock.calls[0]?.[0]).toContain(
			"api.nasa.gov/planetary/apod: HTTP 429",
		);
		expect(warn.mock.calls[0]?.[0]).not.toContain("SECRET");
		warn.mockRestore();
	});

	it("says rain now when the current quarter hour is wet", () => {
		const step = (time: string, mm: number) => ({ time, mm });
		expect(rainLine([step("10:00", 0.3), step("10:15", 0)])).toBe("Rain now");
		expect(rainLine([step("10:00", 0), step("10:15", 0.2)])).toBe(
			"Dry until 10:15",
		);
	});

	it("rebuilds an incomplete day without losing what it had", () => {
		const base = {
			date: "2026-11-06", // even: APOD preferred
			generatedAt: "2026-11-05T23:05:00Z",
			picture: { kind: "met", title: "Chest" },
			onThisDay: { year: 1 },
			featured: { title: "A" },
			word: null,
			quote: { text: "old" },
			quiz: { questions: [{ question: "first draw" }] },
			didYouKnow: [{ text: "a" }],
		} as unknown as NonNullable<Parameters<typeof mergeDay>[0]>;
		expect(incomplete(base, true)).toBe(true); // word missing, and Met stands in
		expect(incomplete({ ...base, word: {} as never }, false)).toBe(false);
		const fresh = {
			...base,
			generatedAt: "2026-11-06T06:05:00Z",
			picture: { kind: "apod", title: "Moon" },
			word: { word: "dune" },
			quote: null,
			quiz: { questions: [{ question: "second draw" }] },
		} as unknown as typeof base;
		const merged = mergeDay(base, fresh);
		expect(merged.quiz?.questions[0].question).toBe("first draw");
		expect(merged.picture?.kind).toBe("apod");
		expect(merged.word?.word).toBe("dune");
		expect(merged.quote?.text).toBe("old");
		expect(merged.generatedAt).toBe("2026-11-06T06:05:00Z");
		expect(incomplete(merged, true)).toBe(false);
		expect(mergeDay({ ...base, date: "2026-11-05" }, fresh)).toBe(fresh);
	});

	it("takes the top headline of an RSS feed, CDATA or not", () => {
		const rss = `<rss><channel><title>Feed</title><item><title><![CDATA[Dykes &amp; dunes <b>hold</b>]]></title><link>https://nos.nl/a/1</link></item><item><title>Second</title><link>https://nos.nl/a/2</link></item></channel></rss>`;
		expect(parseTopItem(rss, "NOS")).toEqual({
			title: "Dykes & dunes hold",
			url: "https://nos.nl/a/1",
			source: "NOS",
		});
		expect(
			parseTopItem(
				"<item><title>x</title><link>javascript:alert(1)</link></item>",
				"X",
			),
		).toBeNull();
		expect(parseTopItem("<rss></rss>", "X")).toBeNull();
	});

	it("builds and serves the value when the cache throws", async () => {
		const cache = {
			match: async () => {
				throw new Error("down");
			},
			put: async () => {
				throw new Error("down");
			},
		} as unknown as Cache;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(
			await cached(
				cache,
				"x",
				async () => ({ n: 2 }),
				() => 60,
			),
		).toEqual({ n: 2 });
		warn.mockRestore();
	});
});

describe("imageSize", () => {
	it("reads a PNG, a GIF and a JPEG past its other segments", () => {
		const png = new Uint8Array(24);
		png.set([0x89, 0x50, 0x4e, 0x47], 0);
		png.set([0, 0, 0x07, 0x80, 0, 0, 0x04, 0x38], 16);
		expect(imageSize(png)).toEqual({ width: 1920, height: 1080 });
		const gif = new Uint8Array([
			0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02,
		]);
		expect(imageSize(gif)).toEqual({ width: 800, height: 600 });
		// SOI, an APP0 segment of 16 bytes, then SOF0: 8-bit, height 2000, width 3000
		const jpeg = new Uint8Array([
			0xff,
			0xd8,
			0xff,
			0xe0,
			0x00,
			0x10,
			...new Array(14).fill(0),
			0xff,
			0xc0,
			0x00,
			0x11,
			0x08,
			0x07,
			0xd0,
			0x0b,
			0xb8,
			0x03,
			0,
			0,
			0,
			0,
		]);
		expect(imageSize(jpeg)).toEqual({ width: 3000, height: 2000 });
	});

	it("gives null for other formats and cut-off headers", () => {
		expect(imageSize(new TextEncoder().encode("RIFF....WEBPVP8 "))).toBeNull();
		expect(
			imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])),
		).toBeNull();
	});
});
