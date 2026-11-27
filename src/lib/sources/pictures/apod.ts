import type { Picture } from "../../types";
import { decodeEntities, getJson, getText, httpsUrl, safe, stripTags } from "../../util";

interface Apod {
  title?: string;
  url?: string;
  hdurl?: string;
  thumbnail_url?: string;
  media_type?: string;
  copyright?: string;
  explanation?: string;
  date?: string;
}

/** Null unless it is `date`'s picture: APOD turns over at US Eastern midnight, ~06:00 here. */
export function parseApod(a: Apod, date: string): Picture | null {
  if (a.date !== date) return null;
  const imageUrl = httpsUrl(a.media_type === "video" ? a.thumbnail_url : a.media_type === "image" ? a.url : undefined);
  // The API has answered with NASA's site logo in place of the day's picture.
  if (!a.title || !imageUrl || /nasa-logo/.test(imageUrl)) return null;
  return {
    kind: "apod",
    title: a.title,
    by: a.copyright?.replace(/\s+/g, " ").trim() || null,
    date: null,
    imageUrl,
    fullImageUrl: a.media_type === "image" ? (httpsUrl(a.hdurl) ?? undefined) : undefined,
    explanation: a.explanation ? stripTags(a.explanation) || undefined : undefined,
    width: null,
    height: null,
    alt: a.title,
    pageUrl: "https://science.nasa.gov/apod/",
    credit: { name: "NASA APOD", url: "https://science.nasa.gov/apod/" },
  };
}

/** NASA's basic feed keeps the dated picture and credit when its API returns the site logo. */
export function parseApodFeed(xml: string, date: string): Picture | null {
  for (const item of xml.split("<item>").slice(1)) {
    const field = (tag: string) =>
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
        .exec(item)?.[1]
        ?.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
        .trim() ?? "";
    const published = new Date(field("pubDate"));
    if (!Number.isFinite(published.getTime()) || published.toISOString().slice(0, 10) !== date) continue;
    const imageUrl = httpsUrl(decodeEntities(field("apod:hdurl")));
    const pageUrl = httpsUrl(decodeEntities(field("link")));
    if (!imageUrl || !/\.(?:jpe?g|png|gif|webp|avif)(?:\?|$)/i.test(imageUrl) || !pageUrl) continue;
    const p = parseApod(
      {
        date,
        title: stripTags(field("title")),
        media_type: "image",
        url: imageUrl,
        hdurl: imageUrl,
        copyright: stripTags(field("apod:credit")),
        explanation: field("apod:explanation"),
      },
      date,
    );
    if (p) return { ...p, pageUrl, alt: stripTags(field("apod:alt")) || p.alt };
  }
  return null;
}

export async function fetchApod(date: string, apiKey: string | undefined): Promise<Picture | null> {
  if (!apiKey) return null;
  // Start both within the source deadline; a slow API must not leave the feed only a second.
  const feed = safe("apod-feed", async () =>
    parseApodFeed(await getText("https://science.nasa.gov/feed/apod-basic/", "application/rss+xml"), date),
  );
  const api = await safe("apod", async () => {
    const url = `https://api.nasa.gov/planetary/apod?thumbs=true&date=${date}&api_key=${encodeURIComponent(apiKey)}`;
    return parseApod(await getJson<Apod>(url), date);
  });
  return api ?? (await feed);
}
