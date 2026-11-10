import { allPlayed, amsterdamDay } from "../lib/day";
import { moonNow, planetsAt, starNow } from "../lib/moon";
import { phaseAt, type SkyPhase, sunAltitude } from "../lib/sun";
import type { Sun } from "../lib/types";
import { bodiesAt, moonPath, PHASE_SUN, SKY, skyAt } from "./sky";

/** The functions the page runs, inlined by their source: each must be self-contained. */
/** Planets by how bright they usually look, so the brighter one keeps its place. */
const BRIGHTEST_FIRST = ["Venus", "Jupiter", "Mars", "Saturn", "Mercury"];

/** Whether two boxes share any area. */
export const overlap = (a: DOMRectReadOnly, b: DOMRectReadOnly) =>
	a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const INLINED = {
	phaseAt,
	sunAltitude,
	skyAt,
	bodiesAt,
	moonNow,
	starNow,
	planetsAt,
	moonPath,
	overlap,
	amsterdamDay,
	allPlayed,
};

type Cfg = {
	sun: Sun;
	forced: string | null;
	ids: string[];
	key: string;
	table: typeof SKY;
	phaseSun: typeof PHASE_SUN;
	planets: [string, number, number][];
	brightest: string[];
} & typeof INLINED;

// Same rules as the server: the sky follows the sun's altitude on the browser clock, and
// the all-played white-out is applied before first paint so a reload does not flash night.
const boot = (cfg: Cfg) => {
	const root = document.documentElement;
	root.classList.add("js");
	const today = () => cfg.amsterdamDay();
	// compared with the load day, not the server's: a wrong device clock must not loop
	const loaded = today();
	const fmt = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Amsterdam",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const favicon = document.querySelector<HTMLLinkElement>(
		"link[rel=icon][type='image/svg+xml']",
	);
	const themeColor = document.querySelector<HTMLMetaElement>(
		"meta[name=theme-color]",
	);
	let lastIcon = "";
	/** The tab icon and the browser bar take the sky's colours. */
	const tint = () => {
		const cs = getComputedStyle(root);
		const c = (n: string) => cs.getPropertyValue(n).trim();
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="${c("--k0")}"/><stop offset=".6" stop-color="${c("--k2")}"/><stop offset="1" stop-color="${c("--k3")}"/></linearGradient></defs><rect width="32" height="32" rx="7" fill="url(#g)"/><path d="M0 25C8 21 14 20 20 23S28 24 32 22V32H0Z" fill="${c("--ground")}"/></svg>`;
		if (svg === lastIcon) return;
		lastIcon = svg;
		if (favicon) favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
		if (themeColor) themeColor.content = c("--k0");
	};
	const paint = (at?: number) => {
		// a tab left open past midnight shows yesterday's paper: fetch today's
		if (today() !== loaded) {
			location.reload();
			return;
		}
		const now = Date.now();
		const skyNow = at ?? now;
		const hhmm = fmt.format(now);
		for (const el of document.querySelectorAll("[data-clock]"))
			el.textContent = hhmm;
		const p = (cfg.forced ?? cfg.phaseAt(cfg.sun, now)) as SkyPhase;
		root.dataset.phase = p;
		const sun = root.hasAttribute("data-whiteout")
			? cfg.phaseSun.day
			: cfg.forced
				? cfg.phaseSun[p]
				: {
						alt: cfg.sunAltitude(skyNow),
						rising: cfg.sunAltitude(skyNow + 600000) > cfg.sunAltitude(skyNow),
					};
		const sky = cfg.skyAt(sun.alt, sun.rising, cfg.table);
		for (const [k, v] of Object.entries(sky.vars)) root.style.setProperty(k, v);
		root.dataset.ground = sky.dark ? "dark" : "light";
		// sun, moon and star: across by hour angle, up by altitude; see `bodiesAt`
		const sky2 = cfg.bodiesAt(
			cfg.sun,
			skyNow,
			sun.alt,
			cfg.moonNow,
			cfg.starNow,
			(t) => cfg.planetsAt(cfg.planets, t),
		);
		for (const el of document.querySelectorAll<HTMLElement>("[data-orb]")) {
			const b = sky2[el.dataset.orb as "sun" | "moon" | "star"];
			el.hidden = !b.show;
			el.style.setProperty("--x", b.x.toFixed(4));
			el.style.setProperty("--alt", b.alt.toFixed(2));
		}
		for (const el of document.querySelectorAll<HTMLElement>("[data-planet]")) {
			const b = sky2.planets.find((p) => p.name === el.dataset.planet);
			el.hidden = !b?.show;
			if (!b) continue;
			el.style.setProperty("--x", b.x.toFixed(4));
			el.style.setProperty("--alt", b.alt.toFixed(2));
		}
		// two bodies close in the sky would stack their buttons: the dimmer planet gives way
		const taken = [
			...document.querySelectorAll<HTMLElement>("[data-orb]:not([hidden])"),
		].map((el) => el.getBoundingClientRect());
		for (const name of cfg.brightest) {
			const el = document.querySelector<HTMLElement>(`[data-planet="${name}"]`);
			if (!el || el.hidden) continue;
			const r = el.getBoundingClientRect();
			if (taken.some((t) => cfg.overlap(t, r))) el.hidden = true;
			else taken.push(r);
		}
		const m = sky2.moon;
		for (const el of document.querySelectorAll("[data-moon-path]"))
			el.setAttribute("d", cfg.moonPath(m, 9));
		for (const el of document.querySelectorAll("[data-moon-line]"))
			el.textContent = m.line;
		for (const el of document.querySelectorAll("[data-moon-label]"))
			el.setAttribute("aria-label", `${m.label}: sun, moon and tide times`);
		for (const el of document.querySelectorAll("[data-star-label]"))
			el.setAttribute(
				"aria-label",
				`${sky2.star.name}: sun, moon and tide times`,
			);
	};
	try {
		const saved = JSON.parse(localStorage.getItem(cfg.key) ?? "{}");
		if (cfg.allPlayed(cfg.ids, saved, today()))
			root.setAttribute("data-whiteout", "");
	} catch {
		// no storage: no white-out
	}
	// the first visit of the day replays the last 45 minutes of sky in one transition
	let replay = false;
	try {
		const day = today();
		replay =
			!cfg.forced &&
			localStorage.getItem("today.sunrise.v1") !== day &&
			!matchMedia("(prefers-reduced-motion: reduce)").matches;
		localStorage.setItem("today.sunrise.v1", day);
	} catch {
		// no storage: no replay
	}
	const repaint = () => {
		if (!document.hidden) paint();
	};
	if (replay) {
		paint(Date.now() - 45 * 60000);
		addEventListener("load", () =>
			requestAnimationFrame(() => requestAnimationFrame(repaint)),
		);
	} else {
		paint();
		document.addEventListener("DOMContentLoaded", repaint);
	}
	document.addEventListener("sky", repaint);
	document.addEventListener("visibilitychange", repaint);
	setInterval(repaint, 30000);
	addEventListener("load", () => setTimeout(tint, 3000));
	setInterval(() => document.hidden || tint(), 60000);
};

/** The inline script that paints the sky before first paint and keeps it moving. */
export function skyBootScript(day: {
	sun: Sun;
	/** The `?phase=` the page keeps, or null to follow the clock. */
	forced: SkyPhase | null;
	ids: string[];
	/** Name, right ascension and declination in degrees, from `planetPositions`. */
	planets?: [string, number, number][];
}): string {
	const cfg = {
		sun: day.sun,
		forced: day.forced,
		ids: day.ids,
		key: "today.games.v1",
		table: SKY,
		phaseSun: PHASE_SUN,
		planets: day.planets ?? [],
		brightest: BRIGHTEST_FIRST,
	};
	const fns = Object.entries(INLINED)
		.map(([name, fn]) => `${JSON.stringify(name)}:${fn.toString()}`)
		.join(",");
	return `(${boot.toString()})(${JSON.stringify(cfg).slice(0, -1)},${fns}})`;
}
