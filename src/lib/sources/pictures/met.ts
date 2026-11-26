import type { Picture } from "../../types";
import { getJson, httpsUrl, safe } from "../../util";
import { artwork, dayIndex, firstPicture } from "./kit";

interface MetObject {
  objectID: number;
  isPublicDomain?: boolean;
  primaryImageSmall?: string;
  primaryImage?: string;
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  objectURL?: string;
}

export function parseMet(o: MetObject): Picture | null {
  const imageUrl = httpsUrl(o.primaryImageSmall);
  const pageUrl = httpsUrl(o.objectURL);
  if (!o.isPublicDomain || !imageUrl || !o.title || !pageUrl) return null;
  return artwork({
    kind: "met",
    title: o.title,
    by: o.artistDisplayName?.trim() || null,
    date: o.objectDate?.trim() || null,
    imageUrl,
    fullImageUrl: httpsUrl(o.primaryImage),
    pageUrl,
    credit: {
      name: "The Metropolitan Museum of Art (public domain)",
      url: "https://www.metmuseum.org/art/collection",
    },
  });
}

const MET = "https://collectionapi.metmuseum.org/public/collection/v1";
const MET_SEARCH = `${MET}.1/search?isHighlight=true&hasImages=true&q=*`;
const MET_TRIES = 6;

export const fetchMet = (date: string) =>
  safe("met", async () => {
    const { total } = await getJson<{ total: number }>(`${MET_SEARCH}&limit=1`);
    if (!total) return null;
    const offset = dayIndex("met", date, total);
    const { objectIDs } = await getJson<{ objectIDs: number[] | null }>(
      `${MET_SEARCH}&offset=${offset}&limit=${MET_TRIES}`,
    );
    const objects = await Promise.all(
      (objectIDs ?? []).map((id) => safe("met-object", () => getJson<MetObject>(`${MET}/objects/${id}`))),
    );
    return firstPicture(objects, parseMet);
  });
