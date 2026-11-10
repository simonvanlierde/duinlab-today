const keyFor = (name: string) =>
	new Request(`https://today.duinlab.nl/__cache/${name}`);

/**
 * How long a value is fresh (`ttl`) and then still served while a request refreshes it in the
 * background (`stale`), both in seconds. A `stale` of 0 is for a failed fetch: retry soon, never
 * serve it past its ttl.
 */
export interface Life {
	ttl: number;
	stale: number;
}

interface Stored<T> extends Life {
	value: T;
	/** Epoch ms of the fetch. */
	at: number;
}

export type Freshness = "fresh" | "stale" | "expired";

export function freshness(ageMs: number, { ttl, stale }: Life): Freshness {
	if (ageMs < ttl * 1000) return "fresh";
	return ageMs < (ttl + stale) * 1000 ? "stale" : "expired";
}

/** Names being refreshed in this isolate, so a burst of views starts one refresh each. */
const refreshing = new Set<string>();

async function store<T>(cache: Cache, name: string, value: T, life: Life) {
	try {
		await cache.put(
			keyFor(name),
			new Response(
				JSON.stringify({ value, at: Date.now(), ...life } satisfies Stored<T>),
				{
					headers: {
						"content-type": "application/json",
						// the Cache API drops the entry once it is too stale to serve
						"cache-control": `public, max-age=${life.ttl + life.stale}`,
					},
				},
			),
		);
	} catch (err) {
		console.warn(`cache put ${name} failed: ${err}`);
	}
}

/**
 * Returns the JSON stored under `name` in the Workers cache. A fresh entry is returned as is; one
 * past its ttl but within its stale window is returned too, and `waitUntil` refreshes it behind
 * the response. With no usable entry it builds the value and stores it for `life(value)` (null:
 * not stored). A cache error never fails the request.
 */
export async function cached<T>(
	cache: Cache,
	name: string,
	build: () => Promise<T>,
	life: (value: T) => Life | null,
	waitUntil: (promise: Promise<unknown>) => void,
): Promise<T> {
	try {
		const hit = await cache.match(keyFor(name));
		if (hit) {
			const entry = (await hit.json()) as Stored<T>;
			const state = freshness(Date.now() - entry.at, entry);
			if (state === "stale" && !refreshing.has(name)) {
				refreshing.add(name);
				waitUntil(
					build()
						.then(async (value) => {
							const next = life(value);
							// a failed refresh leaves the older value to age out
							if (next && next.stale > 0) await store(cache, name, value, next);
						})
						.catch((err) => console.warn(`refresh ${name} failed: ${err}`))
						.finally(() => refreshing.delete(name)),
				);
			}
			if (state !== "expired") return entry.value;
		}
	} catch {
		// a cache error or a corrupt entry: rebuild below
	}
	const value = await build();
	const next = life(value);
	if (next) await store(cache, name, value, next);
	return value;
}
