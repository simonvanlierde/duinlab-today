import { describe, expect, it } from "vitest";
import { bodiesAt } from "../../src/components/sky";
import { moonNow, starNow } from "../../src/lib/moon";
import { sunAltitude, sunTimes } from "../../src/lib/sun";

// References: astronomy-engine (airless altitude, observer 52.08 N 4.31 E, sea level).
// The series is good to about 1.5 degrees, which is under a pixel at the page's 3 px/degree.
const ALTITUDES: [string, number][] = [
	["2026-11-09T21:00:00Z", -47.88],
	["2026-11-24T22:00:00Z", 57.12],
	["2026-07-15T03:30:00Z", -7.8],
	["2026-03-03T18:00:00Z", 1.92],
];

describe("moonNow", () => {
	it.each(ALTITUDES)(
		"puts the moon at the right altitude at %s",
		(iso, alt) => {
			expect(Math.abs(moonNow(Date.parse(iso)).alt - alt)).toBeLessThan(1.5);
		},
	);

	it("follows the sun-moon angle: new and full moon at their real instants", () => {
		const phaseAt = (iso: string) => moonNow(Date.parse(iso)).phase;
		const newMoon = phaseAt("2026-11-09T07:02:42Z"); // astronomy-engine
		expect(Math.min(newMoon, 1 - newMoon)).toBeLessThan(0.01);
		expect(Math.abs(phaseAt("2026-11-24T14:54:04Z") - 0.5)).toBeLessThan(0.01);
	});

	it("words the phase and the lit part", () => {
		const m = moonNow(Date.parse("2026-11-24T14:54:04Z"));
		expect(m.name).toBe("full moon");
		expect(m.line).toBe("Full moon, 100% lit");
		expect(moonNow(Date.parse("2026-11-09T07:02:42Z")).line).toBe(
			"New moon, 0% lit",
		);
	});

	it("turns the hour angle into -180..180, west positive", () => {
		for (let i = 0; i < 48; i++) {
			const { h } = moonNow(Date.UTC(2026, 10, 9) + i * 1800000);
			expect(h).toBeGreaterThanOrEqual(-180);
			expect(h).toBeLessThan(180);
		}
		// full moon rises at dusk and is on the meridian near midnight
		expect(
			Math.abs(moonNow(Date.parse("2026-11-24T23:30:00Z")).h),
		).toBeLessThan(20);
	});
});

describe("starNow", () => {
	it("names the highest bright star and matches the reference altitude", () => {
		const s = starNow(Date.parse("2026-11-09T21:00:00Z"));
		expect(s.name).toBe("Deneb");
		expect(Math.abs(s.alt - 52.16)).toBeLessThan(0.6); // astronomy-engine
	});

	it("always has a star well up, around the clock and the year", () => {
		for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 3700000)
			expect(starNow(t).alt).toBeGreaterThan(30);
	});
});

describe("bodiesAt", () => {
	const sun = sunTimes("2026-11-24");
	const at = (iso: string) => {
		const now = Date.parse(iso);
		return bodiesAt(sun, now, sunAltitude(now), moonNow, starNow);
	};

	it("shows the sun by day and the moon when it is up at night", () => {
		expect(at("2026-11-24T11:00:00Z").sun.show).toBe(true);
		const night = at("2026-11-24T22:00:00Z"); // full moon, high in the south-east
		expect(night.sun.show).toBe(false);
		expect(night.moon.show).toBe(true);
		expect(night.star.show).toBe(false);
	});

	it("falls back to a star on a dark night without the moon", () => {
		const night = at("2026-11-09T21:00:00Z"); // new moon
		expect(night.sun.show).toBe(false);
		expect(night.moon.show).toBe(false);
		expect(night.star.show).toBe(true);
	});

	it("always offers one, and keeps every x on the page", () => {
		for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 3700000) {
			const b = bodiesAt(sun, t, sunAltitude(t), moonNow, starNow);
			expect([b.sun, b.moon, b.star].some((o) => o.show)).toBe(true);
			for (const o of [b.sun, b.moon, b.star]) {
				expect(o.x).toBeGreaterThanOrEqual(0);
				expect(o.x).toBeLessThanOrEqual(1);
			}
		}
	});
});
