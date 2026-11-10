// Played-today state, kept in this browser only: the games island reads and writes it.
import {
	allPlayed as allPlayedOn,
	amsterdamDay,
	streak as run,
	shift,
} from "../lib/day";

export const KEY = "today.games.v1";

export const store = $state({
	/** localStorage was read; before that (server, no script) rows are plain links. */
	ready: false,
	/** localStorage is missing or throws: stay plain. */
	off: false,
	day: "",
	played: {} as Record<string, string[]>,
	ids: [] as string[],
});

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(store.played));
	} catch {
		// private window or full quota: the page keeps working for this visit
	}
}

function load() {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
		const clean: Record<string, string[]> = {};
		if (raw && typeof raw === "object") {
			for (const [id, days] of Object.entries(raw)) {
				if (Array.isArray(days))
					clean[id] = days.filter((d) => typeof d === "string");
			}
		}
		store.played = clean;
		store.off = false;
	} catch {
		store.off = true;
	}
	store.day = amsterdamDay();
	store.ready = true;
	syncSky();
}

export function allPlayed(): boolean {
	return allPlayedOn(store.ids, store.played, store.day);
}

/** Every game played: the sky rises to full day for the rest of the day. */
function syncSky() {
	const root = document.documentElement;
	if (!store.off && allPlayed()) root.setAttribute("data-whiteout", "");
	else root.removeAttribute("data-whiteout");
	document.dispatchEvent(new Event("sky"));
}

let wired = false;
export function init(ids: string[]) {
	store.ids = ids;
	load();
	if (wired) return;
	wired = true;
	// another tab, or a tab left open past Amsterdam midnight
	addEventListener("storage", (e) => e.key === KEY && load());
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) load();
	});
}

export function isPlayed(id: string, day = store.day): boolean {
	return !!store.played[id]?.includes(day);
}

export function mark(id: string) {
	if (isPlayed(id)) return;
	store.played[id] = [...(store.played[id] ?? []), store.day];
	save();
	syncSky();
}

export function playedCount(): number {
	return store.ids.filter((id) => isPlayed(id)).length;
}

/** The last 14 days, oldest first; the last entry is today. */
export function ticks(id: string): boolean[] {
	return Array.from({ length: 14 }, (_, i) =>
		isPlayed(id, shift(store.day, i - 13)),
	);
}

/** Consecutive days played. Today not yet played does not break a run that reaches yesterday. */
export function streak(id: string): number {
	return run((day) => isPlayed(id, day), store.day);
}
