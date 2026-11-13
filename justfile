# Task runner: https://just.systems. `just` lists the recipes, `just <name>` runs one.

# List the recipes (what a bare `just` runs).
default:
    @just --list

# The checks CI runs: lint, types, unit tests, build.
check:
    pnpm check
    pnpm test
    pnpm build
    pnpm run licenses

# Fix and format.
fmt:
    pnpm exec biome check --write .

# Browser tests against a production build on wrangler (phone and desktop).
e2e:
    pnpm e2e

# Dev server in the background; `pnpm exec astro dev stop` ends it.
dev:
    pnpm exec astro dev --background
