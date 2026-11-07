import { describe, expect, it } from "vitest";
import {
	allPlayed,
	amsterdamDay,
	dayOfYear,
	isoAmsterdam,
	shift,
	streak,
} from "../../src/lib/day";

describe("amsterdamDay", () => {
	it("turns over at Amsterdam midnight, not UTC midnight", () => {
		expect(amsterdamDay(new Date("2026-11-06T22:59:00Z"))).toBe("2026-11-06");
		expect(amsterdamDay(new Date("2026-11-06T23:00:00Z"))).toBe("2026-11-07");
		// summer time: midnight is 22:00 UTC
		expect(amsterdamDay(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
	});
});

describe("shift", () => {
	it("crosses month, year and clock-change boundaries", () => {
		expect(shift("2026-11-01", -1)).toBe("2026-10-31");
		expect(shift("2026-12-31", 1)).toBe("2027-01-01");
		expect(shift("2026-03-29", 1)).toBe("2026-03-30");
		expect(shift("2028-02-28", 1)).toBe("2028-02-29");
	});
});

describe("isoAmsterdam and dayOfYear", () => {
	it("writes the local offset of the date", () => {
		expect(isoAmsterdam(new Date("2026-11-06T06:46:12Z"))).toBe(
			"2026-11-06T07:46:12+01:00",
		);
		expect(isoAmsterdam(new Date("2026-07-01T03:20:00Z"))).toBe(
			"2026-07-01T05:20:00+02:00",
		);
		expect(dayOfYear("2026-01-01")).toBe(1);
		expect(dayOfYear("2026-11-06")).toBe(310);
	});
});

describe("streak", () => {
	const on =
		(...days: string[]) =>
		(d: string) =>
			days.includes(d);
	it("counts back from today, or from yesterday while today is still open", () => {
		expect(streak(on("2026-11-05", "2026-11-06"), "2026-11-06")).toBe(2);
		expect(streak(on("2026-11-04", "2026-11-05"), "2026-11-06")).toBe(2);
		expect(streak(on("2026-11-04", "2026-11-06"), "2026-11-06")).toBe(1);
		expect(streak(on("2026-11-04"), "2026-11-06")).toBe(0);
		expect(streak(on(), "2026-11-06")).toBe(0);
	});
});

describe("allPlayed", () => {
	it("needs every game played on that day, and at least one game", () => {
		const day = "2026-11-06";
		expect(
			allPlayed(["a", "b"], { a: [day], b: ["2026-11-05", day] }, day),
		).toBe(true);
		expect(allPlayed(["a", "b"], { a: [day], b: ["2026-11-05"] }, day)).toBe(
			false,
		);
		expect(allPlayed(["a", "b"], { a: [day] }, day)).toBe(false);
		expect(allPlayed([], {}, day)).toBe(false);
	});
});
