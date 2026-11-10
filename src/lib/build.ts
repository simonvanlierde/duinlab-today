import { fetchEvents } from "./sources/events";
import { fetchPictures, mergePictures } from "./sources/picture";
import { fetchQuote } from "./sources/quote";
import { fetchTides } from "./sources/tides";
import { fetchQuiz } from "./sources/trivia";
import { fetchWikipedia } from "./sources/wikipedia";
import { fetchWord } from "./sources/wiktionary";
import { moonAt, sunTimes } from "./sun";
import type { Today } from "./types";

/** The day's sources, fetched in parallel, each failing on its own. Weather, recipes and games are added on read. */
export type Day = Omit<Today, "weather" | "recipes" | "games">;

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
	const keep = <T>(have: T | null | undefined, fetch: () => Promise<T>) =>
		have ? Promise.resolve(have) : fetch();
	const wikiDone =
		prev && prev.didYouKnow.length > 0 && prev.onThisDay && prev.featured;
	const have = prev?.pictures ?? [];
	const [wiki, pictures, word, quote, quiz, tides, events] = await Promise.all([
		wikiDone
			? Promise.resolve({
					didYouKnow: prev.didYouKnow,
					onThisDay: prev.onThisDay,
					featured: prev.featured,
					image: null,
				})
			: fetchWikipedia(date),
		fetchPictures(
			date,
			apiKey,
			have.map((p) => p.kind),
		),
		keep(prev?.word, () => fetchWord(date)),
		keep(prev?.quote, () => fetchQuote()),
		keep(prev?.quiz, () => fetchQuiz(date)),
		keep(prev?.tides, () => fetchTides(date)),
		keep(prev?.events, () => fetchEvents(date)),
	]);
	return {
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
	};
}

/**
 * Sections a source supplies; `sun` and `moon` are computed and always present. A section a
 * day stored before it existed is undefined: missing, so the next run fills it in.
 */
const sections = (d: Day) => [
	d.pictures.length > 0 ? d.pictures : null,
	d.onThisDay,
	d.featured,
	d.word,
	d.quote,
	d.quiz,
	d.tides,
	d.events,
	d.didYouKnow.length > 0 ? d.didYouKnow : null,
];

const missingSections = (d: Day) => sections(d).filter((s) => !s).length;

export const allFailed = (d: Day) => sections(d).every((s) => !s);

/** Not final yet: a source is missing, or APOD, which publishes at 06:00, is not in yet. */
export function incomplete(d: Day, hasApodKey: boolean): boolean {
	return (
		missingSections(d) > 0 ||
		(hasApodKey && !d.pictures.some((p) => p.kind === "apod"))
	);
}

/**
 * A rebuild keeps every section the earlier build already had, so the quiz never changes under
 * someone halfway through it. Pictures merge per source: a stored one is never replaced.
 */
export function mergeDay(prev: Day | null, fresh: Day): Day {
	if (!prev || prev.date !== fresh.date) return fresh;
	return {
		...fresh,
		pictures: mergePictures(prev.pictures ?? [], fresh.pictures),
		didYouKnow: prev.didYouKnow.length > 0 ? prev.didYouKnow : fresh.didYouKnow,
		onThisDay: prev.onThisDay ?? fresh.onThisDay,
		featured: prev.featured ?? fresh.featured,
		word: prev.word ?? fresh.word,
		quote: prev.quote ?? fresh.quote,
		quiz: prev.quiz ?? fresh.quiz,
		tides: prev.tides ?? fresh.tides,
		events: prev.events ?? fresh.events,
	};
}
