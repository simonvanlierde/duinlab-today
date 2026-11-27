import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const run = promisify(execFile);

/**
 * Runs the script with a fake `gh` that logs each call, its arguments split by
 * unit separators and the calls by record separators. A listing
 * prints `existing` (the ids of comments that already carry the marker), as the real call's --jq
 * filter would.
 */
async function comment(url: string, existing = "") {
  const dir = mkdtempSync(join(tmpdir(), "fake-gh-"));
  const log = join(dir, "calls");
  writeFileSync(log, "");
  writeFileSync(
    join(dir, "gh"),
    `#!/usr/bin/env bash\nprintf '%s\\x1f' "$@" >>"${log}"\nprintf '\\x1e' >>"${log}"\ncase "$*" in *--paginate*) printf '%s' "${existing}" ;; esac\n`,
  );
  chmodSync(join(dir, "gh"), 0o755);
  const { stdout } = await run(".github/scripts/preview-comment.sh", ["Preview", url], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, REPO: "o/r", PR: "5", SHA: "0123456789" },
  });
  const calls = readFileSync(log, "utf8")
    .split("\x1e")
    .filter(Boolean)
    .map((call) => call.split("\x1f").slice(0, -1));
  return { stdout, calls };
}

const URL = "https://duinlab-today-pr-5.someone.workers.dev";

it("posts a new comment on the first deploy", async () => {
  const { calls } = await comment(URL);
  expect(calls).toHaveLength(2);
  const [api, path, flag, body] = calls[1];
  expect([api, path, flag]).toEqual(["api", "repos/o/r/issues/5/comments", "-f"]);
  expect(body).toMatch(/^body=<!-- preview-comment: Preview -->\n/);
  expect(body).toContain(`**Preview:** ${URL}`);
  expect(body).toContain("Built from 0123456.");
});

it("edits the earlier comment on a later deploy", async () => {
  const { calls } = await comment(URL, "41\n42");
  expect(calls[1].slice(0, 4)).toEqual(["api", "-X", "PATCH", "repos/o/r/issues/comments/41"]);
});

it("posts nothing for an address outside workers.dev, and still succeeds", async () => {
  for (const url of ["https://example.com", "https://x.workers.dev.example.com", "http://x.workers.dev"]) {
    const { stdout, calls } = await comment(url);
    expect(calls).toEqual([]);
    expect(stdout).toContain("::warning::");
  }
});
