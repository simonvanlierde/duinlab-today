// @ts-check
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import { loadSiteConfig } from "./scripts/site-config.mjs";

const { site, configKey } = loadSiteConfig();

// Platforms cache a preview by image URL, so the URL carries the PNG's hash. The worker has no
// file system, hence a build-time constant.
const ogVersion = createHash("sha256")
	.update(readFileSync("public/og.png"))
	.digest("hex")
	.slice(0, 8);

// Rendered on demand by a Cloudflare Worker: the day's data is fetched and cached there.
// Sessions and image transforms are unused, so their KV and Images bindings are not created.
export default defineConfig({
	output: "server",
	adapter: cloudflare({ imageService: "passthrough" }),
	session: false,
	integrations: [svelte()],
	site: site.site.url,
	vite: {
		define: {
			__OG_VERSION__: JSON.stringify(ogVersion),
			__SITE_CONFIG__: JSON.stringify(site),
			__SITE_CONFIG_KEY__: JSON.stringify(configKey),
		},
	},
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
