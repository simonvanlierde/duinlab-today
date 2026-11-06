import { moonAt, sunTimes } from "./sky";
import { fetchPicture, preferredPicture } from "./sources/picture";
import { fetchQuote } from "./sources/quote";
import { fetchQuiz } from "./sources/trivia";
import { fetchWikipedia } from "./sources/wikipedia";
import { fetchWord } from "./sources/wiktionary";
import type { Today } from "./types";
import { secondsUntilMidnight } from "./util";

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
const sections = (d: Day) => [
	d.picture,
	d.onThisDay,
	d.word,
	d.quote,
	d.quiz,
	d.didYouKnow.length > 0 ? d.didYouKnow : null,
];

export const missingSections = (d: Day) =>
	sections(d).filter((s) => s === null).length;

export const allFailed = (d: Day) => sections(d).every((s) => s === null);

/** A failed source is retried after a minute, not on every request. */
const FAILED_TTL = 60;
/** A day with a source missing is rebuilt soon, so a passing outage does not last until midnight. */
const PARTIAL_TTL = 10 * 60;
/** From 07:00 Amsterdam to midnight. */
const AFTER_SEVEN = 17 * 3600;

/**
 * Seconds to cache a built day. Each rebuild draws new quiz questions, so a complete day is
 * kept until midnight. The one exception is The Met standing in for APOD before 07:00: APOD
 * publishes at US Eastern midnight, so the day is rebuilt once at 07:00 to get it.
 */
export function dayTtl(d: Day, now: Date, hasApodKey: boolean): number {
	if (allFailed(d)) return FAILED_TTL;
	if (missingSections(d) > 0) return PARTIAL_TTL;
	const left = secondsUntilMidnight(now);
	const standIn =
		hasApodKey &&
		preferredPicture(d.date) === "apod" &&
		d.picture?.kind === "met";
	return standIn && left > AFTER_SEVEN ? left - AFTER_SEVEN : left;
}
