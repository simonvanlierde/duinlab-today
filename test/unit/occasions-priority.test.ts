import { expect, it, vi } from "vitest";

// one made-up sky event on Christmas Day, one on the 27th
vi.mock("../../src/lib/sky-events", () => ({
	skyYear: (y: number) => [
		{
			date: `${y}-12-25`,
			name: "Fake moon",
			today: "Fake moon today",
			sky: true,
		},
		{
			date: `${y}-12-27`,
			name: "Fake moon",
			today: "Fake moon today",
			sky: true,
		},
	],
}));

it("lets a holiday win over a sky event on the same day", async () => {
	const { occasionLine } = await import("../../src/lib/occasions");
	expect(occasionLine("2026-12-25")).toEqual({
		text: "Christmas Day",
		sky: false,
	});
	expect(occasionLine("2026-12-27")).toEqual({
		text: "Fake moon today",
		sky: true,
	});
	expect(occasionLine("2026-12-24")).toEqual({
		text: "Christmas tomorrow",
		sky: false,
	});
});
