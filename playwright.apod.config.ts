import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
	...base,
	testMatch: "**/apod.spec.ts",
	testIgnore: [],
	webServer: (base.webServer as { command: string }[]).map((server, index) =>
		index === 1
			? { ...server, command: `${server.command} --var NASA_API_KEY:fixture` }
			: server,
	),
});
