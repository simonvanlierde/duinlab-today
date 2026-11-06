import type { Word } from "../types";
import { decodeEntities, getText, safe, stripTags } from "../util";

const POS: Record<string, string> = {
	n: "noun",
	v: "verb",
	adj: "adjective",
	adv: "adverb",
	prep: "preposition",
	pron: "pronoun",
	conj: "conjunction",
	interj: "interjection",
	phrase: "phrase",
	prov: "proverb",
};

/** The atom feed holds a week of entries; take the one for `date`, else the last. */
export function parseWord(atom: string, date: string): Word | null {
	const entries = atom.split("<entry>").slice(1);
	const entry =
		entries.find((e) => e.includes(`/wotd/${date.replaceAll("-", "")}`)) ??
		entries.at(-1);
	const summary = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(entry ?? "")?.[1];
	if (!summary) return null;
	const html = decodeEntities(summary);
	const word = /<span id="WOTD-rss-title">([^<]+)<\/span>/
		.exec(html)?.[1]
		?.trim();
	if (!word) return null;
	const posAbbr = /id="WOTD-rss-title"[\s\S]*?<\/b>\s*<i>([^<]+)<\/i>/
		.exec(html)?.[1]
		?.trim();
	const desc = html.slice(html.indexOf('id="WOTD-rss-description"'));
	const firstSense = /<li>([\s\S]*?)<\/li>/.exec(desc)?.[1];
	const gloss = firstSense ? stripTags(firstSense) : "";
	if (!gloss) return null;
	return {
		word,
		gloss,
		partOfSpeech: posAbbr ? (POS[posAbbr] ?? posAbbr) : null,
		url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
		credit: {
			name: "Wiktionary",
			url: "https://en.wiktionary.org/wiki/Wiktionary:Word_of_the_day",
		},
	};
}

export const fetchWord = (date: string) =>
	safe("wiktionary", async () =>
		parseWord(
			await getText(
				"https://en.wiktionary.org/w/api.php?action=featuredfeed&feed=wotd&feedformat=atom",
			),
			date,
		),
	);
