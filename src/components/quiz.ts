// Quiz answers and finished days, kept in this browser only: the quiz island reads and writes them.
import { amsterdamDay, streak } from "../lib/day";
import type { Quiz } from "../lib/types";

export const KEY = "today.quiz.v1";
const KEEP_DAYS = 60;

/** Saved picks belong to these questions; a rebuilt day can bring new ones. */
export const signature = (quiz: Quiz) =>
	quiz.questions.map((q) => q.question).join("\n");

/**
 * Today's picks for `quiz` (null where unanswered) and the days on which every question was
 * answered. Picks saved on another day or for other questions are dropped.
 */
export function loadQuiz(
	quiz: Quiz,
	day = amsterdamDay(),
): { picks: (number | null)[]; done: string[] } {
	let picks: (number | null)[] = quiz.questions.map(() => null);
	let done: string[] = [];
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (Array.isArray(saved?.done))
			done = saved.done.filter((d: unknown) => typeof d === "string");
		if (
			saved?.day === day &&
			saved.sig === signature(quiz) &&
			Array.isArray(saved.picks)
		)
			picks = picks.map((_, i) =>
				Number.isInteger(saved.picks[i]) &&
				saved.picks[i] >= 0 &&
				saved.picks[i] < quiz.questions[i].answers.length
					? saved.picks[i]
					: null,
			);
	} catch {
		// private window: the quiz still works for this visit
	}
	return { picks, done };
}

/** Saves `picks`; once all are answered, today joins the finished days. Returns those days. */
export function saveQuiz(
	quiz: Quiz,
	picks: (number | null)[],
	done: string[],
	day = amsterdamDay(),
): string[] {
	const finished =
		picks.every((p) => p !== null) && !done.includes(day)
			? [...done, day].slice(-KEEP_DAYS)
			: done;
	try {
		localStorage.setItem(
			KEY,
			JSON.stringify({
				day,
				sig: signature(quiz),
				picks,
				done: finished,
			}),
		);
	} catch {
		// nothing to keep then
	}
	return finished;
}

/** Consecutive days with the whole quiz answered, ending today or yesterday. */
export const quizStreak = (done: string[], day = amsterdamDay()) =>
	streak((d) => done.includes(d), day);
