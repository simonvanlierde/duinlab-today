import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import { expect, it, vi } from "vitest";

const profile = vi.hoisted(() => ({
	location: {
		latitude: -13.8333,
		longitude: -171.7667,
		timezone: "Pacific/Apia",
	},
}));
vi.mock("../../src/lib/config", () => ({ site: profile }));

import { localDay } from "../../src/lib/day";
import { sunPasses, sunTimes } from "../../src/lib/sun";

it.each(["2026-06-21", "2026-11-14", "2026-12-21"])(
	"keeps date-line solar crossings on local day %s",
	(date) => {
		for (const time of [
			...Object.values(sunTimes(date)),
			sunPasses(date, 6, false),
		]) {
			expect(localDay(new Date(time))).toBe(date);
		}
		const at = new Date(sunTimes(date).sunrise);
		const observer = new Observer(
			profile.location.latitude,
			profile.location.longitude,
			0,
		);
		const q = Equator(Body.Sun, at, observer, true, true);
		expect(
			Math.abs(Horizon(at, observer, q.ra, q.dec).altitude + 0.833),
		).toBeLessThan(0.3);
	},
);
