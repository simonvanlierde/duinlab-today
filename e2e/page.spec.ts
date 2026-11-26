import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { localDay, shift } from "../src/lib/day";
import { planetsTonight } from "../src/lib/planets";
import type { Quiz } from "../src/lib/types";
import { moonAtEdge, moonNow, pinSky, planetApart, planetsNow, sunNow } from "./sky";

const KEY = "today.games.v1";
const PICTURE_HOSTS =
  /^https:\/\/(images\.metmuseum\.org|thumb\.wikimedia\.org|www\.artic\.edu\/iiif|iiif\.micr\.io)\//;

async function play(page: Page, name: string) {
  // a click before the island hydrates opens the game without marking it
  await page.locator("astro-island:not([ssr]) .games:not(.off)").waitFor();
  await page.locator(".games .name", { hasText: name }).click();
}

test.beforeEach(async ({ context }) => {
  // the external game sites are never loaded
  await context.route(/^https?:\/\/(?!localhost)/, (r) =>
    r.request().resourceType() === "document" ? r.fulfill({ body: "ok" }) : r.abort(),
  );
  // the day's pictures (Met, Wikipedia, Art Institute, Rijksmuseum fixtures) are the fixture PNG
  await context.route(PICTURE_HOSTS, (r) => r.fulfill({ path: "e2e/fixtures/picture.png", contentType: "image/png" }));
});

// Content from e2e/fixture-server.mjs, which serves test/unit/fixtures in place of the sources.
test("renders the sky, every section from the fixtures, and the eight games", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-phase", /night|first-light|dawn|day|dusk/);
  await expect(page.locator(".games .game")).toHaveCount(8);

  // no NASA key in e2e: the strip holds the other four sources, in order
  const slides = page.locator(".pic .slide");
  await expect(slides).toHaveCount(4);
  const img = slides.first().locator("img");
  await expect(img).toHaveAttribute("src", "https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg");
  await expect(img).toHaveAttribute("alt", "Wheat Field with Cypresses, by Vincent van Gogh");
  await expect(img).toHaveAttribute("loading", "eager");
  await expect(slides.nth(1).locator("img")).toHaveAttribute("loading", "lazy");
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(64);
  await expect(slides.first().locator("figcaption")).toContainText("Wheat Field with Cypresses, Vincent van Gogh");
  await expect(slides.nth(1).locator("figcaption a").first()).toHaveAttribute(
    "href",
    /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
  );
  await expect(slides.nth(2).locator("figcaption")).toContainText("Art Institute of Chicago");
  await expect(slides.nth(3).locator("figcaption")).toContainText("Rijksmuseum");
  const section = (id: string) => page.locator(`section[aria-labelledby="${id}"]`);
  await expect(section("h-dyk")).toContainText("that Cinema '76 adopted three cats");
  await expect(section("h-word").locator(".word")).toHaveText("sax");
  await expect(section("h-featured")).toContainText("Bill Madden (soldier)");
  await expect(page.locator(".quiz-live .qn")).toHaveText("1 of 3");
  await expect(page.locator(".quiz-live .q")).toHaveText(
    'Which Kingdom Hearts game featured the cast of "The World Ends With You"?',
  );
  // 2016 is a war and skipped: the first event that is not grim
  await expect(section("h-otd").locator(".year")).toHaveText("2012");
  await expect(section("h-otd")).toContainText("Tammy Baldwin");
  await expect(page.locator(".quote")).toContainText("Your mind is infinite, it's your doubts that are limiting.");
  await expect(page.locator(".quote figcaption")).toContainText("Robert Kiyosaki");
  await expect(page.locator(".wx")).toContainText(/5°C\s*overcast, 9° \/ 2°/);
  await expect(page.locator(".strip")).toContainText(/rain expected around \d{2}:\d{2}/);
  await expect(page.locator(".strip")).toContainText("Grass pollen high today · Air quality poor (AQI 64)");
  await expect(section("h-events").locator(":scope > ul > li")).toHaveCount(5);
  await expect(section("h-events").locator("li").first()).toContainText(/^Tomorrow 19:20 Takuya Kuroda/);
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
  await page.addInitScript(() => localStorage.setItem("today.mode.v1", "train"));
  await page.goto("/");
  for (const visible of [".pic", ".quote", "#h-recipes", "section.quiz"])
    await expect(page.locator(visible)).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Coffee|Train)$/ })).toHaveCount(0);
});

