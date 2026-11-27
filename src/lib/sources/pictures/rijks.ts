import type { Picture } from "../../types";
import { getJson, httpsUrl, safe, seededRandom } from "../../util";
import { artwork, firstPicture } from "./kit";

// Linked Art: only the fields read below are typed.
interface LaName {
  content?: string;
  classified_as?: { id?: string }[];
  language?: { id?: string }[];
}
interface RijksObject {
  identified_by?: LaName[];
  produced_by?: {
    part?: {
      carried_out_by?: {
        notation?: { "@language"?: string; "@value"?: string }[];
      }[];
    }[];
    timespan?: { identified_by?: { content?: string }[] };
  };
  subject_of?: {
    digitally_carried_by?: {
      access_point?: { id?: string }[];
      format?: string;
      referred_to_by?: { content?: string }[];
    }[];
  }[];
}

const AAT_PRIMARY_TITLE = "http://vocab.getty.edu/aat/300417200";
const AAT_ENGLISH = "http://vocab.getty.edu/aat/300388277";
const PUBLIC_DOMAIN = /creativecommons\.org\/publicdomain\/(mark|zero)\//;

export function parseRijks(o: RijksObject): Picture | null {
  const carriers = (o.subject_of ?? []).flatMap((s) => s.digitally_carried_by ?? []);
  const licence = carriers.flatMap((c) => c.referred_to_by ?? []).some((r) => PUBLIC_DOMAIN.test(r.content ?? ""));
  const iiif = carriers
    .flatMap((c) => c.access_point ?? [])
    .map((a) => a.id)
    .find((id) => id?.includes("/full/max/"));
  const imageUrl = httpsUrl(iiif?.replace("/full/max/", "/full/960,/"));
  const pageUrl = httpsUrl(carriers.find((c) => c.format === "text/html")?.access_point?.[0]?.id);
  const titles = (o.identified_by ?? []).filter((n) => n.classified_as?.some((c) => c.id === AAT_PRIMARY_TITLE));
  const title = (titles.find((n) => n.language?.some((l) => l.id === AAT_ENGLISH)) ?? titles[0])?.content?.trim();
  if (!licence || !imageUrl || !pageUrl || !title) return null;
  const by =
    o.produced_by?.part
      ?.flatMap((p) => p.carried_out_by ?? [])
      .flatMap((c) => c.notation ?? [])
      .find((n) => n["@language"] === "en")
      ?.["@value"]?.trim() || null;
  return artwork({
    kind: "rijks",
    title,
    by,
    date: o.produced_by?.timespan?.identified_by?.[0]?.content?.trim() || null,
    imageUrl,
    fullImageUrl: httpsUrl(iiif),
    pageUrl,
    credit: {
      name: "Rijksmuseum (public domain)",
      url: "https://www.rijksmuseum.nl/en/rijksstudio",
    },
  });
}

const RIJKS_SEARCH = "https://data.rijksmuseum.nl/search/collection?imageAvailable=true&type=painting";
const RIJKS_TRIES = 4;
/** Paintings dated in these years are plentiful; a page is 100 objects of one year. */
const RIJKS_YEARS = [1550, 1899] as const;
const LD = "application/ld+json";

export const fetchRijks = (date: string) =>
  safe("rijks", async () => {
    const rand = seededRandom(`rijks:${date}`);
    const year = RIJKS_YEARS[0] + Math.floor(rand() * (RIJKS_YEARS[1] - RIJKS_YEARS[0] + 1));
    const { orderedItems } = await getJson<{ orderedItems?: { id: string }[] }>(
      `${RIJKS_SEARCH}&creationDate=${year}`,
      LD,
    );
    const items = orderedItems ?? [];
    if (items.length === 0) return null;
    const start = Math.floor(rand() * items.length);
    const objects = await Promise.all(
      Array.from({ length: Math.min(RIJKS_TRIES, items.length) }, (_, i) => {
        const id = items[(start + i) % items.length]?.id;
        return safe("rijks-object", () => (id && httpsUrl(id) ? getJson<RijksObject>(id, LD) : Promise.resolve(null)));
      }),
    );
    return firstPicture(objects, parseRijks);
  });
