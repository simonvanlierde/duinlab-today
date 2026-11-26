import type { APIRoute } from "astro";
import { site } from "../lib/config";

// the config is fixed at build time, so these ship as static assets with the edge cache
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${site.site.url}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
