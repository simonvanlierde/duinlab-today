import AxeBuilder from "@axe-core/playwright";
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
	await expect(page.locator(".games .game")).toHaveCount(10);
});

test("the games are visible without scrolling", async ({ page }) => {
	await page.goto("/");
	const box = await page.locator(".games").boundingBox();
	const view = page.viewportSize();
	expect(box && view && box.y + box.height <= view.height).toBe(true);
});

test("the desktop page fits one screen", async ({ page }) => {
	for (const [width, height] of [
		[1440, 900],
		[1280, 800],
	]) {
		await page.setViewportSize({ width, height });
		await page.goto("/");
		const tall = await page.evaluate(
			() => document.documentElement.scrollHeight,
		);
		expect(tall).toBeLessThanOrEqual(height);
	}
});

test("the quiz asks one question at a time and keeps the score", async ({
	page,
}) => {
	await page.goto("/");
	const quiz = page.locator(".quiz-live");
	// the server-rendered buttons are inert until the island hydrates
	await page.locator("astro-island:not([ssr]) .quiz-live").waitFor();
	await expect(quiz.locator(".q")).toHaveCount(1);
	const total = Number(
		(await quiz.locator(".qn").textContent())?.match(/of (\d+)/)?.[1],
	);
	for (let i = 0; i < total; i++) {
		await quiz.locator(".answer").first().click();
		await expect(quiz.locator(".answer").first()).toBeDisabled();
		await quiz.locator(".next").click();
	}
	await expect(quiz.locator(".score")).toContainText(`of ${total}.`);
	await page.reload();
	await expect(quiz.locator(".score")).toContainText(`of ${total}.`);
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
	await expect(row.locator(".name")).toContainText(", played");
	await expect(row.locator(".streak .figure")).toHaveText("1");

	await page.reload();
	await expect(page.locator(".count")).toContainText("1 of 10 played");

	await page.locator(".streaks summary").click();
	await page.getByRole("button", { name: "Un-mark Wordle as played" }).click();
	await expect(page.locator(".count")).toContainText("0 of 10 played");
	await expect(row.locator(".name")).toContainText(", not yet");
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
	await page.locator(".streaks summary").click();
	await page
		.getByRole("button", { name: /un-mark/i })
		.first()
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
	await expect(page.locator(".games .streak")).toHaveCount(0);
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

test("the sky follows the browser clock from night to day", async ({
	page,
}) => {
	// the server builds the page for today, so the browser clock starts on today's date
	const today = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Amsterdam",
	}).format(new Date());
	await page.clock.install({ time: new Date(`${today}T00:30:00Z`) });
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-phase", "night");
	await expect(page.locator("html")).toHaveAttribute("data-ground", "dark");
	await page.clock.fastForward("11:30:00"); // around 13:00 Amsterdam, summer or winter
	await expect(page.locator("html")).toHaveAttribute("data-phase", "day");
	await expect(page.locator("html")).toHaveAttribute("data-ground", "light");
});

test.describe("without JavaScript", () => {
	test.use({ javaScriptEnabled: false });
	test("the games are plain links", async ({ page }) => {
		await page.goto("/");
		const links = page.locator(".games a.name");
		await expect(links).toHaveCount(10);
		await expect(links.first()).toHaveAttribute("href", /^https:/);
		await expect(page.locator(".quiz-static details")).not.toHaveCount(0);
	});
});

test("the about page says what is kept and links the source", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.locator(".wx")).toHaveAttribute("href", /buienradar\.nl/);
	await page.getByRole("link", { name: "About", exact: true }).click();
	await expect(page.locator("h1")).toHaveText("About this page");
	await expect(
		page.getByRole("link", { name: /github\.com\/simonvanlierde/ }),
	).toBeVisible();
	const missing = await page.goto("/no-such-page");
	expect(missing?.status()).toBe(404);
	await expect(page.locator("h1")).toHaveText("Below the horizon");
});

test("security headers and a CSP that the page keeps to", async ({ page }) => {
	const blocked: string[] = [];
	page.on("console", (m) => {
		if (/Content Security Policy/i.test(m.text())) blocked.push(m.text());
	});
	const res = await page.goto("/");
	expect(res?.headers()["x-content-type-options"]).toBe("nosniff");
	const csp = res?.headers()["content-security-policy"] ?? "";
	expect(csp).toMatch(/script-src 'self' 'sha256-/);
	expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
	await page.locator("astro-island:not([ssr]) .quiz-live").waitFor();
	expect(blocked).toEqual([]);
});

for (const path of ["/", "/about", "/no-such-page"]) {
	test(`no axe violations (WCAG 2.2 AA) on ${path}`, async ({ page }) => {
		await page.goto(path);
		// let the sky settle: contrast is checked on the final colours
		await page.waitForTimeout(2800);
		const { violations } = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
			.analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
	});
}
