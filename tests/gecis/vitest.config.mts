// Görsel deposu ve veritabanı geçişi testleri (docs/GORSEL-DEPOSU.md,
// docs/COOLIFY-GECIS.md): `npm run test:gecis`. Veritabanı ve ağ yok: saf
// modüller doğrudan, depo sahte fetch ile. CI'da değil (tests/gecis/README.md).
//
// A plain object, not defineConfig: this file is loaded as ESM from a folder
// with no package.json of its own (as tests/saved-cards/vitest.config.mts).

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
  },
};

export default config;
