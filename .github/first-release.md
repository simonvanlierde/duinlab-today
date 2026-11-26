# First release

One-time steps around the first `just release`, in order. Open this file as an issue,
then delete it:

```sh
gh issue create --title "First release" --body-file .github/first-release.md
```

- [ ] **Signing key**, before the first tag: add your SSH signing key to
  `.github/allowed_signers` and commit it to `main`. The comment in that file has the
  command. The release workflow publishes nothing for a tag signed with another key.
- [ ] **OpenSSF Best Practices badge**: fill in the questionnaire at
  <https://www.bestpractices.dev/en/projects/new>
  and add the badge it gives you to the README.
