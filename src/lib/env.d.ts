// Only the binding this app reads; `.dev.vars` supplies it locally and `wrangler secret put` in production.
declare module "cloudflare:workers" {
	export const env: {
		NASA_API_KEY?: string;
		/** e2e only: getText fetches from this fixture server in place of the upstream hosts. */
		FIXTURE_ORIGIN?: string;
		DAYS: KVNamespace;
	};
}
