import { expect, it, vi } from "vitest";

const custom = vi.hoisted(() => ({
  games: [
    {
      id: "zebra",
      name: "Zebra puzzle",
      url: "https://example.org/zebra",
      blurb: "Find the stripes.",
    },
    {
      id: "atlas",
      name: "Atlas puzzle",
      url: "https://example.org/atlas",
      blurb: "Name the place.",
    },
  ],
}));
vi.mock("../../src/lib/config", () => ({ site: custom }));

import { games } from "../../src/lib/games";

it("uses complete configured game entries in alphabetical order", () => {
  expect(games).toEqual([custom.games[1], custom.games[0]]);
});
it("can omit the game rail", async () => {
  custom.games = [];
  vi.resetModules();
  expect((await import("../../src/lib/games")).games).toEqual([]);
});
