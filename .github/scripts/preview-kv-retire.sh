#!/usr/bin/env bash
# Delete the KV namespaces of pull request previews that have no Worker. A preview's first
# deploy creates $SLUG-pr-<number>-days for its DAYS binding (wrangler.jsonc, env.preview),
# and preview-retire.sh deletes only the Worker. A namespace whose Worker $SLUG-pr-<number>
# still exists is kept.
# Usage: SLUG=app PRS="12 13" preview-kv-retire.sh
# PRS empty runs the sweep over every $SLUG-pr-<number>-days namespace whose PR is not open
# and ready; it needs REPO and GH_TOKEN. Run it after
# preview-retire.sh, and before a preview's deploy: wrangler reuses only a namespace its
# Worker is bound to, and fails creating one whose title already exists.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. API overrides the Cloudflare API base
# (tests). Exits 1 when any step failed.
set -euo pipefail

api="${API:-https://api.cloudflare.com/client/v4}/accounts/$CLOUDFLARE_ACCOUNT_ID"
# curl reads the token from a file only this user can read, so it stays out of the process list.
auth=$(mktemp)
trap 'rm -f "$auth"' EXIT
printf 'Authorization: Bearer %s\n' "$CLOUDFLARE_API_TOKEN" >"$auth"
failed=0

# "<id> <title>" for every namespace; 100 is the API's largest page.
namespaces=""
page=1
while :; do
  if ! got=$(curl -fsS --max-time 30 -H @"$auth" "$api/storage/kv/namespaces?per_page=100&page=$page"); then
    echo "::error::Could not list the account's KV namespaces."
    exit 1
  fi
  rows=$(jq -r '.result[] | "\(.id) \(.title)"' <<<"$got")
  [ -n "$rows" ] || break
  namespaces+="$rows"$'\n'
  page=$((page + 1))
done

candidates=""
if [ -n "${PRS:-}" ]; then
  for pr in $PRS; do
    if [[ $pr = *[!0-9]* ]]; then
      echo "::error::Not a PR number: $pr"
      exit 1
    fi
    candidates+="$SLUG-pr-$pr-days "
  done
else
  for title in $(awk '{print $2}' <<<"$namespaces" | grep -E "^$SLUG-pr-[0-9]+-days\$" || true); do
    n=${title#"$SLUG"-pr-}
    n=${n%-days}
    # An open, ready PR may be in its first deploy: wrangler creates the namespace before it
    # uploads the Worker, so a missing Worker does not yet mean an orphan. A failed read keeps it.
    if ! state=$(gh api "repos/$REPO/pulls/$n" --jq '.state + " " + (.draft|tostring)'); then
      echo "::warning::Could not read PR $n, so its namespace stays for now."
      failed=1
      continue
    fi
    [ "$state" = "open false" ] || candidates+="$title "
  done
fi

if ! workers=$(curl -fsS --max-time 30 -H @"$auth" "$api/workers/scripts" | jq -r '.result[].id'); then
  echo "::error::Could not list the account's Workers."
  exit 1
fi
wanted=""
for title in $candidates; do
  # a namespace whose Worker still serves belongs to a live preview
  grep -qxF "${title%-days}" <<<"$workers" || wanted+="$title "
done

for title in $wanted; do
  id=$(awk -v t="$title" '$2 == t {print $1}' <<<"$namespaces")
  if [ -z "$id" ]; then
    echo "::notice::$title does not exist, so there is nothing to delete."
    continue
  fi
  if curl -fsS --max-time 30 -o /dev/null -X DELETE -H @"$auth" "$api/storage/kv/namespaces/$id"; then
    echo "Deleted KV namespace $title." | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  else
    echo "::error::Could not delete KV namespace $title ($id)."
    failed=1
  fi
done
exit "$failed"
