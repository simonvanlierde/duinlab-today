import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const hosts = /^https:\/\/(images\.metmuseum\.org|thumb\.wikimedia\.org|www\.artic\.edu\/iiif|iiif\.micr\.io)\//;

test.beforeEach(async ({ page }) => {
  await page.route(hosts, (route) =>
    route.fulfill({
      path: "e2e/fixtures/picture.png",
      contentType: "image/png",
    }),
  );
});

test("pictures open, zoom, navigate and return focus without moving the paper", async ({ page }) => {
  await page.goto("/?phase=day");
  const opener = page.getByRole("link", {
    name: "Look closer: Wheat Field with Cypresses",
  });
  await opener.focus();
  const scroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Enter");
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Close viewer" })).toBeFocused();
  await expect(viewer.locator("figcaption")).toContainText("Vincent van Gogh");
  await expect(viewer.getByRole("button", { name: "Previous picture" })).toBeDisabled();
  await viewer.getByRole("button", { name: "Zoom in" }).click();
  const stage = viewer.getByRole("region", { name: "Enlarged picture" });
  await expect(stage).toBeFocused();
  expect(await stage.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const pan = await stage.evaluate((el) => el.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => stage.evaluate((el) => el.scrollLeft)).toBeGreaterThan(pan);
  await viewer.getByRole("button", { name: "Fit picture" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator("figcaption")).toContainText("Wikimedia");
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator("figcaption")).toContainText("Vincent van Gogh");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
});

test("closer viewing loads the source original while the paper keeps its preview", async ({ page }) => {
  const original = "https://images.metmuseum.org/CRDImages/ep/original/DP-42549-001.jpg";
  await page.goto("/");
  const opener = page.getByRole("link", {
    name: "Look closer: Wheat Field with Cypresses",
  });
  await expect(opener).toHaveAttribute("href", original);
  await expect(opener.locator("img")).toHaveAttribute("src", /\/web-large\//);
  const requested = page.waitForRequest(original);
  await opener.click();
  await requested;
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute("src", original);
  await expect(page.getByRole("dialog").getByRole("link", { name: "Open original" })).toHaveAttribute("href", original);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog").getByRole("link", { name: "Open original" })).toHaveAttribute(
    "href",
    await page
      .locator(".picture-open")
      .nth(1)
      .evaluate((el) => (el as HTMLAnchorElement).href),
  );
});

test("a failed original falls back to the preview before showing an image error", async ({ page }) => {
  await page.route("**/original/DP-42549-001.jpg", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" }).click();
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  const image = viewer.locator("img");
  await expect(image).toHaveAttribute("src", /\/web-large\//);
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(viewer.locator(".viewer-error")).toBeHidden();
  await expect(viewer.getByRole("link", { name: "Open original" })).toHaveAttribute(
    "href",
    /\/original\/DP-42549-001.jpg$/,
  );
  await image.evaluate((el) => el.dispatchEvent(new Event("error")));
  await expect(viewer.locator(".viewer-error")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Zoom in" })).toBeDisabled();
});

test("keyboard picture changes keep focus after replacing a caption link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" }).click();
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  await viewer.getByRole("link", { name: "Open original" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByRole("region", { name: "Enlarged picture" })).toBeFocused();
  await expect(viewer.locator("figcaption")).toContainText("Wikimedia");
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator("figcaption")).toContainText("Vincent van Gogh");
});

test("the viewer stays usable with long captions, reduced motion and a broken image", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?phase=night");
  await page
    .locator(".slide figcaption")
    .first()
    .evaluate((el) => {
      el.append(" A longer caption with details about the work.".repeat(15));
    });
  await page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" }).click();
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  await expect(viewer).toBeVisible();
  const close = viewer.getByRole("button", { name: "Close viewer" });
  await expect(close).toBeInViewport();
  await expect(viewer.locator("img")).toBeInViewport();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `test-results/viewer-${testInfo.project.name}.png`,
  });
  await viewer.getByRole("button", { name: "Next picture" }).click();
  await viewer.getByRole("button", { name: "Next picture" }).click();
  await expect(viewer.getByRole("button", { name: "Next picture" })).toBeDisabled();
  await expect(viewer.getByRole("region", { name: "Enlarged picture" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator(".viewer-count")).toHaveText("2 of 3");
  await viewer.getByRole("button", { name: "Previous picture" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator(".viewer-count")).toHaveText("2 of 3");
  await viewer.locator("img").evaluate((img) => img.dispatchEvent(new Event("error")));
  await expect(viewer.getByText("This image couldn’t load. Try its source below.")).toBeVisible();
  await expect(viewer.locator("figcaption a").first()).toHaveAttribute("href", /^https:/);
  await close.click();
  await expect(viewer).toBeHidden();
});

test("touch swipes change pictures while fitted and preserve zoomed panning", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" }).click();
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  const stage = viewer.getByRole("region", { name: "Enlarged picture" });
  const swipe = async () => {
    await stage.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 250,
      clientY: 150,
    });
    await stage.dispatchEvent("pointerup", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 150,
    });
  };
  await swipe();
  await expect(viewer.locator("figcaption")).toContainText("Wikimedia");
  await viewer.getByRole("button", { name: "Zoom in" }).click();
  await swipe();
  await expect(viewer.locator("figcaption")).toContainText("Wikimedia");
});

