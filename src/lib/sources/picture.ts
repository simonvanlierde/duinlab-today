import { site } from "../config";
import type { PictureKind } from "../picture-sources";
import type { Picture } from "../types";
import { safe, upstreamFetch } from "../util";
import { fetchAic } from "./pictures/aic";
import { fetchApod } from "./pictures/apod";
import { fetchCleveland } from "./pictures/cleveland";
import { fetchMet } from "./pictures/met";
import { fetchRijks } from "./pictures/rijks";
import { fetchSmk } from "./pictures/smk";
import { fetchWellcome } from "./pictures/wellcome";

export { parseAic } from "./pictures/aic";
export { parseApod, parseApodFeed } from "./pictures/apod";
export { parseCleveland } from "./pictures/cleveland";
export { parseMet } from "./pictures/met";
export { parseRijks } from "./pictures/rijks";
export { parseSmk } from "./pictures/smk";
export { parseWellcome } from "./pictures/wellcome";

/**
 * Each source's picture for a date, or null. Wikipedia's picture comes with its feed
 * (./wikipedia.ts), so it has none here. A new source also needs an entry in ../picture-sources.ts.
 */
const SOURCES: Record<Exclude<PictureKind, "wikipedia">, (date: string, apiKey?: string) => Promise<Picture | null>> = {
  apod: fetchApod,
  met: fetchMet,
  aic: fetchAic,
  rijks: fetchRijks,
  cleveland: fetchCleveland,
  smk: fetchSmk,
  wellcome: fetchWellcome,
};

/** The order the strip shows; a stored picture keeps its source's place. */
export const PICTURE_ORDER: Picture["kind"][] = site.content.pictures;

/**
 * One picture per source, the first list's winning, in PICTURE_ORDER. A source no longer
 * configured drops out, and so does an image another source already shows.
 */
export function mergePictures(...lists: Picture[][]): Picture[] {
  const byKind = new Map<Picture["kind"], Picture>();
  for (const p of lists.flat()) if (!byKind.has(p.kind)) byKind.set(p.kind, p);
  const seen = new Set<string>();
  return PICTURE_ORDER.flatMap((k) => {
    const p = byKind.get(k);
    if (!p || (p.imageUrl && seen.has(p.imageUrl))) return [];
    seen.add(p.imageUrl);
    return [p];
  });
}

/** Width and height from the header of a JPEG, PNG or GIF; null for anything else. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const u16 = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
  const u32 = (i: number) => u16(i) * 65536 + u16(i + 2);
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { width: u32(16), height: u32(20) };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return {
      width: (b[6] ?? 0) | ((b[7] ?? 0) << 8),
      height: (b[8] ?? 0) | ((b[9] ?? 0) << 8),
    };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  // JPEG: walk the segments to the first start-of-frame marker
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i++;
      continue;
    }
    const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (sof) {
      const size = { width: u16(i + 7), height: u16(i + 5) };
      return size.width > 0 && size.height > 0 ? size : null;
    }
    i += 2 + u16(i + 2);
  }
  return null;
}

/** The first 128 KiB of an image: enough for the header, whether or not the host honours Range. */
async function imageHead(url: string): Promise<Uint8Array> {
  const res = await upstreamFetch(url, {
    headers: { range: "bytes=0-131071" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok || !res.body) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  while (got < 131072) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
  }
  await reader.cancel();
  const out = new Uint8Array(got);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The Met asks for a search and then up to several objects: this caps a source, not one request. */
const SOURCE_DEADLINE_MS = 5000;

/** The source's answer, or null once `ms` have passed. */
function deadline<T>(work: Promise<T | null>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * The sources `have` lacks, each failing or timing out on its own. Wikipedia's picture comes
 * with its feed, not from here. A size lets the page hold the space before an image loads.
 */
export async function fetchPictures(
  date: string,
  apiKey: string | undefined,
  have: Picture["kind"][] = [],
  deadlineMs = SOURCE_DEADLINE_MS,
): Promise<Picture[]> {
  const got = await Promise.all(
    PICTURE_ORDER.filter((kind) => kind !== "wikipedia" && !have.includes(kind)).map((kind) =>
      deadline(SOURCES[kind as keyof typeof SOURCES](date, apiKey), deadlineMs),
    ),
  );
  return Promise.all(got.flatMap((p) => (p ? [p] : [])).map(sized));
}

async function sized(p: Picture): Promise<Picture> {
  if (p.width && p.height) return p;
  const size = await safe("picture-size", async () => imageSize(await imageHead(p.imageUrl)));
  return size ? { ...p, ...size } : p;
}
