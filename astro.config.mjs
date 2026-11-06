// @ts-check
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

// Rendered on demand by a Cloudflare Worker: the day's data is fetched and cached there.
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [svelte()],
  site: "https://today.duinlab.nl",
});
