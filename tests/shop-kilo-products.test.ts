import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { skuPrefix } from "@/lib/admin/sku";
import { computeOrderTotals } from "@/lib/utils/commerce";

/**
 * Operator, 12 Kas 2026: "çekirdek kahvede de kiloluk kahve ekle ve fiyatını
 * kargo dahil 2000 TL yap filtre ekle 1800 TL yap cold brew ekle 2250 TL
 * yap, ve matcha ekle 250 gr fiyatını 6.000 TL yap".
 *
 * The four products were written by a migration because nobody was at the
 * panel. A data migration is the one kind of file here that can take the
 * site down by being slightly wrong (the application applies the whole
 * bundle in one transaction ahead of its first query) and that comes back
 * on every later deploy unless it guards itself. These are its promises;
 * its behaviour was exercised against a real Postgres 16 before it shipped
 * (empty shelf, seeded shelf through the application, re-run after a
 * delete, a missing counter, an absurd id, a taken slug, a forced failure).
 */
const NAME = "20261112113000_kilo_coffee_and_matcha.sql";
const SQL = readFileSync(`db/migrations/${NAME}`, "utf8");
const BUNDLE = readFileSync("db/schema.sql", "utf8");
const STORE = readFileSync("src/lib/admin/store.ts", "utf8");

/** [name, slug, sku prefix, tag, price in kuruş] as the file lists them. */
const ROWS = [
  ...SQL.matchAll(
    /\(\s+'([^']+)', '([a-z0-9-]+)', '([A-Z]{4})',\s+'([^']+)', (\d+),/g,
  ),
].map((m) => ({
  name: m[1],
  slug: m[2],
  prefix: m[3],
  tag: m[4],
  priceMinor: Number(m[5]),
}));

describe("the kilo coffees and the 250 g matcha", () => {
  it("lists the four products at the prices the operator dictated", () => {
    expect(ROWS.map((row) => [row.slug, row.priceMinor])).toEqual([
      ["cekirdek-kahve-1-kg", 200_000],
      ["filtre-kahve-1-kg", 180_000],
      ["cold-brew-kahvesi-1-kg", 225_000],
      ["matcha-250-g", 600_000],
    ]);
  });

  it("draws each in a tone the product form can save back unchanged", () => {
    // The form's select has no `dark`: an unchanged save turned it to cream.
    const HUES = [...SQL.matchAll(/'(beans|pantry)', '([a-z]+)', \d+, \d+,/g)];
    expect(HUES).toHaveLength(4);
    const SCHEMA = readFileSync("src/lib/admin/product-schema.ts", "utf8");
    for (const [, , hue] of HUES) expect(SCHEMA).toContain(`"${hue}"`);
    expect(SQL).not.toMatch(/'dark'/);
  });

  it("gives each the stock code the panel would have derived", () => {
    for (const row of ROWS) expect(row.prefix).toBe(skuPrefix(row.name));
  });

  it("says 'Kargo dahil' only because checkout really adds no shipping", () => {
    // The settings a new database starts with; production carried the same
    // on the day. If the default ever rises above one of these prices the
    // tag must be edited with it: this fails first.
    const flat = Number(/shippingFlatMinor: (\d+),/.exec(STORE)?.[1]);
    const threshold = Number(
      /shippingFreeThresholdMinor: (\d+),/.exec(STORE)?.[1],
    );
    expect(flat).toBeGreaterThan(0);
    expect(threshold).toBeGreaterThan(0);
    for (const row of ROWS) {
      expect(row.tag).toMatch(/Kargo dahil$/);
      const totals = computeOrderTotals(row.priceMinor, 0, {
        shippingFlatMinor: flat,
        shippingFreeThresholdMinor: threshold,
      });
      expect(totals.shippingMinor).toBe(0);
      expect(totals.totalMinor).toBe(row.priceMinor);
    }
  });

  it("claims nothing it was not told: no origin, grade or tasting note", () => {
    const bodies = [...SQL.matchAll(/'([^']*Kargo fiyata dahil\.)'/g)].map(
      (m) => m[1],
    );
    expect(bodies).toHaveLength(4);
    for (const body of bodies) {
      expect(body).not.toMatch(
        /Kenya|Etiyopya|Brezilya|Kolombiya|Uji|Japon|seremoni|organik|tek köken|single|aroma|not(lar)?ı/i,
      );
    }
  });
});

describe("the migration guards itself", () => {
  it("runs once: a product deleted in the panel does not come back", () => {
    expect(SQL).toMatch(
      new RegExp(
        `if exists \\(\\s+select 1\\s+from public\\._migrations\\s+where name = '${NAME}'\\s+\\) then\\s+return;`,
      ),
    );
  });

  it("leaves a new database to the seed, but not a shelf the operator emptied", () => {
    expect(SQL).toMatch(
      /if not exists \(select 1 from public\.products\)\s+and not exists \(select 1 from public\.counters where id = 'seed:products'\)\s+then\s+return;/,
    );
  });

  it("cannot hand out a taken id, slug or stock code", () => {
    // The counter is raised to the highest id on the shelf first...
    expect(SQL).toMatch(/perform public\.raise_counter\(\s+'prd',/);
    // ...an id too long to be a number is never cast...
    expect(SQL).toMatch(/where id ~ '\^prd-\[0-9\]\{1,9\}\$'/);
    // ...a slug that exists is skipped, and the insert yields on a conflict.
    expect(SQL).toMatch(
      /continue when exists \(\s+select 1 from public\.products as p where p\.slug = item\.slug\s+\);/,
    );
    expect(SQL).toMatch(/\)\s+on conflict do nothing;/);
    expect(SQL).toMatch(/seq := public\.next_seq\('prd'\);/);
    // ...and an id past 9999 is padded, never cut (lpad shortens).
    expect(SQL).toMatch(
      /'prd-' \|\| lpad\(seq::text, greatest\(4, length\(seq::text\)\), '0'\)/,
    );
    expect(SQL).not.toMatch(/lpad\(seq::text, [45], '0'\)/);
  });

  it("cannot fail the schema apply: whatever is left is caught", () => {
    expect(SQL).toMatch(
      /exception\s+when others then\s+raise warning 'kilo_coffee_and_matcha: nothing added \(%\)', sqlerrm;\s+end;\s+\$\$;\s*$/,
    );
  });

  it("is in the bundle the application applies", () => {
    expect(BUNDLE).toContain(SQL.trimEnd());
    expect(BUNDLE).toContain(
      `insert into public._migrations (name) values ('${NAME}')`,
    );
  });
});
