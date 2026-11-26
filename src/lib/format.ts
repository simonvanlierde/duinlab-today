import { site } from "./config";
// Plain text for the page: times, dates and the weather and sun lines.
import { shift } from "./day";
import { sunPasses, sunTimes } from "./sun";
import type { Sun, Today, Weather } from "./types";

const TZ = site.location.timezone;

/** "HH:MM" on the configured local clock, from an ISO instant or a Date. */
export function clock(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** "Friday 6 November 2026" from a YYYY-MM-DD day. */
export function longDate(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(new Date(`${day}T12:00:00Z`))
    .replace(",", "");
}

const BEAUFORT = [
  "calm",
  "light air",
  "light breeze",
  "gentle breeze",
  "moderate breeze",
  "fresh breeze",
  "strong breeze",
  "near gale",
  "gale",
  "strong gale",
  "storm",
  "violent storm",
  "hurricane",
];

const COMPASS: Record<string, string> = {
  N: "north",
  NE: "north-east",
  E: "east",
  SE: "south-east",
  S: "south",
  SW: "south-west",
  W: "west",
  NW: "north-west",
};

export function windLine(w: Weather["now"]): string {
  const from = COMPASS[w.windFrom] ?? w.windFrom;
  const name = BEAUFORT[Math.min(12, Math.max(0, w.windBeaufort))];
  return `Wind from the ${from}, force ${w.windBeaufort} (${name}), ${Math.round(site.units.wind === "mph" ? w.windKmh / 1.609344 : w.windKmh)} ${site.units.wind === "mph" ? "mph" : "km/h"}`;
}

export function rainLine(steps: Weather["rainNext2h"], now = new Date(), interval = 5): string {
  const last = steps.at(-1);
  if (!last) return "";
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const first = steps[0];
  const age = first ? (minutes(clock(now)) - minutes(first.time) + 1440) % 1440 : interval;
  if ((first?.mm ?? 0) > 0 && age < interval) return "Rain now";
  const wet = steps.find((s) => s.mm > 0);
  if (wet) return `Rain expected around ${wet.time}`;
  const end = (minutes(last.time) + interval) % 1440;
  return `No rain expected through ${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

/** "9 h 18 min of daylight, 3 min less than yesterday": the day's length and its change. */
export function daylight(today: Sun, yesterday: Sun): string {
  const len = (s: Sun) => Date.parse(s.sunset) - Date.parse(s.sunrise);
  const mins = Math.round(len(today) / 60000);
  const delta = Math.round((len(today) - len(yesterday)) / 60000);
  const change = delta === 0 ? "" : `, ${Math.abs(delta)} min ${delta < 0 ? "less" : "more"} than yesterday`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min of daylight${change}`;
}

/** The almanac's lines and the end-of-paper sunrise, for the day `day`. */
export function sunLines(day: Pick<Today, "date" | "sun">) {
  return {
    sunrise: clock(day.sun.sunrise),
    sunset: clock(day.sun.sunset),
    golden: clock(sunPasses(day.date, 6, false)),
    daylight: daylight(day.sun, sunTimes(shift(day.date, -1))),
    nextSunrise: clock(sunTimes(shift(day.date, 1)).sunrise),
  };
}

/** "Today", "Tomorrow" or the short weekday ("Thu") of `day`, seen from `today` (both YYYY-MM-DD). */
export function weekday(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === shift(today, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${day}T12:00:00Z`));
}

/** Rounded temperature for display; the public JSON keeps Celsius. */
export const temperature = (celsius: number, digits = 0) =>
  Number((site.units.temperature === "fahrenheit" ? (celsius * 9) / 5 + 32 : celsius).toFixed(digits));
export const temperatureUnit = site.units.temperature === "fahrenheit" ? "°F" : "°C";
