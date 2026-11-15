import { handle } from "@astrojs/cloudflare/handler";
import { refreshDay } from "./lib/today";

export { DayCoordinator } from "./lib/day-coordinator";

export default {
	fetch: handle,
	// Hourly at :05 (wrangler.jsonc). It builds the day just after midnight, fills sources that
	// failed, and picks up APOD after NASA publishes it.
	scheduled(
		_controller: unknown,
		_env: unknown,
		ctx: { waitUntil(promise: Promise<unknown>): void },
	) {
		ctx.waitUntil(refreshDay(new Date()));
	},
};
