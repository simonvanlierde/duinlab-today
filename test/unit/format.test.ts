import { describe, expect, it } from "vitest";
import { sunLines, weekday } from "../../src/lib/format";
import { sunTimes } from "../../src/lib/sun";

describe("sunLines", () => {
	it("gives the almanac's lines for 6 November 2026", () => {
		const date = "2026-11-06";
		expect(
			sunLines({
				date,
				sun: sunTimes(date),
			}),
		).toEqual({
			sunrise: "07:47",
			sunset: "17:05",
			golden: "16:13",
			daylight: "9 h 19 min of daylight, −4 min",
			nextSunrise: "07:48",
		});
	});
});

describe("weekday", () => {
	it("names today and tomorrow, then the short weekday", () => {
		expect(weekday("2026-11-09", "2026-11-09")).toBe("Today");
		expect(weekday("2026-11-10", "2026-11-09")).toBe("Tomorrow");
		expect(weekday("2026-11-12", "2026-11-09")).toBe("Thu");
	});
});
