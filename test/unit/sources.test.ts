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
  parseApodFeed,
  parseCleveland,
  parseMet,
  parseRijks,
  parseSmk,
  parseWellcome,
} from "../../src/lib/sources/picture";
import { firstPicture } from "../../src/lib/sources/pictures/kit";
import { wellcomeTitle } from "../../src/lib/sources/pictures/wellcome";
import { parseQuote } from "../../src/lib/sources/quote";
import { parseRecipes } from "../../src/lib/sources/recipes";
import { parseSea } from "../../src/lib/sources/sea";
import { parseQuiz } from "../../src/lib/sources/trivia";
import {
  airLine,
  beaufort,
  compass,
  fetchWeather,
  parseKnmiRain,
  parseRaintext,
  parseWeather,
  withKnmiRain,
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
import cleveland from "./fixtures/cleveland-search.json";
import metObject from "./fixtures/met-object.json";
import metSearch from "./fixtures/met-search.json";
import meteo from "./fixtures/open-meteo.json";
import marine from "./fixtures/open-meteo-marine.json";
import opentdb from "./fixtures/opentdb.json";
import rijksObject from "./fixtures/rijks-object.json";
import smk from "./fixtures/smk-search.json";
import wellcome from "./fixtures/wellcome-images.json";
import wikipedia from "./fixtures/wikipedia.json";
import wiktionary from "./fixtures/wiktionary.atom?raw";
import zen from "./fixtures/zenquotes.json";

afterEach(() => vi.unstubAllGlobals());

const HAGUE = { lat: 52.08, lon: 4.31 };

describe("parsers", () => {
  it.each([null, undefined, Number.NaN])("rejects invalid current weather number %s", (temperature) => {
    const invalid = structuredClone(meteo);
    invalid.current.temperature_2m = temperature as number;
    expect(() => parseWeather(invalid, new Date())).toThrow();
  });
  it("rejects missing daily weather numbers", () => {
    const invalid = structuredClone(meteo);
    invalid.daily.temperature_2m_max = [];
    expect(() => parseWeather(invalid, new Date())).toThrow();
  });
  it("takes two did-you-know items with the hook's article link", () => {
    const facts = parseFacts(wikipedia);
    expect(facts).toHaveLength(2);
    expect(facts[0]?.text).toBe("Cinema '76 adopted three cats named after a series of independent Philippine films?");
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
    expect(facts.map((f) => f.text)).toEqual(["the film All of Tokyo! was based on interviews?"]);
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
    expect(parseApod({ ...moon, media_type: "other", date: "2026-11-06" }, "2026-11-06")).toBeNull();
  });

  it("keeps source originals separate from picture previews and rejects unsafe URLs", () => {
    const moon = {
      title: "Moon",
      date: "2026-11-06",
      media_type: "image",
      url: "https://images.example/moon-small.jpg",
      hdurl: "https://images.example/moon.jpg",
    };
    expect(parseApod(moon, moon.date)).toMatchObject({
      imageUrl: moon.url,
      fullImageUrl: moon.hdurl,
    });
    expect(parseApod({ ...moon, hdurl: "javascript:x" }, moon.date)?.fullImageUrl).toBeUndefined();
    expect(
      parseApod({ ...moon, media_type: "video", thumbnail_url: moon.url }, moon.date)?.fullImageUrl,
    ).toBeUndefined();
    expect(parseMet({ ...metObject, primaryImage: moon.hdurl })?.fullImageUrl).toBe(moon.hdurl);
    expect(
      parseMet({
        ...metObject,
        primaryImage: "http://images.example/original.jpg",
      })?.fullImageUrl,
    ).toBeUndefined();
    expect(parseMet(metObject)?.imageUrl).toBe(metObject.primaryImageSmall);
    expect(parseRijks(rijksObject)?.fullImageUrl).toBe("https://iiif.micr.io/mPymb/full/max/0/default.jpg");
  });

  it("keeps APOD explanations as plain text and tolerates older answers without them", () => {
    const moon = {
      title: "Moon",
      date: "2026-11-06",
      media_type: "image",
      url: "https://images.example/moon.jpg",
    };
    expect(
      parseApod(
        {
          ...moon,
          explanation: "  The <b>Moon</b> &amp; stars.\n A second sentence. ",
        },
        moon.date,
      )?.explanation,
    ).toBe("The Moon & stars. A second sentence.");
    expect(parseApod(moon, moon.date)?.explanation).toBeUndefined();
    expect(parseApod({ ...moon, explanation: " <p> </p> " }, moon.date)?.explanation).toBeUndefined();
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
    expect(parseAic({ ...(a as object), artist_display: "Name\nBorn here" })?.by).toBe("Name");
  });

  it("takes a public-domain Rijksmuseum object and sizes its IIIF image", () => {
    const p = parseRijks(rijksObject);
    expect(p).toMatchObject({
      kind: "rijks",
      title: "Misty Sea",
      by: "Jan Toorop",
      date: "1899",
    });
    expect(p?.imageUrl).toBe("https://iiif.micr.io/mPymb/full/960,/0/default.jpg");
    expect(p?.pageUrl).toMatch(/^https:\/\/www\.rijksmuseum\.nl\//);
    const noLicence = structuredClone(rijksObject);
    for (const c of noLicence.subject_of[0]?.digitally_carried_by ?? []) c.referred_to_by = [];
    expect(parseRijks(noLicence)).toBeNull();
    expect(parseRijks({})).toBeNull();
  });

  it("takes a CC0 Cleveland painting with its sizes and the artist's name alone", () => {
    const p = parseCleveland(cleveland.data[1]);
    expect(p).toMatchObject({ kind: "cleveland", by: "Tara 1", width: 586, height: 900 });
    expect(p?.imageUrl).toMatch(/^https:\/\/openaccess-cdn\.clevelandart\.org\/.+_web\.jpg$/);
    expect(p?.fullImageUrl).toMatch(/_print\.jpg$/);
    expect(parseCleveland({ ...cleveland.data[1], share_license_status: "Copyrighted" })).toBeNull();
    expect(parseCleveland(cleveland.data[0])?.by).toBeNull();
  });

  it("takes a public-domain SMK painting by its maker, not the engraver it is after", () => {
    const p = parseSmk(smk.items[1]);
    expect(p).toMatchObject({
      kind: "smk",
      title: "Seascape with a Town in the Background",
      by: "Willem van Diest",
      date: "1625-1663",
    });
    expect(p?.fullImageUrl).toMatch(/^https:\/\/iip\.smk\.dk\/iiif\/.+\/full\/!2400,\/0\/default\.jpg$/);
    const after = { ...smk.items[1], production: [{ creator: "Goltzius, Hendrick", creator_role: "after" }] };
    expect(parseSmk(after)?.by).toBeNull();
    expect(parseSmk({ ...smk.items[1], production: [{ creator: "Ubekendt", creator_role: null }] })?.by).toBeNull();
    expect(parseSmk({ ...smk.items[1], public_domain: false })).toBeNull();
  });

  it("takes an openly licensed Wellcome image and sizes its preview from the aspect ratio", () => {
    const p = parseWellcome(wellcome.results[0]);
    expect(p).toMatchObject({ kind: "wellcome", title: "An orchid (Cattleya Schofieldianum): flowering stem" });
    expect(p?.imageUrl).toMatch(/^https:\/\/iiif\.wellcomecollection\.org\/image\/.+\/full\/960,\/0\/default\.jpg$/);
    expect(p).toMatchObject({ width: 960, height: Math.round(960 / 0.7325) });
    expect(p?.credit.name).toBe("Wellcome Collection (Public Domain Mark)");
    const closed = structuredClone(wellcome.results[0]);
    closed.locations[0].license.id = "inc";
    expect(parseWellcome(closed)).toBeNull();
    expect(wellcomeTitle("A jay (Garrulax perspicillatus). Coloured lithograph by W. E. Smith.")).toBe(
      "A jay (Garrulax perspicillatus)",
    );
    expect(wellcomeTitle("Head of a stag. Drawing, c. 1789.")).toBe("Head of a stag");
    expect(wellcomeTitle("Hedge mustard pollen")).toBe("Hedge mustard pollen");
  });

  it("skips a scroll or panorama the strip would show as a sliver", () => {
    const scroll = {
      ...cleveland.data[1],
      images: { web: { url: "https://x.test/a.jpg", width: "900", height: "68" } },
    };
    expect(firstPicture([scroll, cleveland.data[1]], parseCleveland)?.by).toBe("Tara 1");
  });

  it("drops a picture another source already shows", () => {
    const pic = (kind: string) =>
      ({ kind, title: kind, imageUrl: "https://same.test/a.jpg" }) as unknown as Parameters<
        typeof mergePictures
      >[0][number];
    expect(mergePictures([pic("met"), pic("aic")]).map((p) => p.kind)).toEqual(["met"]);
  });

  it("takes the Wikipedia picture of the day with its file page and licence", () => {
    const p = parseImage(wikipedia);
    expect(p?.kind).toBe("wikipedia");
    expect(p?.pageUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
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
    expect(a?.questions[0]?.question).toBe('Which Kingdom Hearts game featured the cast of "The World Ends With You"?');
    for (const [i, q] of (a?.questions ?? []).entries()) {
      const raw = opentdb.results[i];
      expect(q.answers[q.correct]).toBe(decodeURIComponent(raw?.correct_answer ?? ""));
      expect([...q.answers].sort()).toEqual(
        [raw?.correct_answer, ...(raw?.incorrect_answers ?? [])].map(decodeURIComponent).sort(),
      );
    }
    expect(c?.questions.map((q) => q.answers)).not.toEqual(a?.questions.map((q) => q.answers));
    expect(parseQuiz({ ...opentdb, response_code: 5 }, "2026-11-06")).toBeNull();
  });

  it("reads the quote and ignores the rate-limit notice", () => {
    expect(parseQuote(zen)?.author).toBe("Robert Kiyosaki");
    expect(parseQuote([{ q: "Too many requests.", a: "Zen Quotes" }])).toBeNull();
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
    expect(shortExtract("Born in the U.S. in 1900. Died.")).toBe("Born in the U.S. in 1900. Died.");
    const page = (p: string) => ({
      tfa: { ...wikipedia.tfa, content_urls: { desktop: { page: p } } },
    });
    expect(parseFeatured(page("javascript:x"))).toBeNull();
    expect(parseFeatured({})).toBeNull();
  });

  it("keeps initials inside featured article sentences", () => {
    const sentence = "Regulus is an oil painting by the English artist J. M. W. Turner, first exhibited in 1828.";
    expect(shortExtract(`${sentence} It depicts a harbour. A third sentence.`)).toBe(
      `${sentence} It depicts a harbour.`,
    );
  });

  it("reads Buienradar's radar text as mm per hour, skipping bad lines", () => {
    expect(parseRaintext(raintext)).toEqual([
      { time: "10:05", mm: 0 },
      { time: "10:10", mm: 0 },
      { time: "10:15", mm: 1 },
      { time: "10:20", mm: 10 },
      { time: "10:25", mm: 0.1 },
    ]);
    expect(rainLine(parseRaintext(raintext))).toBe("Rain expected around 10:15");
    // Buienradar ends its lines with CRLF; git stores the fixture with LF
    expect(parseRaintext("000|10:05\r\n141|10:10\r\n")).toEqual([
      { time: "10:05", mm: 0 },
      { time: "10:10", mm: 10 },
    ]);
  });

  it("takes the rain from Buienradar and falls back to Open-Meteo", async () => {
    const now = new Date("2026-11-06T20:20:00Z");
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("buienradar") ? new Response(raintext) : new Response(JSON.stringify(meteo)),
    );
    const radar = await fetchWeather(now);
    expect(radar?.rainCredit.name).toBe("Buienradar");
    expect(radar?.rainNext2h).toHaveLength(5);
    expect(radar?.credit.name).toBe("Open-Meteo");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("buienradar") ? new Response("", { status: 503 }) : new Response(JSON.stringify(meteo)),
    );
    const fallback = await fetchWeather(now);
    expect(fallback?.rainCredit.name).toBe("Open-Meteo");
    expect(fallback?.rainNext2h).toHaveLength(8);
    warn.mockRestore();
  });

  it("flags poor air and high pollen, and nothing below the thresholds", () => {
    const air = (current: Record<string, number | null>) => airLine({ current });
    expect(air({ european_aqi: 59, grass_pollen: 49, birch_pollen: 69 })).toBeNull();
    expect(air({ european_aqi: 60 })).toBe("Air quality poor (AQI 60)");
    expect(air({ european_aqi: 30, grass_pollen: 50 })).toBe("Grass pollen high today");
    expect(air({ birch_pollen: 70, alder_pollen: 400, grass_pollen: null })).toBe("Birch and alder pollen high today");
    expect(air({ european_aqi: 72, mugwort_pollen: 25 })).toBe("Mugwort pollen high today · Air quality poor (AQI 72)");
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

  it("prefers fresh KNMI KV nowcast and rejects stale or missing cells", () => {
    const now = new Date("2026-11-13T22:44:00Z");
    const fresh = {
      issuedAt: "2026-11-13T22:40:00Z",
      ...HAGUE,
      steps: [
        { time: "23:40", mm: 0 },
        { time: "23:45", mm: 0.24 },
      ],
    };
    const base = parseWeather(meteo, now);
    const applied = withKnmiRain(base, fresh, now);
    expect(applied?.rainCredit.name).toBe("KNMI");
    expect(applied?.rainNext2h).toEqual(fresh.steps);

    // Stale (> 45 min) falls back to existing weather
    const stale = { ...fresh, issuedAt: "2026-11-13T21:50:00Z" };
    expect(parseKnmiRain(stale, now)).toBeNull();
    expect(withKnmiRain(base, stale, now)?.rainCredit.name).toBe("Open-Meteo");

    // Missing cell (null) must not become 0
    const withNull = {
      issuedAt: "2026-11-13T22:40:00Z",
      ...HAGUE,
      steps: [
        { time: "23:40", mm: 0 },
        { time: "23:45", mm: null },
      ],
    };
    expect(parseKnmiRain(withNull, now)).toBeNull();

    // A feed for another city, or one without a location, is ignored
    expect(parseKnmiRain({ ...fresh, lat: 52.37, lon: 4.9 }, now)).toBeNull();
    expect(parseKnmiRain({ issuedAt: fresh.issuedAt, steps: fresh.steps }, now)).toBeNull();
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
    expect([0.5, 1, 5.9, 6, 28.9, 29, 117, 118, 200].map(beaufort)).toEqual([0, 1, 1, 2, 4, 5, 11, 12, 12]);
    expect([0, 22, 23, 90, 359, 360].map(compass)).toEqual(["N", "N", "NE", "E", "N", "N"]);
  });
});

describe("pictures", () => {
  const nasaFeed = `<rss><channel><item>
		<title>Moon &amp; stars</title><pubDate>Fri, 06 Nov 2026 05:05:00 +0000</pubDate>
		<link>https://science.nasa.gov/image-article/apod-2026-november-6-moon/</link>
		<apod:hdurl>https://assets.science.nasa.gov/moon.jpg?w=2000&#038;h=1800</apod:hdurl>
		<apod:credit><![CDATA[<a href="https://example.com">A Photographer</a>]]></apod:credit>
		<apod:alt>The Moon above a field of stars.</apod:alt>
		<apod:explanation><![CDATA[<p>The <b>Moon</b> &amp; stars.</p>]]></apod:explanation>
	</item></channel></rss>`;

  it("reads the dated official NASA feed without taking a stale day or unsafe image", () => {
    expect(parseApodFeed(nasaFeed, "2026-11-06")).toMatchObject({
      kind: "apod",
      title: "Moon & stars",
      by: "A Photographer",
      imageUrl: "https://assets.science.nasa.gov/moon.jpg?w=2000&h=1800",
      alt: "The Moon above a field of stars.",
      explanation: "The Moon & stars.",
      pageUrl: "https://science.nasa.gov/image-article/apod-2026-november-6-moon/",
    });
    expect(parseApodFeed(nasaFeed, "2026-11-07")).toBeNull();
    expect(parseApodFeed(nasaFeed.replace("Fri, 06 Nov 2026 05:05:00 +0000", "invalid"), "2026-11-06")).toBeNull();
    expect(
      parseApodFeed(
        nasaFeed.replace("https://assets.science.nasa.gov/moon.jpg?w=2000&#038;h=1800", "javascript:x"),
        "2026-11-06",
      ),
    ).toBeNull();
    expect(parseApodFeed(nasaFeed.replace("moon.jpg", "nasa-logo.png"), "2026-11-06")).toBeNull();
  });

  it("uses NASA's official feed when the API returns its site logo", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (new URL(url).host === "api.nasa.gov") return new Response(JSON.stringify(apod));
      if (new URL(url).host === "science.nasa.gov") return new Response(nasaFeed);
      return new Response("", { status: 404 });
    });
    expect((await fetchPictures("2026-11-06", "k", ["met", "aic", "rijks"]))[0]?.title).toBe("Moon & stars");
  });

  it.each([false, true])(
    "keeps a ready feed within the source deadline and prefers a valid API answer (%s)",
    async (apiOk) => {
      vi.useFakeTimers();
      try {
        vi.stubGlobal("fetch", async (url: string) => {
          const host = new URL(url).host;
          if (host === "api.nasa.gov") {
            await new Promise((resolve) => setTimeout(resolve, 4000));
            return apiOk ? new Response(JSON.stringify(goodApod)) : new Response("", { status: 503 });
          }
          if (host === "science.nasa.gov") {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            return new Response(nasaFeed);
          }
          return new Response("", { status: 404 });
        });
        const result = fetchPictures("2026-11-06", "k", ["met", "aic", "rijks"]);
        await vi.advanceTimersByTimeAsync(5000);
        expect((await result)[0]?.title).toBe(apiOk ? "Moon" : "Moon & stars");
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("replaces generic museum medium text with the title and artist, retaining descriptions", () => {
    const work = {
      ...aic.data[0],
      title: "A painting",
      artist_display: "An Artist",
      thumbnail: { alt_text: "A work made of oil on canvas." },
    };
    expect(parseAic(work)?.alt).toBe("A painting, by An Artist");
    expect(
      parseAic({
        ...work,
        thumbnail: { alt_text: "People gathered beside a lake." },
      })?.alt,
    ).toBe("People gathered beside a lake.");
  });

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
      if (u.host === "api.nasa.gov") return apodOk ? json(goodApod) : new Response("", { status: 500 });
      if (u.host === "api.artic.edu") return json(aic);
      if (u.host === "data.rijksmuseum.nl") return json({ orderedItems: [{ id: "https://id.rijksmuseum.nl/1" }] });
      if (u.host === "id.rijksmuseum.nl") return json(rijksObject);
      if (u.host === "openaccess-api.clevelandart.org") return json(cleveland);
      if (u.host === "api.smk.dk") return json(smk);
      if (u.host === "api.wellcomecollection.org") return json(wellcome);
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
    expect(got.map((p) => p.kind).sort()).toEqual(["apod", "cleveland", "met", "smk", "wellcome"]);
  });

  it("picks the same artwork for the same date and skips sources already held", async () => {
    const hosts: string[] = [];
    stubFetch(true, hosts);
    const one = await fetchPictures("2026-11-06", undefined);
    expect(one.map((p) => p.kind)).toEqual(["met", "cleveland", "smk", "wellcome"]);
    expect(await fetchPictures("2026-11-06", undefined)).toEqual(one);
    hosts.length = 0;
    await fetchPictures("2026-11-06", "k", ["met", "cleveland", "smk", "wellcome"]);
    expect(hosts.filter((h) => h !== "img")).toEqual(["science.nasa.gov", "api.nasa.gov"]);
  });

  it("lets each source fail or hang on its own", async () => {
    stubFetch(false);
    expect((await fetchPictures("2026-11-06", "k")).map((p) => p.kind)).toEqual([
      "met",
      "cleveland",
      "smk",
      "wellcome",
    ]);
    vi.stubGlobal("fetch", async () => new Response("", { status: 500 }));
    expect(await fetchPictures("2026-11-06", "k")).toEqual([]);
    // APOD hangs: the others come back once the deadline passes
    vi.stubGlobal("fetch", async (url: string) => {
      if (new URL(url).host === "api.nasa.gov") return new Promise<Response>(() => {});
      return new Response("", { status: 500 });
    });
    expect(await fetchPictures("2026-11-06", "k", [], 50)).toEqual([]);
  });

  it("keeps a stored picture and orders the strip by source, dropping sources no longer configured", () => {
    const pic = (kind: string, title: string) =>
      ({ kind, title }) as unknown as Parameters<typeof mergePictures>[0][number];
    const merged = mergePictures(
      [pic("cleveland", "stored"), pic("met", "stored")],
      [pic("apod", "new"), pic("cleveland", "reshuffled"), pic("rijks", "new")],
      [pic("wikipedia", "new")],
    );
    expect(merged.map((p) => `${p.kind}:${p.title}`)).toEqual([
      "apod:new",
      "met:stored",
      "wikipedia:new",
      "cleveland:stored",
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
      "api.smk.dk",
      "api.wellcomecollection.org",
      "api.wikimedia.org",
      "collectionapi.metmuseum.org",
      "openaccess-api.clevelandart.org",
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
      url.includes("zenquotes") ? new Response(JSON.stringify(zen)) : new Response("", { status: 503 }),
    );
    const day = await buildDay("2026-11-06", new Date("2026-11-06T08:00:00Z"), undefined);
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
    expect(allFailed(await buildDay("2026-11-06", new Date(), undefined))).toBe(true);
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
    expect(store.values().next().value?.headers.get("cache-control")).toBe("public, max-age=180");
    await cached(cache, "b", build, () => null, later);
    expect(store.size).toBe(1);
  });

  it("waits a minute before refreshing a stale entry again after a refresh failed", async () => {
    const store = new Map<string, Response>();
    const cache = {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    } as unknown as Cache;
    const life = (v: { ok: boolean }) => (v.ok ? { ttl: 60, stale: 3600 } : { ttl: 60, stale: 0 });
    let ok = true;
    const build = vi.fn(async () => ({ ok }));
    const jobs: Promise<unknown>[] = [];
    const later = (p: Promise<unknown>) => void jobs.push(p);
    vi.useFakeTimers();
    try {
      await cached(cache, "r", build, life, later);
      ok = false;
      vi.advanceTimersByTime(90_000);
      await cached(cache, "r", build, life, later);
      await Promise.all(jobs);
      await cached(cache, "r", build, life, later);
      expect(build).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(61_000);
      // a refresh that throws pauses retries the same way
      build.mockRejectedValueOnce(new Error("down"));
      await cached(cache, "r", build, life, later);
      await Promise.all(jobs);
      await cached(cache, "r", build, life, later);
      expect(build).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
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
  it("expires rain intervals against their feed anchor across midnight", () => {
    const issuedAt = "2026-11-13T22:55:00Z";
    const steps = [
      { time: "23:55", mm: 1 },
      { time: "00:00", mm: 0 },
    ];
    expect(parseKnmiRain({ issuedAt, steps, ...HAGUE }, new Date("2026-11-13T23:01:00Z"))).toEqual([steps[1]]);
    expect(parseKnmiRain({ issuedAt, steps, ...HAGUE }, new Date("2026-11-13T23:05:00Z"))).toBeNull();
  });

  it("does not call an accepted half-hour-old wet interval current rain", () => {
    const steps = Array.from({ length: 13 }, (_, i) => ({
      time: `11:${String((i * 5) % 60).padStart(2, "0")}`,
      mm: i === 0 ? 1 : 0,
    }));
    steps[12] = { time: "12:00", mm: 0 };
    const now = new Date("2026-11-13T10:30:00Z");
    const remaining = parseKnmiRain({ issuedAt: "2026-11-13T10:00:00Z", steps, ...HAGUE }, now);
    expect(remaining?.[0]).toEqual({ time: "11:30", mm: 0 });
    expect(rainLine(remaining ?? [], now)).toBe("No rain expected through 12:05");
  });

  it("drops elapsed cached radar and quarter-hour forecast intervals", () => {
    const fetched = new Date("2026-11-06T20:20:00Z");
    const base = parseWeather(meteo, fetched);
    const now = new Date("2026-11-06T20:30:00Z");
    expect(withKnmiRain(base, null, now)?.rainNext2h[0]?.time).toBe("21:30");
    const radar = {
      ...base,
      rainCredit: { name: "Buienradar", url: "https://www.buienradar.nl/" },
      rainNext2h: [
        { time: "21:20", mm: 1 },
        { time: "21:25", mm: 0 },
      ],
    };
    expect(withKnmiRain(radar, null, now)?.rainNext2h).toEqual([]);
  });

  it("rejects invalid clocks and ambiguous repeated-hour rain", () => {
    const now = new Date("2026-10-25T00:30:00Z");
    for (const time of ["24:00", "12:60", "02:30"]) {
      expect(parseKnmiRain({ issuedAt: now.toISOString(), ...HAGUE, steps: [{ time, mm: 1 }] }, now)).toBeNull();
    }
    expect(parseRaintext("109|24:00\n109|12:60\n999|12:30")).toEqual([]);
    expect(() =>
      parseWeather(
        {
          ...meteo,
          minutely_15: { ...meteo.minutely_15, time: ["2026-11-06T24:00"] },
        },
        now,
      ),
    ).toThrow("invalid rain times");
  });

  it("keeps ordered spring-transition intervals without inventing missing clocks", () => {
    const issuedAt = "2026-03-29T00:55:00Z";
    const steps = [
      { time: "01:55", mm: 1 },
      { time: "03:00", mm: 0 },
    ];
    expect(parseKnmiRain({ issuedAt, steps, ...HAGUE }, new Date("2026-03-29T01:01:00Z"))).toEqual([steps[1]]);
  });
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
    await safe("apod", () => getText("https://api.nasa.gov/planetary/apod?api_key=SECRET"));
    expect(warn.mock.calls[0]?.[0]).toContain("api.nasa.gov/planetary/apod: HTTP 429");
    expect(warn.mock.calls[0]?.[0]).not.toContain("SECRET");
    warn.mockRestore();
  });

  it("says rain now when the current quarter hour is wet", () => {
    const step = (time: string, mm: number) => ({ time, mm });
    const now = new Date("2026-11-06T09:10:00Z");
    expect(rainLine([step("10:00", 0.3), step("10:15", 0)], now, 15)).toBe("Rain now");
    expect(rainLine([step("10:00", 0), step("10:15", 0.2)], now, 15)).toBe("Rain expected around 10:15");
  });

  it("limits a dry forecast to its available horizon", () => {
    expect(rainLine([{ time: "23:30", mm: 0 }])).toBe("No rain expected through 23:35");
    expect(rainLine([])).toBe("");
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
    expect(merged.pictures.map((p) => `${p.kind}:${p.title}`)).toEqual(["apod:Moon", "met:Chest"]);
    expect(merged.word?.word).toBe("dune");
    expect(merged.quote?.text).toBe("old");
    expect(merged.generatedAt).toBe("2026-11-06T06:05:00Z");
    expect(incomplete(merged, true)).toBe(true);
    const complete = {
      ...merged,
      pictures: ["apod", "met", "wikipedia", "cleveland", "smk", "wellcome"].map((kind) => ({
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
    expect(parseRecipes("<item><title>x</title><link>javascript:alert(1)</link></item>", "X")).toEqual([]);
    expect(parseRecipes("<rss></rss>", "X")).toEqual([]);
  });

  it("takes the first item whose link matches, for mixed feeds", () => {
    const rss = `<item><title>Best pans</title><link>https://gf.test/review/pans</link></item><item><title>Premium</title><link>https://gf.test/premium/x</link></item><item><title>Salad</title><link>https://gf.test/recipes/salad</link></item>`;
    expect(parseRecipes(rss, "Good Food", /\/recipes\//)[0]?.title).toBe("Salad");
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
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02]);
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
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBeNull();
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
