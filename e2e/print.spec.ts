import { expect, test } from "@playwright/test";

test("print lays out every picture and caption without carousel controls", async ({
	page,
}, testInfo) => {
	await page.route(
		/^https:\/\/(images\.metmuseum\.org|thumb\.wikimedia\.org|www\.artic\.edu\/iiif|iiif\.micr\.io)\//,
		(r) =>
			r.fulfill({ path: "e2e/fixtures/picture.png", contentType: "image/png" }),
	);
	await page.goto("/");
	await expect(page.locator(".dots")).toBeVisible();
	await page
		.getByRole("link", { name: "Look closer: Wheat Field with Cypresses" })
		.click();
	await page.emulateMedia({ media: "print" });
	await page.setViewportSize({ width: 794, height: 1123 });
	const slides = await page.locator(".slide").evaluateAll((slides) =>
		slides.map((slide) => {
			const r = slide.getBoundingClientRect();
			return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
		}),
	);
	expect(slides).toHaveLength(4);
	for (const [i, box] of slides.entries()) {
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(794);
		expect(box.top).toBeGreaterThanOrEqual(slides[i - 1]?.bottom ?? 0);
	}
	await expect(page.locator(".dots")).toBeHidden();
	await expect(page.locator(".arrow").first()).toBeHidden();
	await expect(page.locator(".more").first()).toBeHidden();
	await expect(page.locator(".picture-viewer")).toBeHidden();
	await page.screenshot({
		path: `test-results/print-paper-${testInfo.project.name}.png`,
		fullPage: true,
	});
	await page.pdf({
		path: `test-results/paper-${testInfo.project.name}.pdf`,
		format: "A4",
		margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
	});
});
