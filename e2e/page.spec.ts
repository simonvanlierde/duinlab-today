import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { amsterdamDay, shift } from "../src/lib/day";
import type { Quiz } from "../src/lib/types";

const KEY = "today.games.v1";
const PICTURE_HOSTS =
	/^https:\/\/(images\.metmuseum\.org|thumb\.wikimedia\.org|www\.artic\.edu\/iiif|iiif\.micr\.io)\//;

async function play(page: Page, name: string) {
	// a click before the island hydrates opens the game without marking it
	await page.locator("astro-island:not([ssr]) .games:not(.off)").waitFor();
	await page.locator(".games .name", { hasText: name }).click();
}

test.beforeEach(async ({ page }) => {
	// the external game sites are never loaded
	await page.route(/^https?:\/\/(?!localhost)/, (r) =>
		r.request().resourceType() === "document"
			? r.fulfill({ body: "ok" })
			: r.continue(),
	);
	// the day's pictures (Met, Wikipedia, Art Institute, Rijksmuseum fixtures) are the fixture PNG
	await page.route(PICTURE_HOSTS, (r) =>
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

	// no NASA key in e2e: the strip holds the other four sources, in order
	const slides = page.locator(".pic .slide");
	await expect(slides).toHaveCount(4);
	const img = slides.first().locator("img");
	await expect(img).toHaveAttribute(
		"src",
		"https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg",
	);
	await expect(img).toHaveAttribute(
		"alt",
		"Wheat Field with Cypresses, by Vincent van Gogh",
	);
	await expect(img).toHaveAttribute("loading", "eager");
	await expect(slides.nth(1).locator("img")).toHaveAttribute("loading", "lazy");
	await expect
		.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
		.toBe(64);
	await expect(slides.first().locator("figcaption")).toContainText(
		"Wheat Field with Cypresses, Vincent van Gogh",
	);
	await expect(slides.nth(1).locator("figcaption a").first()).toHaveAttribute(
		"href",
		/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
	);
	await expect(slides.nth(2).locator("figcaption")).toContainText(
		"Art Institute of Chicago",
	);
	await expect(slides.nth(3).locator("figcaption")).toContainText(
		"Rijksmuseum",
	);
	const section = (id: string) =>
		page.locator(`section[aria-labelledby="${id}"]`);
	await expect(section("h-dyk")).toContainText(
		"that Cinema '76 adopted three cats",
	);
	await expect(section("h-word").locator(".word")).toHaveText("sax");
	await expect(section("h-featured")).toContainText("Bill Madden (soldier)");
	await expect(page.locator(".quiz-live .qn")).toHaveText("1 of 3");
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
	await expect(page.locator(".strip")).toContainText(
		"rain expected around 10:15",
	);
	await expect(page.locator(".strip")).toContainText(
		"Grass pollen high today · Air quality poor (AQI 64)",
	);
	await expect(section("h-events").locator(":scope > ul > li")).toHaveCount(5);
	await expect(section("h-events").locator("li").first()).toContainText(
		/^Tomorrow 19:20 Takuya Kuroda/,
	);
	await expect(section("h-recipes").locator(":scope > ul .paper")).toHaveText([
		"The Guardian",
		"Good Food",
		"Love and Lemons",
	]);
	await expect(section("h-recipes").locator(":scope > ul > li")).toHaveText([
		/The Guardian fixture recipe: dune bread/,
		/Good Food fixture recipe: dune bread/,
		/Love and Lemons fixture recipe: dune bread/,
	]);
});

test("an old train preference no longer hides the paper", async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem("today.mode.v1", "train"),
	);
	await page.goto("/");
	for (const visible of [".pic", ".quote", "#h-recipes", "section.quiz"])
		await expect(page.locator(visible)).toBeVisible();
	await expect(
		page.getByRole("button", { name: /^(Coffee|Train)$/ }),
	).toHaveCount(0);
});

// whichever of sun, moon and star is up right now
const orbs = (page: Page) => page.locator("[data-orb]:not([hidden])");

test("the almanac has an explicit close control", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	const opener = orbs(page).first();
	await opener.click();
	await page.locator("#almanac").screenshot({
		path: `test-results/almanac-close-${testInfo.project.name}.png`,
	});
	await page
		.locator("#almanac")
		.getByRole("button", { name: "Close", exact: true })
		.click();
	await expect(page.locator("#almanac")).toBeHidden();
	await expect(opener).toBeFocused();
});

