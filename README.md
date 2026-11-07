# duinlab-today

A small daily page at <https://today.duinlab.nl>: the day's picture, a few sourced facts, the
weather in The Hague, a five-question quiz and a short list of daily web games with
played-today marks and streaks. The sky at the top follows the sun's position over The Hague, minute by minute.

It is an Astro site rendered by a Cloudflare Worker. The Worker fetches the sources once and
caches the day until midnight (Europe/Amsterdam). If a source failed, it tries again after 10
minutes. The weather is cached for 15 minutes. The same data is served as JSON at
`/today.json`, which browsers and proxies may cache for 5 minutes. Checkmarks and streaks stay
in your browser; the server keeps nothing beyond Cloudflare's request logs.

## Develop

You need Node 22 or later (CI uses 26). `packageManager` in `package.json` pins pnpm.

```sh
pnpm install
pnpm exec playwright install chromium
just dev
```

`just dev` starts the dev server in the background; `pnpm exec astro dev stop` ends it.
`just check` runs CI's lint, types, unit tests and build. `just e2e` runs the browser tests
against a production build, including an axe scan of the home, about and 404 pages.

For the NASA picture, put a line `NASA_API_KEY=<your key>` in `.dev.vars` for local runs. In
production it is a Worker secret (`pnpm wrangler secret put NASA_API_KEY`). Without a key the
picture comes from The Met. The tests don't need it.

## Data

`/today.json` holds the same data as the page, for scripts such as an email digest. The
types in [`src/lib/types.ts`](src/lib/types.ts) describe every field. The top-level keys
are:

| Key | Type | When its source fails |
|---|---|---|
| `date` | the Amsterdam day, `YYYY-MM-DD` | always present |
| `generatedAt` | ISO instant (UTC) the day was built | always present |
| `sun`, `moon` | worked out locally | always present |
| `games` | the daily games | always present |
| `picture`, `onThisDay`, `word`, `quote`, `quiz`, `weather` | objects | `null` |
| `didYouKnow` | a list of facts | `[]` |

Sun times carry the Amsterdam offset. `weather.rainNext2h[].time` is `HH:MM` on the
Amsterdam clock. New fields may appear at any time. A commit that renames or removes a field says so
in its message.
When every source fails, the endpoint still answers 200, with a short cache time. When the
Worker itself fails, it answers 503 with `{"error": ...}`.

## Sources

Wikipedia (On this day, Did you know), Wiktionary (word of the day), NASA APOD, The
Metropolitan Museum of Art (public-domain works), Open Trivia DB (CC BY-SA 4.0), ZenQuotes and
Open-Meteo. Each item on the page links to its source.

## Licence

MIT, see [LICENSE](LICENSE). Content from the sources keeps its own licence.
