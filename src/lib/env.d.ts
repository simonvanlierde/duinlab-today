// Only the binding this app reads; `.dev.vars` supplies it locally and `wrangler secret put` in production.
declare module "cloudflare:workers" {
	export const env: { NASA_API_KEY?: string; DAYS: KVNamespace };
}
