import { describe, expect, it } from "vitest";
import { dayBand } from "../../src/components/dayband";
import { sunTimes } from "../../src/lib/sky";

const pcts = (g: string) =>
	[...g.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));

describe("dayBand", () => {
	it("runs night, blue, golden, day and back, in order, midnight to midnight", () => {
		for (const date of ["2026-06-21", "2026-11-07", "2026-12-21"]) {
			const band = dayBand(date, sunTimes(date));
			const stops = pcts(band.gradient);
			expect(stops[0]).toBe(0);
			expect(stops.at(-1)).toBe(100);
			expect(stops).toEqual([...stops].sort((a, b) => a - b));
			expect(band.gradient.match(/#/g)).toHaveLength(7);
		}
	});

	it("puts the evening golden hour around sunset", () => {
		const band = dayBand("2026-11-07", sunTimes("2026-11-07"));
		// sunset in The Hague on 7 November 2026 is about 16:59
		expect(band.golden[0] < "16:59" && band.golden[1] > "16:59").toBe(true);
		expect(band.golden[0]).toMatch(/^16:/);
	});
});
