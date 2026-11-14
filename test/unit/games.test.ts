import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubStorage } from "./stub-storage";

beforeEach(() => {
	vi.resetModules();
	vi.stubGlobal("$state", <T>(value: T) => value);
	vi.stubGlobal("document", {
		documentElement: { setAttribute: vi.fn(), removeAttribute: vi.fn() },
		dispatchEvent: vi.fn(),
	});
	vi.stubGlobal("localStorage", stubStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe("games store", () => {
	it("merges durable and in-memory plays after acquiring the lock", async () => {
		const { KEY, store, mark } = await import(
			"../../src/components/games.svelte"
		);
		store.day = "2026-11-14";
		store.played = { first: [store.day] };
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const request = vi.fn(async (_key, save) => {
			await held;
			return save();
		});
		vi.stubGlobal("navigator", { locks: { request } });
		const pending = mark("second");
		expect(request).toHaveBeenCalledWith(KEY, expect.any(Function));
		expect(localStorage.getItem(KEY)).toBeNull();
		localStorage.setItem(
			KEY,
			JSON.stringify({ third: [store.day], first: ["2026-11-13"] }),
		);
		release();
		await pending;
		expect(store.played).toEqual({
			first: [store.day, "2026-11-13"],
			second: [store.day],
			third: [store.day],
		});
		expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual(
			store.played,
		);
	});

	it("keeps in-memory plays when storage and locks are denied", async () => {
		const { store, mark } = await import("../../src/components/games.svelte");
		store.day = "2026-11-14";
		vi.stubGlobal("navigator", {
			locks: { request: () => Promise.reject(new Error("denied")) },
		});
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("denied");
			},
			setItem: () => {
				throw new Error("quota");
			},
		});
		await mark("first");
		expect(store.played).toEqual({ first: [store.day] });
	});

	it("keeps unsaved plays when a later storage refresh succeeds", async () => {
		const { KEY, store, mark, init } = await import(
			"../../src/components/games.svelte"
		);
		vi.stubGlobal("addEventListener", vi.fn());
		Object.assign(document, { addEventListener: vi.fn() });
		store.day = "2026-11-14";
		vi.stubGlobal("localStorage", {
			getItem: () => null,
			setItem: () => {
				throw new Error("quota");
			},
		});
		await mark("first");
		vi.stubGlobal(
			"localStorage",
			stubStorage({ [KEY]: { second: [store.day] } }),
		);
		init(["first", "second"]);
		expect(store.played).toEqual({ first: [store.day], second: [store.day] });
	});
});
