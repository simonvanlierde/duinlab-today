import { expect, test } from "@playwright/test";

test("the masthead keeps date and time together without extra controls", async ({
	page,
}, testInfo) => {
	await page.goto("/?phase=day");
	await page.screenshot({
		path: `test-results/masthead-${testInfo.project.name}.png`,
		fullPage: true,
	});
	await expect(
		page.locator(
			".mode, [data-phase-label], [data-progress], [data-phase-line]",
		),
	).toHaveCount(0);
	const date = await page.locator("h1").boundingBox();
	const time = await page.locator("[data-clock]").boundingBox();
	expect(date && time && Math.abs(date.y - time.y) < date.height).toBeTruthy();
});

for (const [section, label] of [
	["recipes", "More recipes"],
	["local", "More events"],
]) {
	test(`${label} expands and collapses with the keyboard`, async ({ page }) => {
		await page.goto("/");
		const more = page.locator(`.${section} .more`);
		const list = more.locator("ul");
		await expect(list).toBeHidden();
		await more.locator("summary").focus();
		await page.keyboard.press("Enter");
		await expect(list).toBeVisible();
		await expect(more.locator("summary")).toHaveText(label);
		await page.keyboard.press("Enter");
		await expect(list).toBeHidden();
	});
}

test("the extra sections sit side by side on desktop", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== "desktop");
	await page.goto("/");
	const recipes = await page.locator(".recipes").boundingBox();
	const events = await page.locator(".local").boundingBox();
	expect(
		recipes &&
			events &&
			Math.abs(recipes.y - events.y) < 1 &&
			recipes.x + recipes.width <= events.x,
	).toBeTruthy();
	expect(
		await page
			.locator(".dune")
			.evaluate((e) => e.getBoundingClientRect().height),
	).toBeGreaterThanOrEqual(40);
});

test("picture selectors have room for a finger", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator(".dot")).toHaveCount(4);
	for (const box of await page.locator(".dot").evaluateAll((dots) =>
		dots.map((dot) => ({
			width: dot.getBoundingClientRect().width,
			height: dot.getBoundingClientRect().height,
		})),
	)) {
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
	}
});

test.describe("extra lists without JavaScript", () => {
	test.use({ javaScriptEnabled: false });
	test("expand using native disclosures", async ({ page }) => {
		await page.goto("/");
		for (const label of ["More recipes", "More events"]) {
			const summary = page.getByText(label, { exact: true });
			await summary.click();
			await expect(summary.locator("..").locator("ul")).toBeVisible();
		}
	});
});