test("sky controls provide 44px targets", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/?phase=night");
	const boxes = [];
	for (const control of await page.locator(".orb:not([hidden])").all()) {
		const box = await control.boundingBox();
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(box?.height).toBeGreaterThanOrEqual(44);
		if (box) boxes.push(box);
	}
	for (let i = 0; i < boxes.length; i++) {
		for (const b of boxes.slice(i + 1)) {
			const a = boxes[i];
			expect(
				a.x < b.x + b.width &&
					a.x + a.width > b.x &&
					a.y < b.y + b.height &&
					a.y + a.height > b.y,
			).toBe(false);
		}
	}
});

test("the sky's bright body opens the sun, moon and tide times, and Escape closes them", async ({
	page,
}) => {
	await page.goto("/");
	const almanac = page.locator("#almanac");
	await expect(almanac).toBeHidden();
	await orbs(page).first().click();
	await expect(almanac).toBeVisible();
	await expect(almanac).toContainText(/Sun up \d\d:\d\d, down \d\d:\d\d/);
	await expect(almanac).toContainText(/% lit/);
	await expect(almanac).toContainText(
		/High water \d\d:\d\d and \d\d:\d\d, low \d\d:\d\d and \d\d:\d\d at Scheveningen/,
	);
	// the Open-Meteo marine fixture
	await expect(almanac).toContainText(
		"Sea at Scheveningen 11.6 °C, waves 0.1 m",
	);
	await expect(almanac.getByRole("link", { name: "Open-Meteo" })).toBeVisible();
	// which planets show depends on the date: the line is there only when one is up tonight
	const tonight = almanac.locator("p", { hasText: /^Tonight:/ });
	for (const line of await tonight.allTextContents())
		for (const part of line.replace(/^Tonight: /, "").split(", "))
			expect(part).toMatch(
				/^\w+ in the [a-z-]+(?: (?:from|until) \d\d:\d\d){0,2}(?: all night)?$/,
			);
	await page.keyboard.press("Escape");
	await expect(almanac).toBeHidden();
});

test("the planets are named buttons that open the almanac, and show only in the dark", async ({
	page,
}) => {
	await page.goto("/?phase=night");
	const planets = page.locator("[data-planet]");
	await expect(planets).toHaveCount(5);
	for (const name of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"])
		await expect(page.locator(`[data-planet=${name}]`)).toHaveAttribute(
			"aria-label",
			new RegExp(`^${name}:`),
		);
	const up = page.locator("[data-planet]:not([hidden])");
	if (await up.count()) {
		await up.first().click();
		await expect(page.locator("#almanac")).toBeVisible();
	}
	await page.keyboard.press("Escape");
	await page.goto("/?phase=day");
	await expect(page.locator("[data-planet]:not([hidden])")).toHaveCount(0);
});

test("by day the sun is a named, focusable button that opens the times", async ({
	page,
}) => {
	await page.goto("/?phase=day");
	const sun = page.getByRole("button", {
		name: "Sun: sun, moon and tide times",
	});
	await expect(sun).toBeVisible();
	await sun.focus();
	await expect(sun).toBeFocused();
	expect(await sun.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
		"solid",
	);
	await page.keyboard.press("Enter");
	await expect(page.locator("#almanac")).toBeVisible();
	await expect(page.locator("#almanac")).toContainText(/% lit/);
	await page.keyboard.press("Escape");
	await expect(page.locator("#almanac")).toBeHidden();
});

test("at night the sun is gone and the moon or a bright star stays on screen", async ({
	page,
}) => {
	await page.goto("/?phase=night");
	await expect(page.locator("[data-orb=sun]")).toBeHidden();
	const visible = orbs(page);
	await expect(visible).not.toHaveCount(0);
	const box = await visible.first().boundingBox();
	const view = page.viewportSize();
	expect(box && view).toBeTruthy();
	if (box && view) {
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(view.width);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y + box.height).toBeLessThanOrEqual(view.height);
	}
	await visible.first().click();
	await expect(page.locator("#almanac")).toBeVisible();
});

test.describe("the sky without JavaScript", () => {
	test.use({ javaScriptEnabled: false });
	test("the server still places a sun, moon or star that opens the times", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(orbs(page).first()).toBeVisible();
		await expect(orbs(page).first()).toHaveAttribute(
			"popovertarget",
			"almanac",
		);
	});
});

