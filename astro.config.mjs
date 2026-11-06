// @ts-check
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

// Rendered on demand by a Cloudflare Worker: the day's data is fetched and cached there.
// Sessions and image transforms are unused, so their KV and Images bindings are not created.
export default defineConfig({
	output: "server",
	adapter: cloudflare({ imageService: "passthrough" }),
	session: false,
	integrations: [svelte()],
	site: "https://today.duinlab.nl",
});
