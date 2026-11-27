import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { loadSiteConfig, validateSiteConfig } from "../../scripts/site-config.mjs";

type InvalidConfig = {
  site: Record<string, unknown>;
  location: Record<string, unknown>;
  units: Record<string, unknown>;
  content: Record<string, unknown>;
  games: { id: string; url?: string; name?: string; blurb?: string }[];
};
const raw = () => parse(readFileSync("site.toml", "utf8")) as unknown as InvalidConfig;

describe("site configuration", () => {
  it("loads each published profile without sharing their cache identity", () => {
    const profiles = ["site.toml", "examples/utrecht.toml", "examples/evanston.toml"].map(loadSiteConfig);
    expect(profiles.map((p) => p.site.location.name)).toEqual(["The Hague", "Utrecht", "Evanston"]);
    expect(new Set(profiles.map((p) => p.configKey)).size).toBe(3);
    expect(profiles[2].site.location.timezone).toBe("America/Chicago");
    expect(profiles[2].site.units.temperature).toBe("fahrenheit");
  });

  it.each([
    [
      "reserved game identifier",
      (c: ReturnType<typeof raw>) => {
        c.games[0].id = "constructor";
      },
      "games[0].id",
    ],
    [
      "fixed offset timezone",
      (c: ReturnType<typeof raw>) => {
        c.location.timezone = "+01:00";
      },
      "location.timezone",
    ],
    [
      "polar latitude",
      (c: ReturnType<typeof raw>) => {
        c.location.latitude = 66;
      },
      "location.latitude",
    ],
    [
      "duplicate picture",
      (c: ReturnType<typeof raw>) => {
        c.content.pictures = ["apod", "apod"];
      },
      "content.pictures",
    ],
    [
      "site URL path",
      (c: ReturnType<typeof raw>) => {
        c.site.url = "https://example.org/path";
      },
      "site.url",
    ],
    [
      "unknown field",
      (c: ReturnType<typeof raw>) => {
        c.location.latitdue = 52;
      },
      "location.latitdue",
    ],
    [
      "missing setting",
      (c: ReturnType<typeof raw>) => {
        delete c.location.timezone;
      },
      "location.timezone",
    ],
    [
      "invalid timezone",
      (c: ReturnType<typeof raw>) => {
        c.location.timezone = "Mars/Crater";
      },
      "location.timezone",
    ],
    [
      "invalid coordinate",
      (c: ReturnType<typeof raw>) => {
        c.location.latitude = 95;
      },
      "location.latitude",
    ],
    [
      "unsafe game URL",
      (c: ReturnType<typeof raw>) => {
        c.games[0] = { id: "custom", name: "Custom", blurb: "A game of its own.", url: "javascript:alert(1)" };
      },
      "games[0].url",
    ],
    [
      "duplicate game id",
      (c: ReturnType<typeof raw>) => {
        c.games[1].id = c.games[0].id;
      },
      "games[1].id",
    ],
    [
      "unknown picture source",
      (c: ReturnType<typeof raw>) => {
        c.content.pictures = ["fake"];
      },
      "content.pictures",
    ],
    [
      "game id missing from the shared list",
      (c: ReturnType<typeof raw>) => {
        c.games[0] = { id: "no-such-game" };
      },
      "games[0].id",
    ],
    [
      "game with only some fields",
      (c: ReturnType<typeof raw>) => {
        c.games[0] = { id: "wordle", url: "https://example.org/" };
      },
      "games[0].name",
    ],
    [
      "unknown Wellcome setting",
      (c: ReturnType<typeof raw>) => {
        c.content.wellcome = { subjects: ["Birds"], genres: ["Prints"] };
      },
      "content.wellcome.genres",
    ],
    [
      "empty Wellcome subjects",
      (c: ReturnType<typeof raw>) => {
        c.content.wellcome = { subjects: [] };
      },
      "content.wellcome.subjects",
    ],
    [
      "Wellcome settings without the source",
      (c: ReturnType<typeof raw>) => {
        c.content.pictures = ["met"];
      },
      "content.wellcome",
    ],
    [
      "inherited Hague feed",
      (c: ReturnType<typeof raw>) => {
        c.location.latitude = 52.09;
        c.location.longitude = 5.12;
      },
      "content.tides",
    ],
    [
      "KNMI radar outside the Netherlands",
      (c: ReturnType<typeof raw>) => {
        c.location.country = "US";
        c.location.latitude = 42.05;
        c.location.longitude = -87.68;
        c.content.tides = c.content.sea = c.content.events = false;
        c.content.holidays = "none";
      },
      "knmi requires coordinates in the Netherlands",
    ],
    [
      "Dutch holidays abroad",
      (c: ReturnType<typeof raw>) => {
        c.location.country = "US";
      },
      "content",
    ],
  ])("rejects %s with the offending setting", (_name, mutate, field) => {
    const config = raw();
    mutate(config);
    expect(() => validateSiteConfig(config)).toThrow(field);
  });

  it("accepts KNMI radar for another Dutch city", () => {
    const config = raw();
    Object.assign(config.location, { name: "Utrecht", latitude: 52.09, longitude: 5.12 });
    config.content.tides = config.content.sea = config.content.events = false;
    expect(validateSiteConfig(config).content.radar).toBe("knmi");
  });

  it("keeps daily data through display edits and isolates source or location changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "site-config-"));
    const path = join(dir, "site.toml");
    const original = readFileSync("examples/evanston.toml", "utf8");
    const baseline = loadSiteConfig("examples/evanston.toml").configKey;
    try {
      writeFileSync(
        path,
        original
          .replace('title = "Today in Evanston"', 'title = "My morning"')
          .replace('temperature = "fahrenheit"', 'temperature = "celsius"')
          .replace('name = "Factmap"', 'name = "A game"'),
      );
      expect(loadSiteConfig(path).configKey).toBe(baseline);
      writeFileSync(path, original.replace("latitude = 42.0451", "latitude = 42.1"));
      expect(loadSiteConfig(path).configKey).not.toBe(baseline);
      writeFileSync(path, original.replace('"apod", "met",', '"apod",'));
      expect(loadSiteConfig(path).configKey).not.toBe(baseline);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports malformed files and honors an explicit configuration path", () => {
    const dir = mkdtempSync(join(tmpdir(), "site-config-"));
    const path = join(dir, "broken.toml");
    try {
      writeFileSync(path, "[site\ntitle =");
      expect(() => loadSiteConfig(path)).toThrow("Cannot load site configuration");
      expect(() => loadSiteConfig(join(dir, "missing.toml"))).toThrow("Cannot load site configuration");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("normalizes the site URL before templates append paths", () => {
    const config = raw();
    config.site.url = "https://example.org/";
    expect(validateSiteConfig(config).site.url).toBe("https://example.org");
  });

  it("allows explicitly empty picture and game lists", () => {
    const config = raw();
    config.content.pictures = [];
    delete config.content.wellcome;
    config.games = [];
    expect(validateSiteConfig(config).games).toEqual([]);
  });
});

describe("shared games", () => {
  it("fills a game named by id from src/data/games.toml and keeps a game of its own", () => {
    const config = raw();
    const own = { id: "own", name: "Own", url: "https://own.example.org/", blurb: "A game of its own." };
    config.games = [{ id: "wordle" }, own];
    const games = validateSiteConfig(config).games;
    expect(games[0]).toMatchObject({ id: "wordle", name: "Wordle", url: expect.stringMatching(/^https:\/\//) });
    expect(games[1]).toEqual(own);
  });
});
