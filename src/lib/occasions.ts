/** Dutch public holidays and a few customs, for one line under the date. */
interface Occasion {
	/** YYYY-MM-DD */
	date: string;
	/** "Sint-Maarten", used in "Sint-Maarten in 5 days". */
	name: string;
	/** The line on the day itself. */
	today: string;
}

const iso = (y: number, m: number, d: number) =>
	new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Easter Sunday (anonymous Gregorian algorithm) as [month, day]. */
export function easter(y: number): [number, number] {
	const a = y % 19;
	const b = Math.floor(y / 100);
	const c = y % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return [month, day];
}

/** The n-th `weekday` (0 Sunday) of a month; n = -1 is the last. */
function nth(y: number, month: number, weekday: number, n: number): number {
	if (n > 0) {
		const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
		return 1 + ((weekday - first + 7) % 7) + 7 * (n - 1);
	}
	const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
	const last = new Date(Date.UTC(y, month - 1, lastDay)).getUTCDay();
	return lastDay - ((last - weekday + 7) % 7);
}

function year(y: number): Occasion[] {
	const [em, ed] = easter(y);
	const e = (by: number) => iso(y, em, ed + by);
	const kings = new Date(Date.UTC(y, 3, 27)).getUTCDay() === 0 ? 26 : 27;
	return [
		{
			date: iso(y, 1, 1),
			name: "New Year's Day",
			today: "New Year's Day. Go gently.",
		},
		{ date: e(-2), name: "Good Friday", today: "Good Friday" },
		{ date: e(0), name: "Easter", today: "Easter Sunday" },
		{
			date: e(1),
			name: "Easter Monday",
			today: "Easter Monday: a day off for most",
		},
		{
			date: iso(y, 3, nth(y, 3, 0, -1)),
			name: "Summer time",
			today: "Summer time: the clocks went forward last night",
		},
		{
			date: iso(y, 4, kings),
			name: "King's Day",
			today: "King's Day. Orange is allowed today.",
		},
		{
			date: iso(y, 5, 4),
			name: "Remembrance of the Dead",
			today: "Remembrance of the Dead: two minutes' silence at 20:00",
		},
		{ date: iso(y, 5, 5), name: "Liberation Day", today: "Liberation Day" },
		{
			date: iso(y, 5, nth(y, 5, 0, 2)),
			name: "Mother's Day",
			today: "Mother's Day",
		},
		{
			date: e(39),
			name: "Ascension Day",
			today: "Ascension Day: a day off for most",
		},
		{ date: e(49), name: "Whit Sunday", today: "Whit Sunday" },
		{
			date: e(50),
			name: "Whit Monday",
			today: "Whit Monday: a day off for most",
		},
		{
			date: iso(y, 6, nth(y, 6, 0, 3)),
			name: "Father's Day",
			today: "Father's Day",
		},
		{
			date: iso(y, 9, nth(y, 9, 2, 3)),
			name: "Prinsjesdag",
			today: "Prinsjesdag: the King reads the budget speech in The Hague",
		},
		{
			date: iso(y, 10, nth(y, 10, 0, -1)),
			name: "Winter time",
			today: "Winter time: the clocks went back last night",
		},
		{
			date: iso(y, 11, 11),
			name: "Sint-Maarten",
			today: "Sint-Maarten: lanterns at the door tonight",
		},
		{
			date: iso(y, 12, 5),
			name: "Pakjesavond",
			today: "Pakjesavond: presents tonight",
		},
		{ date: iso(y, 12, 25), name: "Christmas", today: "Christmas Day" },
		{ date: iso(y, 12, 26), name: "Boxing Day", today: "Second Christmas Day" },
		{
			date: iso(y, 12, 31),
			name: "New Year's Eve",
			today: "New Year's Eve. Oliebollen o'clock.",
		},
	];
}

/** "Sint-Maarten in 5 days", "Pakjesavond tomorrow", the day's own line, or null. Looks 10 days ahead. */
export function occasionLine(date: string): string | null {
	const y = Number(date.slice(0, 4));
	const t = Date.parse(`${date}T00:00:00Z`);
	const all = [...year(y), ...year(y + 1)].sort((a, b) =>
		a.date.localeCompare(b.date),
	);
	const next = all.find((o) => o.date >= date);
	if (!next) return null;
	const days = Math.round(
		(Date.parse(`${next.date}T00:00:00Z`) - t) / 86400000,
	);
	if (days === 0) return next.today;
	if (days === 1) return `${next.name} tomorrow`;
	if (days <= 10) return `${next.name} in ${days} days`;
	return null;
}
