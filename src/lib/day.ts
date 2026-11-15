import { site } from "./config";

/**
 * The city's calendar day, YYYY-MM-DD. Inlined callers pass the time zone explicitly.
 */
export function localDay(
	d = new Date(),
	timezone = site.location.timezone,
): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
	}).format(d);
}

/** The YYYY-MM-DD day `by` days after `day`. */
export function shift(day: string, by: number): string {
	const d = new Date(`${day}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + by);
	return d.toISOString().slice(0, 10);
}

/** ISO string with the city's offset ("2026-11-06T07:46:12+01:00"). */
export function isoLocal(at: Date, timezone = site.location.timezone): string {
	const f = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
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

/**
 * Consecutive days on which `on` holds, ending `today`. Today not yet done does not break a
 * run that reaches yesterday.
 */
export function streak(on: (day: string) => boolean, today: string): number {
	let day = on(today) ? today : shift(today, -1);
	let n = 0;
	while (on(day)) {
		n++;
		day = shift(day, -1);
	}
	return n;
}

/**
 * Every game played on `day`, from the saved `{id: [days]}` map: the sky rises to full day.
 * Self-contained: the layout inlines it into the page.
 */
export function allPlayed(
	ids: string[],
	played: Record<string, string[] | undefined>,
	day: string,
): boolean {
	return ids.length > 0 && ids.every((id) => !!played[id]?.includes(day));
}
