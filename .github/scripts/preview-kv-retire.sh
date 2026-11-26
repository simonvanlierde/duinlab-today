#!/usr/bin/env bash
# Delete the KV namespaces of retired pull request previews. A preview's first deploy
# creates $SLUG-pr-<number>-days for its DAYS binding (wrangler.jsonc, env.preview), and
# preview-retire.sh deletes only the Worker.
# Usage: SLUG=app PRS="12 13" preview-kv-retire.sh
# PRS empty runs the sweep: every $SLUG-pr-<number>-days namespace whose Worker
# $SLUG-pr-<number> no longer exists. Run it after preview-retire.sh.
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

wanted=""
if [ -n "${PRS:-}" ]; then
  for pr in $PRS; do
    if [[ $pr = *[!0-9]* ]]; then
      echo "::error::Not a PR number: $pr"
      exit 1
    fi
    wanted+="$SLUG-pr-$pr-days "
  done
else
  if ! workers=$(curl -fsS --max-time 30 -H @"$auth" "$api/workers/scripts" | jq -r '.result[].id'); then
    echo "::error::Could not list the account's Workers."
    exit 1
  fi
  for title in $(awk '{print $2}' <<<"$namespaces" | grep -E "^$SLUG-pr-[0-9]+-days\$" || true); do
    # a namespace whose Worker still serves belongs to an open preview
    grep -qxF "${title%-days}" <<<"$workers" || wanted+="$title "
  done
fi

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
