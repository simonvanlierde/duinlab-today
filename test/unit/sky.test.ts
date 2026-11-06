import { describe, expect, it } from "vitest";
import { moonAt, phaseAt, sunTimes } from "../../src/lib/sky";
import type { Sun } from "../../src/lib/types";
import meteo from "./fixtures/open-meteo.json";

const minutes = (iso: string) => Date.parse(iso) / 60000;
// Open-Meteo gives local minutes for the same day, in the CET offset of that date.
const local = (s: string) => minutes(`${s}:00+01:00`);

describe("sunTimes", () => {
	it("matches Open-Meteo's sunrise and sunset for 2026-11-06 within 2 minutes", () => {
		const sun = sunTimes("2026-11-06");
		expect(
			Math.abs(minutes(sun.sunrise) - local(meteo.daily.sunrise[0] as string)),
		).toBeLessThanOrEqual(2);
		expect(
			Math.abs(minutes(sun.sunset) - local(meteo.daily.sunset[0] as string)),
		).toBeLessThanOrEqual(2);
		expect(sun.sunrise.endsWith("+01:00")).toBe(true);
	});

	it("puts civil twilight outside sunrise and sunset, and uses summer time in July", () => {
		const sun = sunTimes("2026-07-01");
		expect(Date.parse(sun.dawn)).toBeLessThan(Date.parse(sun.sunrise));
		expect(Date.parse(sun.dusk)).toBeGreaterThan(Date.parse(sun.sunset));
		expect(sun.sunrise).toMatch(/T05:2\d:\d\d\+02:00$/);
		expect(sun.sunset).toMatch(/T22:0\d:\d\d\+02:00$/);
	});
});

describe("phaseAt", () => {
	const sun: Sun = {
		dawn: "2026-11-06T07:10:00+01:00",
		sunrise: "2026-11-06T07:46:00+01:00",
		sunset: "2026-11-06T17:05:00+01:00",
		dusk: "2026-11-06T17:41:00+01:00",
	};
	const at = (hhmm: string) =>
		phaseAt(sun, new Date(`2026-11-06T${hhmm}:00+01:00`));
	it("changes phase exactly on the boundaries", () => {
		expect([at("07:09"), at("07:10"), at("07:45"), at("07:46")]).toEqual([
			"night",
			"first-light",
			"first-light",
			"dawn",
		]);
		expect([at("09:15"), at("09:16"), at("16:04"), at("16:05")]).toEqual([
			"dawn",
			"day",
			"day",
			"dusk",
		]);
		expect([at("17:40"), at("17:41"), at("23:59")]).toEqual([
			"dusk",
			"night",
			"night",
		]);
	});
});

describe("moonAt", () => {
	it("names the phases around known dates", () => {
		expect(moonAt(new Date("2000-01-06T18:14:00Z")).name).toBe("new moon");
		expect(moonAt(new Date("2026-11-09T12:00:00Z")).name).toBe("new moon"); // new moon 2026-11-09
		expect(moonAt(new Date("2026-11-24T12:00:00Z")).name).toBe("full moon"); // full moon 2026-11-24
		expect(moonAt(new Date("2026-11-16T12:00:00Z")).name).toBe("first quarter");
	});
});
