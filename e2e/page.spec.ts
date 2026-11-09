import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const KEY = "today.games.v1";

async function play(page: Page, name: string) {
	await page.locator(".games .name", { hasText: name }).click();
}

test.beforeEach(async ({ page }) => {
	// the external game sites are never loaded
	await page.route(/^https?:\/\/(?!localhost)/, (r) =>
		r.request().resourceType() === "document"
			? r.fulfill({ body: "ok" })
			: r.continue(),
	);
	// the day's picture (test/unit/fixtures/met-object.json) is the fixture PNG
	await page.route("https://images.metmuseum.org/**", (r) =>
		r.fulfill({ path: "e2e/fixtures/picture.png", contentType: "image/png" }),
	);
});

// Content from e2e/fixture-server.mjs, which serves test/unit/fixtures in place of the sources.
test("renders the sky, every section from the fixtures, and the ten games", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.locator("h1")).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute(
		"data-phase",
		/night|first-light|dawn|day|dusk/,
	);
	await expect(page.locator(".games .game")).toHaveCount(10);

	const img = page.locator(".pic img");
	await expect(img).toHaveAttribute(
		"src",
		"https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg",
	);
	await expect(img).toHaveAttribute(
		"alt",
		"Wheat Field with Cypresses, by Vincent van Gogh",
	);
	await expect
		.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
		.toBe(64);
	await expect(page.locator(".pic figcaption")).toContainText(
		"Wheat Field with Cypresses, Vincent van Gogh",
	);
	const section = (id: string) =>
		page.locator(`section[aria-labelledby="${id}"]`);
	await expect(section("h-dyk")).toContainText(
		"that Cinema '76 adopted three cats",
	);
	await expect(section("h-word").locator(".word")).toHaveText("sax");
	await expect(section("h-featured")).toContainText("Bill Madden (soldier)");
	await expect(page.locator(".quiz-live .qn")).toHaveText("1 of 5");
	await expect(page.locator(".quiz-live .q")).toHaveText(
		'Which Kingdom Hearts game featured the cast of "The World Ends With You"?',
	);
	// 2016 is a war and skipped: the first event that is not grim
	await expect(section("h-otd").locator(".year")).toHaveText("2012");
	await expect(section("h-otd")).toContainText("Tammy Baldwin");
	await expect(page.locator(".quote")).toContainText(
		"Your mind is infinite, it's your doubts that are limiting.",
	);
	await expect(page.locator(".quote figcaption")).toContainText(
		"Robert Kiyosaki",
	);
	await expect(page.locator(".wx")).toContainText(/5°\s*overcast, 9° \/ 2°/);
	await expect(page.locator(".strip")).toContainText("dry until 10:15");
	await expect(section("h-near").locator("li")).toHaveCount(3);
	await expect(section("h-near").locator("li").first()).toContainText(
		"November Tubic 4 sightings",
	);
	await expect(section("h-events").locator("li")).toHaveCount(5);
	await expect(section("h-events").locator("li").first()).toContainText(
		/^Tomorrow 19:20 TAKUYA KURODA/,
	);
	await expect(section("h-news").locator(".paper")).toHaveText([
		"NOS",
		"NRC",
		"BBC",
		"The Guardian",
		"NYT",
	]);
	await expect(section("h-news").locator("li").first()).toContainText(
		"NOS fixture headline: sand dunes grow a metre",
	);
	await expect(section("h-recipes").locator(".paper")).toHaveText([
		"The Guardian",
		"Good Food",
		"Love and Lemons",
	]);
	await expect(section("h-recipes").locator("li")).toHaveText([
		/The Guardian fixture recipe: dune bread/,
		/Good Food fixture recipe: dune bread/,
		/Love and Lemons fixture recipe: dune bread/,
	]);
});

