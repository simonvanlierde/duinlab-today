declare namespace Cloudflare {
	interface Env {
		NASA_API_KEY?: string;
		/** e2e only: fetch source fixtures in place of upstream hosts. */
		FIXTURE_ORIGIN?: string;
	}
}
