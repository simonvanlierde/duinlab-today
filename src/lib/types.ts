// The day's data, as rendered by the page and served at /today.json. When a source fails its
// section is dropped: `didYouKnow` is [], and picture, onThisDay, word, quote, quiz and
// weather are null. Instants are ISO strings (`generatedAt` and `fetchedAt` in UTC, `sun`
// with the Amsterdam offset); `rainNext2h` times are bare HH:MM on the Amsterdam clock.

/** Where an item came from, shown as its credit line. */
export interface Credit {
	name: string;
	url: string;
}

export interface Picture {
	kind: "apod" | "met";
	title: string;
	/** Artist or photographer, when the source names one. */
	by: string | null;
	/** The work's own date as the source gives it ("1889"), not today's date. */
	date: string | null;
	imageUrl: string;
	/** Pixel size when the source gives it, so the page can reserve the right aspect ratio. */
	width: number | null;
	height: number | null;
	alt: string;
	/** The source's own page for the item. */
	pageUrl: string;
	credit: Credit;
}

/** One "Did you know" item. `text` starts after Wikipedia's "... that". */
export interface Fact {
	text: string;
	url: string;
	credit: Credit;
}

export interface OnThisDay {
	year: number;
	text: string;
	url: string;
	credit: Credit;
}

export interface Word {
	word: string;
	/** First sense only, plain text. */
	gloss: string;
	partOfSpeech: string | null;
	url: string;
	credit: Credit;
}

export interface Quote {
	text: string;
	author: string;
	credit: Credit;
}

export interface QuizQuestion {
	question: string;
	/** Shuffled once per day, the same for every visitor. */
	answers: string[];
	/** Index into `answers`. */
	correct: number;
	category: string;
	difficulty: "easy" | "medium" | "hard";
}

export interface Quiz {
	questions: QuizQuestion[];
	credit: Credit;
}

export interface Weather {
	now: {
		temperatureC: number;
		/** WMO weather code, as Open-Meteo gives it. */
		code: number;
		/** Plain words for `code` ("light rain"). */
		description: string;
		/** Percent, 0-100. Tints the sky: overcast is a greyer dawn. */
		cloudCover: number;
		windKmh: number;
		windBeaufort: number;
		/** Compass point the wind comes from ("SW"). */
		windFrom: string;
	};
	today: { maxC: number; minC: number; rainChanceMax: number };
	/** The next two hours in 15-minute steps; `time` is local "HH:MM". */
	rainNext2h: { time: string; mm: number }[];
	/** ISO instant the forecast was fetched; weather is cached for 15 minutes. */
	fetchedAt: string;
	credit: Credit;
}

/** Instants as ISO strings with offset, for The Hague (52.08 N, 4.31 E). */
export interface Sun {
	/** Civil dawn: the sun 6 degrees below the horizon. */
	dawn: string;
	sunrise: string;
	sunset: string;
	/** Civil dusk. */
	dusk: string;
}

export interface Moon {
	/** 0 new, 0.5 full, back to 1. */
	phase: number;
	/** "waxing crescent", "full moon", ... */
	name: string;
}

export interface Game {
	/** Stable key for localStorage. */
	id: string;
	name: string;
	url: string;
	/** One short line on what you do in it. */
	blurb: string;
}

/** A paper's top story, linked to the paper. */
export interface Headline {
	title: string;
	url: string;
	/** The paper's short name ("NOS", "BBC"). */
	source: string;
}

export interface Today {
	/** The day in Europe/Amsterdam, YYYY-MM-DD. */
	date: string;
	/** ISO instant the day's data was built. */
	generatedAt: string;
	sun: Sun;
	moon: Moon;
	picture: Picture | null;
	didYouKnow: Fact[];
	onThisDay: OnThisDay | null;
	word: Word | null;
	quote: Quote | null;
	quiz: Quiz | null;
	weather: Weather | null;
	/** Up to five, one per paper; [] when every feed failed. Cached for 30 minutes. */
	news: Headline[];
	games: Game[];
}
