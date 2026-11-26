import { defineConfig } from "vitest/config";
import { loadSiteConfig } from "./scripts/site-config.mjs";

const { site, configKey } = loadSiteConfig();

export default defineConfig({
  define: {
    __SITE_CONFIG__: JSON.stringify(site),
    __SITE_CONFIG_KEY__: JSON.stringify(configKey),
    __PREVIEW__: "false",
  },
  test: { include: ["test/unit/**/*.test.ts"] },
});
