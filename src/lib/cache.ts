/** Stores `value` as JSON in the Workers cache under a synthetic URL; returns null on a miss. */
const keyFor = (name: string) =>
	new Request(`https://today.duinlab.nl/__cache/${name}`);

export async function cached<T>(
	cache: Cache,
	name: string,
	build: () => Promise<T>,
	ttlSeconds: (value: T) => number | null,
): Promise<T> {
	const key = keyFor(name);
	const hit = await cache.match(key);
	if (hit) {
		try {
			return (await hit.json()) as T;
		} catch {
			// a corrupt entry is rebuilt below
		}
	}
	const value = await build();
	const ttl = ttlSeconds(value);
	if (ttl !== null) {
		await cache.put(
			key,
			new Response(JSON.stringify(value), {
				headers: {
					"content-type": "application/json",
					"cache-control": `public, max-age=${ttl}`,
				},
			}),
		);
	}
	return value;
}
