import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://images.metmuseum.org/**", (route) =>
    route.fulfill({
      path: "e2e/fixtures/picture.png",
      contentType: "image/png",
    }),
  );
});

test("source explanations open on the paper and start collapsed in the viewer", async ({ page }) => {
  await page.goto("/");
  const slide = page.locator(".slide").filter({
    has: page.getByRole("link", { name: "Look closer: Moon & stars" }),
  });
  const explanation = slide.locator("details");
  await expect(explanation).not.toHaveAttribute("open", "");
  await explanation.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(explanation.locator("p")).toHaveText("The Moon & stars. A second sentence.");
  await expect(explanation.locator("p")).toBeVisible();
  await slide.getByRole("link", { name: "Look closer: Moon & stars" }).click();
  const viewer = page.getByRole("dialog", { name: "Picture viewer" });
  const context = viewer.locator("details");
  await expect(context).not.toHaveAttribute("open", "");
  await context.locator("summary").click();
  await expect(context.locator("p")).toBeVisible();
  await expect(context.locator("p")).toHaveText("The Moon & stars. A second sentence.");
  await context.locator("summary").focus();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByRole("region", { name: "Enlarged picture" })).toBeFocused();
  await expect(viewer.locator("details")).toHaveCount(0);
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator("details")).not.toHaveAttribute("open", "");
});

test.describe("APOD without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("source explanations remain available without JavaScript", async ({ page }) => {
    await page.goto("/");
    const context = page.locator(".slide details").first();
    await expect(context).not.toHaveAttribute("open", "");
    await context.locator("summary").click();
    await expect(context.locator("p")).toBeVisible();
    await expect(context.locator("p")).toHaveText("The Moon & stars. A second sentence.");
  });
});
