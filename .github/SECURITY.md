# Security

## Report a vulnerability

Report it privately, through
[a GitHub security advisory](https://github.com/simonvanlierde/duinlab-today/security/advisories/new).
Don't open a public issue or pull request for it: anyone can read those before there is a fix.

Please include what the problem is and where (a file, a route or a dependency), steps to
reproduce it, and the impact you expect.

I acknowledge a report within 14 days, then tell you whether I can reproduce it and when I
expect a fix.

## Scope

The site keeps no accounts and no data about visitors; per-browser state lives in local
storage only.

In scope: the code in this repository, the Worker it deploys to `today.duinlab.nl`, the CI
workflows in `.github/workflows`, and the dependencies in the lockfile when the problem
affects this site.

Out of scope: a problem in a dependency or a data source that doesn't affect this site.
Report it upstream.
