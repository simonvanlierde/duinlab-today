# Product

## Platform

web

## Stack

Astro 7 rendered on Cloudflare Workers (the Worker fetches and caches the day's data until
midnight Europe/Amsterdam and also serves `/today.json`), with Svelte 5 islands for the
interactive parts. TypeScript, pnpm, biome, wrangler. Chosen with the user against the
frontend-stack ruling of 2026-11-04 (content site: Astro, Adopt; Svelte 5 islands as a Trial).

## Users

- **Primary:** two people in one household who open it daily, on phone and desktop about
  equally: with morning coffee, on the train, or in a work break. Both are researchers; one
  of them builds and runs the page.
- **Secondary:** anyone who finds the public link. They know nothing of the household.

## Product Purpose

A daily "morning paper" for two curious people: today's pictures, a few sourced facts, a word,
a short quiz, and the daily web games they play, each with a played-today checkmark and a
streak. Success: they open it most mornings, and it replaces a scattered bookmarks folder and
a dozen open tabs.

## Positioning

Hand-picked for two people rather than an aggregator: a short, fixed set of daily games, a
quiz scored on the page, and facts and pictures from sourced feeds (Wikipedia, Wiktionary, NASA APOD, The
Met, the Art Institute of Chicago, the Rijksmuseum), never generated text. The same `/today.json` feeds the household's email digests.

## Operating Context

- The day turns over at midnight Europe/Amsterdam; everyone sees the same page that day (the
  day is stored once, in Workers KV).
- Games open on their own sites in a new tab; the page cannot see whether a game was finished,
  so opening one counts as playing it.
- Games: factmap.world, TimeGuessr, Shikaku of the day, Krillion, Catfishing, Connections,
  Wordle, Raddle, Timdle, Metazooa.
- Weather: Open-Meteo forecast for The Hague (52.08 N, 4.31 E), no key, credited; the weather
  line links to meteoblue's week forecast. The rain line comes from Buienradar's radar (5-minute
  steps), with Open-Meteo as the fallback. A line on air quality or pollen
  (Open-Meteo air-quality API, no key, credited) shows only when the European AQI is 60 or more
  or a pollen count is high.
- Recipes: the newest recipe from the Guardian, BBC Good Food and Love and Lemons, title and
  link only, below the paper. NYT Cooking is left out: it has no public feed.
- On a desktop screen shorter than 760 px, On this day and the quote start under the fold, so the
  rest of the paper fits one screen.
- Live feeds (weather, recipes) are cached and served stale while refreshed in the background, so a
  cold view does not wait on them; weather is never served more than about 2 h past its 15 minutes.
- Sources: Wikipedia featured feed (On this day, Did you know, the featured article), Wiktionary word of the day,
  Open Trivia DB (three questions per day, CC BY-SA 4.0, credited), NASA APOD (API key), The
  Met collection API (public-domain highlights), the Art Institute of Chicago and Rijksmuseum (public-domain
  artworks, no key), the Wikipedia picture of the day (credited with its licence),
  ZenQuotes (credited).
- Local Hague, below the paper: high and low water at Scheveningen (Rijkswaterstaat, in the
  moon's popover), and the next five shows at Paard.
- Also on the page: the moon in its real phase, high in the sky, which opens the sun times,
  golden hour, day length and moon phase; the games played in the phone's bar, Dutch holidays and customs ahead (a
  static table), day length, a share
  line for the quiz score and games played, and an About page (privacy, accessibility,
  sources, code).

## Capabilities and Constraints

- Public, no accounts, nothing personal on the server. Checkmarks and streaks live in each
  browser (`localStorage`) and must survive their absence (private windows).
- Each source fails on its own: a missing source drops its section, never the page. The pictures are a swipe strip of up to five, one per source, each with its own caption and credit; a source that fails drops only its slide.
- The page must read fully without JavaScript; only checkmarks, streaks and the quiz need it.
- English only.
- Open decision: a shared view of each other's progress, later, which would need server state.

## Brand Commitments

- Domain `today.duinlab.nl`. "duin" is Dutch for dune: a loose nod is welcome, a beach theme
  is not.
- Voice: warm and wry. Friendly with a little dry humour, never cute.
- Must not feel like a news site (busy, attention-grabbing), a SaaS dashboard (cards, KPIs,
  cold), or a dry academic page. Some play and gamification is fine.

## Evidence on Hand

No logo, photography or brand assets exist. Daily imagery comes from APOD, The Met, Wikipedia, the Art Institute and the Rijksmuseum; credit
lines come with each source. There are no users, metrics or testimonials to cite.

## Product Principles

- Morning paper first: the day's picture and reading lead, games are one section of it.
- Nothing personal leaves the browser.
- Sourced facts only; every item links to where it came from.
- One Worker, no other backend.
- Phone and desktop are equal: one column that earns its width, not a mobile afterthought.
