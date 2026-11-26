import { describe, expect, it } from "vitest";
import { localDay } from "../../src/lib/day";
import { moonNow } from "../../src/lib/moon";
import { moonTimes } from "../../src/lib/moon-times";

const here = {
  latitude: 52.08,
  longitude: 4.31,
  timezone: "Europe/Amsterdam",
};

describe("moonTimes", () => {
  it("finds horizon crossings for the configured city", () => {
    const times = moonTimes("2026-11-15");
    expect(times.rise).toMatch(/^2026-11-15T13:25:/);
    expect(times.set).toMatch(/^2026-11-15T21:40:/);
    for (const [event, direction] of [
      [times.rise, 1],
      [times.set, -1],
    ] as const) {
      const at = Date.parse(event as string);
      // Independent low-precision moon position brackets the horizon crossing.
      const before = moonNow(at - 20 * 60000, here.latitude, here.longitude);
      const after = moonNow(at + 20 * 60000, here.latitude, here.longitude);
      expect(direction * (before.alt + 0.8)).toBeLessThan(0);
      expect(direction * (after.alt + 0.8)).toBeGreaterThan(0);
    }
  });

  it.each([
    ["2026-03-29", "16:01", "06:18", "+02:00"],
    ["2026-10-25", "16:41", "06:31", "+01:00"],
  ])("uses the local day across daylight saving on %s", (date, rise, set, offset) => {
    const times = moonTimes(date, here);
    expect(times.rise).toMatch(`${date}T${rise}:`);
    expect(times.set).toMatch(`${date}T${set}:`);
    expect(times.rise?.endsWith(offset)).toBe(true);
    expect(times.set?.endsWith(offset)).toBe(true);
  });

  it.each([
    [{ latitude: 1.87, longitude: -157.43, timezone: "Pacific/Kiritimati" }, "2026-11-14", "2026-11-15"],
    [{ latitude: 21.3, longitude: -157.86, timezone: "Pacific/Honolulu" }, "2026-11-15", "2026-11-16"],
  ])("keeps both events on the date across UTC boundaries (%j)", (location, riseUtcDay, setUtcDay) => {
    const times = moonTimes("2026-11-15", location);
    for (const event of [times.rise, times.set]) {
      expect(event).not.toBeNull();
      expect(localDay(new Date(event as string), location.timezone)).toBe("2026-11-15");
    }
    expect(new Date(times.rise as string).toISOString().slice(0, 10)).toBe(riseUtcDay);
    expect(new Date(times.set as string).toISOString().slice(0, 10)).toBe(setUtcDay);
  });

  it("leaves a missing rise or set empty instead of borrowing from another day", () => {
    const noRise = moonTimes("2026-11-02", here);
    expect(noRise.rise).toBeNull();
    expect(noRise.set).toMatch(/^2026-11-02T14:46:/);
    const noSet = moonTimes("2026-11-17", here);
    expect(noSet.rise).toMatch(/^2026-11-17T13:57:/);
    expect(noSet.set).toBeNull();
  });

  it("includes the final hour of a 25-hour local day", () => {
    expect(moonTimes("2033-10-30", here).set).toMatch(/^2033-10-30T23:08:.*\+01:00$/);
  });

  it("has no events on a calendar day skipped at the date line", () => {
    expect(
      moonTimes("2011-12-30", {
        latitude: -13.83,
        longitude: -171.77,
        timezone: "Pacific/Apia",
      }),
    ).toEqual({ rise: null, set: null });
  });

  it("returns no crossings when the moon stays above or below the polar horizon", () => {
    expect(
      moonTimes("2026-06-15", {
        latitude: 69.65,
        longitude: 18.96,
        timezone: "Europe/Oslo",
      }),
    ).toEqual({ rise: null, set: null });
  });
});
