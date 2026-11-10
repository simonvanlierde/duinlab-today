# Releasing

The website deploys from `main`. A release tag records a reviewed version; it does not deploy it.

## First canonical-day deployment

Version 0.1.0 introduces the SQLite-backed `DayCoordinator` binding and migration in
`wrangler.jsonc`. Existing public days import from KV; subsequent reads use canonical storage.
Browser progress and public JSON fields keep their existing format.

KV cannot establish a fresh winner while an older Worker version is still publishing the same
day. Complete the first deployment before the next Amsterdam midnight, with no household visits
during the deployment transition. Confirm the old deployment has drained before the new day
starts. Verify the next day's quiz from two fresh browser contexts before publishing the release.
Treat the remainder of the imported legacy day as legacy data; consistency cannot be recovered
retroactively for different quizzes that an older version may already have served.

Use a full deployment for this migration, not a gradual split between old and new publishers.
Both canonical storage and its KV mirror expire after two Amsterdam days. SQLite Durable Objects
are [supported on the Workers Free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/);
no paid-plan change is required.

## Prepare and publish

1. Review the entire release, run `just check`, `just e2e`, and the production dependency audit.
   Run builds and browser tests sequentially: both write `dist/`.
2. Merge the reviewed release PR and wait for main's checks and production deployment. Verify
   pictures, almanac Close, quiz review, yesterday's paper and `/today.json` on production.
3. Publish the release manually from the verified merged commit, using `docs/releases/0.1.0.md`
   as the release body. Keep the tag, package version and changelog version aligned.

The first release has no previous tag for an API or benchmark comparison. It ships a website,
not a package or binary archive; there are no downloadable build assets to attach.
