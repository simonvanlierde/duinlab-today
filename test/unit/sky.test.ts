import { describe, expect, it } from "vitest";
import { phaseAt } from "../../src/components/sky";
import { moonAt, sunTimes } from "../../src/lib/sky";
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

describe("sunTimes across the clock changes (last Sundays of March and October 2026)", () => {
	const offsets = (date: string) =>
		Object.values(sunTimes(date)).map((iso) => iso.slice(-6));
	const clockMinutes = (iso: string) =>
		Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

	it("switches to +02:00 on 29 March, and the clock times jump an hour later", () => {
		expect(offsets("2026-03-28")).toEqual(Array(4).fill("+01:00"));
		expect(offsets("2026-03-29")).toEqual(Array(4).fill("+02:00"));
		const before = sunTimes("2026-03-28");
		const after = sunTimes("2026-03-29");
		// an hour on the clock, less the ~2 minutes earlier sunrise of a spring day
		const shift = clockMinutes(after.sunrise) - clockMinutes(before.sunrise);
		expect(shift).toBeGreaterThan(55);
		expect(shift).toBeLessThan(60);
		expect(after.sunrise).toMatch(/^2026-03-29T07:\d\d:\d\d\+02:00$/);
	});

	it("switches back to +01:00 on 25 October, and the clock times jump an hour earlier", () => {
		expect(offsets("2026-10-24")).toEqual(Array(4).fill("+02:00"));
		expect(offsets("2026-10-25")).toEqual(Array(4).fill("+01:00"));
		const before = sunTimes("2026-10-24");
		const after = sunTimes("2026-10-25");
		const shift = clockMinutes(before.sunrise) - clockMinutes(after.sunrise);
		expect(shift).toBeGreaterThan(55);
		expect(shift).toBeLessThan(60);
		expect(after.sunset).toMatch(/^2026-10-25T17:2\d:\d\d\+01:00$/);
	});

	it("keeps each instant: the ISO string parses back to the UTC crossing", () => {
		for (const date of ["2026-03-29", "2026-10-25"])
			for (const iso of Object.values(sunTimes(date)))
				expect(new Date(Date.parse(iso)).toISOString().slice(0, 10)).toBe(date);
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
		phaseAt(sun, Date.parse(`2026-11-06T${hhmm}:00+01:00`));
	it("changes phase exactly on the boundaries", () => {
		// first light to halfway between dawn and sunrise, dawn to 30 min after sunrise, dusk from 30 min before sunset
		expect([at("07:09"), at("07:10"), at("07:27"), at("07:28")]).toEqual([
			"night",
			"first-light",
			"first-light",
			"dawn",
		]);
		expect([at("08:15"), at("08:16"), at("16:34"), at("16:35")]).toEqual([
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
