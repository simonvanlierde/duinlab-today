---
status: accepted
date: 2026-11-26
---

# Adopt project-templates for the repo-level files

## Context and Problem Statement

duinlab-today started on 2026-11-06 as a custom repo, because project-templates had no kind
for an Astro site on a Cloudflare Worker. Its CI, release steps, hooks and community files
were written by hand and drifted from the template's other projects.

## Considered Options

* Keep the hand-written repo-level files
* Adopt [project-templates](https://github.com/simonvanlierde/project-templates) with Copier, for the repo-level files only

## Decision Outcome

Chosen: adopt project-templates v0.16.1 on 2026-11-26, with `ts_kind=web-app`, for the
repo-level files: CI, rulesets, git hooks, and the community and legal files.
`.copier-answers.yml` records the answers, and `copier update` brings later template
changes in as a reviewable diff.

The app layer stays this repo's own: Astro, `wrangler.jsonc` with its Durable Object, KV
namespace and cron trigger, and the Playwright tests in `e2e/`.

### Known divergences

On `copier update`, keep this repo's side of these files:

* Kept whole: `tsconfig.json`, `wrangler.jsonc`, `vitest.config.ts`, `playwright.config.ts`
  and `public/_headers` (Astro's `security.csp` and the middleware set the page headers).
* `package.json`: this repo's dependencies and scripts, under the template's script names
  (`check`, `typecheck`, `test`, `build`, `test:e2e`, `fix`, `coverage`, `licenses`). No
  `budget`, `knip` or Vite. `typecheck` runs `astro check` and `svelte-check`.
* `biome.json`: the unused-variable override also covers `.astro` files.
* `just/ts.just`: no `budget` step and no `ts-shots` recipe. `justfile`: `og-card` renders only
  the PNG, since `astro.config.mjs` versions its URL.
* `.github/workflows/ts.yml`: no `budget` step; the APOD e2e run and the `city-profiles` job; the
  production job builds in the job, deploys without `--domain`, puts `NASA_API_KEY` and checks
  `/today.json`; the preview job only prints a notice.
* `scripts/checkLicenses.mjs` allows `LGPL-3.0-or-later` for the Astro build's sharp binary.
* `.gitignore` adds `.astro/` and the generated `src/lib/worker-configuration.d.ts`.
* Not taken: `index.html`, `vite.config.ts`, `worker/`, the `src/` starter files,
  `scripts/checkBundleBudget.mjs` and `tests/`. The template's privacy spec lives on as
  `e2e/privacy.spec.ts`.

### Consequences

* Good: the checks, CI and release steps match the template's other projects, and fixes
  reach this one as `copier update` pull requests.
* Bad: a file the template owns is changed in the template, not here, or the next
  update reverts it. `just/local.just` holds this project's own recipes.
* Bad: the template's `web-app` kind assumes a Vite and Svelte app, so each update may
  need a hand merge in the app-layer files this repo keeps.

### Confirmation

None: `.copier-answers.yml` names the template version, and `copier update` shows how far
the project has drifted from it.
