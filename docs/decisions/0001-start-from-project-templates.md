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