// whichever of sun, moon and star is up at the pinned time
const orbs = (page: Page) => page.locator("[data-orb]:not([hidden])");
// the one orb in the sky: by day the moon can stand on the sun
const oneOrb = (at: number) => !(sunNow(at) > -3 && moonNow(at).alt > -0.5);

test("the almanac has an explicit close control", async ({ page }, testInfo) => {
  await pinSky(page, oneOrb);
  await page.goto("/");
  await expect(orbs(page)).toHaveCount(1);
  const opener = orbs(page).first();
  await opener.click();
  await page.locator("#almanac").screenshot({
    path: `test-results/almanac-close-${testInfo.project.name}.png`,
  });
  await page.locator("#almanac").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("#almanac")).toBeHidden();
  await expect(opener).toBeFocused();
});

test("sky controls provide 44px targets", async ({ page }) => {
  // the moon at the edge of the sky, where its hit area once shrank
  await pinSky(page, moonAtEdge);
  await page.goto("/?phase=night");
  await expect(page.locator("[data-orb=moon]")).toBeVisible();
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
      expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).toBe(false);
    }
  }
});

test("the sky's bright body opens the sun and moon times, and Escape closes them", async ({ page }) => {
  await pinSky(page, oneOrb);
  // the server renders tonight's planets on the real clock: one of these two is on the page
  const { date } = await (await page.request.get("/today.json")).json();
  const names = () => planetsTonight(date, new Date()).map((p) => p.name);
  const before = names();
  await page.goto("/");
  const after = names();
  const almanac = page.locator("#almanac");
  await expect(almanac).toBeHidden();
  await orbs(page).first().click();
  await expect(almanac).toBeVisible();
  await expect(almanac).toContainText(/Sunrise \d\d:\d\d, sunset \d\d:\d\d/);
  await expect(almanac).toContainText(/% lit/);
  await expect(almanac).toContainText(
    /High water \d\d:\d\d and \d\d:\d\d, low \d\d:\d\d and \d\d:\d\d at Scheveningen/,
  );
  // the Open-Meteo marine fixture
  await expect(almanac).toContainText("Water 11.6 °C, waves 0.1 m");
  await expect(almanac.getByRole("link", { name: "Open-Meteo" })).toBeVisible();
  const tonight = almanac.locator(".planet-window:visible");
  expect([before, after]).toContainEqual(await tonight.locator(".planet-name").allTextContents());
  for (const line of await tonight.allTextContents())
    for (const part of line.replace(/\s+/g, " ").trim().split(", "))
      expect(part).toMatch(/^\w+ in the [a-z-]+(?: (?:from|until) \d\d:\d\d){0,2}(?: all night)?$/);
  await page.keyboard.press("Escape");
  await expect(almanac).toBeHidden();
});

