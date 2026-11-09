import { describe, expect, it } from "vitest";
import { parseNearYou } from "../../src/lib/sources/nature";
import inaturalist from "./fixtures/inaturalist.json";

describe("parseNearYou", () => {
	it("reads the top species with names, counts and taxon links", () => {
		const n = parseNearYou(inaturalist, "2026-11-09");
		expect(n?.species).toEqual([
			{
				name: "November Tubic",
				scientific: "Diurnea lipsiella",
				count: 4,
				url: "https://www.inaturalist.org/taxa/522781",
			},
			expect.objectContaining({ name: "Mute Swan", count: 3 }),
			expect.objectContaining({
				name: "Honey Mushroom",
				url: "https://www.inaturalist.org/taxa/192381",
			}),
		]);
		expect(n?.url).toContain("d1=2026-11-03&d2=2026-11-09");
		expect(n?.credit.name).toBe("iNaturalist");
	});

	it("falls back to the scientific name and skips malformed rows", () => {
		const n = parseNearYou(
			{
				results: [
					{ count: 2, taxon: { id: 1, name: "Bellis perennis" } },
					{ count: "x", taxon: { id: 2, name: "Bad" } },
					null,
				],
			},
			"2026-11-09",
		);
		expect(n?.species.map((s) => s.name)).toEqual(["Bellis perennis"]);
	});

	it("returns null on a bad shape, and no species for a quiet week", () => {
		expect(parseNearYou(null, "2026-11-09")).toBeNull();
		expect(parseNearYou({ results: "x" }, "2026-11-09")).toBeNull();
		expect(parseNearYou({ results: [{ count: 1 }] }, "2026-11-09")).toBeNull();
		expect(parseNearYou({ results: [] }, "2026-11-09")?.species).toEqual([]);
	});
});
