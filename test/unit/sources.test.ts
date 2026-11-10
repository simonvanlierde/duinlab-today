import { afterEach, describe, expect, it, vi } from "vitest";
import { allFailed, buildDay, incomplete, mergeDay } from "../../src/lib/build";
import { cached, freshness } from "../../src/lib/cache";
import { rainLine } from "../../src/lib/format";
import {
	fetchPictures,
	imageSize,
	mergePictures,
	parseAic,
	parseApod,
	parseMet,
	parseRijks,
} from "../../src/lib/sources/picture";
import { parseQuote } from "../../src/lib/sources/quote";
import { parseRecipes } from "../../src/lib/sources/recipes";
import { parseSea } from "../../src/lib/sources/sea";
import { parseQuiz } from "../../src/lib/sources/trivia";
import {
	airLine,
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
	parseImage,
	parseOnThisDay,
	shortExtract,
} from "../../src/lib/sources/wikipedia";
import { parseWord } from "../../src/lib/sources/wiktionary";
import { getText, safe } from "../../src/lib/util";
import aic from "./fixtures/aic-search.json";
import apod from "./fixtures/apod.json";
import raintext from "./fixtures/buienradar.txt?raw";
import metObject from "./fixtures/met-object.json";
import metSearch from "./fixtures/met-search.json";
import meteo from "./fixtures/open-meteo.json";
import marine from "./fixtures/open-meteo-marine.json";
import opentdb from "./fixtures/opentdb.json";
import rijksObject from "./fixtures/rijks-object.json";
import wikipedia from "./fixtures/wikipedia.json";
import wiktionary from "./fixtures/wiktionary.atom?raw";
import zen from "./fixtures/zenquotes.json";

afterEach(() => vi.unstubAllGlobals());

