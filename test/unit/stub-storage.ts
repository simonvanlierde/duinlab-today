/** A Map-backed localStorage for code that runs in the browser. */
export function stubStorage(seed: Record<string, unknown> = {}): Storage {
	const m = new Map(
		Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]),
	);
	return {
		get length() {
			return m.size;
		},
		clear: () => m.clear(),
		getItem: (k) => m.get(k) ?? null,
		key: (i) => [...m.keys()][i] ?? null,
		removeItem: (k) => void m.delete(k),
		setItem: (k, v) => void m.set(k, String(v)),
	};
}
