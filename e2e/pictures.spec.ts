import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const hosts =
	/^https:\/\/(images\.metmuseum\.org|thumb\.wikimedia\.org|www\.artic\.edu\/iiif|iiif\.micr\.io)\//;

test.beforeEach(async ({ page }) => {
	await page.route(hosts, (route) =>
		route.fulfill({
			path: "e2e/fixtures/picture.png",
			contentType: "image/png",
		}),
	);
});

test("pictures open, zoom, navigate and return focus without moving the paper", async ({
	page,
}) => {
	await page.goto("/?phase=day");
	const opener = page.getByRole("link", {
		name: "Look closer: Wheat Field with Cypresses",
	});
	await opener.focus();
	const scroll = await page.evaluate(() => window.scrollY);
	await page.keyboard.press("Enter");
	const viewer = page.getByRole("dialog", { name: "Picture viewer" });
	await expect(viewer).toBeVisible();
	await expect(
		viewer.getByRole("button", { name: "Close viewer" }),
	).toBeFocused();
	await expect(viewer.locator("figcaption")).toContainText("Vincent van Gogh");
	await expect(
		viewer.getByRole("button", { name: "Previous picture" }),
	).toBeDisabled();
	await viewer.getByRole("button", { name: "Zoom in" }).click();
	const stage = viewer.getByRole("region", { name: "Enlarged picture" });
	expect(await stage.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
		true,
	);
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

test("the viewer stays usable with long captions, reduced motion and a broken image", async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/?phase=night");
	await page
		.locator(".slide figcaption")
		.first()
		.evaluate((el) => {
			el.append(" A longer caption with details about the work.".repeat(15));
		});
	await page
		.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" })
		.click();
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
	await viewer.getByRole("button", { name: "Next picture" }).click();
	await expect(
		viewer.getByRole("button", { name: "Next picture" }),
	).toBeDisabled();
	await expect(
		viewer.getByRole("region", { name: "Enlarged picture" }),
	).toBeFocused();
	await page.keyboard.press("ArrowLeft");
	await expect(viewer.locator(".viewer-count")).toHaveText("3 of 4");
	await viewer.getByRole("button", { name: "Previous picture" }).click();
	await viewer.getByRole("button", { name: "Previous picture" }).click();
	await page.keyboard.press("ArrowRight");
	await expect(viewer.locator(".viewer-count")).toHaveText("2 of 4");
	await viewer
		.locator("img")
		.evaluate((img) => img.dispatchEvent(new Event("error")));
	await expect(
		viewer.getByText("This image couldn’t load. Try its source below."),
	).toBeVisible();
	await expect(viewer.locator("figcaption a").first()).toHaveAttribute(
		"href",
		/^https:/,
	);
	await close.click();
	await expect(viewer).toBeHidden();
});

test("touch swipes change pictures while fitted and preserve zoomed panning", async ({
	page,
}) => {
	await page.goto("/");
	await page
		.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" })
		.click();
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

test("yesterday's single picture opens without active navigation", async ({
	page,
}) => {
	await page.goto("/yesterday");
	await page
		.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" })
		.click();
	const viewer = page.getByRole("dialog", { name: "Picture viewer" });
	await expect(viewer).toBeVisible();
	await expect(
		viewer.getByRole("button", { name: "Previous picture" }),
	).toBeDisabled();
	await expect(
		viewer.getByRole("button", { name: "Next picture" }),
	).toBeDisabled();
	await viewer.getByRole("button", { name: "Close viewer" }).click();
	await expect(viewer).toBeHidden();
});

test.describe("pictures without JavaScript", () => {
	test.use({ javaScriptEnabled: false });
	test("link directly to the image and keep captions and credits", async ({
		page,
	}) => {
		await page.goto("/");
		const opener = page.getByRole("link", {
			name: "Look closer: Wheat Field with Cypresses",
		});
		await expect(opener).toHaveAttribute(
			"href",
			/^https:\/\/images\.metmuseum\.org\//,
		);
		await expect(page.locator(".slide figcaption").first()).toContainText(
			"Vincent van Gogh",
		);
		await expect(page.getByRole("dialog")).toHaveCount(0);
	});
});
