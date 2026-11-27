import type { Picture } from "../../types";
import { getJson, safe } from "../../util";
import { artwork, dayIndex, firstPicture } from "./kit";

interface Aic {
  id?: number;
  title?: string;
  artist_display?: string;
  date_display?: string;
  image_id?: string;
  is_public_domain?: boolean;
  thumbnail?: { width?: number; height?: number; alt_text?: string };
}

export function parseAic(a: Aic): Picture | null {
  if (!a.is_public_domain || !a.image_id || !a.title || !a.id) return null;
  // "Georges Seurat (French, 1859-1891)\nmore lines": the first line is the name
  const by = a.artist_display?.split("\n")[0]?.trim() || null;
  const pageUrl = `https://www.artic.edu/artworks/${a.id}`;
  const sourceAlt = a.thumbnail?.alt_text?.trim();
  return artwork({
    kind: "aic",
    title: a.title,
    by,
    date: a.date_display?.trim() || null,
    imageUrl: `https://www.artic.edu/iiif/2/${encodeURIComponent(a.image_id)}/full/843,/0/default.jpg`,
    width: a.thumbnail?.width,
    height: a.thumbnail?.height,
    alt: sourceAlt && !/^A work made of .+\.$/.test(sourceAlt) ? sourceAlt : undefined,
    pageUrl,
    credit: {
      name: "Art Institute of Chicago (CC0)",
      url: "https://www.artic.edu/open-access/open-access-images",
    },
  });
}

const AIC_SEARCH =
  "https://api.artic.edu/api/v1/artworks/search?query[bool][must][0][term][is_public_domain]=true&query[bool][must][1][exists][field]=image_id";
const AIC_FIELDS = "id,title,artist_display,date_display,image_id,is_public_domain,thumbnail";
/** The API refuses a result window past about 1000 entries. */
const AIC_WINDOW = 900;
const AIC_TRIES = 5;

export const fetchAic = (date: string) =>
  safe("aic", async () => {
    const from = dayIndex("aic", date, AIC_WINDOW);
    const { data } = await getJson<{ data?: Aic[] }>(
      `${AIC_SEARCH}&from=${from}&limit=${AIC_TRIES}&fields=${AIC_FIELDS}`,
    );
    return firstPicture(data ?? [], parseAic);
  });
