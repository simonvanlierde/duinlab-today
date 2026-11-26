import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY, loadQuiz, quizStreak, saveQuiz, signature } from "../../src/components/quiz";
import { shift } from "../../src/lib/day";
import type { Quiz } from "../../src/lib/types";
import { stubStorage } from "./stub-storage";

const quiz = {
  questions: [
    { question: "One?", answers: ["a", "b"], correct: 1 },
    { question: "Two?", answers: ["a", "b", "c", "d"], correct: 0 },
  ],
  credit: { name: "Open Trivia DB", url: "https://opentdb.com/" },
} as unknown as Quiz;
const day = "2026-11-06";

afterEach(() => vi.unstubAllGlobals());

describe("quiz store", () => {
  it("reads and merges only after acquiring the storage lock", async () => {
    const storage = stubStorage();
    vi.stubGlobal("localStorage", storage);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const request = vi.fn(async (_key, save) => {
      await held;
      return save();
    });
    vi.stubGlobal("navigator", { locks: { request } });
    const pending = saveQuiz(quiz, [0, null], [], day);
    expect(request).toHaveBeenCalledWith(KEY, expect.any(Function));
    expect(storage.getItem(KEY)).toBeNull();
    storage.setItem(KEY, JSON.stringify({ day, sig: signature(quiz), picks: [1, 0], done: [day] }));
    release();
    expect(await pending).toEqual({ picks: [1, 0], done: [day] });
  });

  it("still saves when locks are unavailable or denied", async () => {
    vi.stubGlobal("localStorage", stubStorage());
    vi.stubGlobal("navigator", {
      locks: { request: () => Promise.reject(new Error("denied")) },
    });
    expect(await saveQuiz(quiz, [1, 0], [], day)).toEqual({
      picks: [1, 0],
      done: [day],
    });
    expect(loadQuiz(quiz, day)).toEqual({ picks: [1, 0], done: [day] });
  });

  it("keeps the first saved answers and completed days when another tab saves stale picks", async () => {
    vi.stubGlobal("localStorage", stubStorage());
    const first = loadQuiz(quiz, day);
    const stale = loadQuiz(quiz, day);
    first.picks[0] = 1;
    first.picks[1] = 0;
    await saveQuiz(quiz, first.picks, first.done, day);
    stale.picks[0] = 0;
    const saved = await saveQuiz(quiz, stale.picks, stale.done, day);
    expect(loadQuiz(quiz, day)).toEqual({ picks: [1, 0], done: [day] });
    expect(saved).toEqual({
      picks: [1, 0],
      done: [day],
    });
  });

  it("keeps a streak longer than sixty days after saving and reloading", async () => {
    vi.stubGlobal("localStorage", stubStorage());
    let done: string[] = [];
    for (let i = -64; i <= 0; i++) done = (await saveQuiz(quiz, [1, 0], done, shift(day, i))).done;
    expect(quizStreak(loadQuiz(quiz, day).done, day)).toBe(65);
  });
  it.each([
    [-1, 0.5],
    [2, 4],
  ])("drops invalid saved answer indices %s, %s", (first, second) => {
    vi.stubGlobal(
      "localStorage",
      stubStorage({
        [KEY]: {
          day,
          sig: signature(quiz),
          picks: [first, second],
          done: [],
        },
      }),
    );
    expect(loadQuiz(quiz, day).picks).toEqual([null, null]);
  });

  it("keeps today's picks for the same questions, and the finished days", () => {
    vi.stubGlobal(
      "localStorage",
      stubStorage({
        [KEY]: {
          day,
          sig: signature(quiz),
          picks: [1, "x"],
          done: ["2026-11-05", 3],
        },
      }),
    );
    expect(loadQuiz(quiz, day)).toEqual({
      picks: [1, null],
      done: ["2026-11-05"],
    });
  });

  it("drops picks from another day or for other questions", () => {
    const saved = { sig: signature(quiz), picks: [1, 0], done: [] };
    vi.stubGlobal("localStorage", stubStorage({ [KEY]: { ...saved, day: "2026-11-05" } }));
    expect(loadQuiz(quiz, day).picks).toEqual([null, null]);
    vi.stubGlobal("localStorage", stubStorage({ [KEY]: { ...saved, day, sig: "Old?" } }));
    expect(loadQuiz(quiz, day).picks).toEqual([null, null]);
  });

  it("starts empty when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(loadQuiz(quiz, day)).toEqual({ picks: [null, null], done: [] });
  });

  it("retains in-memory answers and finished days when storage is denied", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(await saveQuiz(quiz, [1, 0], ["2026-11-05"], day)).toEqual({
      picks: [1, 0],
      done: ["2026-11-05", day],
    });
  });

  it("saves the picks, and adds today to the finished days once all are answered", async () => {
    const store = stubStorage();
    vi.stubGlobal("localStorage", store);
    expect((await saveQuiz(quiz, [1, null], ["2026-11-05"], day)).done).toEqual(["2026-11-05"]);
    expect((await saveQuiz(quiz, [1, 2], ["2026-11-05"], day)).done).toEqual(["2026-11-05", day]);
    expect(JSON.parse(store.getItem(KEY) ?? "")).toEqual({
      day,
      sig: "One?\nTwo?",
      picks: [1, 2],
      done: ["2026-11-05", day],
    });
    expect(quizStreak(["2026-11-05", day], day)).toBe(2);
    expect(quizStreak(["2026-11-05"], day)).toBe(1);
  });
});
