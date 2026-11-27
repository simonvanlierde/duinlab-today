// Canned upstream answers for e2e. The Worker runs with FIXTURE_ORIGIN pointing here, and
// getText (src/lib/util.ts) asks `${FIXTURE_ORIGIN}/<host>/<path>?<query>` in place of
// `https://<host>/<path>?<query>`. The answers live in src/lib/fixtures.ts, shared with
// pull request previews.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { loadSiteConfig } from "../scripts/site-config.mjs";
import { fixtures } from "../src/lib/fixtures.ts";

const { site } = loadSiteConfig();
const port = Number(process.env.FIXTURE_PORT ?? 4332);
const unit = new URL("../test/unit/fixtures/", import.meta.url);
const answer = fixtures(
  site.location.timezone,
  (name) => readFileSync(new URL(name, unit), "utf8"),
  readFileSync(new URL("fixtures/picture.png", import.meta.url)),
);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://fixture");
  if (url.pathname === "/") return res.end("ok");
  const [, host = "", ...rest] = url.pathname.split("/");
  const found = answer(host, `/${rest.join("/")}`);
  if (!found) {
    console.error(`fixture-server: no fixture for ${url.pathname}`);
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader("content-type", found[0]);
  res.end(found[1]);
}).listen(port, "127.0.0.1");