test("the planets are named buttons that open the almanac, and show only in the dark", async ({ page }) => {
  const at = await pinSky(page, planetApart);
  await page.goto("/?phase=night");
  const planets = page.locator("[data-planet]");
  await expect(planets).toHaveCount(5);
  for (const name of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"])
    await expect(page.locator(`[data-planet=${name}]`)).toHaveAttribute("aria-label", new RegExp(`^${name}:`));
  const up = page.locator("[data-planet]:not([hidden])");
  await expect(up).not.toHaveCount(0);
  const name = await up.first().getAttribute("data-planet");
  expect(planetsNow(at).find((p) => p.name === name)?.alt).toBeGreaterThan(3);
  await up.first().click();
  await expect(page.locator("#almanac").getByRole("heading", { name: name ?? "", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/?phase=day");
  await expect(page.locator("[data-planet]:not([hidden])")).toHaveCount(0);
});

test("by day the sun is a named, focusable button that opens the times", async ({ page }) => {
  await page.goto("/?phase=day");
  const sun = page.getByRole("button", {
    name: "Sun: sun and moon times",
  });
  await expect(sun).toBeVisible();
  await sun.focus();
  await expect(sun).toBeFocused();
  expect(await sun.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.keyboard.press("Enter");
  await expect(page.locator("#almanac")).toBeVisible();
  await expect(page.locator("#almanac")).toContainText(/% lit/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#almanac")).toBeHidden();
});

test("at night the sun is gone and the moon or a bright star stays on screen", async ({ page }) => {
  await pinSky(page, moonAtEdge);
  await page.goto("/?phase=night");
  await expect(page.locator("[data-orb=sun]")).toBeHidden();
  const visible = orbs(page);
  await expect(visible).toHaveAttribute("data-orb", "moon");
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
  test("the server still places a sun, moon or star that opens the times", async ({ page }) => {
    await page.goto("/");
    await expect(orbs(page).first()).toBeVisible();
    await expect(orbs(page).first()).toHaveAttribute("popovertarget", "almanac");
  });
});

test("the paper leads on phones and games stay visible on desktop", async ({ page }, testInfo) => {
  await page.goto("/");
  const box = await page.locator(".games").boundingBox();
  if (testInfo.project.name === "phone") {
    await expect(page.locator("#paper > :first-child")).toHaveClass(/\bpic\b/);
    const reading = await page.locator(".reading").boundingBox();
    expect(box && reading && reading.y + reading.height <= box.y).toBeTruthy();
    for (const selector of [".feat", ".otd", ".quote"]) {
      const secondary = await page.locator(selector).boundingBox();
      expect(box && secondary && box.y + box.height <= secondary.y).toBeTruthy();
    }
    const order = await page.locator("#paper").evaluate((paper) => {
      const games = paper.querySelector(".rail");
      if (!games) return false;
      return [".feat", ".otd", ".quote"].every((selector) => {
        const section = paper.querySelector(selector);
        return section && Boolean(games.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
    });
    expect(order).toBe(true);
    return;
  }
  const view = page.viewportSize();
  expect(box && view && box.y + box.height <= view.height).toBe(true);
});

test("desktop reading keeps the complete article directly under the pictures", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const article = page.locator(".feat p");
  await expect(article.locator(".src a")).toBeVisible();
  expect(await article.evaluate((p) => p.scrollHeight <= p.clientHeight + 1)).toBe(true);
  const boxes = await page.locator("#paper").evaluate((paper) => {
    const box = (selector: string) => paper.querySelector(selector)?.getBoundingClientRect();
    return {
      picture: box(".pic")?.bottom ?? 0,
      articleTop: box(".feat")?.top ?? 0,
      articleRight: box(".feat")?.right ?? 0,
      reading: box(".reading")?.left ?? 0,
    };
  });
  // no gap waits for the quiz: the article shares the pictures' column
  expect(boxes.articleTop - boxes.picture).toBeLessThanOrEqual(9);
  expect(boxes.articleRight).toBeLessThanOrEqual(boxes.reading);
});

test("primary reading fills the first column when picture and article sources are missing", async ({ page }) => {
  for (const height of [600, 900]) {
    await page.setViewportSize({ width: 1280, height });
    await page.goto("/");
    await page.locator(".pic, .feat").evaluateAll((sections) => {
      for (const section of sections) section.remove();
    });
    const paper = await page
      .locator("#paper")
      .evaluate((paper) => paper.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(paper).paddingLeft));
    const reading = await page.locator(".reading").boundingBox();
    expect(reading && Math.abs(paper - reading.x) < 1).toBeTruthy();
  }
});

test("the picture strip moves with arrows, dots and the keyboard", async ({ page }) => {
  await page.goto("/");
  const strip = page.getByRole("region", { name: /Pictures of the day/ });
  const dots = strip.locator("xpath=..").locator(".dot");
  const picture = await strip.locator(".picture-open").first().boundingBox();
  const controls = await page.locator(".picture-controls").boundingBox();
  expect(picture && controls).toBeTruthy();
  if (picture && controls) expect(controls.y).toBeGreaterThanOrEqual(picture.y + picture.height);
  await expect(dots).toHaveCount(4);
  await expect(dots.first()).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Next picture" }).click();
  await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
  await expect(dots.first()).not.toHaveAttribute("aria-current");
  await dots.nth(3).click();
  await expect(dots.nth(3)).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: "Next picture" })).toBeDisabled();
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
    expect(await strip.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
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
    const tall = await page.evaluate(() => document.querySelector("#paper")?.getBoundingClientRect().bottom ?? 0);
    expect(tall).toBeLessThanOrEqual(height);
  }
});

test("on a short desktop primary reading and games fit while the complete article can scroll", async ({ page }) => {
  for (const [width, height] of [
    [1100, 700],
    [1280, 700],
    [1280, 600],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const edges = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)?.getBoundingClientRect();
      return {
        above: [".pic", ".reading", ".rail"].map((s) => box(s)?.bottom ?? 0),
        rail: box(".rail")?.bottom ?? 0,
        quote: box(".quote")?.top ?? 0,
      };
    });
    for (const bottom of edges.above) expect(bottom).toBeLessThanOrEqual(height);
    expect(edges.quote).toBeGreaterThan(edges.rail);
    const article = page.locator(".feat p");
    expect(await article.evaluate((p) => p.scrollHeight <= p.clientHeight + 1)).toBe(true);
  }
});

test("on desktop altitude reaches the full height of the sky", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // a moonless night shows the star, and no transition or replay moves it after the jump to 60
  await pinSky(page, (at) => moonNow(at).alt < -2);
  await page.goto("/?phase=night");
  const star = page.locator("[data-orb=star]");
  await expect(star).toBeVisible();
  const sky = await page.locator("header.sky").boundingBox();
  await star.evaluate((el) => el.style.setProperty("--alt", "60"));
  const box = await star.boundingBox();
  expect(sky && box).toBeTruthy();
  if (sky && box)
    // the old 64px band would put 60 degrees under 76px; here it is two thirds of the way up
    expect(sky.y + sky.height - (box.y + box.height / 2)).toBeGreaterThan((sky.height - 76) * 0.5);
});

test("the quiz asks one question at a time and keeps the score", async ({ page }, testInfo) => {
  await page.goto("/");
  const quiz = page.locator(".quiz-live");
  // the server-rendered buttons are inert until the island hydrates
  await page.locator("astro-island:not([ssr]) .quiz-live").waitFor();
  await expect(quiz.locator(".q")).toHaveCount(1);
  await expect(quiz.getByText("Review answers", { exact: true })).toHaveCount(0);
  const questions = [];
  const choices = [];
  const correct = [];
  const source: Quiz = (await (await page.request.get("/today.json")).json()).quiz;
  const total = Number((await quiz.locator(".qn").textContent())?.match(/of (\d+)/)?.[1]);
  for (let i = 0; i < total; i++) {
    const question = source.questions[i];
    const pick = i === 0 ? question.correct : (question.correct + 1) % question.answers.length;
    questions.push((await quiz.locator(".q").textContent()) ?? "");
    choices.push(question.answers[pick]);
    await quiz.locator(".answer").nth(pick).click();
    correct.push(question.answers[question.correct]);
    await expect(quiz.locator(".answer").first()).toBeDisabled();
    await quiz.locator(".next").click();
  }
  await expect(quiz.locator(".score")).toContainText(`of ${total}.`);
  await expect(quiz.locator(".score .figure")).toHaveText("1");
  const saved = await page.evaluate(() => localStorage.getItem("today.quiz.v1"));
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
      await expect(review.nth(i)).toContainText(`Correct answer: ${correct[i]}`);
    }
  }
  await quiz.screenshot({
    path: `test-results/quiz-review-${testInfo.project.name}.png`,
  });
  expect((await new AxeBuilder({ page }).include(".quiz-live").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("today.quiz.v1"))).toBe(saved);
  await page.keyboard.press("Enter");
  await expect(review.first()).toBeHidden();
  await page.reload();
  await expect(quiz.locator(".score")).toContainText(`of ${total}.`);
  await expect(quiz.locator(".score .figure")).toHaveText("1");
  await quiz.getByText("Review answers", { exact: true }).click();
  await expect(review.first()).toContainText(choices[0] ?? "");
});

