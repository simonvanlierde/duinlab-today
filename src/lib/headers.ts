/** Headers a meta CSP cannot set; the CSP itself comes from `security.csp` in the Astro config. */
export function responseHeaders(preview: boolean): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    // search engines index the production site, not the pull request previews
    ...(preview && { "X-Robots-Tag": "noindex" }),
  };
}
