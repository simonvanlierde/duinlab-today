# This repo's own recipes; copier updates never touch this file.

# Dev server in the background; `pnpm exec astro dev stop` ends it.
dev:
    pnpm exec astro dev --background

# The picture-of-the-day specs, which need their own fixture config (CI's e2e job runs them).
e2e-apod *args:
    pnpm exec playwright test --config playwright.apod.config.ts {{ args }}

# Every browser test CI runs, phone and desktop.
e2e:
    just ts-e2e
    just e2e-apod

# The city-profile e2e checks CI runs, once per example site config.
city-profiles:
    for config in examples/*.toml; do SITE_CONFIG="$config" pnpm run test:e2e e2e/city.spec.ts || exit 1; done