const openFirst = async (page: import("@playwright/test").Page) => {
  await page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" }).click();
  return page.getByRole("dialog", { name: "Picture viewer" });
};

test("a click zooms in at that point and a second click fits the picture again", async ({ page }) => {
  await page.goto("/");
  const viewer = await openFirst(page);
  const image = viewer.locator(".viewer-stage img");
  await image.click();
  await expect(viewer.getByRole("button", { name: "Fit picture" })).toBeVisible();
  // a mouse press on the zoomed picture captures the pointer for panning; the click must still fit
  await image.click();
  await expect(viewer.getByRole("button", { name: "Zoom in" })).toBeVisible();
});

test("a mouse drag pans the zoomed picture and does not fit it again", async ({ page }) => {
  await page.goto("/");
  const viewer = await openFirst(page);
  const stage = viewer.locator(".viewer-stage");
  await viewer.locator(".viewer-stage img").click();
  await expect(viewer.getByRole("button", { name: "Fit picture" })).toBeVisible();
  const box = await stage.boundingBox();
  if (!box) throw new Error("no stage");
  const before = await stage.evaluate((el) => el.scrollLeft);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await stage.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before + 60);
  await expect(viewer.getByRole("button", { name: "Fit picture" })).toBeVisible();
  // after a drag, a plain click still fits the picture, and the next one zooms in again
  await viewer.locator(".viewer-stage img").click();
  await expect(viewer.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await viewer.locator(".viewer-stage img").click();
  await expect(viewer.getByRole("button", { name: "Fit picture" })).toBeVisible();
});

test("a late original of a picture already left behind does not replace the next one", async ({ page }) => {
  await page.goto("/");
  const links = page.locator(".picture-open");
  const [first, second] = await Promise.all([links.nth(0).getAttribute("href"), links.nth(1).getAttribute("href")]);
  if (!first || !second) throw new Error("fewer than two pictures");
  // hold the first picture's original until the viewer has moved on to the second
  let release = () => {};
  const held = new Promise<void>((done) => {
    release = done;
  });
  await page.route(first, async (route) => {
    await held;
    await route.fallback();
  });
  const viewer = await openFirst(page);
  const image = viewer.locator(".viewer-stage img");
  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("src", second);
  const late = page.waitForResponse(first);
  release();
  await late;
  // two frames: the late image's load event has run by then
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(image).toHaveAttribute("src", second);
  await expect(viewer.locator(".viewer-count")).toHaveText(/^2 of \d+$/);
});

test("a diagonal touch swipe neither closes the viewer nor changes the picture", async ({ page }) => {
  await page.goto("/");
  const viewer = await openFirst(page);
  const stage = viewer.locator(".viewer-stage");
  await stage.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", clientX: 200, clientY: 100 });
  await stage.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", clientX: 290, clientY: 200 });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".viewer-count")).toHaveText(/^1 of \d+$/);
});

