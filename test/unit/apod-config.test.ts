import { expect, it, vi } from "vitest";

vi.mock("../../src/lib/config", async (original) => {
  const actual = await original<typeof import("../../src/lib/config")>();
  return {
    ...actual,
    site: {
      ...actual.site,
      content: {
        ...actual.site.content,
        pictures: ["apod"],
        tides: false,
        events: false,
      },
    },
  };
});

import { type Day, incomplete } from "../../src/lib/build";

it("does not retry an APOD-only strip when its key is absent", () => {
  const day = {
    pictures: [],
    onThisDay: {},
    featured: {},
    word: {},
    quote: {},
    quiz: {},
    didYouKnow: [{}],
  } as unknown as Day;
  expect(incomplete(day, false)).toBe(false);
  expect(incomplete(day, true)).toBe(true);
});
