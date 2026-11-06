import { games } from "./games";
import { moonAt, sunTimes } from "./sky";
import { fetchPicture } from "./sources/picture";
import { fetchQuote } from "./sources/quote";
import { fetchQuiz } from "./sources/trivia";
import { fetchWikipedia } from "./sources/wikipedia";
import { fetchWord } from "./sources/wiktionary";
import type { Today } from "./types";

/** Everything but weather: fetched in parallel, each source failing on its own. */
export type Day = Omit<Today, "weather">;

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
		games,
	};
}

/** Sections a source supplies; `sun`, `moon` and `games` are computed and always present. */
export const missingSections = (d: Day) =>
	[d.picture, d.onThisDay, d.word, d.quote, d.quiz].filter((s) => s === null)
		.length + (d.didYouKnow.length === 0 ? 1 : 0);

export const allFailed = (d: Day) => missingSections(d) === 6;
