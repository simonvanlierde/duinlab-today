import { expect, type Page, test } from "@playwright/test";

const KEY = "today.games.v1";

async function play(page: Page, name: string) {
	await page.locator(".games .name", { hasText: name }).click();
}

test.beforeEach(async ({ page }) => {
	// the external game sites are never loaded
	await page.route(
		/^https?:\/\/(?!localhost)(?!images\.metmuseum|apod\.nasa)/,
		(r) =>
			r.request().resourceType() === "document"
				? r.fulfill({ body: "ok" })
				: r.continue(),
	);
});

test("renders the sky, the sections and the ten games", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("h1")).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute(
		"data-phase",
		/night|first-light|dawn|day|dusk/,
	);
	const labels = await page.locator(".cue .num").allTextContents();
	expect(labels.map(Number)).toEqual(labels.map((_, i) => i + 1)); // numbered 1..n, no gaps
	await expect(page.locator(".games .game")).toHaveCount(10);
	await expect(page.locator(".dots .dot")).toHaveCount(10);
});

test("the board is visible without scrolling and links to the rows", async ({
	page,
}) => {
	await page.goto("/");
	const box = await page.locator(".board").boundingBox();
	const view = page.viewportSize();
	expect(box && view && box.y + box.height <= view.height).toBe(true);
	await page.locator(".dots .dot").nth(6).click();
	await expect(page).toHaveURL(/#game-/);
});

test("opening a game marks it, un-mark undoes it, and state survives a reload", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.locator(".count")).toContainText("0 of 10 played");
	await expect(page.locator(".first-visit")).toHaveText(
		"0 days. Everyone starts in the dark.",
	);
	await expect(page.locator(".games .name").first()).toHaveAttribute(
		"target",
		"_blank",
	);
	await play(page, "Wordle");
	await expect(page.locator(".count")).toContainText("1 of 10 played");
	const row = page.locator(".game", { hasText: "Wordle" });
	await expect(row.locator(".state")).toHaveText("played");
	await expect(row.locator(".streak .figure")).toHaveText("1");

	await page.reload();
	await expect(page.locator(".count")).toContainText("1 of 10 played");

	await row.getByRole("button", { name: /un-mark/i }).click();
	await expect(page.locator(".count")).toContainText("0 of 10 played");
	await expect(row.locator(".state")).toHaveText("not yet");
});

test("all ten played lights the white-out, and it persists", async ({
	page,
}) => {
	await page.goto("/");
	const names = await page
		.locator(".games .name")
		.evaluateAll((els) =>
			els.map((e) => e.textContent?.replace(/\(opens.*/, "").trim() ?? ""),
		);
	expect(names).toHaveLength(10);
	for (const n of names) await play(page, n);
	await expect(page.locator(".count")).toContainText("The sky agrees");
	await expect(page.locator("html")).toHaveAttribute("data-whiteout", "");
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-whiteout", "");
	await page
		.locator(".game")
		.first()
		.getByRole("button", { name: /un-mark/i })
		.click();
	await expect(page.locator("html")).not.toHaveAttribute("data-whiteout", "");
});

test("a streak counts consecutive days", async ({ page }) => {
	await page.addInitScript((key) => {
		const day = (back: number) =>
			new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(
				new Date(Date.now() - back * 864e5),
			);
		localStorage.setItem(
			key,
			JSON.stringify({ wordle: [day(1), day(2), day(3)] }),
		);
	}, KEY);
	await page.goto("/");
	const row = page.locator(".game", { hasText: "Wordle" });
	await expect(row.locator(".streak .figure")).toHaveText("3");
	await expect(page.locator(".first-visit")).toHaveCount(0);
});

test("without localStorage the games are plain links and nothing breaks", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new Error("denied");
			},
		});
	});
	await page.goto("/");
	await expect(page.locator(".games .name")).toHaveCount(10);
	await expect(page.locator(".count")).toContainText("10 daily games");
	await expect(page.locator(".state:visible")).toHaveCount(0);
	expect(errors).toEqual([]);
});

test("no horizontal scroll and 44px game rows", async ({ page }) => {
	await page.goto("/");
	const wide = await page.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth,
	);
	expect(wide).toBe(false);
	for (const h of await page
		.locator(".games .name")
		.evaluateAll((e) => e.map((x) => x.getBoundingClientRect().height)))
		expect(h).toBeGreaterThanOrEqual(44);
});

test("the sky follows the browser clock across sunrise", async ({ page }) => {
	await page.clock.install({ time: new Date("2026-11-06T05:30:00Z") }); // 06:30 Amsterdam
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-phase", "night");
	await page.clock.fastForward("02:00:00"); // 08:30
	await expect(page.locator("html")).toHaveAttribute("data-phase", /dawn|day/);
	await page.clock.fastForward("04:00:00"); // 12:30
	await expect(page.locator("html")).toHaveAttribute("data-phase", "day");
});

test.describe("without JavaScript", () => {
	test.use({ javaScriptEnabled: false });
	test("the games are plain links", async ({ page }) => {
		await page.goto("/");
		const links = page.locator(".games a.name");
		await expect(links).toHaveCount(10);
		await expect(links.first()).toHaveAttribute("href", /^https:/);
		await expect(page.locator(".state:visible")).toHaveCount(0);
	});
});
