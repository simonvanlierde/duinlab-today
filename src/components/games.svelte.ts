// Played-today state, kept in this browser only. Shared by the board and the list islands.
export const KEY = "today.games.v1";
const KEEP_DAYS = 60;

/** The Europe/Amsterdam day, YYYY-MM-DD: the day turns over at Amsterdam midnight. */
export function amsterdamDay(d = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Amsterdam",
	}).format(d);
}

/** The YYYY-MM-DD day `by` days after `day`. */
export function shift(day: string, by: number): string {
	const d = new Date(`${day}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + by);
	return d.toISOString().slice(0, 10);
}

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
		const cutoff = shift(store.day, -KEEP_DAYS);
		const out: Record<string, string[]> = {};
		for (const [id, days] of Object.entries(store.played))
			out[id] = days.filter((d) => d >= cutoff);
		localStorage.setItem(KEY, JSON.stringify(out));
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
	return store.ids.length > 0 && store.ids.every((id) => isPlayed(id));
}

/** All ten played: the sky rises to full day for the rest of the day. */
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

export function unmark(id: string) {
	store.played[id] = (store.played[id] ?? []).filter((d) => d !== store.day);
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
	let day = isPlayed(id) ? store.day : shift(store.day, -1);
	let n = 0;
	while (isPlayed(id, day)) {
		n++;
		day = shift(day, -1);
	}
	return n;
}

export function anyHistory(): boolean {
	return store.ids.some((id) => (store.played[id]?.length ?? 0) > 0);
}
