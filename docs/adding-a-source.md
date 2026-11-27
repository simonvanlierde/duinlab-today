# Adding a source

A new picture source or game is a small pull request. Open an issue first only for something larger,
such as a new section on the page ([CONTRIBUTING](../.github/CONTRIBUTING.md#scope-and-response)).

## A picture source

A picture source is an open-access collection with a search API that needs no key. Each day it
returns one picture, the same for every visitor.

1. **List it** in [`src/lib/picture-sources.ts`](../src/lib/picture-sources.ts) under a short id,
   with the name the About page shows and the host the privacy line names. Settings a person
   can choose, such as Wellcome's `subjects`, go in `options` with their default.
2. **Write the adapter** in `src/lib/sources/pictures/<id>.ts`. Use
   [`cleveland.ts`](../src/lib/sources/pictures/cleveland.ts) as the model:
   - `parse<Id>` turns one search result into a `Picture`, or null when the work isn't public
     domain or openly licensed, or lacks an image, a title or a page. Pass the fields to
     `artwork()`, which writes the alt text from the title and artist when the source has none.
   - `fetch<Id>(date)` asks for the result count, picks a page with `dayIndex()`, and returns
     `firstPicture()` over a few results, so one unusable work doesn't empty the day.
     Wrap it in `safe()`: a failing source must not affect the others.
   - Give the picture's `width` and `height` when the API has them. Otherwise the Worker reads
     them from the image header.
3. **Register the adapter** in `SOURCES` in [`src/lib/sources/picture.ts`](../src/lib/sources/picture.ts).
   The type check fails until a listed source has one.
4. **Record a fixture.** Save a trimmed search response to `test/unit/fixtures/<id>-search.json`.
   Answer its API host from it in [`src/lib/fixtures.ts`](../src/lib/fixtures.ts), so e2e tests
   and pull request previews run without the network. Add its image host to
   [`e2e/fixture-pictures.ts`](../e2e/fixture-pictures.ts).
5. **Test the parser** in `test/unit/sources.test.ts`: a good result, and one it must refuse.
6. **Document it** in the sources table in [configuration.md](configuration.md#pictures-and-local-sources),
   the README's source list and the privacy statement's list of sites the browser contacts.

`just check` and `just e2e` must pass. Say in the pull request whether you could reach the API
from a Cloudflare Worker: some museums block Cloudflare's network.

## A game

Games are links to daily puzzles on other sites. Add a `[[games]]` table with `id`, `name`,
`url` and `blurb` to your `site.toml` ([configuration](configuration.md#settings)).

## Other sources

Each section's adapter is in [`src/lib/sources/`](../src/lib/sources/): weather, tides, the quiz,
the word, recipes and events. [`src/lib/build.ts`](../src/lib/build.ts) fetches the day's sections
once per day, and [`src/lib/today.ts`](../src/lib/today.ts) adds the ones that change during the
day. A new section changes the page layout as well, so open an issue to agree on it first.
