# Assurance case

Why I think duinlab-today is safe to run and to visit, each claim linked to its evidence.
To report a problem, see [SECURITY.md](../.github/SECURITY.md).

## Threat model

The project is a Cloudflare Worker that serves <https://today.duinlab.nl> and
[`/today.json`](../README.md#data). It also answers on its `workers.dev` hostname, which the deploy
check uses; that hostname skips the zone's bot challenge but serves the same Worker. It builds one
page a day from public sources, keeps that day in
a Durable Object with a KV copy, and caches weather, sea and recipe data. There are no accounts,
and no data about visitors is stored on the server beyond Cloudflare's request logs
([privacy statement](privacy.md)).

What could be harmed:

- **Visitors' browsers.** Upstream text and links reach every visitor's page. Injected script
  would run for all of them.
- **The day's content.** Everyone sees the same day, so a poisoned source or KV entry reaches
  every visitor until the day turns over.
- **Secrets.** The NASA API key in the Worker, the Cloudflare token in CI, and the KV-write token
  the outside jobs hold.
- **The deployed Worker and releases**, which CI builds from `main` and signed tags.

Threats come from hostile or broken upstream feeds, the outside jobs that write KV, crafted
requests, and hijacked dependencies or CI jobs. Attacks that need the visitor's device or the
maintainer's accounts are out of [scope](../.github/SECURITY.md#scope).

## Trust boundaries

| Boundary | What crosses it | Treatment |
| --- | --- | --- |
| Visitor's browser | The page, local storage of games and quiz | Trusted for its own state only; nothing it sends is stored |
| Requests | Path and the `?phase=` parameter | Untrusted; `?phase=` is checked against a fixed list ([`index.astro`](../src/pages/index.astro)) |
| Upstream feeds (NASA, museums, Wikipedia, Wiktionary, Open-Meteo, Buienradar, Rijkswaterstaat, event sites) | Text, links, image URLs, numbers | Untrusted: parsed, links filtered to https, text stripped of tags ([`src/lib/sources/`](../src/lib/sources/)) |
| KV feeds `rain/v1`, `agenda/v1` | JSON written by outside jobs | Untrusted: shape, age and links checked; a bad `rain/v1` is dropped whole, a bad `agenda/v1` item on its own ([configuration](configuration.md#kv-feeds)) |
| KV day mirror `day/v3/` | A whole day, read when the Durable Object has none stored | Checked: a day for another date, without its sections, or with a link that isn't https is rejected and rebuilt ([`day-coordinator.ts`](../src/lib/day-coordinator.ts)) |
| Site configuration | `site.toml` or `SITE_CONFIG` at build time | Trusted, but validated so a typo fails the build ([`site-config.mjs`](../scripts/site-config.mjs)) |
| Cloudflare | Runs the Worker, KV, the Durable Object, the cache | Trusted platform |
| GitHub Actions, pnpm, Renovate | Code, dependencies, deploys, releases | Trusted with pinned versions and read-only workflow defaults (T6 to T8). Renovate may merge without an approval, never without the required checks |

## Secure design principles

- **Economy of mechanism.** One Worker, one Durable Object per day, no database or accounts.
- **Minimal attack surface.** The only input a request carries is the path and `?phase=`. Storage
  keys come from the server clock and the config, never from the request
  ([`today.ts`](../src/lib/today.ts)).
- **Fail-safe defaults.** A source that fails drops its own section. A `rain/v1` feed with one bad
  value is ignored whole, so missing radar never shows as dry. The front page answers 503 rather than
  render a half-read day.
- **Least privilege.** Workflows start at `contents: read`. The Cloudflare token and NASA key live
  in the `production` environment, which deploys from `main` only
  ([`ts.yml`](../.github/workflows/ts.yml)). `Permissions-Policy` denies camera, microphone and
  geolocation.
- **Complete mediation.** Every upstream link goes through `httpsUrl`. Upstream text that can
  carry HTML (Wikipedia, Wiktionary, picture and recipe feeds) goes through `stripTags`; the rest is
  plain JSON that the templates escape ([`util.ts`](../src/lib/util.ts)).
- **Open design.** Code, CSP and headers are public. The only secrets are those three keys.

## Weaknesses countered

| # | Weakness | Counter | Evidence |
| --- | --- | --- | --- |
| T1 | XSS through upstream text | Astro and Svelte escape text. Upstream HTML is stripped to text first, in a loop until stable, and the rest is plain JSON. The only raw HTML is the inline boot script, built from config and computed values | [`util.ts`](../src/lib/util.ts), [`Base.astro`](../src/layouts/Base.astro), [`boot.ts`](../src/components/boot.ts) |
| T2 | Injected script or framing | Astro's CSP allows the boot script by its SHA-256 hash, not `'unsafe-inline'`. The middleware adds HSTS, `X-Frame-Options: DENY`, nosniff and a strict referrer policy | [`astro.config.mjs`](../astro.config.mjs), [`middleware.ts`](../src/middleware.ts), [e2e CSP test](../e2e/page.spec.ts) |
| T3 | `javascript:` or other hostile links | Upstream links and image URLs must be https or are dropped | [`util.ts`](../src/lib/util.ts) `httpsUrl`, [unit tests](../test/unit/sources.test.ts) |
| T4 | Poisoned KV feed | `rain/v1` must be fresh, with every step valid; `agenda/v1` items need a valid date, time and https link, each checked on its own. A `day/v3` mirror day must be for its own date, with every link https | [`weather.ts`](../src/lib/sources/weather.ts), [`events.ts`](../src/lib/sources/events.ts), [`day-coordinator.ts`](../src/lib/day-coordinator.ts), [unit tests](../test/unit/today.test.ts) |
| T5 | Leaked API key | The NASA key is URL-encoded into the request only. Failed fetches log the host and path, never the query. The key never enters the stored day or `/today.json` | [`picture.ts`](../src/lib/sources/picture.ts), [`util.ts`](../src/lib/util.ts) |
| T6 | Hijacked dependency | Frozen `pnpm-lock.yaml`. pnpm and Renovate take only releases at least a week old (Renovate skips the wait for template releases and the author's own packages). Only esbuild and workerd may run install scripts | [`pnpm-workspace.yaml`](../pnpm-workspace.yaml), [`renovate.json5`](../renovate.json5) |
| T7 | Hijacked action or stolen CI token | Actions pinned by digest; the Playwright test image by version tag. Default `contents: read`. The production token only in the `production` environment, on `main`. Pull request previews use a separate token in the `preview` environment, scoped to Workers and KV. Cloudflare grants those per account, so in the production account that token can also replace the production Worker or write its KV. Fork and bot pull requests never get it, and the step that holds it never holds the GitHub token | [`.github/workflows/`](../.github/workflows/), [ADR 0001](decisions/0001-start-from-project-templates.md) |
| T8 | Forged release | The release workflow publishes only a tag signed with a key in `.github/allowed_signers` | [`release.yml`](../.github/workflows/release.yml), [`verify-tag.sh`](../.github/scripts/verify-tag.sh), [releasing](releasing.md#check-a-release-tag) |

## Residual risk

- **The deploy token is in reach of dependencies.** Renovate merges minor and patch npm updates and
  the weekly lockfile relock, and `main` deploys, so a hijacked `wrangler` or build dependency could
  read the Cloudflare token. pnpm's week-long `minimumReleaseAge` is the guard, for relocks too: a
  hijacked release is usually caught and pulled within that week.
- **Images load from any https host.** `img-src` allows `https:` because sources link pictures on
  many hosts. A hostile feed could point at a tracking image; it sees the visitor's IP address and
  the origin `today.duinlab.nl`.
- **Upstream content is shown as given.** A source can publish wrong or offensive text; the page
  credits and links each item but does not moderate it.
- **The KV writers are trusted with write access.** A compromised outside job could replace the
  agenda or rain feed with well-formed but false data. It could also plant a well-formed day with
  false text under `day/v3/`, which the Durable Object adopts when it has no day stored yet.
- **One maintainer** holds every key, so nobody else reviews changes
  ([GOVERNANCE.md](../GOVERNANCE.md)).
