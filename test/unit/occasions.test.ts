import { describe, expect, it } from "vitest";
import { daylight } from "../../src/components/sky";
import { easter, occasionLine } from "../../src/lib/occasions";
import { sunTimes } from "../../src/lib/sky";

describe("occasions", () => {
	it("computes Easter", () => {
		expect(easter(2026)).toEqual([4, 5]);
		expect(easter(2027)).toEqual([3, 28]);
		expect(easter(2025)).toEqual([4, 20]);
	});
	it("names the day, tomorrow, or a few days ahead, across the year end", () => {
		expect(occasionLine("2026-11-06")).toBe("Sint-Maarten in 5 days");
		expect(occasionLine("2026-11-11")).toMatch(/^Sint-Maarten: lanterns/);
		expect(occasionLine("2026-12-04")).toBe("Pakjesavond tomorrow");
		expect(occasionLine("2026-12-31")).toMatch(/Oliebollen/);
		expect(occasionLine("2027-01-01")).toMatch(/^New Year's Day/);
		expect(occasionLine("2026-04-26")).toMatch(/King's Day/); // 27 April 2026 is a Monday
		expect(occasionLine("2026-10-25")).toMatch(/clocks went back/);
		expect(occasionLine("2026-08-01")).toBeNull();
	});
});

describe("daylight", () => {
	it("gives the length of the day and its change", () => {
		expect(daylight(sunTimes("2026-11-06"), sunTimes("2026-11-05"))).toMatch(
			/^9 h \d+ min of daylight, −[34] min$/,
		);
		expect(daylight(sunTimes("2026-03-21"), sunTimes("2026-03-20"))).toMatch(
			/daylight, \+\d min$/,
		);
	});
});