for (const kind of ["quiz", "games"] as const) {
  test(`${kind} saves serialize overlapping tab updates`, async ({ page, context }) => {
    await page.goto("/");
    const other = await context.newPage();
    await other.goto("/");
    for (const tab of [page, other]) await tab.locator("astro-island:not([ssr]) .games:not(.off)").waitFor();
    const key = `today.${kind}.v1`;
    await page.evaluate(
      (key) =>
        new Promise<void>((entered) => {
          void navigator.locks.request(key, () => {
            entered();
            return new Promise<void>((release) => {
              (window as Window & { releaseProgress?: () => void }).releaseProgress = release;
            });
          });
        }),
      key,
    );
    if (kind === "quiz") {
      await page.locator(".quiz-live .answer").first().click();
      await other.locator(".quiz-live .answer").nth(1).click();
    } else {
      await page.locator(".games .name").first().click();
      await other.locator(".games .name").nth(1).click();
    }
    await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending?.length)).toBe(2);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await page.evaluate(() => (window as Window & { releaseProgress?: () => void }).releaseProgress?.());
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const saved = JSON.parse(localStorage.getItem(key) ?? "null");
          return key.includes("quiz") ? saved?.picks[0] === 0 : Object.keys(saved ?? {}).length === 2;
        }, key),
      )
      .toBe(true);
    if (kind === "quiz")
      await expect(other.locator(".quiz-live .answer").first()).toHaveAttribute("aria-disabled", "true");
    await other.close();
  });
}

