import type { Game } from "./types";

const list: Game[] = [
	{
		id: "factmap",
		name: "Factmap",
		url: "https://www.factmap.world/",
		blurb: "Place the day's facts on the map.",
	},
	{
		id: "timeguessr",
		name: "TimeGuessr",
		url: "https://timeguessr.com/",
		blurb: "Guess where and when a photo was taken.",
	},
	{
		id: "shikaku",
		name: "Shikaku of the day",
		url: "https://shikakuofthe.day/",
		blurb: "Cut the grid into rectangles that match the numbers.",
	},
	{
		id: "krillion",
		name: "Krillion",
		url: "https://krillion.io/",
		blurb: "Seven prompts; the rarer your answer, the deeper you dive.",
	},
	{
		id: "catfishing",
		name: "Catfishing",
		url: "https://catfishing.net/",
		blurb: "Work out which animal is hiding behind the clues.",
	},
	{
		id: "connections",
		name: "Connections",
		url: "https://www.nytimes.com/games/connections",
		blurb: "Sort sixteen words into four groups.",
	},
	{
		id: "wordle",
		name: "Wordle",
		url: "https://www.nytimes.com/games/wordle/index.html",
		blurb: "Five letters, six tries.",
	},
	{
		id: "raddle",
		name: "Raddle",
		url: "https://raddle.quest/",
		blurb: "Order the clues into a word ladder.",
	},
	{
		id: "timdle",
		name: "Timdle",
		url: "https://www.timdle.com/",
		blurb: "Put events in the order they happened.",
	},
	{
		id: "metazooa",
		name: "Metazooa",
		url: "https://metazooa.com/",
		blurb: "Find the mystery animal by how closely related your guesses are.",
	},
];

/** Alphabetical, so a game is easy to find. */
export const games: Game[] = list.toSorted((a, b) =>
	a.name.localeCompare(b.name),
);
