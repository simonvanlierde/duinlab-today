import { describe, expect, it } from "vitest";
import { parseEvents } from "../../src/lib/sources/events";
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
			name: "TAKUYA KURODA",
		});
		expect(r?.url).toBe("https://www.paard.nl/event/");
	});

	it("skips cancelled shows, decodes entities, drops events outside the window", () => {
		const r = parseEvents(paard, "2026-11-10");
		expect(r?.items.some((i) => i.name.includes("geannuleerd"))).toBe(false);
		const wide = parseEvents(paard, "2026-11-12");
		expect(wide?.items.every((i) => !i.name.includes("&#"))).toBe(true);
		expect(
			parseEvents(page(ev("Late", "2026-11-17T20:00")), "2026-11-10"),
		).toBeNull();
		expect(
			parseEvents(page(ev("Past", "2026-11-09T20:00")), "2026-11-10"),
		).toBeNull();
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

	it("returns null when there are no events", () => {
		expect(parseEvents("<html></html>", "2026-11-10")).toBeNull();
		expect(parseEvents(page('{"@type":"WebPage"}'), "2026-11-10")).toBeNull();
	});
});
