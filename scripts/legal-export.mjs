/**
 * Exports the contracts the mobile app bundles for offline reading.
 *
 * Why a generator and not a copy: the app shows these documents at the moment
 * a customer consents, and the order records which revision they agreed to.
 * A hand-maintained copy drifts — the app was shipping abridged 26 Mayıs text
 * while orders recorded consent to the 1 Eylül revision. Running this keeps
 * the two identical by construction.
 *
 *   npm run legal:export -- ../laffogato-mobil/src/data/legal.seed.json
 *
 * The app fetches everything from GET /api/mobile/v1/legal at runtime; what is
 * bundled is the OFFLINE floor: every document the app itself asks consent
 * for, warns with, or is governed by. The rest is listed offline (the index is
 * complete) and fetched when opened.
 */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * The contracts are TypeScript with path aliases, and this repo has no TS
 * script runner. esbuild is already here (vitest pulls it), so the source is
 * bundled to a temp module and imported — no new dependency for one script.
 */
async function loadLegal() {
  const outfile = resolve(here, "../.legal-export.tmp.mjs");
  await build({
    entryPoints: [resolve(here, "../src/lib/legal/documents.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
    alias: { "@": resolve(here, "../src") },
  });
  const mod = await import(pathToFileURL(outfile).href);
  return mod;
}

const { LEGAL_DOCS, LEGAL_UPDATED, CHECKOUT_CONSENT_DOCS } = await loadLegal();

/** Documents the app must be able to show with no network. */
export const BUNDLED_SLUGS = [
  // Consent at checkout — Mesafeli Sözleşmeler Yönetmeliği wants these read
  // BEFORE the order, and the order records the revision.
  "on-bilgilendirme-formu",
  "mesafeli-satis-sozlesmesi",
  "iade-ve-cayma",
  "teslimat-ve-kargo",
  // Consent at sign-up.
  "uyelik-sozlesmesi",
  "kvkk-aydinlatma-metni",
  // The app itself.
  "mobil-uygulama-kosullari",
  "kullanim-sartlari",
  "gizlilik-politikasi",
  // What the app warns about, runs, or sells under.
  "gida-guvenligi-ve-alerjen",
  "ticari-elektronik-ileti",
  "odul-programi",
  "kafe-hizmet-kosullari",
  "sirket-bilgileri",
];

const missing = BUNDLED_SLUGS.filter(
  (slug) => !LEGAL_DOCS.some((d) => d.slug === slug),
);
if (missing.length > 0) {
  console.error(`[legal:export] bilinmeyen slug: ${missing.join(", ")}`);
  process.exit(1);
}

const index = LEGAL_DOCS.map((d) => ({
  slug: d.slug,
  title: d.title,
  shortTitle: d.shortTitle,
  category: d.category,
  summary: d.summary,
  updatedAt: d.updatedAt,
}));

const payload = {
  _generated:
    "RiosenBeq/laffogato · scripts/legal-export.mjs — ELLE DÜZENLEME; kaynak src/lib/legal/content.ts",
  LEGAL_UPDATED,
  CONSENT_DOCS: [...CHECKOUT_CONSENT_DOCS],
  /** Every published contract, title only — so the list is complete offline. */
  LEGAL_INDEX: index,
  /** Full text of the documents the app's own flows depend on. */
  LEGAL_DOCS: LEGAL_DOCS.filter((d) => BUNDLED_SLUGS.includes(d.slug)),
};

const target = resolve(
  process.argv[2] ?? "../laffogato-mobil/src/data/legal.seed.json",
);
writeFileSync(target, `${JSON.stringify(payload, null, 1)}\n`, "utf8");
const kb = (JSON.stringify(payload).length / 1024).toFixed(0);
console.log(
  `[legal:export] ${payload.LEGAL_DOCS.length}/${LEGAL_DOCS.length} belge tam metin · dizin ${index.length} · ${kb} KB → ${target}`,
);
