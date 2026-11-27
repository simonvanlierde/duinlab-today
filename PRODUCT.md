# Product

## Platform

web

## Stack

Astro 7 rendered on Cloudflare Workers (the Worker fetches and caches the day's data until
midnight in the configured time zone and also serves `/today.json`), with Svelte 5 islands for the
interactive parts. TypeScript, pnpm, biome, wrangler.

## Users

Household readers come first, on phone and desktop. One maintains the page; the other needs no
technical context. Visitors and people making their own version need it to make sense on first opening.

## Product Purpose

A daily "morning paper" for two curious people: today's pictures, a few sourced facts, a word,
a short quiz, and the daily web games they play, each with a played-today checkmark and a
streak. Success: they open it most mornings, and it replaces a scattered bookmarks folder and
a dozen open tabs.

## Positioning

Hand-picked daily games, a
quiz scored on the page, and facts and pictures from sourced feeds (Wikipedia, Wiktionary, NASA APOD, The
Met, the Cleveland Museum of Art), never generated text. The same `/today.json` feeds the household's email digests.

## Operating Context

- The day turns over at midnight in the configured time zone; everyone sees the same page that day (the
  day is stored once in a per-day Durable Object, with a Workers KV mirror).
- Games open on their own sites in a new tab; the page cannot see whether a game was finished,
  so opening one counts as playing it.
- Games: factmap.world, TimeGuessr, Shikaku of the day, Krillion, Catfishing, Connections,
  Wordle, Metazooa.
- Weather: Open-Meteo forecast for The Hague (52.08 N, 4.31 E), no key, credited; the weather
  line links to meteoblue's week forecast. The rain line uses KNMI's radar nowcast from KV,
  then Buienradar (both in 5-minute steps), then Open-Meteo in 15-minute steps. A line on air quality or pollen
  (Open-Meteo air-quality API, no key, credited) shows only when the European AQI is 60 or more
  or a pollen count is high.
- Recipes: the three newest recipes from the Guardian, BBC Good Food and Love and Lemons, title
  and link only. One per source is visible; More recipes expands the rest. NYT Cooking is left out: it has no public feed.
- The Hague's page shows Did you know and leaves out the featured article and On this day; other
  configurations can show any of the three. Without the article, the quote follows the pictures.
- On a desktop screen shorter than 760 px, On this day and the quote follow the main reading and
  games. Compact spacing targets a 600 px-high screen; longer daily content can still scroll.
- Live feeds (weather, recipes) use cached responses while refreshing usable stale entries in
  the background. Cold or expired entries wait for a fetch; weather is never served more than
  about 2 h past its 15 minutes.
- Sources: Wikipedia featured feed (On this day, Did you know, the featured article), Wiktionary word of the day,
  Open Trivia DB (three questions per day, CC BY-SA 4.0, credited), NASA APOD (API key), The
  Met collection API (public-domain highlights), the Cleveland Museum of Art (CC0), SMK (public domain), the Wellcome
  Collection (open licences, limited to botany, plants, birds and animals), the Wikipedia
  picture of the day (credited with its licence),
  ZenQuotes (credited).
- Local Hague, below the paper: high and low water at Scheveningen (Rijkswaterstaat, in the
  moon's popover), and this week's shows and events from Paard, Amare and DenHaag.com. The five-item preview
  takes at most two per site when several are available; More events expands the rest.
  Palace Noordeinde, Namuso Gallery, Laan van Meerdervoort 7B and Pulchri Studio are excluded. Amare and DenHaag.com block scripts, so a weekly job reads them through a headless
  browser and writes `agenda/v1` to Workers KV; the Worker merges it with Paard's.
- Yesterday's paper at `/yesterday`: the stored day before today, read-only, quiz answers shown.
- Sea: temperature and wave height off Scheveningen from Open-Meteo's marine API (keyless, credited),
  in the almanac popover beside the tides, cached for an hour.
- Sky: Astronomy Engine (MIT) gives the bright planets, full moons, solstices, equinoxes and
  eclipses seen from the configured location; meteor shower peaks are fixed approximate dates.
- Also on the page: the moon in its real phase, high in the sky, which opens the sun times, moonrise and moonset,
  golden hour, day length, moon phase, the planets up tonight, the sea and the tides. At night
  the bright planets are small named points in the sky like the moon; Dutch holidays and customs ahead (a
  static table) and sky events (full moons, meteor peaks, solstices, equinoxes, eclipses; a holiday wins), day length, and an About page (privacy, accessibility,
  sources, code).

## Configuration

One TOML file configures each deployment’s identity, location, units, picture sources, supported local feeds and games.
The default remains The Hague; complete Utrecht and Evanston, Illinois examples are in `examples/`.
The sky supports latitudes between −55° and 55°. Content remains in English.
Local Hague adapters are disabled for other cities. Configuration and fork deployment are documented in `docs/configuration.md`.

## Capabilities and Constraints

- Public, no accounts. Checkmarks and streaks stay in each browser (`localStorage`).
  Games and the quiz must still work when storage is unavailable, such as in private windows.
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

No logo, photography or brand assets exist. Daily imagery comes from APOD, Wikipedia and five museum collections; credit
lines come with each source. There are no measured usage figures or testimonials to cite.

## Product Principles

- Morning paper first: the day's picture and reading lead, followed by games on phones;
  desktop keeps the games in a side rail.
- Nothing personal leaves the browser.
- The date and time share a masthead row. Recipes and events sit side by side on desktop.
- Phone pictures keep a short, stable frame and show the whole image. Sun and moon remain
  the quiet controls for the almanac.
- Tapping a moon, planet or bright star brings that object's details to the top of the almanac, with the
  remaining information below. Without JavaScript the complete overview still opens.
- Pictures open in a larger viewer with zoom, touch and keyboard navigation, and their existing
  captions and source links. Closing returns to the same place in the paper.
  The viewer uses source originals when supplied and falls back to the preview if they fail.
  "Open original" links to the image directly. NASA's source explanation, when available, starts
  collapsed under "About this picture" and works without JavaScript.
- Picture selectors sit below the caption, leaving the whole work visible. NASA leads when
  available; its official daily feed recovers pictures missing from the API.
- Quiz answers stay in sync across tabs in the same browser. The first saved answer is kept.
- Games mark on opening; the page has no un-mark controls, score sharing or reading modes.
- Sourced facts only; every item links to where it came from.
- One Worker, no other backend.
- Phone and desktop are equal: one column that earns its width, not a mobile afterthought.
