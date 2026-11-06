const keyFor = (name: string) =>
	new Request(`https://today.duinlab.nl/__cache/${name}`);

/**
 * Returns the JSON stored under `name` in the Workers cache, else builds it and stores it for
 * `ttlSeconds(value)` seconds (null: not stored). A cache error never fails the request.
 */
export async function cached<T>(
	cache: Cache,
	name: string,
	build: () => Promise<T>,
	ttlSeconds: (value: T) => number | null,
): Promise<T> {
	const key = keyFor(name);
	try {
		const hit = await cache.match(key);
		if (hit) return (await hit.json()) as T;
	} catch {
		// a cache error or a corrupt entry: rebuild below
	}
	const value = await build();
	const ttl = ttlSeconds(value);
	if (ttl !== null) {
		try {
			await cache.put(
				key,
				new Response(JSON.stringify(value), {
					headers: {
						"content-type": "application/json",
						"cache-control": `public, max-age=${ttl}`,
					},
				}),
			);
		} catch (err) {
			console.warn(`cache put ${name} failed: ${err}`);
		}
	}
	return value;
}
