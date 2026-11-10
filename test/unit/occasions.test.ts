import { describe, expect, it } from "vitest";
import { daylight } from "../../src/lib/format";
import { easter, occasionLine as occasion } from "../../src/lib/occasions";
import { sunTimes } from "../../src/lib/sun";

const occasionLine = (date: string) => occasion(date)?.text ?? null;

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
		expect(occasionLine("2026-10-10")).toBeNull();
		expect(occasionLine("2027-03-28")).toBe(
			"Easter Sunday. Summer time: the clocks went forward last night",
		);
	});
});

describe("sky events", () => {
	it("names full moons, meteor peaks, solstices and equinoxes, and says they are sky events", () => {
		// full moon 24 Nov 2026 14:53 UTC
		expect(occasion("2026-11-23")).toEqual({
			text: "Full moon tomorrow",
			sky: true,
		});
		expect(occasionLine("2026-11-24")).toBe("Full moon today");
		expect(occasionLine("2026-11-12")).toBe("Leonid peak in 5 days");
		expect(occasionLine("2026-11-17")).toBe("Leonids peak tonight");
		expect(occasionLine("2026-12-18")).toBe("December solstice in 3 days");
		expect(occasionLine("2026-12-21")).toBe(
			"December solstice: the shortest day",
		);
		expect(occasionLine("2027-03-17")).toBe("March equinox in 3 days");
		expect(occasion("2026-12-10")).toEqual({
			text: "Geminid peak in 4 days",
			sky: true,
		});
		expect(occasion("2026-12-02")).toEqual({
			text: "Pakjesavond in 3 days",
			sky: false,
		});
	});

	it("includes only the eclipses that can be seen from The Hague", () => {
		// partial solar eclipse of 12 Aug 2026 in the evening; the lunar one of 3 Mar 2026 is over before moonrise
		expect(occasionLine("2026-08-12")).toMatch(
			/Perseids peak tonight\. Partial solar eclipse, peaking at 20:\d\d/,
		);
		expect(occasionLine("2026-03-03")).not.toMatch(/eclipse/);
		expect(occasionLine("2026-08-28")).toMatch(
			/Partial lunar eclipse, peaking at 06:\d\d/,
		);
	});
});

describe("daylight", () => {
	it("gives the length of the day and its change", () => {
		expect(daylight(sunTimes("2026-11-06"), sunTimes("2026-11-05"))).toMatch(
			/^9 h \d+ min of daylight, [34] min less than yesterday$/,
		);
		expect(daylight(sunTimes("2026-03-21"), sunTimes("2026-03-20"))).toMatch(
			/daylight, \d min more than yesterday$/,
		);
	});
});
