// Stores a day for yesterday in the e2e KV, so /yesterday has something to show.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });
const date = fmt.format(new Date(Date.now() - 86_400_000));
const credit = { name: "Wikipedia", url: "https://en.wikipedia.org/" };
const day = {
	date,
	generatedAt: new Date().toISOString(),
	pictures: [],
	didYouKnow: [
		{
			text: "moss grows on the north side",
			url: "https://en.wikipedia.org/wiki/Moss",
			credit,
		},
	],
	onThisDay: null,
	featured: null,
	word: null,
	quote: { text: "Yesterday's quote.", author: "Ada Lovelace", credit },
	quiz: {
		questions: [
			{
				question: "Which planet is red?",
				answers: ["Venus", "Mars", "Jupiter"],
				correct: 1,
			},
		],
		credit: { name: "Open Trivia DB", url: "https://opentdb.com/" },
	},
	tides: null,
	events: null,
};
const file = ".wrangler/yesterday.json";
writeFileSync(file, JSON.stringify(day));
execFileSync(
	"pnpm",
	[
		"exec",
		"wrangler",
		"kv",
		"key",
		"put",
		`day/v2/${date}`,
		"--path",
		file,
		"--binding",
		"DAYS",
		"--local",
		"--persist-to",
		".wrangler/e2e",
	],
	{ stdio: "inherit" },
);