test("quiz tabs share progress without stealing focus or overwriting completed answers", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  for (const tab of [page, other]) await tab.locator("astro-island:not([ssr]) .quiz-live").waitFor();
  const quiz: Quiz = (await (await page.request.get("/today.json")).json()).quiz;
  const otherGame = other.locator(".games .name").first();
  await otherGame.focus();
  await page.locator(".quiz-live .answer").nth(quiz.questions[0].correct).click();
  await expect(other.locator(".quiz-live .qn")).toHaveText(`2 of ${quiz.questions.length}`);
  await expect(otherGame).toBeFocused();
  // Install before hydration: Window invokes storage listeners in registration order.
  await other.addInitScript(() => {
    addEventListener("storage", (event) => event.stopImmediatePropagation(), true);
    document.addEventListener("visibilitychange", (event) => event.stopImmediatePropagation(), true);
  });
  await other.reload();
  await other.locator("astro-island:not([ssr]) .quiz-live").waitFor();
  await expect(other.locator(".quiz-live .qn")).toHaveText(`2 of ${quiz.questions.length}`);
  await page.locator(".quiz-live .next").click();
  for (const question of quiz.questions.slice(1)) {
    await page.locator(".quiz-live .answer").nth(question.correct).click();
    await page.locator(".quiz-live .next").click();
  }
  const saved = await page.evaluate(() => localStorage.getItem("today.quiz.v1"));
  await expect(other.locator(".quiz-live .qn")).toHaveText(`2 of ${quiz.questions.length}`);
  await other
    .locator(".quiz-live .answer")
    .nth((quiz.questions[1].correct + 1) % quiz.questions[1].answers.length)
    .click();
  for (let i = 1; i < quiz.questions.length; i++) await other.locator(".quiz-live .next").click();
  await expect(other.locator(".quiz-live .score .figure")).toHaveText(String(quiz.questions.length));
  expect(await other.evaluate(() => localStorage.getItem("today.quiz.v1"))).toBe(saved);
  await other.close();
});

test("another quiz tab keeps the current answer feedback and Next button focused", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  for (const tab of [page, other]) await tab.locator("astro-island:not([ssr]) .quiz-live").waitFor();
  await page.locator(".quiz-live .answer").first().click();
  const next = page.locator(".quiz-live .next");
  await expect(next).toBeFocused();
  const feedback = await page.locator(".quiz-foot > span").textContent();
  await expect(other.locator(".quiz-live .qn")).toHaveText("2 of 3");
  await other.locator(".quiz-live .answer").first().click();
  await page.evaluate(() => dispatchEvent(new StorageEvent("storage", { key: "today.quiz.v1" })));
  await expect(page.locator(".quiz-live .qn")).toHaveText("1 of 3");
  await expect(page.locator(".quiz-foot > span")).toHaveText(feedback ?? "");
  await expect(next).toBeFocused();
  await next.click();
  await expect(page.locator(".quiz-live .qn")).toHaveText("2 of 3");
  await expect(next).toBeVisible();
  await other.close();
});

