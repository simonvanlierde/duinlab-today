# Accessibility statement

This statement covers duinlab-today at [today.duinlab.nl](https://today.duinlab.nl) (and its live summary in [About](/about)).
Simon van Lierde builds duinlab-today and is responsible for this page.

## Using duinlab-today

You can:

- use duinlab-today on a 390 px mobile viewport without horizontal scrolling;
- use a dark or light theme, following the sky over The Hague;
- read the entire page, including the almanac, games list, quiz and picture links, without JavaScript;
- operate interactive controls (games, quiz, almanac, picture viewer) with a keyboard, with visible focus and 44 px minimum touch targets;
- respect system reduced-motion preferences, which stop sky and transition animations.

## How accessible duinlab-today is

duinlab-today aims to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) at level AA.

Its conformance is **not assessed**: nobody has checked duinlab-today against every WCAG 2.2 rule yet. Automated checks run on every change, and no outside expert has tested it.

## Known problems

- The expanded picture viewer and full page have not been tested by hand with a physical phone screen reader yet.

## Tell us about a problem

If any part of duinlab-today is hard or impossible for you to use, [open an issue](https://github.com/simonvanlierde/duinlab-today/issues/new/choose). Tell us what you tried to do, what happened, and which browser and assistive technology you use, if any.

## How we check

These automatic checks run on every proposed change to duinlab-today:

- [axe-core](https://github.com/dequelabs/axe-core) scans the today, yesterday, about and 404 pages in Chromium via Playwright (`e2e/`).
- [Biome's accessibility rules](https://biomejs.dev/linter/javascript/rules/#a11y) check the source for mistakes such as missing alt text, invalid ARIA, or non-keyboard click handlers.
- Phone (390 px) and desktop (1440 px) layout tests check for horizontal overflow and print layout.

Automatic tools find only some problems, so passing them does not mean there are none. The tests are in [`e2e/`](../e2e).

## About this statement

Prepared: 2026-11-13

Last reviewed: 2026-11-13

Next review: within 12 months of the last review, or at the next major release if that comes first.

Method: self-assessment, using the checks under How we check.
