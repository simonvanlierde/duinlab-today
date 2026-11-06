# duinlab-today

A small daily page at <https://today.duinlab.nl>: the day's picture, a few sourced facts, the
weather in The Hague, a five-question quiz and ten daily web games with played-today marks
and streaks. The sky at the top follows the sun's position over The Hague, minute by minute.

It is an Astro site rendered by a Cloudflare Worker. The Worker fetches each source once and
caches it until midnight (Europe/Amsterdam); the weather is cached for 15 minutes. The same
data is served as JSON at `/today.json`. Checkmarks and streaks stay in your browser; nothing
about visitors is stored.

## Develop

```sh
pnpm install
pnpm dev
```

`just check` runs what CI runs (lint, types, unit tests); `just e2e` runs the browser tests,
including an axe accessibility scan, against a production build.

`NASA_API_KEY` goes in `.dev.vars` for local runs and in a Worker secret in production
(`pnpm wrangler secret put NASA_API_KEY`). Without it the picture falls back to the APOD feed
or The Met.

## Sources

Wikipedia (On this day, Did you know), Wiktionary (word of the day), NASA APOD, The
Metropolitan Museum of Art (public-domain works), Open Trivia DB (CC BY-SA 4.0), ZenQuotes and
Open-Meteo. Each item on the page links to its source.

## Licence

MIT, see [LICENSE](LICENSE). Content from the sources keeps its own licence.
