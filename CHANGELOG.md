# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-11-10

### Added

- A daily paper for The Hague with sourced pictures, facts, a word, a quiz, recipes and local events.
- A larger picture viewer with zoom, swipe and keyboard navigation, captions and source links.
- A living sky and almanac with selected-object details, sun and moon times, planets, sea conditions and tides.
- Daily games with browser-local progress and streaks, quiz answer review, and yesterday's paper.

### Changed

- The almanac includes an explicit Close control, and sky controls have larger touch targets.
- Correct quiz answers use one review line; missed answers keep both the chosen and correct answer.

### Fixed

- Concurrent requests share one durably stored daily quiz, and incomplete days remain readable during background retries.
- Featured-article excerpts keep an artist's initials with their surname.
- Failed picture sources remain eligible for recovery without replacing pictures already shown.
- Long-running game and quiz streaks retain their completed days.
- Malformed agenda and weather data cannot break healthy sections or omit required weather fields.

[Unreleased]: https://github.com/simonvanlierde/duinlab-today/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/simonvanlierde/duinlab-today/releases/tag/v0.1.0
