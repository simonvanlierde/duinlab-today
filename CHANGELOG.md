# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-11-26

### Added

- One TOML file configures the city, time zone, weather units, pictures and games, with Utrecht and Evanston examples and fork deployment instructions.
- The picture viewer links directly to the original image. NASA pictures include an expandable explanation from their source.
- The almanac shows moonrise and moonset for the configured city, including days without either event.
- The rain forecast uses KNMI's two-hour radar nowcast in 5-minute steps, with Buienradar and Open-Meteo as fallbacks. A missing radar cell never shows as dry.
- A [privacy statement](docs/privacy.md) says what the page keeps and which sites your browser contacts. The About page links it.

### Changed

- Page labels, game controls and documentation use shorter, clearer wording.
- The picture viewer uses source originals when available and falls back to previews if they fail.
- Picture selectors sit below captions, and the almanac groups sun, moon, planets and sea details.
- Short desktop layouts use tighter spacing while keeping body text and game controls readable.
- On phones, games follow the picture, facts, word and quiz instead of the longer reading. On desktop, the full article spans both reading columns.
- Rain forecasts drop intervals that have passed, so `weather.rainNext2h` in `/today.json` can be shorter than two hours or empty.
- The web manifest, robots.txt and sitemap follow the configured site.

### Fixed

- Yesterday's page description and the documented local time-zone contract match the configured city.
- Picture navigation keeps keyboard focus when a caption link or explanation is selected.
- NASA's official APOD feed recovers the day's astronomy picture when its API returns a placeholder or fails.
- The occasion line stays readable in daylight, and inline source credits keep their word spacing.
- Word definitions omit colour-swatch captions, and generic artwork descriptions use the title and artist.
- Picture swipes recover after a second finger or an interrupted gesture.
- The social card keeps its title and line inside the centred crop that some link previews apply.
- Zooming a picture moves keyboard focus to the image so arrow keys can pan it.
- Selecting the bright star opens its current name and altitude first in the almanac.
- Quiz tabs preserve saved answers and completed days while keeping answer feedback in place.
- Games and quiz saves preserve progress when tabs write at the same time, and remote updates keep keyboard focus visible.
- Daily weather summaries refresh after local midnight.
- Imported titles decode accented HTML entities, and about and yesterday pages include sharing cards.
- The moon keeps a full 44px tap target when it sits at the right edge of the sky.
- Keyboard focus on the sun, moon and planets stays visible against a pale daytime sky.
- Touch screens show the "Look closer" hint on pictures, which before appeared only on hover.
- If today's page can't load for a moment, the front page asks you to try again instead of showing a server error.

## [0.1.0] - 2026-11-10

### Added

- A daily paper for The Hague with sourced pictures, facts, a word, a quiz, recipes and local events.
- A larger picture viewer with zoom, swipe and keyboard navigation, captions and source links.
- A living sky and almanac with selected-object details, sun and moon times, planets, sea conditions and tides.
- Daily games with browser-local progress and streaks, quiz answer review, and yesterday's paper.

### Changed

- The almanac includes an explicit Close control, and sky controls have larger touch targets.
- Correct quiz answers use one review line; missed answers keep both the chosen and correct answer.
- About and yesterday's paper use the current sky colours, with compact dune headers and one author link in the footer.

### Fixed

- Concurrent requests share one durably stored daily quiz, and incomplete days remain readable during background retries.
- Featured-article excerpts keep an artist's initials with their surname.
- Failed picture sources remain eligible for recovery without replacing pictures already shown.
- Long-running game and quiz streaks retain their completed days.
- Malformed agenda and weather data cannot break healthy sections or omit required weather fields.
- Rain forecasts describe expected rain and the two-hour dry outlook without promising a dry spell.

[Unreleased]: https://github.com/simonvanlierde/duinlab-today/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/simonvanlierde/duinlab-today/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/simonvanlierde/duinlab-today/releases/tag/v0.1.0
