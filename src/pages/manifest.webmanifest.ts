import type { APIRoute } from "astro";
import { site } from "../lib/config";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: site.site.title,
      description: site.site.description,
      short_name: "today",
      start_url: "/",
      display: "standalone",
      background_color: "#0d1129",
      theme_color: "#0a1030",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    }),
    { headers: { "Content-Type": "application/manifest+json; charset=utf-8" } },
  );
