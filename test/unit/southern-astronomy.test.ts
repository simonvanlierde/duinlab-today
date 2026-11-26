import { expect, it, vi } from "vitest";

vi.mock("../../src/lib/config", () => ({
  site: {
    location: {
      latitude: -33.87,
      longitude: 151.21,
      timezone: "Australia/Sydney",
    },
    units: { temperature: "celsius", wind: "kmh" },
  },
}));

import { starNow } from "../../src/lib/moon";
import { skyYear } from "../../src/lib/sky-events";

it("reverses the solstice seasons for southern cities", () => {
  const events = skyYear(2026);
  expect(events.find((event) => event.name === "June solstice")?.today).toBe("June solstice: the shortest day");
  expect(events.find((event) => event.name === "December solstice")?.today).toBe("December solstice: the longest day");
});

it("has a visible bright star through the southern year", () => {
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 3700000)
    expect(starNow(t, -33.87, 151.21).alt).toBeGreaterThan(30);
});