test("quiz updates preserve a focused unanswered question", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  for (const tab of [page, other]) await tab.locator("astro-island:not([ssr]) .quiz-live").waitFor();
  const choice = other.locator(".quiz-live .answer").first();
  await choice.focus();
  for (let i = 0; i < 3; i++) {
    await page.locator(".quiz-live .answer").first().click();
    await page.locator(".quiz-live .next").click();
    await expect(other.locator(".quiz-live .qn")).toHaveText("1 of 3");
    await expect(choice).toBeFocused();
  }
  await expect(other.locator(".quiz-live .next")).toBeVisible();
  for (let i = 0; i < 3; i++) await other.locator(".quiz-live .next").click();
  await expect(other.locator(".quiz-live .score")).toBeFocused();
  await other.close();
});

test("quiz tabs refresh missed progress when returning to the page", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.addInitScript(() => {
    addEventListener("storage", (event) => event.stopImmediatePropagation(), true);
  });
  await other.goto("/");
  for (const tab of [page, other]) await tab.locator("astro-island:not([ssr]) .quiz-live").waitFor();
  await page.locator(".quiz-live .answer").first().click();
  await expect(other.locator(".quiz-live .qn")).toHaveText("1 of 3");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("today.quiz.v1") ?? "null")?.picks[0]))
    .toBe(0);
  await other.bringToFront();
  await other.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(other.locator(".quiz-live .qn")).toHaveText("2 of 3");
  await other.close();
});

test("games keep keyboard focus when another tab finishes the board", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const other = await context.newPage();
  await other.setViewportSize({ width: 390, height: 844 });
  await other.goto("/");
  for (const tab of [page, other]) await tab.locator("astro-island:not([ssr]) .games:not(.off)").waitFor();
  await other.locator(".games .name").first().focus();
  for (const link of await page.locator(".games .name").all()) await link.click();
  const unfold = other.getByRole("button", { name: "Show games" });
  await expect(unfold).toBeFocused();
  await other.keyboard.press("Enter");
  await expect(other.locator(".games .name").first()).toBeFocused();
  await other.close();
});

test("long game streaks survive another game's save and a reload", async ({ page }) => {
  const today = localDay();
  const history = Array.from({ length: 64 }, (_, i) => shift(today, i - 64));
  await page.addInitScript(
    ({ history, key }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ wordle: history }));
    },
    { history, key: KEY },
  );
  await page.goto("/");
  await play(page, "Wordle");
  await play(page, "Connections");
  await page.reload();
  await expect(page.locator(".game", { hasText: "Wordle" }).locator(".streak .figure")).toHaveText("65");
});

test("opening a game marks it and state survives a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".count")).toContainText("0 of 8 played");
  await expect(page.locator(".games .name").first()).toHaveAttribute("target", "_blank");
  await play(page, "Wordle");
  await expect(page.locator(".count")).toContainText("1 of 8 played");
  const row = page.locator(".game", { hasText: "Wordle" });
  await expect(row.locator(".name")).toContainText(", played");
  await expect(row.locator(".streak .figure")).toHaveText("1");

  await page.reload();
  await expect(page.locator(".count")).toContainText("1 of 8 played");

  await expect(page.getByRole("button", { name: /un-mark|share today/i })).toHaveCount(0);
});

test("all eight played lights the white-out, and it persists", async ({ page }) => {
  await page.goto("/");
  const names = await page
    .locator(".games .name .label")
    .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ""));
  expect(names).toHaveLength(8);
  for (const n of names) await play(page, n);
  await expect(page.locator(".count")).toContainText("8 of 8 played");
  await expect(page.locator("html")).toHaveAttribute("data-whiteout", "");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-whiteout", "");
  await expect(page.getByRole("button", { name: /un-mark|share today/i })).toHaveCount(0);
});

test("a streak counts consecutive days", async ({ page }) => {
  // the browser's day is the Monday after the clocks went forward: the 23-hour Sunday still counts
  await page.clock.setFixedTime(new Date("2026-03-30T10:00:00+02:00"));
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ wordle: ["2026-03-27", "2026-03-28", "2026-03-29"] }));
  }, KEY);
  await page.goto("/");
  const row = page.locator(".game", { hasText: "Wordle" });
  await expect(row.locator(".streak .figure")).toHaveText("3");
});

