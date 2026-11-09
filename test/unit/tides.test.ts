import { describe, expect, it } from "vitest";
import { parseTides } from "../../src/lib/sources/tides";
import fixture from "./fixtures/tides.json?raw";

const series = (...pts: [string, number][]) =>
	JSON.stringify({
		WaarnemingenLijst: [
			{
				MetingenLijst: pts.map(([t, v]) => ({
					Tijdstip: t,
					Meetwaarde: { Waarde_Numeriek: v },
				})),
			},
		],
	});

describe("parseTides", () => {
	it("reads one Amsterdam day from the recorded response", () => {
		const t = parseTides(fixture, "2026-11-09");
		expect(t?.events).toEqual([
			{ kind: "high", at: "02:48", heightCm: 121 },
			{ kind: "low", at: "10:39", heightCm: -43 },
			{ kind: "high", at: "15:05", heightCm: 118 },
			{ kind: "low", at: "22:43", heightCm: -56 },
		]);
		expect(t?.credit.name).toBe("Rijkswaterstaat");
		expect(t?.url).toMatch(/^https:/);
	});

	it("is null for empty, garbage or a day without events", () => {
		expect(parseTides("", "2026-11-09")).toBeNull();
		expect(parseTides("<html>", "2026-11-09")).toBeNull();
		expect(parseTides("{}", "2026-11-09")).toBeNull();
		expect(parseTides(fixture, "2026-12-25")).toBeNull();
	});

	it("puts 23:30Z on the next Amsterdam day in winter, and shifts for summer time", () => {
		const body = series(
			["2026-01-10T20:00:00Z", 100],
			["2026-01-10T23:30:00Z", -50],
			["2026-07-10T21:30:00Z", 90],
			["2026-07-11T03:00:00Z", -40],
		);
		expect(parseTides(body, "2026-01-10")?.events.map((e) => e.at)).toEqual([
			"21:00",
		]);
		expect(parseTides(body, "2026-01-11")?.events).toEqual([
			{ kind: "low", at: "00:30", heightCm: -50 },
		]);
		expect(parseTides(body, "2026-07-10")?.events[0]?.at).toBe("23:30");
	});
});
