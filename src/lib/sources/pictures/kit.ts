// Shared by the picture sources: one per file in this folder, registered in ../picture.ts.
import type { Picture } from "../../types";
import { seededRandom } from "../../util";

/** A picture's fields; `alt` defaults to the title and artist, the size to unknown. */
export type Fields = Omit<Picture, "alt" | "width" | "height"> & Partial<Pick<Picture, "alt" | "width" | "height">>;

export function artwork(f: Fields): Picture {
  return {
    ...f,
    alt: f.alt || (f.by ? `${f.title}, by ${f.by}` : f.title),
    width: f.width ?? null,
    height: f.height ?? null,
  };
}

/** Panoramas and scrolls are a sliver in the strip: skip a picture wider or taller than this ratio. */
const MAX_RATIO = 3;

/** Unknown sizes pass: the pipeline reads them later. */
export function showable(p: Picture): boolean {
  if (!p.width || !p.height) return true;
  const ratio = p.width / p.height;
  return ratio <= MAX_RATIO && ratio >= 1 / MAX_RATIO;
}

/** The first candidate that parses to a showable picture: a source asks for a few in case some don't. */
export function firstPicture<T>(candidates: readonly (T | null | undefined)[], parse: (c: T) => Picture | null) {
  for (const c of candidates) {
    const p = c == null ? null : parse(c);
    if (p && showable(p)) return p;
  }
  return null;
}

/** A whole number in [0, n), the same all day for this source: every visitor sees the same picture. */
export function dayIndex(kind: string, date: string, n: number): number {
  return Math.floor(seededRandom(`${kind}:${date}`)() * n);
}

/** A number from an API that sends sizes as text ("900"); null when absent or not positive. */
export function size(v: string | number | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
