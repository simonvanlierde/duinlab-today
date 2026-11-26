# Accessibility statement

This statement covers [today.duinlab.nl](https://today.duinlab.nl). The [About](https://today.duinlab.nl/about) page has a short version.
I'm Simon van Lierde. I build duinlab-today and I'm responsible for this page.

## Using duinlab-today

- The page fits a 390 px phone screen without sideways scrolling.
- The theme is dark or light, following the sky over The Hague.
- Without JavaScript you can still read everything, including the almanac, games list, quiz and picture links.
- A keyboard works on the games, quiz, almanac and picture viewer. Focus is visible and touch targets are at least 44 px.
- If your system asks for reduced motion, the sky and transition animations stop.

## How accessible duinlab-today is

I aim to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) at level AA.

Conformance is **not assessed**. Nobody has checked duinlab-today against every WCAG 2.2 criterion yet. Automated checks run on every change. No outside expert has tested it.

## Known problems

- Nobody has tested the expanded picture viewer or the full page by hand with a screen reader on a physical phone.

## Tell me about a problem

If something is hard or impossible to use, [open an issue](https://github.com/simonvanlierde/duinlab-today/issues/new/choose). Tell me what you tried, what happened, and which browser and assistive technology you use, if any.

## How I check

These checks run on every proposed change:

- [axe-core](https://github.com/dequelabs/axe-core) scans the today, yesterday, about and 404 pages in Chromium via Playwright (`e2e/`).
- [Biome's accessibility rules](https://biomejs.dev/linter/javascript/rules/#a11y) check the source for mistakes such as missing alt text, invalid ARIA, or non-keyboard click handlers.
- Phone (390 px) and desktop (1440 px) layout tests check for horizontal overflow and print layout.

Automatic tools find only some problems. The tests are in [`e2e/`](../e2e).

## About this statement

Prepared: 2026-11-13

Last reviewed: 2026-11-13

Next review: within 12 months of the last review, or at the next major release if that comes first.

Method: self-assessment, using the checks under How I check. The criterion-by-criterion record is the [WCAG 2.2 self-assessment](accessibility-assessment.md).