test("without localStorage the games are plain links and nothing breaks", async ({ page }) => {
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
  await expect(page.locator(".games .name")).toHaveCount(8);
  await expect(page.locator(".count")).toContainText("8 daily games");
  await expect(page.locator(".games .streak")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("no horizontal scroll and 44px game rows", async ({ page }) => {
  await page.goto("/");
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(wide).toBe(false);
  for (const h of await page.locator(".games .name").evaluateAll((e) => e.map((x) => x.getBoundingClientRect().height)))
    expect(h).toBeGreaterThanOrEqual(44);
});

// WCAG 1.4.10 reflow: 320 CSS px wide with no sideways scrolling.
test.describe("at 320px wide", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const path of ["/", "/about", "/yesterday", "/no-such-page"]) {
    test(`${path} reflows without horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(wide).toBe(false);
    });
  }
});

test("the sky follows the browser clock from night to day", async ({ page }) => {
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
    await expect(links).toHaveCount(8);
    await expect(links.first()).toHaveAttribute("href", /^https:/);
    await expect(page.locator(".quiz-static details")).not.toHaveCount(0);
  });
});

test("public pages share their own title and description with the site card", async ({ page }) => {
  for (const path of ["/about", "/yesterday"]) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", await page.title());
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      (await page.locator('meta[name="description"]').getAttribute("content")) ?? "",
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `https://today.duinlab.nl${path}`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https:\/\/today\.duinlab\.nl\/og\.png\?v=[a-f0-9]{8}$/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  }
  const missing = await page.goto("/missing-card-test");
  expect(missing?.status()).toBe(404);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(0);
});

test("the about page says what is kept and links the source", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".wx")).toHaveAttribute("href", /meteoblue\.com/);
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("About this page");
  await expect(page.locator("footer").getByRole("link", { name: "Simon van Lierde" })).toHaveAttribute(
    "href",
    "https://simonvanlierde.com",
  );
  await expect(page.locator("footer")).not.toContainText("duinlab.nl");
  await page.screenshot({
    path: testInfo.outputPath("about.png"),
    fullPage: true,
  });
  await expect(page.getByRole("link", { name: "Code on GitHub" })).toBeVisible();
  // the short form here points to the full statement, which holds the rights and contact
  await expect(page.getByRole("link", { name: "full privacy statement" })).toHaveAttribute(
    "href",
    /docs\/privacy\.md$/,
  );
  const missing = await page.goto("/no-such-page");
  expect(missing?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Below the horizon");
});

test("yesterday's paper shows the stored day with the quiz answers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Yesterday's paper" }).click();
  await expect(page.getByText("Which planet is red?")).toBeVisible();
  await expect(page.locator("strong", { hasText: "Mars" })).toBeVisible();
  await expect(page.getByText("Yesterday's quote.")).toBeVisible();
  await page.getByRole("link", { name: "Today's paper" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("security headers and a CSP that the page keeps to", async ({ page, request }) => {
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
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
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
  expect(font.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
});

// Each page carries its own script and style hashes, so each is checked against its CSP.
for (const path of ["/about", "/yesterday", "/no-such-page"]) {
  test(`${path} keeps to its CSP`, async ({ page }) => {
    const blocked: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy/i.test(m.text())) blocked.push(m.text());
    });
    await page.goto(path, { waitUntil: "networkidle" });
    expect(blocked).toEqual([]);
  });
}

const PHASES = ["night", "first-light", "dawn", "day", "dusk"];
for (const path of [...PHASES.map((p) => `/?phase=${p}`), "/about", "/yesterday", "/no-such-page"]) {
  test(`no axe violations (WCAG 2.2 AA) on ${path}`, async ({ page }) => {
    await page.goto(path);
    // let the sky settle: contrast is checked on the final colours
    await page.waitForTimeout(2800);
    const phase = new URL(path, "http://x").searchParams.get("phase");
    if (phase) await expect(page.locator("html")).toHaveAttribute("data-phase", phase);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}
