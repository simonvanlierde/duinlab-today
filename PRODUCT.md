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

A daily "morning paper" for two curious people: today's picture, a few sourced facts, a word,
a short quiz, and the daily web games they play, each with a played-today checkmark and a
streak. Success: they open it most mornings, and it replaces a scattered bookmarks folder and
a dozen open tabs.

## Positioning

Hand-picked for two people rather than an aggregator: a short, fixed set of daily games, a
quiz scored on the page, and facts from sourced feeds (Wikipedia, Wiktionary, NASA APOD, The
Met), never generated text. The same `/today.json` feeds the household's email digests.

## Operating Context

- The day turns over at midnight Europe/Amsterdam; everyone sees the same page that day (the
  day is stored once, in Workers KV).
- Games open on their own sites in a new tab; the page cannot see whether a game was finished,
  so opening one counts as playing it.
- Games: factmap.world, TimeGuessr, Shikaku of the day, Krillion, Catfishing, Connections,
  Wordle, Raddle, Timdle, Metazooa.
- Weather: Open-Meteo forecast for The Hague (52.08 N, 4.31 E), no key, credited; the weather
  line links to meteoblue's week forecast. The rain line comes from Buienradar's radar (5-minute
  steps), with Open-Meteo as the fallback.
- Headlines: the top story from NOS, NRC, the BBC, the Guardian and the New York Times,
  below the paper. Five lines, not a news section.
- Sources: Wikipedia featured feed (On this day, Did you know, the featured article), Wiktionary word of the day,
  Open Trivia DB (five questions per day, CC BY-SA 4.0, credited), NASA APOD (API key), The
  Met collection API (public-domain highlights, and the picture when APOD has none),
  ZenQuotes (credited).
- Also on the page: the moon in its real phase, high in the sky, which opens the sun times,
  golden hour, day length and moon phase; the games played in the phone's bar, Dutch holidays and customs ahead (a
  static table), day length, a share
  line for the quiz score and games played, and an About page (privacy, accessibility,
  sources, code).

## Capabilities and Constraints

- Public, no accounts, nothing personal on the server. Checkmarks and streaks live in each
  browser (`localStorage`) and must survive their absence (private windows).
- Each source fails on its own: a missing source drops its section, never the page.
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

No logo, photography or brand assets exist. Daily imagery comes from APOD and The Met; credit
lines come with each source. There are no users, metrics or testimonials to cite.

## Product Principles

- Morning paper first: the day's picture and reading lead, games are one section of it.
- Nothing personal leaves the browser.
- Sourced facts only; every item links to where it came from.
- One Worker, no other backend.
- Phone and desktop are equal: one column that earns its width, not a mobile afterthought.
