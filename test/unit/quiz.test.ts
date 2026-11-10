import { afterEach, describe, expect, it, vi } from "vitest";
import {
	KEY,
	loadQuiz,
	quizStreak,
	saveQuiz,
	signature,
} from "../../src/components/quiz";
import type { Quiz } from "../../src/lib/types";
import { stubStorage } from "./stub-storage";

const quiz = {
	questions: [
		{ question: "One?", answers: ["a", "b"], correct: 1 },
		{ question: "Two?", answers: ["a", "b", "c", "d"], correct: 0 },
	],
	credit: { name: "Open Trivia DB", url: "https://opentdb.com/" },
} as unknown as Quiz;
const day = "2026-11-06";

afterEach(() => vi.unstubAllGlobals());

describe("quiz store", () => {
	it("keeps today's picks for the same questions, and the finished days", () => {
		vi.stubGlobal(
			"localStorage",
			stubStorage({
				[KEY]: {
					day,
					sig: signature(quiz),
					picks: [1, "x"],
					done: ["2026-11-05", 3],
				},
			}),
		);
		expect(loadQuiz(quiz, day)).toEqual({
			picks: [1, null],
			done: ["2026-11-05"],
		});
	});

	it("drops picks from another day or for other questions", () => {
		const saved = { sig: signature(quiz), picks: [1, 0], done: [] };
		vi.stubGlobal(
			"localStorage",
			stubStorage({ [KEY]: { ...saved, day: "2026-11-05" } }),
		);
		expect(loadQuiz(quiz, day).picks).toEqual([null, null]);
		vi.stubGlobal(
			"localStorage",
			stubStorage({ [KEY]: { ...saved, day, sig: "Old?" } }),
		);
		expect(loadQuiz(quiz, day).picks).toEqual([null, null]);
	});

	it("starts empty when storage throws", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("denied");
			},
		});
		expect(loadQuiz(quiz, day)).toEqual({ picks: [null, null], done: [] });
	});

	it("saves the picks, and adds today to the finished days once all are answered", () => {
		const store = stubStorage();
		vi.stubGlobal("localStorage", store);
		expect(saveQuiz(quiz, [1, null], ["2026-11-05"], day)).toEqual([
			"2026-11-05",
		]);
		expect(saveQuiz(quiz, [1, 2], ["2026-11-05"], day)).toEqual([
			"2026-11-05",
			day,
		]);
		expect(JSON.parse(store.getItem(KEY) ?? "")).toEqual({
			day,
			sig: "One?\nTwo?",
			picks: [1, 2],
			done: ["2026-11-05", day],
		});
		expect(quizStreak(["2026-11-05", day], day)).toBe(2);
		expect(quizStreak(["2026-11-05"], day)).toBe(1);
	});
});
