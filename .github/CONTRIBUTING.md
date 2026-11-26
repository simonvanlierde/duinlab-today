# Contributing

Bug reports, feature requests and pull requests are welcome. Read the
[Code of Conduct](CODE_OF_CONDUCT.md) first. Report vulnerabilities as
[SECURITY.md](SECURITY.md) describes, not in a public issue.

## Report a bug or ask for a feature

Open an [issue](https://github.com/simonvanlierde/duinlab-today/issues) with the bug or
feature form. For a bug, say what you did, what you expected and what happened, with the
release or commit you used. A question the README and docs don't answer is a gap in the docs: open
a feature request for it.

## Scope and response

I maintain duinlab-today in my own time. Expect a reply to an issue or
pull request within about two weeks.

Before a large pull request, such as a new feature or a change to how something works,
open an issue and agree on the change there first. A small fix needs no issue. I close a pull
request outside the project's scope with a link to this section.

## Set up and check

The [README](../README.md) says how to install the tools, the dependencies
and the git hooks. `just check` runs the checks CI runs. `just fmt` fixes and
formats.

pnpm locks only releases at least a week old. If `just check` fails on
a security fix newer than that, add the package to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`,
and remove it a week later ([how](https://github.com/simonvanlierde/project-templates/blob/main/docs/tooling.md#dependencies)).

## Write commits and pull requests

- **Commits** follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
  `type(scope): summary`, in the imperative, lower case, with no period. Add a body only
  when the change needs one, with a bullet per logical chunk.
- **The pull request title** becomes the squash commit subject, so it follows the same rule.
- **Both are checked** against [`committed.toml`](../committed.toml): a commit-msg
  hook (installed by `prek install`) refuses a commit message that breaks the rule, and
  the `pull request title` check fails a pull request whose title does. Lower case isn't
  checked. A revert is titled `revert: <original subject>`: rename the
  `Revert "..."` title that GitHub's Revert button writes.
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

## Make a release

The maintainer runs `just release X.Y.Z`. [Publishing](https://github.com/simonvanlierde/project-templates/blob/main/docs/setup.md#publishing) has the steps and the one-time setup.

## Tests and code style

A pull request that adds or changes behaviour adds or updates the tests for it, and
`just check` passes before it merges. A bug fix comes with a test that failed before the
fix.

The code follows the style the linters enforce, and `just fmt` applies most of it:

- TypeScript, Astro and Svelte: [Biome](https://biomejs.dev) for lint and format, `astro check` for types.

Fix every warning a linter or type checker gives. Where a warning is wrong, silence that one line
and say why in a comment.

## Choosing dependencies

Add a dependency only when the platform, the standard library or a package already in
`package.json` can't do the job in a few lines. Before adding one, check that it:

- is maintained: a release or commit in the last year, and issues that get answers;
- has a licence compatible with MIT (`pnpm run licenses` checks the production dependencies);
- has no open advisory (`pnpm audit --prod` checks locally; the `dependency review` check reports one on the pull request);
- runs no install script, or is added to `allowBuilds` in `pnpm-workspace.yaml` with a reason.

pnpm and Renovate take only releases at least a week old; Renovate skips the wait for
template releases and the author's own packages.

## Sign off your commits

Every commit in a pull request carries a `Signed-off-by:` line, which says you wrote the
change or have the right to submit it under this project's license: the
[Developer Certificate of Origin 1.1](https://developercertificate.org/). `git commit -s`
adds the line, and the commit-msg hook refuses a commit without it.

To add it to commits you already made, run `git fetch origin`, then
`git rebase --signoff origin/main`. That works in a clone of this repository, where `origin`
is the only remote. If you work from a fork, use the remote that points at this repository
(often `upstream`) in place of `origin`. If you have not pushed the branch yet, that is all.
If you pushed it already, update it with `git push --force-with-lease`, which refuses to
overwrite work you have not seen. Do not use a plain `git push --force`.

The `dco` workflow checks every pull request from a fork and fails on a commit without the line. Pull requests from a branch in this repository skip it: pushing that branch already needed write access.

## Who maintains this

I (Simon van Lierde) maintain duinlab-today. I review and merge pull requests and
make releases. The repository belongs to [simonvanlierde](https://github.com/simonvanlierde)
on GitHub. Only maintainers and the Renovate app can merge to `main`. An existing maintainer adds a new one by naming them in this section.
[GOVERNANCE.md](../GOVERNANCE.md) says who has access and who takes over if I can't continue.
