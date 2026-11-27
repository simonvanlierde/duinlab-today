import { site } from "../../config";
import { PICTURE_SOURCES } from "../../picture-sources";
import type { Picture } from "../../types";
import { getJson, httpsUrl, safe } from "../../util";
import { artwork, dayIndex, firstPicture } from "./kit";

interface WellcomeImage {
  id?: string;
  aspectRatio?: number;
  locations?: { url?: string; license?: { id?: string; label?: string } }[];
  source?: { id?: string; title?: string; contributors?: { agent?: { label?: string } }[] };
}

/** Licences that allow showing the image with a credit line. */
const OPEN = ["pdm", "cc-0", "cc-by"];
/** The preview's width; the API gives only the aspect ratio. */
const WIDTH = 960;

/** "An orchid (Cattleya Schofieldianum): flowering stem. Watercolour." loses its last sentence, the medium. */
export function wellcomeTitle(title: string): string {
  const cut = title.replace(/ \/ .*$/, "").trim();
  const first = /^(.{12,}?)\.\s+[A-Z]/.exec(cut)?.[1];
  return (first ?? cut).replace(/\.$/, "");
}

export function parseWellcome(i: WellcomeImage): Picture | null {
  const location = i.locations?.[0];
  const info = httpsUrl(location?.url);
  const licence = location?.license;
  const work = i.source?.id;
  const title = i.source?.title && wellcomeTitle(i.source.title);
  if (!info?.endsWith("/info.json") || !OPEN.includes(licence?.id ?? "") || !i.id || !work || !title) return null;
  const base = info.slice(0, -"/info.json".length);
  const ratio = i.aspectRatio && i.aspectRatio > 0 ? i.aspectRatio : null;
  return artwork({
    kind: "wellcome",
    title,
    // catalogue names can end in a full stop: "Guenébeaud."
    by: i.source?.contributors?.[0]?.agent?.label?.trim().replace(/\.$/, "") || null,
    date: null,
    imageUrl: `${base}/full/${WIDTH},/0/default.jpg`,
    fullImageUrl: `${base}/full/max/0/default.jpg`,
    width: ratio ? WIDTH : null,
    height: ratio ? Math.round(WIDTH / ratio) : null,
    pageUrl: `https://wellcomecollection.org/works/${encodeURIComponent(work)}/images?id=${encodeURIComponent(i.id)}`,
    credit: {
      name: `Wellcome Collection (${licence?.label ?? "open licence"})`,
      url: "https://wellcomecollection.org/",
    },
  });
}

const PAGE = 5;
/** The API stops paging after 10,000 results. */
const LAST_PAGE = 10_000 / PAGE;

export const fetchWellcome = (date: string) =>
  safe("wellcome", async () => {
    const subjects = site.content.wellcome?.subjects ?? PICTURE_SOURCES.wellcome.options.subjects;
    const filter = encodeURIComponent(subjects.map((s) => `"${s}"`).join(","));
    const search = `https://api.wellcomecollection.org/catalogue/v2/images?locations.license=${OPEN.join(",")}&source.subjects.label=${filter}&include=source.contributors&pageSize=${PAGE}`;
    const { totalPages } = await getJson<{ totalPages?: number }>(`${search}&page=1`);
    if (!totalPages) return null;
    const page = 1 + dayIndex("wellcome", date, Math.min(totalPages, LAST_PAGE));
    const { results } = await getJson<{ results?: WellcomeImage[] }>(`${search}&page=${page}`);
    return firstPicture(results ?? [], parseWellcome);
  });
