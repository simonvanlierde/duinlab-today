import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { moonNow } from "../src/lib/moon";

test.beforeEach(async ({ page }) => {
	await page.route(
		/^https:\/\/(images\.metmuseum\.org|thumb\.wikimedia\.org|www\.artic\.edu\/iiif|iiif\.micr\.io)\//,
		(route) =>
			route.fulfill({
				path: "e2e/fixtures/picture.png",
				contentType: "image/png",
			}),
	);
});

test("the moon leads on keyboard opening and the rest of the almanac stays available", async ({
	page,
}, testInfo) => {
	const { date } = await (await page.request.get("/today.json")).json();
	const at = Array.from({ length: 22 }, (_, h) =>
		Date.parse(`${date}T${String(h).padStart(2, "0")}:00:00Z`),
	).find((at) => moonNow(at).alt > 5);
	if (at === undefined)
		throw new Error("No moon-above-horizon test time found");
	await page.clock.install({ time: new Date(at) });
	await page.goto("/?phase=night");
	const moon = page.locator("button[data-orb=moon]");
	await expect(moon).toBeVisible();
	await moon.focus();
	await page.keyboard.press("Enter");
	const almanac = page.locator("#almanac");
	await expect(almanac).toBeVisible();
	await expect(
		almanac.getByRole("heading", { name: "Moon", exact: true }),
	).toBeFocused();
	await expect(
		almanac.locator(".almanac-details > :first-child"),
	).toHaveAttribute("data-almanac-body", "moon");
	await expect(
		almanac.locator(".almanac-details > :nth-child(2)"),
	).toHaveAttribute("data-almanac-body", "sun");
	await expect(almanac.locator("[data-moon-line]")).toHaveCount(1);
	await expect(almanac).toContainText(/Sun up \d\d:\d\d/);
	await expect(almanac).toContainText("Scheveningen");
	await expect(almanac.getByRole("link", { name: "Open-Meteo" })).toBeVisible();
	await page.clock.fastForward(60000);
	await expect(almanac.locator("[data-moon-line]")).toHaveText(
		moonNow(at + 60000).line,
	);
	expect(
		(await new AxeBuilder({ page }).include("#almanac").analyze()).violations,
	).toEqual([]);
	await page.screenshot({
		path: `test-results/almanac-moon-${testInfo.project.name}.png`,
	});
	await page.keyboard.press("Escape");
	await expect(almanac).toBeHidden();
	await expect(moon).toBeFocused();
});

test("each planet leads with its own detail, and sun opening resets the order", async ({
	page,
}, testInfo) => {
	await page.goto("/?phase=night");
	const almanac = page.locator("#almanac");
	for (const name of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
		// Exercise every trigger even when today's geometry puts that planet below the horizon.
		await page
			.locator(`button[data-planet=${name}]`)
			.evaluate((button: HTMLButtonElement) => button.click());
		await expect(
			almanac.getByRole("heading", { name, exact: true }),
		).toBeVisible();
		const lead = almanac.locator(".almanac-details > :first-child");
		await expect(lead).toHaveAttribute("data-almanac-body", name);
		await expect(lead).toBeVisible();
		await expect(lead).toContainText(/Tonight:|No remaining observing window/);
		await expect(almanac.locator("[data-almanac-body=sun]")).toBeVisible();
		await expect(almanac.locator("[data-moon-line]")).toBeVisible();
		await page.keyboard.press("Escape");
	}
	await page
		.locator("button[data-orb=sun]")
		.evaluate((button: HTMLButtonElement) => button.click());
	await expect(
		almanac.getByRole("heading", { name: "Sun", exact: true }),
	).toBeVisible();
	await expect(
		almanac.locator(".almanac-details > :first-child"),
	).toHaveAttribute("data-almanac-body", "sun");
	await page.screenshot({
		path: `test-results/almanac-sun-${testInfo.project.name}.png`,
	});
});

test("reopening on a short screen shows the newly selected object at the top", async ({
	page,
}) => {
	await page.setViewportSize({ width: 568, height: 320 });
	await page.goto("/?phase=day");
	await page.locator("button[data-orb=sun]").click();
	const almanac = page.locator("#almanac");
	await expect(almanac).toBeVisible();
	await almanac.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
	});
	expect(await almanac.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await page.keyboard.press("Escape");
	await page
		.locator("button[data-planet=Jupiter]")
		.evaluate((button: HTMLButtonElement) => button.click());
	await expect(
		almanac.getByRole("heading", { name: "Jupiter", exact: true }),
	).toBeInViewport();
	await expect(
		almanac.locator(".almanac-details > :first-child"),
	).toBeInViewport();
	expect(await almanac.evaluate((el) => el.scrollTop)).toBe(0);
});

test.describe("the almanac without JavaScript", () => {
	test.use({ javaScriptEnabled: false });
	test("native sky controls still open the complete overview", async ({
		page,
	}) => {
		await page.goto("/");
		await page
			.locator("button[popovertarget=almanac]:not([hidden])")
			.first()
			.click();
		const almanac = page.locator("#almanac");
		await expect(almanac).toBeVisible();
		await expect(
			almanac.getByRole("heading", { name: "Almanac", exact: true }),
		).toBeVisible();
		await expect(almanac).toContainText(/Sun up \d\d:\d\d/);
		await expect(almanac).toContainText(/% lit/);
		await expect(almanac).toContainText("Scheveningen");
	});
});
