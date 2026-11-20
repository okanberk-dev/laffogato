// Saved-card tests (docs/PAYNKOLAY.md §16.3). Run through
// `npm run test:saved-cards`, which starts the PayNkolay mock and the app;
// they are not part of CI (they need a local Postgres and a built app).
//
// A plain object, not defineConfig: this file is loaded as ESM from a folder
// with no package.json of its own.

const here = new URL(".", import.meta.url).pathname;
const root = new URL("../../", import.meta.url).pathname;

const config = {
  resolve: {
    alias: {
      "@": `${root}src/`,
      "server-only": `${here}server-only.ts`,
    },
  },
  test: {
    root,
    environment: "node",
    include: [`${here}*.test.ts`],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
};

export default config;
