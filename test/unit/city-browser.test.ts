import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../src/lib/config", async (original) => {
  const actual = await original<typeof import("../../src/lib/config")>();
  return {
    ...actual,
    site: {
      ...actual.site,
      location: {
        ...actual.site.location,
        name: "Evanston",
        latitude: 42.0451,
        longitude: -87.6877,
        timezone: "America/Chicago",
        country: "US",
      },
      units: { temperature: "fahrenheit", wind: "mph" },
    },
  };
});

import { skyBootScript } from "../../src/components/boot";
import { clock, temperature, windLine } from "../../src/lib/format";
import { sunTimes } from "../../src/lib/sun";
import { stubStorage } from "./stub-storage";

afterEach(() => vi.useRealTimers());
it("runs the serialized sky on Chicago's day while Amsterdam is already tomorrow", () => {
  vi.useFakeTimers({ now: new Date("2026-11-07T00:30:00Z") });
  const attrs = new Set<string>();
  const label = { textContent: "" };
  const root = {
    classList: { add: () => {} },
    dataset: {},
    style: { setProperty: () => {} },
    setAttribute: (key: string) => attrs.add(key),
    hasAttribute: (key: string) => attrs.has(key),
  };
  const globals = {
    document: {
      documentElement: root,
      hidden: false,
      querySelector: () => null,
      querySelectorAll: (selector: string) => (selector === "[data-clock]" ? [label] : []),
      addEventListener: () => {},
    },
    localStorage: stubStorage({ "today.games.v1": { puzzle: ["2026-11-06"] } }),
    location: { reload: vi.fn() },
    matchMedia: () => ({ matches: true }),
    addEventListener: () => {},
    setInterval: () => {},
    setTimeout: () => {},
  };
  new Function(
    ...Object.keys(globals),
    skyBootScript({
      sun: sunTimes("2026-11-06"),
      forced: null,
      ids: ["puzzle"],
    }),
  )(...Object.values(globals));
  expect(label.textContent).toBe("18:30");
  expect(attrs.has("data-whiteout")).toBe(true);
  expect(globals.location.reload).not.toHaveBeenCalled();
});
it("converts display units without changing the metric source data", () => {
  expect(temperature(0)).toBe(32);
  expect(temperature(11.6, 1)).toBe(52.9);
  expect(clock(new Date("2026-11-07T00:30:00Z"))).toBe("18:30");
  expect(windLine({ windFrom: "N", windBeaufort: 2, windKmh: 16.09344 } as never)).toContain("10 mph");
});
