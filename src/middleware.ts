import { defineMiddleware } from "astro:middleware";
import { responseHeaders } from "./lib/headers";

/** True in a pull request preview build (astro.config.mjs). */
declare const __PREVIEW__: boolean;

const HEADERS = responseHeaders(__PREVIEW__);

export const onRequest = defineMiddleware(async (_, next) => {
  const res = await next();
  for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  return res;
});
