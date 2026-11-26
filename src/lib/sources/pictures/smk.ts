import type { Picture } from "../../types";
import { getJson, httpsUrl, safe } from "../../util";
import { artwork, dayIndex, firstPicture } from "./kit";

interface Smk {
  titles?: { title?: string; type?: string; language?: string }[];
  production?: { creator?: string; creator_role?: string | null }[];
  production_date?: { period?: string }[];
  image_thumbnail?: string;
  image_iiif_id?: string | null;
  image_width?: number;
  image_height?: number;
  frontend_url?: string;
  public_domain?: boolean;
}

export function parseSmk(o: Smk): Picture | null {
  const imageUrl = httpsUrl(o.image_thumbnail);
  const pageUrl = httpsUrl(o.frontend_url);
  // a title with a type is an earlier one; some works have only a Danish title
  const current = o.titles?.filter((t) => !t.type) ?? [];
  const title = (current.find((t) => t.language === "engelsk") ?? current[0] ?? o.titles?.[0])?.title?.trim();
  if (!o.public_domain || !imageUrl || !pageUrl || !title) return null;
  // "Diest, Willem van" as "Willem van Diest"; a creator with a role made the print it is "after" or published it
  const creator = o.production?.find((p) => !p.creator_role)?.creator?.trim();
  const by = creator && !/^(ubekendt|unknown)$/i.test(creator) ? creator.split(", ").reverse().join(" ") : null;
  const iiif = httpsUrl(o.image_iiif_id ?? undefined);
  return artwork({
    kind: "smk",
    title,
    by,
    date: o.production_date?.[0]?.period?.trim() || null,
    imageUrl,
    fullImageUrl: iiif && `${iiif}/full/max/0/default.jpg`,
    width: o.image_width,
    height: o.image_height,
    pageUrl,
    credit: { name: "SMK, National Gallery of Denmark (public domain)", url: "https://open.smk.dk/" },
  });
}

const SEARCH =
  "https://api.smk.dk/api/v1/art/search/?keys=*&filters=%5Bhas_image:true%5D,%5Bpublic_domain:true%5D,%5Bobject_names:painting%5D&lang=en";
const TRIES = 5;

export const fetchSmk = (date: string) =>
  safe("smk", async () => {
    const { found } = await getJson<{ found?: number }>(`${SEARCH}&rows=0`);
    if (!found) return null;
    const offset = dayIndex("smk", date, found);
    const { items } = await getJson<{ items?: Smk[] }>(`${SEARCH}&offset=${offset}&rows=${TRIES}`);
    return firstPicture(items ?? [], parseSmk);
  });
