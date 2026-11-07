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
	// Astro hashes its own scripts; Base.astro adds the hash of the inline sky script. Style
	// attributes carry the sky's colours, hence 'unsafe-inline' for attributes only.
	security: {
		csp: {
			directives: [
				"default-src 'self'",
				"img-src 'self' data: https:",
				"font-src 'self'",
				"connect-src 'self'",
				"base-uri 'self'",
				"form-action 'self'",
				"object-src 'none'",
				"frame-ancestors 'none'",
			],
			styleDirective: {
				resources: [
					"'self'",
					{ resource: "'unsafe-inline'", kind: "attribute" },
				],
			},
		},
	},
});
