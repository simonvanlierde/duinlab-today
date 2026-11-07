const UA = "duinlab-today/1.0 (https://today.duinlab.nl)";
const TIMEOUT_MS = 4000;

// e2e only: wrangler dev sets FIXTURE_ORIGIN; outside the Worker (unit tests) the module is absent
const fixtureOrigin = import("cloudflare:workers").then(
	(m) => m.env.FIXTURE_ORIGIN,
	() => undefined,
);

/** `https://host/path?q` as `${FIXTURE_ORIGIN}/host/path?q` when that var is set, else `url`. */
export async function upstream(url: string): Promise<string> {
	const origin = await fixtureOrigin;
	return origin ? `${origin}/${url.replace(/^https:\/\//, "")}` : url;
}

export async function getText(url: string, accept = "*/*"): Promise<string> {
	const res = await fetch(await upstream(url), {
		headers: { "user-agent": UA, accept },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	// host and path only: a query string can carry an API key into the logs
	if (!res.ok) {
		const u = new URL(url);
		throw new Error(`${u.host}${u.pathname}: HTTP ${res.status}`);
	}
	return res.text();
}

export async function getJson<T>(url: string): Promise<T> {
	return JSON.parse(await getText(url, "application/json")) as T;
}

/** Runs a source; any failure (network, timeout, unexpected shape) becomes null. */
export async function safe<T>(
	name: string,
	run: () => Promise<T | null>,
): Promise<T | null> {
	try {
		return await run();
	} catch (err) {
		console.warn(
			`source ${name} failed: ${err instanceof Error ? err.message : err}`,
		);
		return null;
	}
}

/** `s` when it is an https URL, else undefined: upstream links go into href and src. */
export const httpsUrl = (s: string | undefined) =>
	s && URL.canParse(s) && new URL(s).protocol === "https:" ? s : undefined;

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	ldquo: "“",
	rdquo: "”",
	lsquo: "‘",
	rsquo: "’",
	mdash: "—",
	ndash: "–",
	hellip: "…",
};

export function decodeEntities(s: string): string {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
		if (e[0] === "#") {
			const code =
				e[1] === "x" || e[1] === "X"
					? Number.parseInt(e.slice(2), 16)
					: Number(e.slice(1));
			return Number.isFinite(code) ? String.fromCodePoint(code) : m;
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});
}

/** Plain text from an HTML fragment; the page escapes it again when it renders. */
export function stripTags(html: string): string {
	let text = html;
	// repeat until stable: one pass leaves "<script" behind in "<scr<b>ipt"
	for (let prev = ""; prev !== text; ) {
		prev = text;
		text = text.replace(/<[^>]*>/g, "");
	}
	return decodeEntities(text).replace(/\s+/g, " ").trim();
}

/** 32-bit FNV-1a, enough to seed a per-day choice. */
function hashString(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** Small seeded PRNG (mulberry32): the same seed gives the same sequence on every visit. */
export function seededRandom(seed: string): () => number {
	let a = hashString(seed);
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
	const a = [...items];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j] as T, a[i] as T];
	}
	return a;
}

const AMS_DATE = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Amsterdam",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** The calendar day in Europe/Amsterdam as YYYY-MM-DD. */
export function amsterdamDate(now: Date): string {
	return AMS_DATE.format(now);
}

/** ISO string with the Europe/Amsterdam offset ("2026-11-06T07:46:12+01:00"). */
export function isoAmsterdam(at: Date): string {
	const f = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Amsterdam",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
		timeZoneName: "longOffset",
	}).formatToParts(at);
	const p = (t: string) => f.find((x) => x.type === t)?.value ?? "";
	const offset = p("timeZoneName").replace("GMT", "") || "+00:00";
	return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}${offset}`;
}

export function dayOfYear(date: string): number {
	const [y, m, d] = date.split("-").map(Number) as [number, number, number];
	return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
}
