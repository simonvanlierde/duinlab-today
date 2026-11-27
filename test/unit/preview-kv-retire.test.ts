import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
/** Smaller than the script's per_page, so a test account spans several pages. */
const PAGE = 2;

let server: Server | undefined;
afterEach(() => server?.close());

interface Account {
  namespaces: [string, string][];
  workers: string[];
  /** PR numbers the fake `gh` reports as open and ready */
  open?: number[];
  /** namespace ids whose DELETE answers 500 */
  failing?: string[];
}

/** A `gh` on PATH that answers `gh api repos/<repo>/pulls/<n> --jq ...` from `open`. */
function fakeGh(open: number[]): string {
  const dir = mkdtempSync(join(tmpdir(), "fake-gh-"));
  const gh = join(dir, "gh");
  writeFileSync(
    gh,
    `#!/usr/bin/env bash\nn=\${2##*/}\ncase " ${open.join(" ")} " in *" $n "*) echo "open false" ;; *) echo "closed false" ;; esac\n`,
  );
  chmodSync(gh, 0o755);
  return dir;
}

/** Runs the script against a fake Cloudflare API; returns its exit code and the deleted namespace ids. */
async function retire(env: Record<string, string>, account: Account) {
  const deleted: string[] = [];
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "", "http://x");
    if (req.headers.authorization !== "Bearer t") {
      res.statusCode = 401;
      return res.end("{}");
    }
    if (req.method === "DELETE") {
      const id = url.pathname.split("/").at(-1) ?? "";
      if (account.failing?.includes(id)) {
        res.statusCode = 500;
        return res.end("{}");
      }
      deleted.push(id);
      res.end("{}");
    } else if (url.pathname.endsWith("/kv/namespaces")) {
      const page = Number(url.searchParams.get("page"));
      const rows = account.namespaces.slice((page - 1) * PAGE, page * PAGE);
      res.end(JSON.stringify({ result: rows.map(([id, title]) => ({ id, title })) }));
    } else {
      res.end(JSON.stringify({ result: account.workers.map((id) => ({ id })) }));
    }
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const code = await run(".github/scripts/preview-kv-retire.sh", {
    env: {
      ...process.env,
      PATH: `${fakeGh(account.open ?? [])}:${process.env.PATH}`,
      API: `http://127.0.0.1:${port}`,
      CLOUDFLARE_API_TOKEN: "t",
      CLOUDFLARE_ACCOUNT_ID: "a",
      REPO: "o/r",
      GH_TOKEN: "g",
      SLUG: "app",
      GITHUB_STEP_SUMMARY: "/dev/null",
      ...env,
    },
  }).then(
    () => 0,
    (error: { code: number }) => error.code,
  );
  return { code, deleted };
}

const namespaces: [string, string][] = [
  ["n7", "app-pr-7-days"],
  ["n8", "app-pr-8-days"],
  ["n9", "other-pr-9-days"],
  ["n10", "app-pr-10-days"],
];

describe("preview-kv-retire.sh", () => {
  it("deletes a named pull request's namespace only when its Worker is gone", async () => {
    expect(await retire({ PRS: "7 8" }, { namespaces, workers: ["app-pr-8"] })).toEqual({ code: 0, deleted: ["n7"] });
  });

  it("keeps the namespace of a preview that is still deployed", async () => {
    expect(await retire({ PRS: "8" }, { namespaces, workers: ["app-pr-8"] })).toEqual({ code: 0, deleted: [] });
  });

  it("finds a namespace past the first page", async () => {
    expect(await retire({ PRS: "10" }, { namespaces, workers: [] })).toEqual({ code: 0, deleted: ["n10"] });
  });

  it("does nothing for a pull request that has no namespace", async () => {
    expect(await retire({ PRS: "11" }, { namespaces, workers: [] })).toEqual({ code: 0, deleted: [] });
  });

  it("sweeps every orphaned namespace of this app and no other, on every page", async () => {
    expect(await retire({ PRS: "" }, { namespaces, workers: ["app-pr-7"] })).toEqual({
      code: 0,
      deleted: ["n8", "n10"],
    });
  });

  it("keeps an open pull request's namespace while its first deploy has no Worker yet", async () => {
    expect(await retire({ PRS: "" }, { namespaces, workers: [], open: [8] })).toEqual({
      code: 0,
      deleted: ["n7", "n10"],
    });
  });

  it("fails when a delete fails, and still deletes the rest", async () => {
    expect(await retire({ PRS: "7 10" }, { namespaces, workers: [], failing: ["n7"] })).toEqual({
      code: 1,
      deleted: ["n10"],
    });
  });

  it("refuses a value that is not a PR number, and deletes nothing", async () => {
    expect(await retire({ PRS: "7 7x" }, { namespaces, workers: [] })).toEqual({ code: 1, deleted: [] });
  });

  it("fails when the token is refused", async () => {
    expect(await retire({ PRS: "7", CLOUDFLARE_API_TOKEN: "wrong" }, { namespaces, workers: [] })).toEqual({
      code: 1,
      deleted: [],
    });
  });
});
