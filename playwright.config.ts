import { defineConfig } from "@playwright/test";

const port = 4331;

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
	webServer: {
		command: `mise exec -- pnpm build && mise exec -- pnpm exec wrangler dev --port ${port}`,
		url: `http://localhost:${port}`,
		reuseExistingServer: true,
		timeout: 240_000,
	},
});
