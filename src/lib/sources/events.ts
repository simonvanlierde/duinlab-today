import { isoAmsterdam, shift } from "../day";
import type { Events, Happening } from "../types";
import { decodeEntities, getText, httpsUrl, safe } from "../util";

// The /event/ archive lists every upcoming show with its JSON-LD in one GET; the home and
// agenda pages carry none. robots.txt only disallows /wp-admin.
const AGENDA = "https://www.paard.nl/event/";
const MAX = 5;
const BLOCK = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;
const LOCAL = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/;

type Node = Record<string, unknown>;

/**
 * Paard writes most show names in capitals: those become title case ("MACY GRAY" to "Macy
 * Gray"). Names with any lower case are the venue's own styling and stay as they are.
 */
export function titleCase(name: string): string {
	if (name !== name.toUpperCase()) return name;
	return name
		.toLowerCase()
		.replace(
			/(^|[\s\-/(&+])(\p{L})/gu,
			(_, sep: string, c: string) => sep + c.toUpperCase(),
		);
}

/** Every Event node in one JSON-LD value: a single object, an array, or an @graph. */
function eventNodes(v: unknown): Node[] {
	if (Array.isArray(v)) return v.flatMap(eventNodes);
	if (!v || typeof v !== "object") return [];
	const n = v as Node;
	const type = [n["@type"]].flat();
	const own = type.some((t) => typeof t === "string" && t.endsWith("Event"))
		? [n]
		: [];
	return [...own, ...eventNodes(n["@graph"])];
}

/** Day and time in Amsterdam: Paard writes local time with no offset; an explicit offset is converted. */
function amsterdamStart(
	s: string,
): { day: string; time: string | null } | null {
	if (/(Z|[+-]\d{2}:?\d{2})$/.test(s) && s.includes("T")) {
		const at = new Date(s);
		if (Number.isNaN(at.getTime())) return null;
		const iso = isoAmsterdam(at);
		return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
	}
	const m = LOCAL.exec(s);
	return m ? { day: m[1] as string, time: m[2] ?? null } : null;
}

/**
 * The next week of shows (`date` through date+6) from the page's JSON-LD: `items` is [] in a
 * week without shows, and the result is null when the page lists no shows at all.
 */
export function parseEvents(html: string, date: string): Events | null {
	const last = shift(date, 6);
	const found: (Happening & { start: string })[] = [];
	let shows = 0;
	for (const m of html.matchAll(BLOCK)) {
		let nodes: Node[];
		try {
			nodes = eventNodes(JSON.parse(m[1] as string));
		} catch {
			continue; // one broken block must not hide the rest
		}
		for (const n of nodes) {
			if (typeof n.name !== "string" || typeof n.startDate !== "string")
				continue;
			shows++;
			if (String(n.eventStatus ?? "").endsWith("EventCancelled")) continue;
			const start = amsterdamStart(n.startDate);
			const url = httpsUrl(typeof n.url === "string" ? n.url : undefined);
			const name = titleCase(decodeEntities(n.name).trim());
			if (!start || !url || !name || start.day < date || start.day > last)
				continue;
			found.push({
				name,
				day: start.day,
				time: start.time,
				venue: "Paard",
				url,
				start: `${start.day}T${start.time ?? "00:00"}`,
			});
		}
	}
	// no shows at all means the page changed; none this week (a summer break) is a real answer
	if (shows === 0) return null;
	found.sort((a, b) => a.start.localeCompare(b.start));
	return {
		items: found.slice(0, MAX).map(({ start: _, ...h }) => h),
		url: AGENDA,
		credit: { name: "Paard", url: AGENDA },
	};
}

export const fetchEvents = (date: string) =>
	safe("events", async () => parseEvents(await getText(AGENDA), date));

/** One item of `agenda/v1` in KV, which a homelab job writes twice a month from Amare and denhaag.com. */
interface AgendaItem {
	venue: string;
	name: string;
	url: string;
	/** YYYY-MM-DD, Europe/Amsterdam */
	start: string;
	time: string | null;
	end: string | null;
}

/**
 * Paard's week plus the agenda's events that start this week (`date` through date+6), sorted,
 * at most MAX. The credit names every venue that has an item.
 */
export function withAgenda(
	paard: Events | null,
	agenda: { items: AgendaItem[] } | null,
	date: string,
): Events | null {
	const last = shift(date, 6);
	const extra: Happening[] = (agenda?.items ?? [])
		.filter((a) => a.start >= date && a.start <= last && httpsUrl(a.url))
		.map((a) => ({
			name: a.name,
			day: a.start,
			time: a.time,
			venue: a.venue,
			url: a.url,
		}));
	if (!paard && extra.length === 0) return null;
	const items = [...(paard?.items ?? []), ...extra]
		.sort((a, b) =>
			`${a.day}T${a.time ?? "00:00"}`.localeCompare(
				`${b.day}T${b.time ?? "00:00"}`,
			),
		)
		.slice(0, MAX);
	const venues = [...new Set(items.map((i) => i.venue))];
	return {
		items,
		url: paard?.url ?? AGENDA,
		credit: {
			name: venues.join(", ") || "Paard",
			url: paard?.credit.url ?? AGENDA,
		},
	};
}
