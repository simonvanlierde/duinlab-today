# Install node_modules, writing pnpm-lock.yaml if it is missing. CI uses --frozen-lockfile.
ts-sync:
    pnpm install

# What CI runs: lint and unused code, types, tests, build, dependency audit, licenses.
ts-check:
    pnpm run check
    pnpm run typecheck
    pnpm run test
    pnpm run build
    pnpm audit --prod --audit-level=moderate
    pnpm run licenses

# Fix what biome can fix, then format.
ts-fmt:
    pnpm run fix

# Tests with a coverage summary.
ts-cov:
    pnpm run coverage

# Tests only; extra arguments reach vitest (`just ts-test -t name`).
ts-test *args:
    pnpm exec vitest run {{ args }}

# Install the browser once per machine: `pnpm exec playwright install chromium`.

# Playwright against the production build: the accessibility and CSP specs.
ts-e2e *args:
    pnpm run test:e2e {{ args }}

# The files go into the gitignored shots/ (`<route>-<width>-<scheme>.png`). It builds
# and serves the app like ts-e2e.

# Screenshot every route at 390 and 1440 px, light and dark.
ts-shots:
    rm -rf ./shots
    SHOTS=1 pnpm exec playwright test --project shots
