import { defineMiddleware } from "astro:middleware";

/** Headers a meta CSP cannot set; the CSP itself comes from `security.csp` in the Astro config. */
const HEADERS: Record<string, string> = {
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy":
		"camera=(), microphone=(), geolocation=(), interest-cohort=()",
	"X-Frame-Options": "DENY",
	"Cross-Origin-Opener-Policy": "same-origin",
};

export const onRequest = defineMiddleware(async (_, next) => {
	const res = await next();
	for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
	return res;
});
