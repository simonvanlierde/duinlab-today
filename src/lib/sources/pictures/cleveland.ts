import type { Picture } from "../../types";
import { getJson, httpsUrl, safe } from "../../util";
import { artwork, dayIndex, firstPicture, size } from "./kit";

interface CmaImage {
  url?: string;
  width?: string;
  height?: string;
}
interface Cma {
  title?: string;
  creation_date?: string;
  url?: string;
  share_license_status?: string;
  creators?: { description?: string }[];
  images?: { web?: CmaImage; print?: CmaImage };
}

export function parseCleveland(a: Cma): Picture | null {
  const web = a.images?.web;
  const imageUrl = httpsUrl(web?.url);
  const pageUrl = httpsUrl(a.url);
  if (a.share_license_status !== "CC0" || !imageUrl || !pageUrl || !a.title) return null;
  return artwork({
    kind: "cleveland",
    title: a.title,
    // "Zhou Chen (Chinese, c. 1450–c. 1536)": the name before the bracket
    by: a.creators?.[0]?.description?.split(" (")[0]?.trim() || null,
    date: a.creation_date?.trim() || null,
    imageUrl,
    fullImageUrl: httpsUrl(a.images?.print?.url),
    width: size(web?.width),
    height: size(web?.height),
    pageUrl,
    credit: { name: "Cleveland Museum of Art (CC0)", url: "https://www.clevelandart.org/open-access" },
  });
}

const SEARCH =
  "https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&type=Painting&fields=title,creators,creation_date,images,url,share_license_status";
const TRIES = 5;

export const fetchCleveland = (date: string) =>
  safe("cleveland", async () => {
    const { info } = await getJson<{ info?: { total?: number } }>(`${SEARCH}&limit=1`);
    if (!info?.total) return null;
    const skip = dayIndex("cleveland", date, info.total);
    const { data } = await getJson<{ data?: Cma[] }>(`${SEARCH}&skip=${skip}&limit=${TRIES}`);
    return firstPicture(data ?? [], parseCleveland);
  });
