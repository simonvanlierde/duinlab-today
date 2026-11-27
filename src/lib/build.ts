import { site } from "./config";
import { fetchEvents } from "./sources/events";
import { fetchPictures, mergePictures, PICTURE_ORDER } from "./sources/picture";
import { fetchQuote } from "./sources/quote";
import { fetchTides } from "./sources/tides";
import { fetchQuiz } from "./sources/trivia";
import { fetchWikipedia } from "./sources/wikipedia";
import { fetchWord } from "./sources/wiktionary";
import { moonAt, sunTimes } from "./sun";
import type { Today } from "./types";

/** The day's sources, fetched in parallel, each failing on its own. Weather, sea, recipes and games are added on read. */
export type Day = Omit<Today, "weather" | "sea" | "recipes" | "games">;

/**
 * A rebuild passes the stored day as `prev` and fetches only the sections it lacks: asking a
 * source again for what the day already has wastes its rate limit, and mergeDay would keep
 * the stored copy anyway.
 */
export async function buildDay(
  date: string,
  now: Date,
  apiKey: string | undefined,
  prev: Day | null = null,
): Promise<Day> {
  const keep = <T>(have: T | null | undefined, fetch: () => Promise<T>) => (have ? Promise.resolve(have) : fetch());
  const { didYouKnow, onThisDay, featured } = site.content;
  // one feed holds all four, so it is asked only while one the page shows is missing
  const wikiNeeded =
    (didYouKnow && !prev?.didYouKnow.length) ||
    (onThisDay && !prev?.onThisDay) ||
    (featured && !prev?.featured) ||
    (PICTURE_ORDER.includes("wikipedia") && !prev?.pictures.some((p) => p.kind === "wikipedia"));
  const have = prev?.pictures ?? [];
  const [wiki, pictures, word, quote, quiz, tides, events] = await Promise.all([
    wikiNeeded
      ? fetchWikipedia(date)
      : Promise.resolve({
          didYouKnow: prev?.didYouKnow ?? [],
          onThisDay: prev?.onThisDay ?? null,
          featured: prev?.featured ?? null,
          image: null,
        }),
    fetchPictures(
      date,
      apiKey,
      have.map((p) => p.kind),
    ),
    keep(prev?.word, () => fetchWord(date)),
    keep(prev?.quote, () => fetchQuote()),
    keep(prev?.quiz, () => fetchQuiz(date)),
    site.content.tides ? keep(prev?.tides, () => fetchTides(date)) : Promise.resolve(null),
    site.content.events ? keep(prev?.events, () => fetchEvents(date)) : Promise.resolve(null),
  ]);
  return configured({
    date,
    generatedAt: now.toISOString(),
    sun: sunTimes(date),
    moon: moonAt(new Date(`${date}T12:00:00Z`)),
    pictures: mergePictures(have, pictures, wiki.image ? [wiki.image] : []),
    didYouKnow: wiki.didYouKnow,
    onThisDay: wiki.onThisDay,
    featured: wiki.featured,
    word,
    quote,
    quiz,
    tides,
    events,
  });
}

/** The day without the Wikipedia sections this configuration leaves out, as a stored day from before a config change has them. */
export function configured(d: Day): Day {
  return {
    ...d,
    didYouKnow: site.content.didYouKnow ? d.didYouKnow : [],
    onThisDay: site.content.onThisDay ? d.onThisDay : null,
    featured: site.content.featured ? d.featured : null,
  };
}

/**
 * Sections a source supplies; `sun` and `moon` are computed and always present. A section a
 * day stored before it existed is undefined: missing, so the next run fills it in.
 */
const sections = (d: Day) => [
  ...(site.content.onThisDay ? [d.onThisDay] : []),
  ...(site.content.featured ? [d.featured] : []),
  d.word,
  d.quote,
  d.quiz,
  ...(site.content.tides ? [d.tides] : []),
  ...(site.content.events ? [d.events] : []),
  ...(site.content.didYouKnow ? [d.didYouKnow.length > 0 ? d.didYouKnow : null] : []),
];

const missingSections = (d: Day) => sections(d).filter((s) => !s).length;

export const allFailed = (d: Day) => d.pictures.length === 0 && sections(d).every((s) => !s);

/** Not final yet: a section or an enabled picture source is missing. */
export function incomplete(d: Day, hasApodKey: boolean): boolean {
  return (
    missingSections(d) > 0 ||
    PICTURE_ORDER.some((kind) => (kind !== "apod" || hasApodKey) && !d.pictures.some((p) => p.kind === kind))
  );
}

/**
 * A rebuild keeps every section the earlier build already had, so the quiz never changes under
 * someone halfway through it. Pictures merge per source: a stored one is never replaced.
 */
export function mergeDay(prev: Day | null, fresh: Day): Day {
  if (!prev || prev.date !== fresh.date) return fresh;
  return configured({
    ...fresh,
    pictures: mergePictures(prev.pictures ?? [], fresh.pictures),
    didYouKnow: prev.didYouKnow.length > 0 ? prev.didYouKnow : fresh.didYouKnow,
    onThisDay: prev.onThisDay ?? fresh.onThisDay,
    featured: prev.featured ?? fresh.featured,
    word: prev.word ?? fresh.word,
    quote: prev.quote ?? fresh.quote,
    quiz: prev.quiz ?? fresh.quiz,
    tides: site.content.tides ? (prev.tides ?? fresh.tides) : null,
    events: site.content.events ? (prev.events ?? fresh.events) : null,
  });
}
