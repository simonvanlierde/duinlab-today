import { describe, expect, it } from "vitest";
import {
	parseEvents,
	titleCase,
	withAgenda,
} from "../../src/lib/sources/events";
import paard from "./fixtures/paard.html?raw";

const page = (...blocks: string[]) =>
	blocks
		.map((b) => `<script type="application/ld+json">${b}</script>`)
		.join("");
const ev = (name: string, startDate: string, extra = "") =>
	`{"@type":"Event","name":"${name}","url":"https://www.paard.nl/event/x/","startDate":"${startDate}"${extra}}`;

describe("parseEvents", () => {
	it("takes the next week of shows, sorted, at most five", () => {
		const r = parseEvents(paard, "2026-11-10");
		expect(r?.items).toHaveLength(5);
		const days = r?.items.map((i) => i.day) ?? [];
		expect(days).toEqual([...days].sort());
		expect(days.every((d) => d >= "2026-11-10" && d <= "2026-11-16")).toBe(
			true,
		);
		expect(r?.items[0]).toMatchObject({
			day: "2026-11-10",
			time: "19:20",
			name: "Takuya Kuroda",
		});
		expect(r?.url).toBe("https://www.paard.nl/event/");
	});

	it("skips cancelled shows, decodes entities, drops events outside the window", () => {
		const r = parseEvents(paard, "2026-11-10");
		expect(r?.items.some((i) => i.name.includes("geannuleerd"))).toBe(false);
		const wide = parseEvents(paard, "2026-11-12");
		expect(wide?.items.every((i) => !i.name.includes("&#"))).toBe(true);
		expect(
			parseEvents(page(ev("Late", "2026-11-17T20:00")), "2026-11-10")?.items,
		).toEqual([]);
		expect(
			parseEvents(page(ev("Past", "2026-11-09T20:00")), "2026-11-10")?.items,
		).toEqual([]);
	});

	it("handles @graph, arrays and single objects, and https urls only", () => {
		const html = page(
			`{"@graph":[${ev("A", "2026-11-11T20:00")}]}`,
			`[${ev("B", "2026-11-12T20:00")}]`,
			ev("C", "2026-11-13T20:00").replace("https:", "http:"),
			ev("D &#038; E", "2026-11-14T19:00"),
		);
		expect(parseEvents(html, "2026-11-10")?.items.map((i) => i.name)).toEqual([
			"A",
			"B",
			"D & E",
		]);
	});

	it("converts an explicit offset to Amsterdam time", () => {
		const r = parseEvents(page(ev("Z", "2026-11-11T23:30:00Z")), "2026-11-10");
		expect(r?.items[0]).toMatchObject({ day: "2026-11-12", time: "00:30" });
	});

	it("skips a malformed block without losing the rest", () => {
		const r = parseEvents(
			page("{not json", ev("Ok", "2026-11-11T20:00")),
			"2026-11-10",
		);
		expect(r?.items.map((i) => i.name)).toEqual(["Ok"]);
	});

	it("returns null when the page lists no shows, and no items for a week without any", () => {
		expect(parseEvents("<html></html>", "2026-11-10")).toBeNull();
		expect(parseEvents(page('{"@type":"WebPage"}'), "2026-11-10")).toBeNull();
		expect(parseEvents(paard, "2027-07-01")?.items).toEqual([]);
	});
});

describe("titleCase", () => {
	it("title-cases names in capitals and leaves mixed case alone", () => {
		expect(titleCase("MACY GRAY")).toBe("Macy Gray");
		expect(titleCase("QUEEN’S PLEASURE")).toBe("Queen’s Pleasure");
		expect(titleCase("HAAGSCH COLLEGE: MINDER TELEFOON")).toBe(
			"Haagsch College: Minder Telefoon",
		);
		expect(titleCase("SEA-FOAM (LIVE)")).toBe("Sea-Foam (Live)");
		expect(titleCase("Paardcafé: Club Pony!")).toBe("Paardcafé: Club Pony!");
	});
});

describe("withAgenda", () => {
	const paard = {
		items: [
			{
				name: "Show",
				day: "2026-11-12",
				time: "20:00",
				venue: "Paard",
				url: "https://www.paard.nl/event/show",
			},
		],
		url: "https://www.paard.nl/event/",
		credit: { name: "Paard", url: "https://www.paard.nl/event/" },
	};
	const item = (start: string, time: string | null, venue = "Amare") => ({
		venue,
		name: `${venue} ${start}`,
		url: `https://www.amare.nl/en/agenda/${start}`,
		start,
		time,
		end: null,
	});

	it("adds this week's agenda items in time order and credits each venue", () => {
		const r = withAgenda(
			paard,
			{ items: [item("2026-11-11", "19:00"), item("2026-11-30", "19:00")] },
			"2026-11-10",
		);
		expect(r?.items.map((i) => i.venue)).toEqual(["Amare", "Paard"]);
		expect(r?.credit.name).toBe("Amare, Paard");
	});

	it("keeps Paard alone when the agenda is missing, and the agenda alone when Paard failed", () => {
		expect(withAgenda(paard, null, "2026-11-10")).toEqual(paard);
		expect(
			withAgenda(null, { items: [item("2026-11-10", null)] }, "2026-11-10")
				?.items,
		).toHaveLength(1);
		expect(
			withAgenda(null, { items: [item("2026-11-30", null)] }, "2026-11-10"),
		).toBeNull();
	});

	it("takes at most two per venue when there are several", () => {
		const many = ["2026-11-10", "2026-11-11", "2026-11-12"].map((d) =>
			item(d, "09:00", "DenHaag.com"),
		);
		const r = withAgenda(paard, { items: many }, "2026-11-10");
		expect(r?.items.map((i) => i.venue)).toEqual([
			"DenHaag.com",
			"DenHaag.com",
			"Paard",
		]);
	});
});
