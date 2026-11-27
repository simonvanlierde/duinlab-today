import { expect, it } from "vitest";
import { responseHeaders } from "../../src/lib/headers";

it("keeps pull request previews out of search engines, and production in", () => {
  expect(responseHeaders(true)["X-Robots-Tag"]).toBe("noindex");
  expect(responseHeaders(false)).not.toHaveProperty("X-Robots-Tag");
});
