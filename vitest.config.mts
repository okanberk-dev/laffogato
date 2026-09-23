import { defineConfig } from "vitest/config";

// .mts, not .ts: package.json has no "type": "module", so a .ts config is
// bundled to CommonJS and loaded with require(), and Vitest 4's config entry
// pulls in ESM-only packages (std-env). require() of ESM only works from Node
// 22.12 on; the .mts extension loads the config as ESM on every Node.

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src/", import.meta.url).pathname,
      // Server modules side-effect import "server-only"; stub it for Node tests.
      "server-only": new URL("./tests/_stubs/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
