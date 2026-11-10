import { defineConfig } from "@playwright/test";

const port = 4331;
const fixtures = "http://127.0.0.1:4332";

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	reporter: "list",
	use: { baseURL: `http://localhost:${port}` },
	projects: [
		{
			name: "phone",
			use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
		},
		{
			name: "desktop",
			use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
		},
	],
	webServer: [
		{
			// canned upstream answers (e2e/fixture-server.mjs): no test depends on a live source
			command: "node e2e/fixture-server.mjs",
			url: `${fixtures}/`,
			reuseExistingServer: false,
		},
		{
			// its own KV and cache state, emptied each run: a day stored by `wrangler dev` never leaks in
			command: `rm -rf .wrangler/e2e && pnpm build && node e2e/seed-yesterday.mjs && pnpm exec wrangler dev --port ${port} --persist-to .wrangler/e2e --var FIXTURE_ORIGIN:${fixtures}`,
			url: `http://localhost:${port}`,
			// a reused server could be serving an older build
			reuseExistingServer: false,
			timeout: 240_000,
		},
	],
});
