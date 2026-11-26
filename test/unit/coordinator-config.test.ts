import { describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  site: { url: "https://example.org" },
  location: { timezone: "Australia/Sydney" },
  content: { pictures: [] },
}));
vi.mock("../../src/lib/config", () => ({
  site: config,
  configKey: "sydney",
}));
vi.mock("../../src/lib/build", () => ({ allFailed: () => false }));
vi.mock("cloudflare:workers", () => ({
  env: {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
const { DayCoordinator } = await import("../../src/lib/day-coordinator");

describe("local retention boundary", () => {
  it("reads only its own configuration's mirror", async () => {
    const get = vi.fn(async (..._args: unknown[]) => null);
    const owner = new DayCoordinator(
      {
        storage: { get },
        blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
      } as unknown as DurableObjectState,
      { DAYS: { get } } as never,
    );
    expect(await owner.read("2026-11-14")).toBeNull();
    expect(get.mock.calls).toEqual([["day"], ["day/v3/sydney/2026-11-14", "json"]]);
  });

  it.each([
    ["Australia/Sydney", "2026-10-02", "2026-10-04T00:00:00+10:00"],
    ["Australia/Sydney", "2026-04-03", "2026-04-05T00:00:00+11:00"],
    ["America/Chicago", "2026-03-06", "2026-03-08T00:00:00-06:00"],
    ["America/Chicago", "2026-10-30", "2026-11-01T00:00:00-05:00"],
    ["America/Santiago", "2026-09-04", "2026-09-06T01:00:00-03:00"],
  ])("expires %s content at the start of its second following day", async (timezone, date, boundary) => {
    config.location.timezone = timezone;
    const setAlarm = vi.fn();
    const storage = {
      get: vi.fn(async () => null),
      put: vi.fn(),
      setAlarm,
      transaction: async (fn: (s: unknown) => Promise<void>) => fn(storage),
    };
    const owner = new DayCoordinator(
      {
        storage,
        blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
      } as unknown as DurableObjectState,
      { DAYS: { get: async () => ({ date, pictures: [], didYouKnow: [] }), put: vi.fn() } } as never,
    );
    await owner.read(date);
    expect(setAlarm).toHaveBeenCalledWith(Date.parse(boundary));
  });
});
