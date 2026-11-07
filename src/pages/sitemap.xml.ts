import type { APIRoute } from "astro";
import { amsterdamDay } from "../lib/day";

/** Two pages; the front page changes every day, so its lastmod is today. */
export const GET: APIRoute = () => {
	const today = amsterdamDay();
	const url = (path: string, lastmod?: string) =>
		`<url><loc>https://today.duinlab.nl${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${url("/", today)}${url("/about")}</urlset>`;
	return new Response(body, {
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
};