test("the paper leads on phones and games stay visible on desktop", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	const box = await page.locator(".games").boundingBox();
	if (testInfo.project.name === "phone") {
		await expect(page.locator("#paper > :first-child")).toHaveClass("pic");
		for (const selector of [".reading", ".feat", ".otd", ".quote"]) {
			const reading = await page.locator(selector).boundingBox();
			expect(
				box && reading && reading.y + reading.height <= box.y,
			).toBeTruthy();
		}
		return;
	}
	const view = page.viewportSize();
	expect(box && view && box.y + box.height <= view.height).toBe(true);
});

test("the picture strip moves with arrows, dots and the keyboard", async ({
	page,
}) => {
	await page.goto("/");
	const strip = page.getByRole("region", { name: /Pictures of the day/ });
	const dots = strip.locator("xpath=..").locator(".dot");
	await expect(dots).toHaveCount(4);
	await expect(dots.first()).toHaveAttribute("aria-current", "true");
	await page.getByRole("button", { name: "Next picture" }).click();
	await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
	await expect(dots.first()).not.toHaveAttribute("aria-current");
	await dots.nth(3).click();
	await expect(dots.nth(3)).toHaveAttribute("aria-current", "true");
	await expect(
		page.getByRole("button", { name: "Next picture" }),
	).toBeDisabled();
	await strip.focus();
	await page.keyboard.press("ArrowLeft");
	await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
	await page.getByRole("button", { name: "Previous picture" }).click();
	await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
});

test.describe("the pictures without JavaScript", () => {
	test.use({ javaScriptEnabled: false });
	test("are a plain scrollable strip with every caption", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator(".pic .slide")).toHaveCount(4);
		await expect(page.locator(".pic button")).toHaveCount(0);
		const strip = page.locator(".pic .slides");
		expect(await strip.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(
			true,
		);
		await expect(page.locator(".pic figcaption a")).not.toHaveCount(0);
	});
});

test("the desktop page fits one screen", async ({ page }) => {
	for (const [width, height] of [
		[1440, 900],
		[1280, 800],
	]) {
		await page.setViewportSize({ width, height });
		await page.goto("/");
		// the paper itself; the recipes and the footer follow below the fold
		const tall = await page.evaluate(
			() =>
				document.querySelector("#paper")?.getBoundingClientRect().bottom ?? 0,
		);
		expect(tall).toBeLessThanOrEqual(height);
	}
});

test("on a short desktop the picture, reading and games fit, and the quote waits under the fold", async ({
	page,
}) => {
	for (const [width, height] of [
		[1100, 700],
		[1280, 700],
	]) {
		await page.setViewportSize({ width, height });
		await page.goto("/");
		const edges = await page.evaluate(() => {
			const box = (s: string) =>
				document.querySelector(s)?.getBoundingClientRect();
			return {
				above: [".pic", ".feat", ".reading", ".rail"].map(
					(s) => box(s)?.bottom ?? 0,
				),
				rail: box(".rail")?.bottom ?? 0,
				quote: box(".quote")?.top ?? 0,
			};
		});
		for (const bottom of edges.above)
			expect(bottom).toBeLessThanOrEqual(height);
		expect(edges.quote).toBeGreaterThan(edges.rail);
	}
});

test("on desktop altitude reaches the full height of the sky", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto("/");
	const star = page.locator("[data-orb=star]");
	const sky = await page.locator("header.sky").boundingBox();
	await star.evaluate((el) => {
		el.removeAttribute("hidden");
		el.style.setProperty("--alt", "60");
	});
	const box = await star.boundingBox();
	expect(sky && box).toBeTruthy();
	if (sky && box)
		// the old 64px band would put 60 degrees under 76px; here it is two thirds of the way up
		expect(sky.y + sky.height - (box.y + box.height / 2)).toBeGreaterThan(
			(sky.height - 76) * 0.5,
		);
});

