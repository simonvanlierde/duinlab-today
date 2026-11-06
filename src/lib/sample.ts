import type { Today } from "./types";

const wikipedia = { name: "Wikipedia", url: "https://en.wikipedia.org/" };

export const sample: Today = {
	date: "2026-11-06",
	generatedAt: "2026-11-06T05:00:00+01:00",
	sun: {
		dawn: "2026-11-06T07:00:00+01:00",
		sunrise: "2026-11-06T07:38:00+01:00",
		sunset: "2026-11-06T16:59:00+01:00",
		dusk: "2026-11-06T17:37:00+01:00",
	},
	moon: { phase: 0.9, name: "waning crescent" },
	picture: {
		kind: "met",
		title: "Wheat Field with Cypresses",
		by: "Vincent van Gogh",
		date: "1889",
		imageUrl:
			"https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg",
		width: 599,
		height: 477,
		alt: "A golden wheat field swept by wind, dark cypress trees rising on the right under a sky of churning white and blue clouds.",
		pageUrl: "https://www.metmuseum.org/art/collection/search/436535",
		credit: {
			name: "The Met, public domain",
			url: "https://www.metmuseum.org/",
		},
	},
	didYouKnow: [
		{
			text: "Cinema '76 adopted three cats named after a series of independent Philippine films?",
			url: "https://en.wikipedia.org/wiki/Cinema_%2776",
			credit: wikipedia,
		},
		{
			text: "the lighthouse keeper's daughter rowed out through the storm to bring the oil for the lamp?",
			url: "https://en.wikipedia.org/wiki/Lighthouse",
			credit: wikipedia,
		},
		{
			text: "a pocket-sized atlas of canal locks was printed in a run of only forty copies?",
			url: "https://en.wikipedia.org/wiki/Canal",
			credit: wikipedia,
		},
	],
	onThisDay: {
		year: 1913,
		text: "Mahatma Gandhi was arrested while leading the Great March of Indian miners in South Africa.",
		url: "https://en.wikipedia.org/wiki/Mahatma_Gandhi",
		credit: wikipedia,
	},
	word: {
		word: "sax",
		gloss: "Clipping of saxophone.",
		partOfSpeech: "noun",
		url: "https://en.wiktionary.org/wiki/sax",
		credit: { name: "Wiktionary", url: "https://en.wiktionary.org/" },
	},
	quote: {
		text: "The journey of a thousand miles begins with a single step.",
		author: "Lao Tzu",
		credit: { name: "ZenQuotes", url: "https://zenquotes.io/" },
	},
	quiz: {
		credit: {
			name: "Open Trivia DB (CC BY-SA 4.0)",
			url: "https://opentdb.com/",
		},
		questions: [
			{
				category: "Geography",
				difficulty: "easy",
				question: "Which river flows through Cairo?",
				answers: ["Nile", "Tigris", "Danube", "Congo"],
				correct: 0,
			},
			{
				category: "Science",
				difficulty: "easy",
				question: "What is the chemical symbol for gold?",
				answers: ["Ag", "Au", "Gd", "Go"],
				correct: 1,
			},
			{
				category: "Art",
				difficulty: "medium",
				question: "Which painter is known for the series Sunflowers?",
				answers: [
					"Pierre-Auguste Renoir",
					"Paul Cezanne",
					"Vincent van Gogh",
					"Edvard Munch",
				],
				correct: 2,
			},
			{
				category: "Music",
				difficulty: "medium",
				question: "Which instrument did Adolphe Sax invent?",
				answers: ["The oboe", "The saxophone", "The clarinet", "The tuba"],
				correct: 1,
			},
			{
				category: "History",
				difficulty: "hard",
				question: "In which year did the Berlin Wall fall?",
				answers: ["1987", "1991", "1989", "1985"],
				correct: 2,
			},
		],
	},
	weather: {
		now: {
			temperatureC: 8,
			code: 3,
			description: "overcast",
			cloudCover: 88,
			windKmh: 19,
			windBeaufort: 4,
			windFrom: "SW",
		},
		today: { maxC: 10, minC: 6, rainChanceMax: 40 },
		rainNext2h: [
			{ time: "07:30", mm: 0 },
			{ time: "07:45", mm: 0 },
			{ time: "08:00", mm: 0 },
			{ time: "08:15", mm: 0 },
			{ time: "08:30", mm: 0 },
			{ time: "08:45", mm: 0 },
			{ time: "09:00", mm: 0 },
			{ time: "09:15", mm: 0.2 },
		],
		fetchedAt: "2026-11-06T07:30:00+01:00",
		credit: { name: "Open-Meteo", url: "https://open-meteo.com/" },
	},
	games: [
		{
			id: "factmap",
			name: "factmap",
			url: "https://www.factmap.world/",
			blurb: "Place a fact on the world map.",
		},
		{
			id: "timeguessr",
			name: "TimeGuessr",
			url: "https://timeguessr.com/",
			blurb: "Guess where and when a photo was taken.",
		},
		{
			id: "shikaku",
			name: "Shikaku",
			url: "https://shikakuofthe.day/",
			blurb: "Divide the grid into rectangles.",
		},
		{
			id: "krillion",
			name: "Krillion",
			url: "https://krillion.io/",
			blurb: "Guess the number behind the clues.",
		},
		{
			id: "catfishing",
			name: "Catfishing",
			url: "https://catfishing.net/",
			blurb: "Work out who the picture shows.",
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
			blurb: "Find the five-letter word in six tries.",
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
			url: "https://timdle.com/",
			blurb: "Put the events in order of time.",
		},
		{
			id: "metazooa",
			name: "Metazooa",
			url: "https://metazooa.com/",
			blurb: "Find the mystery animal by relatives.",
		},
	],
};
