# Security

<!-- The advisories link below works only once Settings > Code security >
     Private vulnerability reporting is on. `just repo-settings` turns it on. -->

## Report a vulnerability

Report it privately, through
[a GitHub security advisory](https://github.com/simonvanlierde/duinlab-today/security/advisories/new)
or by email to <code@duinlab.nl>. Don't open a public issue or pull request for it:
anyone can read those before there is a fix.

Please include:

- What the problem is and where it is: a file, a function or a dependency.
- Steps to reproduce it, or a proof of concept.
- The impact you expect, and the release or commit you saw it in.

I acknowledge a report within 14 days, then tell you whether I can reproduce it and when I
expect a fix.

## Fixes and disclosure

A fix ships in a new release. When it is out, I publish the GitHub security advisory for
it, with a CVE where one applies, and credit you unless you'd rather not be named. The
CHANGELOG entry for that release links the advisory.

## Scope

The site keeps no accounts and no data about visitors beyond Cloudflare's request logs;
per-browser state lives in local storage only.

In scope:

- The code in this repository and the Worker it deploys to `today.duinlab.nl`.
- The CI and release workflows in `.github/workflows`.
- The dependencies in the lockfile, when the problem affects this site.

Out of scope:

- A problem in a dependency or a data source that doesn't affect this site. Report it upstream.