test("the quiz asks one question at a time and keeps the score", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	const quiz = page.locator(".quiz-live");
	// the server-rendered buttons are inert until the island hydrates
	await page.locator("astro-island:not([ssr]) .quiz-live").waitFor();
	await expect(quiz.locator(".q")).toHaveCount(1);
	await expect(quiz.getByText("Review answers", { exact: true })).toHaveCount(
		0,
	);
	const questions = [];
	const choices = [];
	const correct = [];
	const source: Quiz = (await (await page.request.get("/today.json")).json())
		.quiz;
	const total = Number(
		(await quiz.locator(".qn").textContent())?.match(/of (\d+)/)?.[1],
	);
	for (let i = 0; i < total; i++) {
		const question = source.questions[i];
		const pick =
			i === 0
				? question.correct
				: (question.correct + 1) % question.answers.length;
		questions.push((await quiz.locator(".q").textContent()) ?? "");
		choices.push(question.answers[pick]);
		await quiz.locator(".answer").nth(pick).click();
		correct.push(question.answers[question.correct]);
		await expect(quiz.locator(".answer").first()).toBeDisabled();
		await quiz.locator(".next").click();
	}
	await expect(quiz.locator(".score")).toContainText(`of ${total}.`);
	await expect(quiz.locator(".score .figure")).toHaveText("1");
	const saved = await page.evaluate(() =>
		localStorage.getItem("today.quiz.v1"),
	);
	const summary = quiz.getByText("Review answers", { exact: true });
	await summary.focus();
	await page.keyboard.press("Enter");
	const review = quiz.locator(".review li");
	await expect(review).toHaveCount(total);
	for (let i = 0; i < total; i++) {
		await expect(review.nth(i)).toBeVisible();
		await expect(review.nth(i)).toContainText(questions[i]);
		if (choices[i]?.trim() === correct[i]) {
			await expect(review.nth(i)).toContainText(`Correct: ${correct[i]}`);
			await expect(review.nth(i)).not.toContainText("Your answer:");
		} else {
			await expect(review.nth(i)).toContainText(`Your answer: ${choices[i]}`);
			await expect(review.nth(i)).toContainText(
				`Correct answer: ${correct[i]}`,
			);
		}
	}
	await quiz.screenshot({
		path: `test-results/quiz-review-${testInfo.project.name}.png`,
	});
	expect(
		(await new AxeBuilder({ page }).include(".quiz-live").analyze()).violations,
	).toEqual([]);
	expect(await page.evaluate(() => localStorage.getItem("today.quiz.v1"))).toBe(
		saved,
	);
	await page.keyboard.press("Enter");
	await expect(review.first()).toBeHidden();
	await page.reload();
	await expect(quiz.locator(".score")).toContainText(`of ${total}.`);
	await expect(quiz.locator(".score .figure")).toHaveText("1");
	await quiz.getByText("Review answers", { exact: true }).click();
	await expect(review.first()).toContainText(choices[0] ?? "");
});

test("long game streaks survive another game's save and a reload", async ({
	page,
}) => {
	const today = amsterdamDay();
	const history = Array.from({ length: 64 }, (_, i) => shift(today, i - 64));
	await page.addInitScript(
		({ history, key }) => {
			if (!localStorage.getItem(key))
				localStorage.setItem(key, JSON.stringify({ wordle: history }));
		},
		{ history, key: KEY },
	);
	await page.goto("/");
	await play(page, "Wordle");
	await play(page, "Connections");
	await page.reload();
	await expect(
		page.locator(".game", { hasText: "Wordle" }).locator(".streak .figure"),
	).toHaveText("65");
});

test("opening a game marks it and state survives a reload", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.locator(".count")).toContainText("0 of 10 played");
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

	await expect(
		page.getByRole("button", { name: /un-mark|share today/i }),
	).toHaveCount(0);
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
	await expect(
		page.getByRole("button", { name: /un-mark|share today/i }),
	).toHaveCount(0);
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
}, testInfo) => {
	await page.goto("/");
	await expect(page.locator(".wx")).toHaveAttribute("href", /meteoblue\.com/);
	await page.getByRole("link", { name: "About", exact: true }).click();
	await expect(page.locator("h1")).toHaveText("About this page");
	await expect(
		page.locator("footer").getByRole("link", { name: "Simon van Lierde" }),
	).toHaveAttribute("href", "https://simonvanlierde.com");
	await expect(page.locator("footer")).not.toContainText("duinlab.nl");
	await page.screenshot({
		path: testInfo.outputPath("about.png"),
		fullPage: true,
	});
	await expect(
		page.getByRole("link", { name: /github\.com\/simonvanlierde/ }),
	).toBeVisible();
	const missing = await page.goto("/no-such-page");
	expect(missing?.status()).toBe(404);
	await expect(page.locator("h1")).toHaveText("Below the horizon");
});

test("yesterday's paper shows the stored day with the quiz answers", async ({
	page,
}) => {
	await page.goto("/");
	await page.getByRole("link", { name: "Yesterday's paper" }).click();
	await expect(page.getByText("Which planet is red?")).toBeVisible();
	await expect(page.locator("strong", { hasText: "Mars" })).toBeVisible();
	await expect(page.getByText("Yesterday's quote.")).toBeVisible();
	await page.getByRole("link", { name: "Today's paper" }).click();
	await expect(page).toHaveURL(/\/$/);
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
	"/yesterday",
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
