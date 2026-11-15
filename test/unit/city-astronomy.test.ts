import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/config", () => ({
	site: {
		location: {
			latitude: 42.0451,
			longitude: -87.6877,
			timezone: "America/Chicago",
		},
		content: { holidays: "none" },
		units: { temperature: "celsius", wind: "kmh" },
	},
}));

import { localDay } from "../../src/lib/day";
import { moonNow, planetsAt } from "../../src/lib/moon";
import { occasionLine } from "../../src/lib/occasions";
import { planetPositions } from "../../src/lib/planets";
import { sunAltitude, sunTimes } from "../../src/lib/sun";

const latitude = 42.0451;
const longitude = -87.6877;
const observer = new Observer(latitude, longitude, 0);

describe("Evanston astronomy", () => {
	it.each(["2026-06-21", "2026-11-14"])(
		"keeps sunrise and sunset on the city's %s",
		(day) => {
			const times = sunTimes(day);
			for (const key of ["sunrise", "sunset"] as const) {
				const at = new Date(times[key]);
				expect(localDay(at)).toBe(day);
				const q = Equator(Body.Sun, at, observer, true, true);
				const altitude = Horizon(at, observer, q.ra, q.dec).altitude;
				expect(Math.abs(altitude + 0.833)).toBeLessThan(0.3);
			}
			expect(Date.parse(times.sunset)).toBeGreaterThan(
				Date.parse(times.sunrise),
			);
		},
	);

	it("uses the observer for the sun, moon and browser planet positions", () => {
		const at = new Date("2026-11-14T03:00:00Z");
		for (const [body, actual, tolerance] of [
			[Body.Sun, sunAltitude(at.getTime(), latitude, longitude), 0.3],
			[Body.Moon, moonNow(at.getTime(), latitude, longitude).alt, 1.5],
		] as const) {
			const q = Equator(body, at, observer, true, true);
			expect(
				Math.abs(actual - Horizon(at, observer, q.ra, q.dec).altitude),
			).toBeLessThan(tolerance);
		}
		const positions = planetPositions(at);
		const actual = planetsAt(positions, at.getTime(), latitude, longitude);
		for (const [i, [, ra, dec]] of positions.entries())
			expect(
				Math.abs(
					(actual[i]?.alt ?? 99) - Horizon(at, observer, ra / 15, dec).altitude,
				),
			).toBeLessThan(1);
	});

	it("does not show Dutch holidays when they are disabled", () => {
		expect(occasionLine("2026-12-05")?.text).not.toMatch(/Pakjesavond/);
		expect(occasionLine("2026-04-27")?.text).not.toMatch(/King's Day/);
	});
});
