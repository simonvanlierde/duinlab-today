import { handle } from "@astrojs/cloudflare/handler";
import { refreshDay } from "./lib/today";

export default {
	fetch: handle,
	// Hourly at :05 (wrangler.jsonc). It builds the day just after midnight, fills sources that
	// failed, and picks up APOD after it publishes at 06:00 Amsterdam time.
	scheduled(
		_controller: unknown,
		_env: unknown,
		ctx: { waitUntil(promise: Promise<unknown>): void },
	) {
		ctx.waitUntil(refreshDay(new Date()));
	},
};
