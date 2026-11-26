// Pull request previews only (PREVIEW at build time, see astro.config.mjs): every upstream
// request is answered here from the recorded fixtures, so a preview never calls a live source.
import picture from "../../e2e/fixtures/picture.png?inline";
import { site } from "./config";
import { fixtures } from "./fixtures";

const files = import.meta.glob<string>("../../test/unit/fixtures/*", {
  query: "?raw",
  import: "default",
  eager: true,
});
// ?inline gives a data: URL
const png = Uint8Array.from(atob(picture.slice(picture.indexOf(",") + 1)), (c) => c.charCodeAt(0));
const answer = fixtures(
  site.location.timezone,
  (name) => {
    const file = files[`../../test/unit/fixtures/${name}`];
    if (file === undefined) throw new Error(`no fixture file ${name}`);
    return file;
  },
  png,
);

/** The fixture answer for `url`, or a 404 for a host without one, like a source that is down. */
export function fixtureResponse(url: string): Response {
  const { host, pathname } = new URL(url);
  const found = answer(host, pathname);
  return found
    ? new Response(found[1], { headers: { "content-type": found[0] } })
    : new Response(null, { status: 404 });
}
