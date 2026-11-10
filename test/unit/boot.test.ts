import { afterEach, describe, expect, it, vi } from "vitest";
import { overlap, skyBootScript } from "../../src/components/boot";
import { sunTimes } from "../../src/lib/sun";
import { stubStorage } from "./stub-storage";

const day = "2026-11-06";
const sun = sunTimes(day);
const ids = ["a", "b"];

/** Runs the inline script against a stub page; only the globals listed here exist to it. */
function run(script: string, storage: Storage) {
	const attrs = new Set<string>();
	const props: Record<string, string> = {};
	const root = {
		classList: { add: (c: string) => attrs.add(`class:${c}`) },
		dataset: {} as Record<string, string>,
		style: {
			setProperty: (k: string, v: string) => {
				props[k] = v;
			},
		},
		setAttribute: (n: string) => attrs.add(n),
		hasAttribute: (n: string) => attrs.has(n),
	};
	const page = {
		document: {
			documentElement: root,
			hidden: false,
			querySelector: () => null,
			querySelectorAll: () => [],
			addEventListener: () => {},
		},
		localStorage: storage,
		location: { reload: vi.fn() },
		matchMedia: () => ({ matches: false }),
		getComputedStyle: () => ({ getPropertyValue: () => "" }),
		addEventListener: () => {},
		setInterval: () => 0,
		setTimeout: () => 0,
		requestAnimationFrame: () => 0,
	};
	new Function(...Object.keys(page), script)(...Object.values(page));
	return { root, attrs, props, reload: page.location.reload };
}

afterEach(() => vi.useRealTimers());

describe("skyBootScript", () => {
	it("parses, and paints the phase and the sky from the clock", () => {
		vi.useFakeTimers({ now: new Date("2026-11-06T12:00:00+01:00") });
		const page = run(skyBootScript({ sun, forced: null, ids }), stubStorage());
		expect(page.attrs.has("class:js")).toBe(true);
		expect(page.root.dataset.phase).toBe("day");
		expect(page.root.dataset.ground).toBe("light");
		expect(page.props["--k0"]).toMatch(/^color-mix\(in oklab/);
		expect(page.attrs.has("data-whiteout")).toBe(false);
		expect(page.reload).not.toHaveBeenCalled();
	});

	it("keeps a forced phase", () => {
		vi.useFakeTimers({ now: new Date("2026-11-06T12:00:00+01:00") });
		const page = run(
			skyBootScript({ sun, forced: "night", ids }),
			stubStorage(),
		);
		expect(page.root.dataset.phase).toBe("night");
		expect(page.root.dataset.ground).toBe("dark");
	});

	it("whites out the night sky once every game is played today", () => {
		vi.useFakeTimers({ now: new Date("2026-11-06T22:00:00+01:00") });
		const played = stubStorage({
			"today.games.v1": { a: [day], b: ["2026-11-05", day] },
		});
		const page = run(skyBootScript({ sun, forced: null, ids }), played);
		expect(page.attrs.has("data-whiteout")).toBe(true);
		expect(page.root.dataset.phase).toBe("night");
		expect(page.root.dataset.ground).toBe("light");

		const half = stubStorage({ "today.games.v1": { a: [day] } });
		const dark = run(skyBootScript({ sun, forced: null, ids }), half);
		expect(dark.attrs.has("data-whiteout")).toBe(false);
		expect(dark.root.dataset.ground).toBe("dark");
	});
});

describe("overlap", () => {
	const box = (left: number, top: number) =>
		({ left, top, right: left + 32, bottom: top + 32 }) as DOMRectReadOnly;
	it("sees boxes that share area, not ones that only touch", () => {
		expect(overlap(box(0, 0), box(20, 20))).toBe(true);
		expect(overlap(box(0, 0), box(32, 0))).toBe(false);
		expect(overlap(box(0, 0), box(0, 40))).toBe(false);
	});
});