test("the moon opens the sun and moon times, and Escape closes them", async ({
	page,
}) => {
	await page.goto("/");
	const almanac = page.locator("#almanac");
	await expect(almanac).toBeHidden();
	await page.getByRole("button", { name: /sun and moon times/ }).click();
	await expect(almanac).toBeVisible();
	await expect(almanac).toContainText(/Sun up \d\d:\d\d, down \d\d:\d\d/);
	await expect(almanac).toContainText(/% lit/);
	await expect(almanac).toContainText(
		/High water \d\d:\d\d and \d\d:\d\d, low \d\d:\d\d and \d\d:\d\d at Scheveningen/,
	);
	await page.keyboard.press("Escape");
	await expect(almanac).toBeHidden();
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
		// the paper itself; the headlines and the footer follow below the fold
		const tall = await page.evaluate(
			() =>
				document.querySelector("#paper")?.getBoundingClientRect().bottom ?? 0,
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
		.locator(".games .name .label")
		.evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ""));
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
	// the browser's day is the Monday after the clocks went forward: the 23-hour Sunday still counts
	await page.clock.setFixedTime(new Date("2026-03-30T10:00:00+02:00"));
	await page.addInitScript((key) => {
		localStorage.setItem(
			key,
			JSON.stringify({ wordle: ["2026-03-27", "2026-03-28", "2026-03-29"] }),
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
	await expect(page.locator(".wx")).toHaveAttribute("href", /meteoblue\.com/);
	await page.getByRole("link", { name: "About", exact: true }).click();
	await expect(page.locator("h1")).toHaveText("About this page");
	await expect(
		page.getByRole("link", { name: /github\.com\/simonvanlierde/ }),
	).toBeVisible();
	const missing = await page.goto("/no-such-page");
	expect(missing?.status()).toBe(404);
	await expect(page.locator("h1")).toHaveText("Below the horizon");
});

test("security headers and a CSP that the page keeps to", async ({
	page,
	request,
}) => {
	const blocked: string[] = [];
	page.on("console", (m) => {
		if (/Content Security Policy/i.test(m.text())) blocked.push(m.text());
	});
	const res = await page.goto("/");
	const headers = res?.headers() ?? {};
	// src/middleware.ts
	expect(headers).toMatchObject({
		"strict-transport-security": "max-age=31536000; includeSubDomains",
		"x-content-type-options": "nosniff",
		"referrer-policy": "strict-origin-when-cross-origin",
		"permissions-policy":
			"camera=(), microphone=(), geolocation=(), interest-cohort=()",
		"x-frame-options": "DENY",
		"cross-origin-opener-policy": "same-origin",
	});
	// security.csp in astro.config.mjs; the script and style hashes change with the build
	const csp = Object.fromEntries(
		(headers["content-security-policy"] ?? "")
			.split(";")
			.map((d) => d.trim().split(/\s+/))
			.filter(([name]) => name)
			.map(([name, ...values]) => [name, values.join(" ")]),
	);
	expect(csp).toMatchObject({
		"default-src": "'self'",
		"img-src": "'self' data: https:",
		"font-src": "'self'",
		"connect-src": "'self'",
		"base-uri": "'self'",
		"form-action": "'self'",
		"object-src": "'none'",
		"frame-ancestors": "'none'",
	});
	expect(csp["script-src"]).toMatch(/^'self'( 'sha256-[^']+')+$/);
	expect(csp["style-src"]).toMatch(/^'self'( 'sha256-[^']+')*$/);
	expect(csp["style-src-attr"]).toBe("'unsafe-inline'");
	await page.locator("astro-island:not([ssr]) .quiz-live").waitFor();
	expect(blocked).toEqual([]);

	// static files skip the Worker: public/_headers
	const icon = await request.get("/favicon.svg");
	expect(icon.headers()["x-content-type-options"]).toBe("nosniff");
	const font = await request.get("/fonts/literata.woff2");
	expect(font.headers()["cache-control"]).toBe(
		"public, max-age=31536000, immutable",
	);
});

const PHASES = ["night", "first-light", "dawn", "day", "dusk"];
for (const path of [
	...PHASES.map((p) => `/?phase=${p}`),
	"/about",
	"/no-such-page",
]) {
	test(`no axe violations (WCAG 2.2 AA) on ${path}`, async ({ page }) => {
		await page.goto(path);
		// let the sky settle: contrast is checked on the final colours
		await page.waitForTimeout(2800);
		const phase = new URL(path, "http://x").searchParams.get("phase");
		if (phase)
			await expect(page.locator("html")).toHaveAttribute("data-phase", phase);
		const { violations } = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
			.analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
	});
}