test("a touch swipe down closes the viewer", async ({ page }) => {
  await page.goto("/");
  const viewer = await openFirst(page);
  const stage = viewer.locator(".viewer-stage");
  await stage.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", clientX: 200, clientY: 100 });
  await stage.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", clientX: 210, clientY: 300 });
  await expect(viewer).toBeHidden();
  await expect(page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" })).toBeFocused();
});

test("an arrow press past the last picture leaves it as it is", async ({ page }) => {
  await page.goto("/");
  const viewer = await openFirst(page);
  const n = await page.locator(".pic .slide").count();
  for (let i = 1; i < n; i++) await page.keyboard.press("ArrowRight");
  await expect(viewer.locator(".viewer-count")).toHaveText(`${n} of ${n}`);
  const image = viewer.locator(".viewer-stage img");
  const original = await page
    .locator(".picture-open")
    .nth(n - 1)
    .getAttribute("href");
  await expect(image).toHaveAttribute("src", original ?? "");
  // read in the same task as the key press: a reload of the preview would show here at once
  const after = await viewer.evaluate((dialog) => {
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    return dialog.querySelector(".viewer-stage img")?.getAttribute("src");
  });
  expect(after).toBe(original);
});

test("a small object on a plain backdrop opens framed, and Whole picture shows all of it", async ({ page }) => {
  await page.route(hosts, (route) =>
    route.fulfill({
      path: "e2e/fixtures/object.png",
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/");
  const viewer = await openFirst(page);
  await expect(viewer.getByRole("button", { name: "Whole picture" })).toBeVisible();
  await expect(viewer.locator(".viewer-count")).toHaveText(/^1 of \d+, backdrop cropped$/);
  await viewer.getByRole("button", { name: "Whole picture" }).click();
  await expect(viewer.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(viewer.locator(".viewer-count")).toHaveText(/^1 of \d+$/);
});

test("an original that loads after a failed preview replaces the error", async ({ page }) => {
  await page.route("**/web-large/DP-42549-001.jpg", (route) => route.abort());
  // the original is held until the preview has failed and the error shows
  let release = () => {};
  const held = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/original/DP-42549-001.jpg", async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto("/");
  const viewer = await openFirst(page);
  await expect(viewer.locator(".viewer-error")).toBeVisible();
  release();
  await expect(viewer.locator(".viewer-stage img")).toHaveAttribute("src", /\/original\/DP-42549-001.jpg$/);
  await expect(viewer.locator(".viewer-stage img")).toBeVisible();
  await expect(viewer.locator(".viewer-error")).toBeHidden();
});

test("yesterday's single picture opens without active navigation", async ({ page }) => {
  await page.goto("/yesterday");
  await page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" }).click();
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Open original" })).toHaveAttribute(
    "href",
    /\/web-large\/DP-42549-001.jpg$/,
  );
  await expect(viewer.getByRole("button", { name: "Previous picture" })).toBeDisabled();
  await expect(viewer.getByRole("button", { name: "Next picture" })).toBeDisabled();
  await viewer.getByRole("button", { name: "Close viewer" }).click();
  await expect(viewer).toBeHidden();
});

test.describe("pictures without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("link directly to the image and keep captions and credits", async ({ page }) => {
    await page.goto("/");
    const opener = page.getByRole("link", {
      name: "Look closer: Wheat Field with Cypresses",
    });
    await expect(opener).toHaveAttribute("href", /^https:\/\/images\.metmuseum\.org\//);
    await expect(page.locator(".slide figcaption").first()).toContainText("Vincent van Gogh");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("a second finger and interrupted swipes do not strand the viewer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" }).click();
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  const stage = viewer.locator(".viewer-stage");
  const pointer = (type: string, id: number, x: number) =>
    stage.dispatchEvent(type, {
      pointerType: "touch",
      pointerId: id,
      clientX: x,
      clientY: 150,
    });
  await pointer("pointerdown", 1, 250);
  await pointer("pointerdown", 2, 280);
  await pointer("pointerup", 1, 100);
  await expect(viewer.locator(".viewer-count")).toHaveText("2 of 3");
  await pointer("pointerup", 2, 280);
  for (const interrupt of ["pointercancel", "lostpointercapture", "blur"]) {
    await pointer("pointerdown", 1, 250);
    if (interrupt === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else await pointer(interrupt, 1, 250);
    await pointer("pointerup", 1, 100);
    await expect(viewer.locator(".viewer-count")).toHaveText("2 of 3");
  }
  await pointer("pointerdown", 1, 250);
  await pointer("pointerup", 1, 100);
  await expect(viewer.locator(".viewer-count")).toHaveText("3 of 3");
});
