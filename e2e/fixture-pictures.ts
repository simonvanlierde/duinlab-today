import { loadSiteConfig } from "../scripts/site-config.mjs";

/** Where the fixture pictures' images live; tests answer these with a local PNG. */
export const imageHosts =
  /^https:\/\/(images\.metmuseum\.org|thumb\.wikimedia\.org|www\.artic\.edu\/iiif|iiif\.micr\.io|openaccess-cdn\.clevelandart\.org|iip(-thumb)?\.smk\.dk|iiif\.wellcomecollection\.org)\//;

/** Slides in the e2e strip: every configured source but NASA's, which needs a key. */
export const SLIDES = loadSiteConfig().site.content.pictures.filter((kind) => kind !== "apod").length;
