import { describe, expect, it } from "vitest";
import { sunLines } from "../../src/lib/format";
import { moonAt, sunTimes } from "../../src/lib/sun";

describe("sunLines", () => {
	it("gives the almanac's lines for 6 November 2026", () => {
		const date = "2026-11-06";
		expect(
			sunLines({
				date,
				sun: sunTimes(date),
				moon: moonAt(new Date("2026-11-06T11:00:00Z")),
			}),
		).toEqual({
			sunrise: "07:47",
			sunset: "17:05",
			golden: "16:13",
			daylight: "9 h 19 min of daylight, −4 min",
			nextSunrise: "07:48",
			moonName: "Waning crescent",
			moon: "Waning crescent, 13% lit",
		});
	});

	it("reads a full moon as all lit and a new moon as none", () => {
		const date = "2026-11-06";
		const sun = sunTimes(date);
		expect(
			sunLines({ date, sun, moon: { phase: 0.5, name: "full moon" } }).moon,
		).toBe("Full moon, 100% lit");
		expect(
			sunLines({ date, sun, moon: { phase: 0, name: "new moon" } }).moon,
		).toBe("New moon, 0% lit");
	});
});
