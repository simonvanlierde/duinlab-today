// Canned upstream answers, for e2e (e2e/fixture-server.mjs) and pull request previews
// (preview-fixtures.ts). A request for `https://<host>/<path>?<query>` is answered by host; an
// unknown host gets null, like a source that is down. Dated answers move to today, so a
// preview built on any day shows a full paper.

/** The recorded files this module answers from, by name in test/unit/fixtures/. */
export type FixtureText = (name: string) => string;

/** [content type, body] */
export type Answer = [string, string | Uint8Array<ArrayBuffer>];

const RECIPE_HOSTS: Record<string, string> = {
  "www.theguardian.com": "The Guardian",
  "www.bbcgoodfood.com": "Good Food",
  "www.loveandlemons.com": "Love and Lemons",
};

/** Answers for the configured time zone; `png` stands in for every museum image. */
export function fixtures(timezone: string, text: FixtureText, png: Uint8Array<ArrayBuffer>) {
  const isoLocal = (at: Date) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .format(at)
      .replace(" ", "T");

  /** Today at the configured location, the day the Worker builds: the word feed must have an entry for it. */
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

  /** The 2026-11-06 entry of the recorded feed, re-dated to today. */
  const wordFeed = () => {
    const atom = text("wiktionary.atom");
    const [head] = atom.split("<entry>");
    const entry = atom.split("<entry>").find((e) => e.includes("/wotd/20261106"));
    const dated = entry?.split("</feed>")[0].replaceAll("20261106", today().replaceAll("-", ""));
    return `${head}<entry>${dated}</feed>`;
  };

  /** `body` with every YYYY-MM-DD moved by the days from `base` to today, so "this week" stays this week. */
  const redated = (body: string, base: string) => {
    const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
    const by = ms(today()) - ms(base);
    return body.replace(/\b(20\d\d-\d\d-\d\d)(?=T)/g, (d) => new Date(ms(d) + by).toISOString().slice(0, 10));
  };

  const recipeRss = (host: string) =>
    `<?xml version="1.0"?><rss version="2.0"><channel><title>${RECIPE_HOSTS[host]}</title>` +
    // Good Food's feed mixes in reviews, which the parser skips
    (host === "www.bbcgoodfood.com"
      ? `<item><title>Good Food fixture review</title><link>https://${host}/review/fixture-pan</link></item>`
      : "") +
    `<item><title>${RECIPE_HOSTS[host]} fixture recipe: dune bread</title>` +
    `<link>https://${host}/recipes/fixture-bread</link></item>` +
    ["soup", "salad"]
      .map(
        (dish) =>
          `<item><title>${RECIPE_HOSTS[host]} fixture ${dish}</title><link>https://${host}/recipes/fixture-${dish}</link></item>`,
      )
      .join("") +
    `</channel></rss>`;

  const raintext = () => {
    const start = Math.floor(Date.now() / 300_000) * 300_000;
    return Array.from(
      { length: 24 },
      (_, i) => `${i === 2 ? "109" : "000"}|${isoLocal(new Date(start + i * 300_000)).slice(11, 16)}`,
    ).join("\n");
  };

  const weather = () => {
    const raw = JSON.parse(text("open-meteo.json"));
    const start = Math.floor(Date.now() / 900_000) * 900_000;
    raw.minutely_15.time = raw.minutely_15.time.map((_: string, i: number) => isoLocal(new Date(start + i * 900_000)));
    return JSON.stringify(raw);
  };

  const hosts: Record<string, (path: string) => Answer> = {
    "api.nasa.gov": () => [
      "application/json",
      JSON.stringify({
        date: today(),
        title: "Moon & stars",
        media_type: "image",
        // A real public-domain image, so a preview's browser can show it.
        url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-19279-001.jpg",
        hdurl: "https://images.metmuseum.org/CRDImages/ep/original/DP-19279-001.jpg",
        explanation: "The Moon & stars. A second sentence.",
        copyright: "Fixture image",
      }),
    ],
    "api.wikimedia.org": () => ["application/json", text("wikipedia.json")],
    "en.wiktionary.org": () => ["application/atom+xml", wordFeed()],
    "collectionapi.metmuseum.org": (path) =>
      path.includes("/search")
        ? ["application/json", '{"total":1,"objectIDs":[436535]}']
        : ["application/json", text("met-object.json")],
    "images.metmuseum.org": () => ["image/png", png],
    "iiif.micr.io": () => ["image/png", png],
    "api.artic.edu": () => ["application/json", text("aic-search.json")],
    "data.rijksmuseum.nl": () => ["application/ld+json", text("rijks-search.json")],
    "openaccess-api.clevelandart.org": () => ["application/json", text("cleveland-search.json")],
    "api.smk.dk": () => ["application/json", text("smk-search.json")],
    "api.wellcomecollection.org": () => ["application/json", text("wellcome-images.json")],
    "id.rijksmuseum.nl": () => ["application/ld+json", text("rijks-object.json")],
    "opentdb.com": () => ["application/json", text("opentdb.json")],
    "zenquotes.io": () => ["application/json", text("zenquotes.json")],
    "api.open-meteo.com": () => ["application/json", weather()],
    "air-quality-api.open-meteo.com": () => ["application/json", text("open-meteo-air.json")],
    "marine-api.open-meteo.com": () => ["application/json", text("open-meteo-marine.json")],
    "gpsgadget.buienradar.nl": () => ["text/plain", raintext()],
    // both recorded on 2026-11-09
    "ddapi20-waterwebservices.rijkswaterstaat.nl": () => [
      "application/json",
      redated(text("tides.json"), "2026-11-09"),
    ],
    "www.paard.nl": () => ["text/html", redated(text("paard.html"), "2026-11-09")],
    ...Object.fromEntries(
      Object.keys(RECIPE_HOSTS).map((h): [string, () => Answer] => [h, () => ["application/rss+xml", recipeRss(h)]]),
    ),
  };

  /** The answer for `<host>/<path>`, or null for a host without a fixture. */
  return (host: string, path: string): Answer | null => hosts[host]?.(path) ?? null;
}
