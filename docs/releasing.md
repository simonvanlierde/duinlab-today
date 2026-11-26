# Releasing

This repository deploys from `main`. Forks can use the manual deployment steps in [configuration and deployment](configuration.md).
A release tag records a reviewed version. It doesn't deploy it.

## First canonical-day deployment

This section applies only when you upgrade a deployment from before version 0.1.0.
`wrangler.jsonc` holds the SQLite-backed `DayCoordinator` binding and its migration.
Existing public days import from KV, and later reads use the Durable Object.
Browser progress and public JSON fields keep their format.

KV can't pick a winner while an older Worker version is still publishing the same day.
So finish the first deployment before midnight in the configured time zone, and keep visits
to a minimum while it rolls out. Confirm the old deployment has drained before the new day
starts. Before you publish the release, check the next day's quiz from two fresh browser contexts.
Treat the rest of the imported day as legacy data. If an older version already served
different quizzes, that can't be fixed afterwards.

Deploy to all traffic at once for this migration, with no gradual split between old and new publishers.
Canonical storage and its KV mirror both expire after two days in the configured time zone. SQLite Durable Objects
are [supported on the Workers Free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/);
no paid plan is needed.

## Configuration changes

Settings in `site.toml` apply at build time. Restart development servers after you edit them.
For a fork, follow [configuration and deployment](configuration.md) before running any Wrangler deployment or secret command.
Each deployment needs its own Worker, KV namespace and domain settings.

Changing location or content settings gives a separate daily cache. Branding, display units and games don't regenerate the quiz.
The original Hague configuration keeps its existing canonical day on upgrade.
Before a release, check a changed profile's local date, clock, weather and omitted sections on `/` and `/today.json`.

## Prepare and publish

1. Review the whole release and run `just check`, `just e2e`, and the production dependency audit.
   Run builds and browser tests sequentially: both write `dist/`.
2. Merge the reviewed release PR and wait for main's checks and production deployment. Verify
   pictures, almanac Close, quiz review, yesterday's paper and `/today.json` on production.
3. Prepare the long-form release notes in `docs/releases/`, following `docs/releases/0.1.0.md`. The GitHub
   release itself carries that version's `CHANGELOG.md` section, not this file.
4. Run `just release X.Y.Z`: it cuts `[Unreleased]` in `CHANGELOG.md` into `[X.Y.Z]` and sets
   `package.json`'s version in one commit. Merge that, then run `just release X.Y.Z` again on up-to-date
   `main` to sign and push the tag `vX.Y.Z`. The release workflow publishes the GitHub release with that
   version's changelog section. Signing needs a key listed in `.github/allowed_signers`.

The release ships a website, so there are no build assets to attach.

## Check a release tag

Each tag from v0.2.0 on is signed with an SSH key listed in `.github/allowed_signers`; v0.1.0 is not.
To check one, point Git at that file and verify the tag:

```sh
git -c gpg.ssh.allowedSignersFile=.github/allowed_signers verify-tag v0.2.0
```
