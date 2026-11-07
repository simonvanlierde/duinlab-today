import { describe, expect, it } from "vitest";
import { SKY, skyAt } from "../../src/components/sky";
import { sunAltitude } from "../../src/lib/sun";

describe("sunAltitude", () => {
	it("puts the sun near the horizon at The Hague's sunrise and highest near noon", () => {
		// 6 November 2026: sunrise 07:47, solar noon about 12:26 Amsterdam (UTC+1)
		expect(
			Math.abs(sunAltitude(Date.parse("2026-11-06T06:47:00Z")) + 0.8),
		).toBeLessThan(0.6);
		const noon = sunAltitude(Date.parse("2026-11-06T11:26:00Z"));
		expect(noon).toBeGreaterThan(21);
		expect(noon).toBeLessThan(23);
		expect(sunAltitude(Date.parse("2026-06-21T11:40:00Z"))).toBeGreaterThan(60);
	});
});

describe("skyAt", () => {
	it("keeps a dark ground until just before sunrise, then a light one", () => {
		expect(skyAt(-4, true, SKY).dark).toBe(true);
		expect(skyAt(-1, true, SKY).dark).toBe(false);
		expect(skyAt(-30, true, SKY).dark).toBe(true);
		expect(skyAt(80, false, SKY).dark).toBe(false);
	});
	it("blends neighbouring stops and shows stars only well after dusk", () => {
		const mid = skyAt(-8, true, SKY).vars;
		expect(mid["--k0"]).toBe("color-mix(in oklab, #070d2c, #0a1030 50.00%)");
		expect(Number(skyAt(-18, false, SKY).vars["--stars"])).toBe(1);
		expect(Number(skyAt(-2, false, SKY).vars["--stars"])).toBe(0);
	});
});
