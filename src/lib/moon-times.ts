import { Body, Observer, SearchRiseSet } from "astronomy-engine";
import { site } from "./config";
import { isoLocal, localDay, shift } from "./day";

/** Moonrise and moonset on the city's calendar date, or null for a missing crossing. Server only. */
export function moonTimes(
  date: string,
  location: Pick<typeof site.location, "latitude" | "longitude" | "timezone"> = site.location,
): { rise: string | null; set: string | null } {
  const observer = new Observer(location.latitude, location.longitude, 0);
  const crossing = (direction: number): string | null => {
    // A padded UTC window includes every local day, including DST and date-line offsets.
    let from = new Date(`${shift(date, -1)}T00:00:00Z`);
    const end = Date.parse(`${shift(date, 2)}T00:00:00Z`);
    while (from.getTime() < end) {
      const event = SearchRiseSet(Body.Moon, observer, direction, from, (end - from.getTime()) / 86400000);
      if (!event) return null;
      const day = localDay(event.date, location.timezone);
      if (day === date) return isoLocal(event.date, location.timezone);
      if (day > date) return null;
      from = new Date(event.date.getTime() + 1000);
    }
    return null;
  };
  return { rise: crossing(1), set: crossing(-1) };
}
