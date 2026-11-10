import type { Quiz, QuizQuestion } from "../types";
import { getJson, safe, seededRandom, shuffled } from "../util";

interface Raw {
	response_code: number;
	results: {
		difficulty: string;
		category: string;
		question: string;
		correct_answer: string;
		incorrect_answers: string[];
	}[];
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

/** `encode=url3986` fields are percent-encoded; answers are shuffled with the date as the seed. */
export function parseQuiz(raw: Raw, date: string): Quiz | null {
	if (raw.response_code !== 0 || raw.results.length === 0) return null;
	const rand = seededRandom(`quiz:${date}`);
	const questions = raw.results.map((r): QuizQuestion => {
		const correct = decodeURIComponent(r.correct_answer);
		const answers = shuffled(
			[correct, ...r.incorrect_answers.map(decodeURIComponent)],
			rand,
		);
		return {
			question: decodeURIComponent(r.question),
			answers,
			correct: answers.indexOf(correct),
			category: decodeURIComponent(r.category),
			difficulty: DIFFICULTIES.find((d) => d === r.difficulty) ?? "medium",
		};
	});
	return {
		questions,
		credit: {
			name: "Open Trivia DB (CC BY-SA 4.0)",
			url: "https://opentdb.com",
		},
	};
}

export const fetchQuiz = (date: string) =>
	safe("opentdb", async () =>
		parseQuiz(
			await getJson<Raw>(
				"https://opentdb.com/api.php?amount=3&type=multiple&encode=url3986",
			),
			date,
		),
	);
