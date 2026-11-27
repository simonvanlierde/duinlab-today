import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "smol-toml";
import { PICTURE_SOURCES } from "../src/lib/picture-sources.ts";

const fields = {
  site: ["title", "url", "description"],
  location: ["name", "latitude", "longitude", "timezone", "country"],
  units: ["temperature", "wind"],
  content: ["pictures", "tides", "sea", "events", "radar", "holidays", "featured", "didYouKnow", "onThisDay"],
};

function fail(path, message) {
  throw new Error(`Site configuration: ${path} ${message}`);
}

function keys(value, expected, path, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be a table");
  for (const key of Object.keys(value)) {
    if (!expected.includes(key) && !optional.includes(key)) fail(`${path}.${key}`, "is unknown");
  }
  for (const key of expected) {
    if (!(key in value)) fail(`${path}.${key}`, "is required");
  }
}

function text(value, path) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim())
    fail(path, "must be nonempty text without surrounding spaces");
}

function choice(value, choices, path) {
  if (!choices.includes(value)) fail(path, `must be one of ${choices.join(", ")}`);
}

function https(value, path) {
  text(value, path);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(path, "must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) fail(path, "must be an HTTPS URL without credentials");
  return url;
}

function checkGame(game, path) {
  keys(game, ["id", "name", "url", "blurb"], path);
  for (const key of ["id", "name", "blurb"]) text(game[key], `${path}.${key}`);
  if (!/^[a-z][a-z0-9-]*$/.test(game.id)) fail(`${path}.id`, "must be a unique lowercase identifier");
  if (Object.hasOwn(Object.prototype, game.id)) fail(`${path}.id`, "is reserved; choose a different identifier");
  https(game.url, `${path}.url`);
}

/** Games any configuration can list by id; read from the working directory, like site.toml. */
export const GAMES_FILE = "src/data/games.toml";
let games;
function knownGames() {
  if (!games) {
    const list = parse(readFileSync(GAMES_FILE, "utf8")).games;
    if (!Array.isArray(list)) fail(GAMES_FILE, "must hold [[games]] tables");
    games = new Map();
    for (const [i, game] of list.entries()) {
      checkGame(game, `${GAMES_FILE} games[${i}]`);
      if (games.has(game.id)) fail(`${GAMES_FILE} games[${i}].id`, "must be unique");
      games.set(game.id, game);
    }
  }
  return games;
}

/** Validate public settings before they enter the browser or Worker bundle. */
export function validateSiteConfig(config) {
  keys(config, [...Object.keys(fields), "games"], "config");
  // a picture source with settings takes an optional [content.<source>] table
  const sourceTables = Object.keys(PICTURE_SOURCES).filter((kind) => PICTURE_SOURCES[kind].options);
  for (const [section, expected] of Object.entries(fields))
    keys(config[section], expected, section, section === "content" ? sourceTables : []);
  for (const key of fields.site) text(config.site[key], `site.${key}`);
  const url = https(config.site.url, "site.url");
  if (url.pathname !== "/" || url.search || url.hash)
    fail("site.url", "must be an origin without a path, query or fragment");
  config.site.url = url.origin;
  text(config.location.name, "location.name");
  text(config.location.timezone, "location.timezone");
  if (!/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+)$/.test(config.location.timezone))
    fail("location.timezone", "must be an IANA time zone name");
  try {
    new Intl.DateTimeFormat("en", { timeZone: config.location.timezone });
  } catch {
    fail("location.timezone", "must be a valid IANA time zone");
  }
  for (const [key, limit] of [
    ["latitude", 55],
    ["longitude", 180],
  ]) {
    const value = config.location[key];
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > limit)
      fail(`location.${key}`, `must be a number between -${limit} and ${limit}`);
  }
  if (typeof config.location.country !== "string" || !/^[A-Z]{2}$/.test(config.location.country))
    fail("location.country", "must be a two-letter uppercase country code");
  choice(config.units.temperature, ["celsius", "fahrenheit"], "units.temperature");
  choice(config.units.wind, ["kmh", "mph"], "units.wind");
  if (!Array.isArray(config.content.pictures)) fail("content.pictures", "must be a list");
  for (const source of config.content.pictures) choice(source, Object.keys(PICTURE_SOURCES), "content.pictures");
  for (const kind of sourceTables) {
    const table = config.content[kind];
    if (table === undefined) continue;
    const path = `content.${kind}`;
    if (!config.content.pictures.includes(kind)) fail(path, `needs "${kind}" in content.pictures`);
    keys(table, [], path, Object.keys(PICTURE_SOURCES[kind].options));
    for (const [key, list] of Object.entries(table)) {
      if (!Array.isArray(list) || list.length === 0) fail(`${path}.${key}`, "must be a nonempty list of text");
      for (const item of list) text(item, `${path}.${key}`);
    }
  }
  if (new Set(config.content.pictures).size !== config.content.pictures.length)
    fail("content.pictures", "must not contain duplicates");
  const { latitude, longitude, country, timezone } = config.location;
  const hague = latitude === 52.08 && longitude === 4.31 && country === "NL" && timezone === "Europe/Amsterdam";
  for (const source of ["tides", "sea", "events"]) {
    if (typeof config.content[source] !== "boolean") fail(`content.${source}`, "must be true or false");
    if (config.content[source] && !hague)
      fail(`content.${source}`, "is only supported for The Hague (52.08, 4.31, NL, Europe/Amsterdam)");
  }
  for (const section of ["featured", "didYouKnow", "onThisDay"])
    if (typeof config.content[section] !== "boolean") fail(`content.${section}`, "must be true or false");
  choice(config.content.radar, ["knmi", "buienradar", "none"], "content.radar");
  // Inside the KNMI radar grid (49.4-56 N, 0-10.9 E) with room to spare.
  const dutch = country === "NL" && latitude >= 50.7 && latitude <= 53.6 && longitude >= 3.3 && longitude <= 7.3;
  if (config.content.radar !== "none" && !dutch)
    fail("content.radar", `${config.content.radar} requires coordinates in the Netherlands`);
  choice(config.content.holidays, ["nl", "none"], "content.holidays");
  if (config.content.holidays === "nl" && country !== "NL") fail("content.holidays", "nl requires country NL");
  if (!Array.isArray(config.games)) fail("games", "must be a list of game tables");
  const ids = new Set();
  config.games = config.games.map((entry, i) => {
    const path = `games[${i}]`;
    // a table with only an id names a game from the shared list
    const known = entry && typeof entry === "object" && Object.keys(entry).join() === "id";
    const game = known ? knownGames().get(entry.id) : entry;
    if (!game) fail(`${path}.id`, `is not in ${GAMES_FILE}; give its name, url and blurb too`);
    checkGame(game, path);
    if (ids.has(game.id)) fail(`${path}.id`, "must be a unique lowercase identifier");
    ids.add(game.id);
    return { ...game };
  });
  return /** @type {import("../src/lib/config").SiteConfig} */ (config);
}

export function loadSiteConfig(path = process.env.SITE_CONFIG || "site.toml") {
  let config;
  try {
    config = parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot load site configuration ${path}: ${error.message}`);
  }
  const site = validateSiteConfig(config);
  // Display settings must not regenerate a household’s daily quiz.
  const stable = JSON.stringify({ location: site.location, content: site.content }, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
  return {
    site,
    configKey: createHash("sha256").update(stable).digest("hex").slice(0, 12),
  };
}
