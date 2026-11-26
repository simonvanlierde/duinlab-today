# Releasing

This repository deploys from `main`. Forks can use the manual deployment steps in [configuration and deployment](configuration.md).
A release tag records a reviewed version; it does not deploy it.

## First canonical-day deployment

This section applies only when upgrading a deployment from before version 0.1.0.
The SQLite-backed `DayCoordinator` binding and migration are in `wrangler.jsonc`.
Existing public days import from KV; later reads use the Durable Object.
Browser progress and public JSON fields keep their format.

KV cannot establish a fresh winner while an older Worker version is still publishing the same
day. Complete the first deployment before midnight in the configured time zone, with no household visits
during the deployment transition. Confirm the old deployment has drained before the new day
starts. Verify the next day's quiz from two fresh browser contexts before publishing the release.
Treat the remainder of the imported legacy day as legacy data; consistency cannot be recovered
retroactively for different quizzes that an older version may already have served.

Use a full deployment for this migration, not a gradual split between old and new publishers.
Both canonical storage and its KV mirror expire after two days in the configured time zone. SQLite Durable Objects
are [supported on the Workers Free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/);
no paid-plan change is required.

## Configuration changes

Settings in `site.toml` take effect at build time. Restart development servers after editing them.
For a fork, follow [configuration and deployment](configuration.md) before running any Wrangler deployment or secret command.
Each deployment needs its own Worker, KV namespace and domain settings.

Changing location or content settings uses a separate daily cache. Branding, display units and games do not regenerate the quiz.
The original Hague configuration keeps its existing canonical day when upgrading.
Check a changed profile’s local date, clock, weather and omitted sections on `/` and `/today.json` before release.

## Prepare and publish

1. Review the entire release, run `just check`, `just e2e`, and the production dependency audit.
   Run builds and browser tests sequentially: both write `dist/`.
2. Merge the reviewed release PR and wait for main's checks and production deployment. Verify
   pictures, almanac Close, quiz review, yesterday's paper and `/today.json` on production.
3. Prepare the long-form release notes in `docs/releases/`, following `docs/releases/0.1.0.md`. The GitHub
   release itself carries that version's `CHANGELOG.md` section, not this file.
4. Run `just release X.Y.Z`: it cuts `[Unreleased]` in `CHANGELOG.md` into `[X.Y.Z]` and sets
   `package.json`'s version in one commit. Merge that, then run `just release X.Y.Z` again on up-to-date
   `main` to sign and push the tag `vX.Y.Z`. The release workflow publishes the GitHub release with that
   version's changelog section. Signing needs a key listed in `.github/allowed_signers`.

The release ships a website. There are no package or binary build assets to attach.
