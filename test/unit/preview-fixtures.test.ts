import { afterEach, expect, it, vi } from "vitest";
import { buildDay, incomplete } from "../../src/lib/build";
import { localDay } from "../../src/lib/day";
import { fixtureResponse } from "../../src/lib/preview-fixtures";
import { fetchRecipes } from "../../src/lib/sources/recipes";
import { fetchSea } from "../../src/lib/sources/sea";
import { fetchWeather } from "../../src/lib/sources/weather";

afterEach(() => vi.unstubAllGlobals());

/** Every fetch answered as a preview Worker answers it; returns the hosts that got a 404. */
function previewFetch() {
  const missing = new Set<string>();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const res = fixtureResponse(url);
    if (res.status === 404) missing.add(new URL(url).host);
    return res;
  });
  return missing;
}

it("answers a host without a fixture with a 404, like a source that is down", async () => {
  const res = fixtureResponse("https://unknown.example/x");
  expect(res.status).toBe(404);
});

it("answers the museum images with the fixture PNG", async () => {
  const res = fixtureResponse("https://images.metmuseum.org/CRDImages/ep/original/DP-19279-001.jpg");
  expect(res.headers.get("content-type")).toBe("image/png");
  expect([...new Uint8Array(await res.arrayBuffer()).slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
});

// A source added without a fixture would leave its section empty in every preview.
it("builds a complete day from fixtures alone", async () => {
  const missing = previewFetch();
  const now = new Date();
  const day = await buildDay(localDay(now), now, "fixture");
  expect(incomplete(day, true)).toBe(false);
  expect(await fetchWeather(now)).not.toBeNull();
  expect(await fetchSea()).not.toBeNull();
  expect((await fetchRecipes()).length).toBeGreaterThan(0);
  // the APOD feed is only a fallback for the NASA API, which has a fixture
  expect([...missing]).toEqual(["science.nasa.gov"]);
});
