import { moonAt, sunTimes } from "./sky";
import { fetchPicture } from "./sources/picture";
import { fetchQuote } from "./sources/quote";
import { fetchQuiz } from "./sources/trivia";
import { fetchWikipedia } from "./sources/wikipedia";
import { fetchWord } from "./sources/wiktionary";
import type { Today } from "./types";

/** The day's sources, fetched in parallel, each failing on its own. Weather and games are added on read. */
export type Day = Omit<Today, "weather" | "games">;

export async function buildDay(
	date: string,
	now: Date,
	apiKey: string | undefined,
): Promise<Day> {
	const [wiki, picture, word, quote, quiz] = await Promise.all([
		fetchWikipedia(date),
		fetchPicture(date, apiKey),
		fetchWord(date),
		fetchQuote(),
		fetchQuiz(date),
	]);
	return {
		date,
		generatedAt: now.toISOString(),
		sun: sunTimes(date),
		moon: moonAt(new Date(`${date}T12:00:00Z`)),
		picture,
		didYouKnow: wiki.didYouKnow,
		onThisDay: wiki.onThisDay,
		word,
		quote,
		quiz,
	};
}

/** Sections a source supplies; `sun` and `moon` are computed and always present. */
export const missingSections = (d: Day) =>
	[d.picture, d.onThisDay, d.word, d.quote, d.quiz].filter((s) => s === null)
		.length + (d.didYouKnow.length === 0 ? 1 : 0);

export const allFailed = (d: Day) => missingSections(d) === 6;
