// Anahtar değişimi testleri (docs/LAFPOS.md "Anahtarı değiştirmek"):
// `npm run test:anahtar`. Veritabanı ve ağ yok: saf modül doğrudan, imzalı
// uçlar veri katmanı taklit edilerek koşar. CI'da değil (tests/anahtar/README.md).
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
