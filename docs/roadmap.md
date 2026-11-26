# Roadmap

What I plan to work on over the next year. It is a plan, not a promise: duinlab-today has one
maintainer ([GOVERNANCE.md](../GOVERNANCE.md)), and the order changes when something in daily use
gets in the way. Shipped changes are in the [changelog](../CHANGELOG.md).

## Now

- **Use it every morning.** The page exists for daily use first. The next change comes from a
  real recurring friction or a missing source, not from a broad redesign.
- **The Art Institute of Chicago pictures.** Its API blocks requests from Cloudflare's network,
  so the source fails on the live page. Options: fetch it elsewhere and store the result, drop
  the source, or ask the museum.
- **Check accessibility by hand.** Fill in the
  [accessibility assessment](accessibility-assessment.md) with keyboard, screen-reader and
  physical-device checks.

## Next

- **Rain for any Dutch city.** The KNMI two-hour forecast works for The Hague. Make it work for any
  configured Dutch city, without a Hague-only extractor.
- **TypeScript 7.** Lift the hold in `renovate.json5` once Astro's type checker supports it.

## Later, or only if asked

- **More forks.** The page can be configured for another city
  ([docs/configuration.md](configuration.md)). More local sources (events, tides) for other
  cities wait until someone runs a fork that needs them.

## Not planned

Accounts, storing anything about visitors on the server, personal content, generated text, and a
news section. [PRODUCT.md](../PRODUCT.md) says why.
