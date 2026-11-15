import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { site } from "../src/lib/config";
import { localDay } from "../src/lib/day";
import { clock, temperature } from "../src/lib/format";

test("configured paper uses its city, clock, units, sources and identity", async ({
	page,
}, testInfo) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.route(/^https:\/\//, (route) =>
		route.request().resourceType() === "image"
			? route.fulfill({
					path: "e2e/fixtures/picture.png",
					contentType: "image/png",
				})
			: route.abort(),
	);
	await page.goto("/");
	await page.locator("astro-island:not([ssr]) .games").waitFor();
	await expect(page).toHaveTitle(
		new RegExp(site.site.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
	);
	await expect(page.locator("[data-clock]")).toHaveText(clock(new Date()));
	const day = await (await page.request.get("/today.json")).json();
	expect(day.date).toBe(localDay());
	await expect(page.locator(".games .game")).toHaveCount(site.games.length);
	await expect(page.locator(".pic .slide")).toHaveCount(day.pictures.length);
	expect(day.sun.sunrise.slice(0, 10)).toBe(day.date);
	expect(day.games.map((game: { id: string }) => game.id).sort()).toEqual(
		site.games.map((game) => game.id).sort(),
	);
	await expect(page.locator(".temp")).toContainText(
		String(temperature(day.weather.now.temperatureC)),
	);
	expect(day.weather.now.temperatureC).toBe(4.6);
	expect(
		day.pictures.every((picture: { kind: string }) =>
			site.content.pictures.includes(picture.kind as never),
		),
	).toBe(true);
	if (!site.content.tides) expect(day.tides).toBeNull();
	if (!site.content.sea) expect(day.sea).toBeNull();
	if (!site.content.events) expect(day.events).toBeNull();
	if (!site.content.events && !site.content.sea && !site.content.tides) {
		await expect(page.locator("body")).not.toContainText(
			/Scheveningen|This week in The Hague/,
		);
	}
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		"href",
		`${site.site.url}/`,
	);
	const manifest = await (
		await page.request.get("/manifest.webmanifest")
	).json();
	expect(manifest.name).toBe(site.site.title);
	expect(await (await page.request.get("/robots.txt")).text()).toContain(
		`${site.site.url}/sitemap.xml`,
	);
	expect(await (await page.request.get("/sitemap.xml")).text()).toContain(
		`<loc>${site.site.url}/</loc>`,
	);
	await page.screenshot({
		path: `test-results/city-${site.location.country}-${testInfo.project.name}.png`,
		fullPage: true,
	});
	await page.goto("/about");
	await expect(page.locator("main")).toContainText(site.location.name);
	await expect(page.locator("main")).toContainText(site.location.timezone);
	if (!site.content.events && !site.content.sea && !site.content.tides) {
		await expect(page.locator("main")).not.toContainText(
			/Scheveningen|Paard|Amare|DenHaag/,
		);
	}
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	expect(errors).toEqual([]);
});
