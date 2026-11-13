# Contributing

Thank you for your interest in duinlab-today. Bug reports, feature requests and pull
requests are welcome. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first, and
report vulnerabilities as [SECURITY.md](SECURITY.md) describes, not in a public issue.

## Report a bug or ask for a feature

Open an [issue](https://github.com/simonvanlierde/duinlab-today/issues) with the bug or
feature form. For a bug, say what you did, what you expected and what happened, with the
release or commit you used. A question the README and docs don't answer is a gap in the docs: open
a feature request for it.

## Scope and response

One person maintains duinlab-today, in their own time. Expect a reply to an issue or
pull request within about two weeks.

Before a large pull request, such as a new feature or a change to how something works,
open an issue and agree on the change there first. A small fix needs no issue. A pull
request outside what the project sets out to do is closed with a link to this section.

## Set up and check

The [README](../README.md) says how to install the tools and dependencies. `just check`
runs the checks CI runs, and `just fmt` fixes and formats.

pnpm locks only releases at least a week old. If `just check` fails on a security fix
newer than that, add the package to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`,
and remove it a week later.

## Write commits and pull requests

- **Commits** follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
  `type(scope): summary`, in the imperative, lower case, with no period. Add a body only
  when the change needs one, with a bullet per logical chunk.
- **The pull request title** becomes the squash commit subject, so it follows the same rule.
- **The pull request body** has the shape of
  [the pull request template](pull_request_template.md): what it fixes and why, three or
  four bullets, a `Tested:` line with the proof (the command and its result, or a test
  that fails without the change), and a `Not checked:` line with what did not run and why,
  and any design choice or security path that only a person can judge. "Nothing" is fine.
- **The changelog** ([CHANGELOG.md](../CHANGELOG.md)) follows
  [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). Write each entry for
  the people who use the project, not as a commit subject. Mark breaking changes
  **Breaking**, and put upgrade steps first under the version.
- **The release notes** are that version's changelog section.

## Tests and code style

A pull request that adds or changes behaviour adds or updates the tests for it, and
`just check` passes before it merges. A bug fix comes with a test that failed before the
fix.

The code follows the style the linters enforce, and `just fmt` applies most of it:

- TypeScript and Astro: [Biome](https://biomejs.dev) for lint and format, `astro check` for types.

## Who maintains this

Simon van Lierde maintains duinlab-today: reviews pull requests, merges them and
makes releases. The repository belongs to [simonvanlierde](https://github.com/simonvanlierde)
on GitHub. Only maintainers can merge to `main`. A new maintainer is added by an existing one, by name in this section.
If no maintainer can continue, the repository is archived with a note in the README,
and anyone may fork it under its license.
