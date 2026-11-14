import { describe, expect, it } from "vitest";
import { rainLine, sunLines, weekday } from "../../src/lib/format";
import { sunTimes } from "../../src/lib/sun";

it("describes only the remaining rain horizon and distinguishes future rain", () => {
	const now = new Date("2026-11-06T10:30:00Z");
	expect(rainLine([{ time: "11:35", mm: 1 }], now)).toBe(
		"Rain expected around 11:35",
	);
	expect(rainLine([{ time: "11:30", mm: 1 }], now)).toBe("Rain now");
	expect(
		rainLine(
			[
				{ time: "11:30", mm: 0 },
				{ time: "11:35", mm: 0 },
			],
			now,
		),
	).toBe("No rain expected through 11:40");
});

it.each([
	["10:00", 5, "10:05"],
	["10:00", 15, "10:15"],
	["23:55", 5, "00:00"],
])(
	"ends the dry horizon after its last %s interval (%s minutes)",
	(time, interval, end) => {
		expect(
			rainLine([{ time, mm: 0 }], new Date("2026-11-06T09:04:00Z"), interval),
		).toBe(`No rain expected through ${end}`);
	},
);

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
			daylight: "9 h 19 min of daylight, 4 min less than yesterday",
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