describe("parsers", () => {
	it.each([null, undefined, Number.NaN])(
		"rejects invalid current weather number %s",
		(temperature) => {
			const invalid = structuredClone(meteo);
			invalid.current.temperature_2m = temperature as number;
			expect(() => parseWeather(invalid, new Date())).toThrow();
		},
	);
	it("rejects missing daily weather numbers", () => {
		const invalid = structuredClone(meteo);
		invalid.daily.temperature_2m_max = [];
		expect(() => parseWeather(invalid, new Date())).toThrow();
	});
	it("takes two did-you-know items with the hook's article link", () => {
		const facts = parseFacts(wikipedia);
		expect(facts).toHaveLength(2);
		expect(facts[0]?.text).toBe(
			"Cinema '76 adopted three cats named after a series of independent Philippine films?",
		);
		expect(facts[0]?.url).toBe("https://en.wikipedia.org/wiki/Cinema_'76");
		expect(facts[1]?.text.startsWith("when Martin Lehmann")).toBe(true);
	});

	it("skips a did-you-know item that is not a hook", () => {
		const notice = {
			text: "File:Example.jpg is not protected; either 1) Upload the file to en.wiki (see instructions), or 2) protect the file at Commons",
			html: '<a href="https://en.wikipedia.org/wiki/File:Example.jpg">File:Example.jpg</a> is not protected',
		};
		const fourDots = {
			text: ".... that the film All of Tokyo! was based on interviews?",
			html: '.... that the film <b><a href="https://en.wikipedia.org/wiki/All_of_Tokyo!">All of Tokyo!</a></b>',
		};
		const facts = parseFacts({ dyk: [notice, fourDots] });
		expect(facts.map((f) => f.text)).toEqual([
			"the film All of Tokyo! was based on interviews?",
		]);
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

	it("takes the Art Institute's public-domain artworks with an image", () => {
		const p = parseAic(aic.data[0] as never);
		expect(p).toMatchObject({
			kind: "aic",
			by: "Vincent van Gogh (Dutch, 1853\u20131890)",
			pageUrl: "https://www.artic.edu/artworks/28560",
			width: 12614,
			height: 9875,
		});
		expect(p?.imageUrl).toBe(
			"https://www.artic.edu/iiif/2/6644829f-f292-c5c4-a73c-0356a6fdbf0d/full/843,/0/default.jpg",
		);
		const a = aic.data[0] as never;
		expect(parseAic({ ...(a as object), is_public_domain: false })).toBeNull();
		expect(parseAic({ ...(a as object), image_id: undefined })).toBeNull();
		// only the artist's first line is a name
		expect(
			parseAic({ ...(a as object), artist_display: "Name\nBorn here" })?.by,
		).toBe("Name");
	});

	it("takes a public-domain Rijksmuseum object and sizes its IIIF image", () => {
		const p = parseRijks(rijksObject);
		expect(p).toMatchObject({
			kind: "rijks",
			title: "Misty Sea",
			by: "Jan Toorop",
			date: "1899",
		});
		expect(p?.imageUrl).toBe(
			"https://iiif.micr.io/mPymb/full/960,/0/default.jpg",
		);
		expect(p?.pageUrl).toMatch(/^https:\/\/www\.rijksmuseum\.nl\//);
		const noLicence = structuredClone(rijksObject);
		for (const c of noLicence.subject_of[0]?.digitally_carried_by ?? [])
			c.referred_to_by = [];
		expect(parseRijks(noLicence)).toBeNull();
		expect(parseRijks({})).toBeNull();
	});

	it("takes the Wikipedia picture of the day with its file page and licence", () => {
		const p = parseImage(wikipedia);
		expect(p?.kind).toBe("wikipedia");
		expect(p?.pageUrl).toMatch(
			/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
		);
		expect(p?.title).not.toMatch(/^File:|\.jpg$/);
		expect(p?.credit.name).toMatch(/^Wikimedia Commons \(CC /);
		expect(p?.width).toBeGreaterThan(0);
		expect(parseImage({})).toBeNull();
		expect(
			parseImage({
				image: { ...wikipedia.image, file_page: "javascript:x" },
			}),
		).toBeNull();
	});

	it("decodes and shuffles the quiz the same way every time", () => {
		const a = parseQuiz(opentdb, "2026-11-06");
		const b = parseQuiz(opentdb, "2026-11-06");
		const c = parseQuiz(opentdb, "2026-11-07");
		expect(a).toEqual(b);
		expect(a?.questions).toHaveLength(3);
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

	it("keeps initials inside featured article sentences", () => {
		const sentence =
			"Regulus is an oil painting by the English artist J. M. W. Turner, first exhibited in 1828.";
		expect(
			shortExtract(`${sentence} It depicts a harbour. A third sentence.`),
		).toBe(`${sentence} It depicts a harbour.`);
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

	it("flags poor air and high pollen, and nothing below the thresholds", () => {
		const air = (current: Record<string, number | null>) =>
			airLine({ current });
		expect(
			air({ european_aqi: 59, grass_pollen: 49, birch_pollen: 69 }),
		).toBeNull();
		expect(air({ european_aqi: 60 })).toBe("Air quality poor (AQI 60)");
		expect(air({ european_aqi: 30, grass_pollen: 50 })).toBe(
			"Grass pollen high today",
		);
		expect(
			air({ birch_pollen: 70, alder_pollen: 400, grass_pollen: null }),
		).toBe("Birch and alder pollen high today");
		expect(air({ european_aqi: 72, mugwort_pollen: 25 })).toBe(
			"Mugwort pollen high today · Air quality poor (AQI 72)",
		);
		expect(air({})).toBeNull();
	});

	it("reads the sea temperature and wave height, each of which may be missing", () => {
		expect(parseSea(marine)).toMatchObject({
			temperatureC: 11.6,
			waveHeightM: 0.1,
			credit: { name: "Open-Meteo" },
		});
		expect(
			parseSea({
				current: { wave_height: 0.4, sea_surface_temperature: null },
			}),
		).toMatchObject({ temperatureC: null, waveHeightM: 0.4 });
		expect(
			parseSea({
				current: { wave_height: null, sea_surface_temperature: null },
			}),
		).toBeNull();
		expect(parseSea({})).toBeNull();
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

describe("pictures", () => {
	const goodApod = {
		title: "Moon",
		media_type: "image",
		url: "https://img/m.jpg",
		date: "2026-11-06",
	};
	const json = (b: unknown) => new Response(JSON.stringify(b));
	/** Every picture source answers from its fixture; `apodOk` false makes APOD fail. */
	function stubFetch(apodOk = true, hosts: string[] = []) {
		vi.stubGlobal("fetch", async (url: string) => {
			const u = new URL(url);
			hosts.push(u.host);
			if (u.host === "api.nasa.gov")
				return apodOk ? json(goodApod) : new Response("", { status: 500 });
			if (u.host === "api.artic.edu") return json(aic);
			if (u.host === "data.rijksmuseum.nl")
				return json({ orderedItems: [{ id: "https://id.rijksmuseum.nl/1" }] });
			if (u.host === "id.rijksmuseum.nl") return json(rijksObject);
			if (u.host === "collectionapi.metmuseum.org")
				return u.pathname.includes("/search")
					? json(
							u.search.includes("limit=1&") || u.search.endsWith("limit=1")
								? { total: 2301, objectIDs: [1] }
								: metSearch,
						)
					: json(metObject);
			return new Response("", { status: 404 }); // image size lookups
		});
	}

	it("asks every source and returns what answered, one per source", async () => {
		stubFetch();
		const got = await fetchPictures("2026-11-06", "k");
		expect(got.map((p) => p.kind).sort()).toEqual([
			"aic",
			"apod",
			"met",
			"rijks",
		]);
	});

	it("picks the same artwork for the same date and skips sources already held", async () => {
		const hosts: string[] = [];
		stubFetch(true, hosts);
		const one = await fetchPictures("2026-11-06", undefined);
		expect(one.map((p) => p.kind)).toEqual(["met", "aic", "rijks"]);
		expect(await fetchPictures("2026-11-06", undefined)).toEqual(one);
		hosts.length = 0;
		await fetchPictures("2026-11-06", "k", ["met", "aic", "rijks"]);
		expect(hosts.filter((h) => h !== "img")).toEqual(["api.nasa.gov"]);
	});

	it("lets each source fail or hang on its own", async () => {
		stubFetch(false);
		expect((await fetchPictures("2026-11-06", "k")).map((p) => p.kind)).toEqual(
			["met", "aic", "rijks"],
		);
		vi.stubGlobal("fetch", async () => new Response("", { status: 500 }));
		expect(await fetchPictures("2026-11-06", "k")).toEqual([]);
		// APOD hangs: the others come back once the deadline passes
		vi.stubGlobal("fetch", async (url: string) => {
			if (new URL(url).host === "api.nasa.gov")
				return new Promise<Response>(() => {});
			return new Response("", { status: 500 });
		});
		expect(await fetchPictures("2026-11-06", "k", [], 50)).toEqual([]);
	});

	it("keeps a stored picture and orders the strip by source", () => {
		const pic = (kind: string, title: string) =>
			({ kind, title }) as unknown as Parameters<
				typeof mergePictures
			>[0][number];
		const merged = mergePictures(
			[pic("aic", "stored"), pic("met", "stored")],
			[pic("apod", "new"), pic("aic", "reshuffled"), pic("rijks", "new")],
			[pic("wikipedia", "new")],
		);
		expect(merged.map((p) => `${p.kind}:${p.title}`)).toEqual([
			"apod:new",
			"met:stored",
			"wikipedia:new",
			"aic:stored",
			"rijks:new",
		]);
	});
});

describe("day assembly and cache", () => {
	it("asks only the sources whose section the stored day lacks", async () => {
		const hosts: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => {
			hosts.push(new URL(url).host);
			return new Response("", { status: 503 });
		});
		const prev = {
			date: "2026-11-06",
			pictures: [{ kind: "apod" }],
			didYouKnow: [{ text: "a" }],
			onThisDay: { year: 1 },
			featured: { title: "A" },
			word: { word: "dune" },
			quote: { text: "q" },
			quiz: { questions: [] },
			tides: { events: [] },
			events: null,
		} as unknown as Parameters<typeof buildDay>[3];
		const day = await buildDay("2026-11-06", new Date(), "k", prev);
		// the sources that no stored picture covers are asked too
		expect(hosts.sort()).toEqual([
			"api.artic.edu",
			"api.wikimedia.org",
			"collectionapi.metmuseum.org",
			"data.rijksmuseum.nl",
			"www.paard.nl",
		]);
		expect(day.quiz).toBe(prev?.quiz);
		// APOD missing from the stored pictures is asked again
		hosts.length = 0;
		await buildDay("2026-11-06", new Date(), "k", {
			...prev,
			pictures: [{ kind: "met" }],
		} as unknown as typeof prev);
		expect(hosts).toContain("api.nasa.gov");
	});

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
		expect(day.pictures).toEqual([]);
		expect(day.didYouKnow).toEqual([]);
		expect(day.sun.sunrise).toMatch(/^2026-11-06T07:/);
		expect(allFailed(day)).toBe(false);
		// /today.json's public shape (README "Data"): a rename here breaks the digest
		expect(Object.keys(day).sort()).toEqual([
			"date",
			"didYouKnow",
			"events",
			"featured",
			"generatedAt",
			"moon",
			"onThisDay",
			"pictures",
			"quiz",
			"quote",
			"sun",
			"tides",
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
		const life = () => ({ ttl: 60, stale: 120 });
		const later = vi.fn();
		expect(await cached(cache, "a", build, life, later)).toEqual({ n: 1 });
		expect(await cached(cache, "a", build, life, later)).toEqual({ n: 1 });
		expect(build).toHaveBeenCalledTimes(1);
		expect(later).not.toHaveBeenCalled();
		expect(store.values().next().value?.headers.get("cache-control")).toBe(
			"public, max-age=180",
		);
		await cached(cache, "b", build, () => null, later);
		expect(store.size).toBe(1);
	});

	it("decides fresh, stale and expired from the age", () => {
		const life = { ttl: 60, stale: 120 };
		expect(freshness(59_000, life)).toBe("fresh");
		expect(freshness(60_000, life)).toBe("stale");
		expect(freshness(179_000, life)).toBe("stale");
		expect(freshness(180_000, life)).toBe("expired");
		expect(freshness(60_000, { ttl: 60, stale: 0 })).toBe("expired");
	});

	it("serves a stale entry and refreshes it behind the response, once", async () => {
		const store = new Map<string, Response>();
		const cache = {
			match: async (r: Request) => store.get(r.url)?.clone(),
			put: async (r: Request, res: Response) => void store.set(r.url, res),
		} as unknown as Cache;
		const life = () => ({ ttl: 60, stale: 3600 });
		let n = 0;
		let release = () => {};
		const gate = new Promise<void>((r) => (release = r));
		const build = vi.fn(async () => {
			if (n > 0) await gate;
			return { n: ++n };
		});
		const jobs: Promise<unknown>[] = [];
		const later = (p: Promise<unknown>) => void jobs.push(p);
		vi.useFakeTimers();
		try {
			expect(await cached(cache, "s", build, life, later)).toEqual({ n: 1 });
			vi.advanceTimersByTime(90_000);
			expect(await cached(cache, "s", build, life, later)).toEqual({ n: 1 });
			expect(await cached(cache, "s", build, life, later)).toEqual({ n: 1 });
			expect(jobs).toHaveLength(1);
			release();
			await Promise.all(jobs);
			expect(await cached(cache, "s", build, life, later)).toEqual({ n: 2 });
			// past the stale window the request builds the value itself
			vi.advanceTimersByTime(3_700_000);
			expect(await cached(cache, "s", build, life, later)).toEqual({ n: 3 });
			expect(jobs).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("hardening", () => {
	it("drops every Wikipedia section on a malformed feed instead of throwing", async () => {
		vi.stubGlobal("fetch", async () => new Response('{"dyk":5}'));
		expect(await fetchWikipedia("2026-11-06")).toEqual({
			didYouKnow: [],
			onThisDay: null,
			featured: null,
			image: null,
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
			date: "2026-11-06",
			generatedAt: "2026-11-05T23:05:00Z",
			pictures: [{ kind: "met", title: "Chest" }],
			onThisDay: { year: 1 },
			featured: { title: "A" },
			word: null,
			quote: { text: "old" },
			quiz: { questions: [{ question: "first draw" }] },
			tides: { events: [] },
			events: { items: [] },
			didYouKnow: [{ text: "a" }],
		} as unknown as NonNullable<Parameters<typeof mergeDay>[0]>;
		expect(incomplete(base, true)).toBe(true); // word missing, and APOD is not in
		expect(incomplete({ ...base, word: {} as never }, false)).toBe(true);
		const fresh = {
			...base,
			generatedAt: "2026-11-06T06:05:00Z",
			pictures: [
				{ kind: "apod", title: "Moon" },
				{ kind: "met", title: "Reshuffled" },
			],
			word: { word: "dune" },
			quote: null,
			quiz: { questions: [{ question: "second draw" }] },
		} as unknown as typeof base;
		const merged = mergeDay(base, fresh);
		expect(merged.quiz?.questions[0].question).toBe("first draw");
		expect(merged.pictures.map((p) => `${p.kind}:${p.title}`)).toEqual([
			"apod:Moon",
			"met:Chest",
		]);
		expect(merged.word?.word).toBe("dune");
		expect(merged.quote?.text).toBe("old");
		expect(merged.generatedAt).toBe("2026-11-06T06:05:00Z");
		expect(incomplete(merged, true)).toBe(true);
		const complete = {
			...merged,
			pictures: ["apod", "met", "wikipedia", "aic", "rijks"].map((kind) => ({
				kind,
			})),
		} as typeof merged;
		expect(incomplete(complete, true)).toBe(false);
		for (const missing of complete.pictures) {
			expect(
				incomplete(
					{
						...complete,
						pictures: complete.pictures.filter((p) => p.kind !== missing.kind),
					},
					true,
				),
			).toBe(true);
		}
		expect(
			incomplete(
				{
					...complete,
					pictures: complete.pictures.filter((p) => p.kind !== "apod"),
				},
				false,
			),
		).toBe(false);
		expect(mergeDay({ ...base, date: "2026-11-05" }, fresh)).toBe(fresh);

		// a day stored before tides existed has no such key: the next run fills it in
		const { tides: _, ...older } = { ...base, word: {} as never };
		const stored = older as unknown as typeof base;
		expect(incomplete(stored, false)).toBe(true);
		expect(mergeDay(stored, fresh).tides).toEqual(fresh.tides);
	});

	it("reads RSS recipe titles, CDATA or not", () => {
		const rss = `<rss><channel><title>Feed</title><item><title><![CDATA[Dykes &amp; dunes <b>hold</b>]]></title><link>https://nos.nl/a/1</link></item><item><title>Second</title><link>https://nos.nl/a/2</link></item></channel></rss>`;
		expect(parseRecipes(rss, "NOS")).toEqual([
			{
				title: "Dykes & dunes hold",
				url: "https://nos.nl/a/1",
				source: "NOS",
			},
			{ title: "Second", url: "https://nos.nl/a/2", source: "NOS" },
		]);
		expect(
			parseRecipes(
				"<item><title>x</title><link>javascript:alert(1)</link></item>",
				"X",
			),
		).toEqual([]);
		expect(parseRecipes("<rss></rss>", "X")).toEqual([]);
	});

	it("takes the first item whose link matches, for mixed feeds", () => {
		const rss = `<item><title>Best pans</title><link>https://gf.test/review/pans</link></item><item><title>Premium</title><link>https://gf.test/premium/x</link></item><item><title>Salad</title><link>https://gf.test/recipes/salad</link></item>`;
		expect(parseRecipes(rss, "Good Food", /\/recipes\//)[0]?.title).toBe(
			"Salad",
		);
		expect(parseRecipes(rss, "Good Food", /\/nope\//)).toEqual([]);
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
				() => ({ ttl: 60, stale: 0 }),
				() => {},
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

describe("recipe lists", () => {
	it("keeps three distinct recipes and skips invalid or duplicate links", () => {
		const rss = [
			"javascript:alert(1)",
			"https://food.test/one",
			"https://food.test/one",
			"https://food.test/two",
			"https://food.test/three",
			"https://food.test/four",
		]
			.map((url) => `<item><title>Soup</title><link>${url}</link></item>`)
			.join("");
		expect(parseRecipes(rss, "Food").map((r) => r.url)).toEqual([
			"https://food.test/one",
			"https://food.test/two",
			"https://food.test/three",
		]);
	});
});
