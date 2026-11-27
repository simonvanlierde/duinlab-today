import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const run = promisify(execFile);

let server: Server | undefined;
afterEach(() => server?.close());

/** A fake Cloudflare API with these namespaces and Workers; returns the deleted namespace ids. */
async function retire(env: Record<string, string>, namespaces: [string, string][], workers: string[]) {
  const deleted: string[] = [];
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "", "http://x");
    if (req.method === "DELETE") {
      deleted.push(url.pathname.split("/").at(-1) ?? "");
      res.end("{}");
    } else if (url.pathname.endsWith("/kv/namespaces")) {
      const page = url.searchParams.get("page") === "1" ? namespaces : [];
      res.end(JSON.stringify({ result: page.map(([id, title]) => ({ id, title })) }));
    } else {
      res.end(JSON.stringify({ result: workers.map((id) => ({ id })) }));
    }
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await run(".github/scripts/preview-kv-retire.sh", {
    env: {
      ...process.env,
      API: `http://127.0.0.1:${port}`,
      CLOUDFLARE_API_TOKEN: "t",
      CLOUDFLARE_ACCOUNT_ID: "a",
      SLUG: "app",
      GITHUB_STEP_SUMMARY: "/dev/null",
      ...env,
    },
  });
  return deleted;
}

const namespaces: [string, string][] = [
  ["n7", "app-pr-7-days"],
  ["n8", "app-pr-8-days"],
  ["n9", "other-pr-9-days"],
];

describe("preview-kv-retire.sh", () => {
  it("deletes a named pull request's namespace only when its Worker is gone", async () => {
    expect(await retire({ PRS: "7 8" }, namespaces, ["app-pr-8"])).toEqual(["n7"]);
  });

  it("keeps the namespace of a preview that is still deployed", async () => {
    expect(await retire({ PRS: "8" }, namespaces, ["app-pr-8"])).toEqual([]);
  });

  it("sweeps every orphaned namespace of this app and no other", async () => {
    expect(await retire({ PRS: "" }, namespaces, ["app-pr-7"])).toEqual(["n8"]);
  });
});
