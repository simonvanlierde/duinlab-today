import { expect, test } from "@playwright/test";

/**
 * docs/privacy.md says the site sets no cookies, keeps in the browser only what it lists,
 * and loads its own scripts, styles and fonts, with only the day's pictures from other
 * sites. These prove it on a first visit to every page.
 */

const ROUTES = ["/", "/about", "/yesterday", "/no-such-page"];
// What a first visit may keep, each with a line in docs/privacy.md. The game and quiz keys
// are written only after the visitor acts.
const ALLOWED_LOCAL_STORAGE = ["today.sunrise.v1"];
// How long a page may sit idle before the checks: later storage or requests are not seen.
const SETTLE_MS = 3_000;

test.beforeEach(async ({ context }) => {
  // Other sites are never reached; pictures get a stand-in so the page renders as usual.
  await context.route(/^https?:\/\/(?!localhost)/, (r) =>
    r.request().resourceType() === "image"
      ? r.fulfill({ path: "e2e/fixtures/picture.png", contentType: "image/png" })
      : r.abort(),
  );
});

for (const path of ROUTES) {
  test(`${path} sets no cookies, keeps only listed data and loads only pictures from elsewhere`, async ({
    page,
    context,
  }) => {
    const elsewhere: string[] = [];
    let own = 0;
    context.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith("http")) return;
      if (new URL(url).hostname === "localhost") own++;
      else if (request.resourceType() !== "image") elsewhere.push(`${request.resourceType()} ${url}`);
    });
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);

    expect(await context.cookies()).toEqual([]);
    const stored = await page.evaluate(async () => ({
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
      indexedDB: (await indexedDB.databases()).map((db) => db.name ?? ""),
      caches: await caches.keys(),
      serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
    }));
    expect(stored.localStorage.filter((key) => !ALLOWED_LOCAL_STORAGE.includes(key))).toEqual([]);
    expect(stored).toMatchObject({ sessionStorage: [], indexedDB: [], caches: [], serviceWorkers: 0 });
    // The page's own files must show up, or the capture saw nothing and proves nothing.
    expect(own).toBeGreaterThan(0);
    expect(elsewhere).toEqual([]);
  });
}
