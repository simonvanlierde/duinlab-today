import { Horizon, Observer } from "astronomy-engine";
import { describe, expect, it } from "vitest";
import { bodiesAt } from "../../src/components/sky";
import { moonNow, planetsAt, starNow } from "../../src/lib/moon";
import {
	planetPositions,
	planetsBetween,
	planetsTonight,
} from "../../src/lib/planets";
import { sunAltitude, sunTimes } from "../../src/lib/sun";

describe("planets", () => {
	it("the sky script's altitude agrees with astronomy-engine within a degree", () => {
		const at = new Date("2026-11-10T20:00:00Z");
		const planets = planetPositions(at);
		const mine = planetsAt(planets, at.getTime());
		for (const [i, [, ra, dec]] of planets.entries()) {
			const ref = Horizon(at, new Observer(52.08, 4.31, 0), ra / 15, dec);
			expect(Math.abs((mine[i]?.alt ?? 99) - ref.altitude)).toBeLessThan(1);
		}
	});

	it("says where and when for the night of 10 November 2026", () => {
		// Saturn rose before dusk and sets after 03:00, Jupiter rises after midnight, Mars and the morning stars come later
		const line = planetsBetween(
			new Date(sunTimes("2026-11-10").dusk),
			new Date(sunTimes("2026-11-11").dawn),
		);
		expect(line).toMatch(/Saturn in the south until 0[23]:\d\d/);
		expect(line).toMatch(/Jupiter in the east from 00:\d\d/);
		expect(line).toMatch(/Mars in the east from 0\d:\d\d/);
	});

	it("says all night for a planet that is up through the window", () => {
		const hour = (h: number) => new Date(Date.UTC(2026, 10, 10, h));
		expect(planetsBetween(hour(20), hour(21))).toMatch(
			/Saturn in the south all night/,
		);
	});

	it("tonight starts at now once it is dark, and before dawn means the night in progress", () => {
		const late = planetsTonight("2026-11-10", new Date("2026-11-10T22:30:00Z"));
		// 23:30 Amsterdam: nothing can start "from" an hour that has passed
		expect(late ?? "").not.toMatch(/from 1[89]:|from 2[01]:/);
		const early = planetsTonight(
			"2026-11-10",
			new Date("2026-11-10T01:00:00Z"),
		);
		expect(early).toBeTruthy();
	});

	it("shows planets only in the dark and above 3 degrees, placed like the stars", () => {
		const sun = sunTimes("2026-11-10");
		const planets = planetPositions(new Date("2026-11-10T20:00:00Z"));
		const at = (iso: string) => {
			const now = Date.parse(iso);
			return bodiesAt(sun, now, sunAltitude(now), moonNow, starNow, (t) =>
				planetsAt(planets, t),
			);
		};
		expect(at("2026-11-10T11:00:00Z").planets.some((p) => p.show)).toBe(false);
		const night = at("2026-11-10T20:00:00Z");
		const shown = night.planets.filter((p) => p.show);
		expect(shown.length).toBeGreaterThan(0);
		for (const p of shown) {
			expect(p.alt).toBeGreaterThan(3);
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.x).toBeLessThanOrEqual(1);
		}
		expect(bodiesAt(sun, 0, -20, moonNow, starNow).planets).toEqual([]);
	});
});
