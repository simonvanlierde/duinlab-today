import type { Quote } from "../types";
import { getJson, safe } from "../util";

export function parseQuote(body: unknown): Quote | null {
	const q = Array.isArray(body) ? body[0] : null;
	// Over the rate limit ZenQuotes answers 200 with a notice in place of a quote.
	if (
		!q ||
		typeof q.q !== "string" ||
		typeof q.a !== "string" ||
		q.a === "Zen Quotes"
	)
		return null;
	return {
		text: q.q,
		author: q.a,
		credit: { name: "ZenQuotes", url: "https://zenquotes.io/" },
	};
}

export const fetchQuote = () =>
	safe("zenquotes", async () =>
		parseQuote(await getJson("https://zenquotes.io/api/today")),
	);
