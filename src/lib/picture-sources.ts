// Every picture source a configuration can list in `content.pictures`. This file has no imports:
// the build's config validation (scripts/site-config.mjs) reads it before the site config exists.
// Adding a source: docs/adding-a-source.md.

export interface PictureSourceInfo {
  /** As the About page lists it. */
  name: string;
  /** Who serves the images, as the About page's privacy line names them. */
  host: string;
  /** Optional `[content.<kind>]` settings, each a list of text, with its default. */
  options?: Record<string, readonly string[]>;
}

export const PICTURE_SOURCES = {
  apod: { name: "NASA Astronomy Picture of the Day", host: "NASA" },
  met: { name: "The Metropolitan Museum of Art", host: "The Met" },
  wikipedia: { name: "Wikipedia’s picture of the day", host: "Wikimedia" },
  aic: { name: "Art Institute of Chicago", host: "the Art Institute" },
  rijks: { name: "Rijksmuseum", host: "the Rijksmuseum" },
  cleveland: { name: "Cleveland Museum of Art", host: "the Cleveland Museum of Art" },
  smk: { name: "SMK, the National Gallery of Denmark", host: "SMK" },
  wellcome: {
    name: "Wellcome Collection",
    host: "the Wellcome Collection",
    // the collection is mostly medical; these subjects keep to plants and animals
    options: { subjects: ["Botany", "Plants", "Plants, Ornamental", "Birds", "Animals"] },
  },
} as const satisfies Record<string, PictureSourceInfo>;

export type PictureKind = keyof typeof PICTURE_SOURCES;
