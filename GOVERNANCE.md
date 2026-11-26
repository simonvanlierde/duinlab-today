# Governance

I'm the only maintainer of duinlab-today. This file says who decides and who has access.

## Who decides

I decide what goes into the page and when to release.
Anyone can propose a change in an issue or a pull request. I weigh each proposal against
[PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md), and I record larger decisions in
[docs/decisions/](docs/decisions/), with the reasons. If I turn a proposal down, I say why in the
issue or pull request.

The planned work is in the [roadmap](docs/roadmap.md).

## Who has access

- **Repository:** only the maintainer has write and admin access; the Renovate app also
  merges dependency updates. Other contributors send changes as pull requests.
- **Releases:** only the maintainer signs `v*` tags. The release workflow publishes a GitHub
  release only for a tag signed with a key in [`.github/allowed_signers`](.github/allowed_signers).
- **Hosting:** only the maintainer has access to the Cloudflare account that runs the Worker at
  <https://today.duinlab.nl>, and to the `duinlab.nl` domain. CI deploys `main` through the
  `production` environment after every check passes; that environment holds the Cloudflare token
  and the NASA API key.
- **Bots:** Renovate opens dependency updates and merges minor and patch npm updates and the weekly
  lockfile relock once every check passes. It does not merge majors or the actions and hooks group ([`renovate.json5`](renovate.json5)).

## If the maintainer is unavailable

If I can't continue, the person I named through GitHub's account successor setting can take over
the repository. The recovery details for Cloudflare, the `duinlab.nl` domain and the NASA API key
are in an emergency-access vault.

The code, the release history and the docs are public under the MIT license, so anyone can fork the
project and deploy their own copy ([docs/configuration.md](docs/configuration.md)). The live page
runs on its own until a data source or the platform changes.

## Changes to this file

The maintainer changes this file through a pull request, like any other change. If more people get
access, this file will name their role first.
