import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Veritabanıyla: şube sütunları ve şubenin Satışta / Tükendi satırları
// gerçek Postgres'te (db/migrations/20261121150719_branches.sql).
//
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/laf_test npm run test:sube
//
// Yerel, boş bir veritabanı ister (satır yazar); yoksa atlanır. Şema
// `db/schema.sql` ile önceden kurulmuş olmalı (`npm run db:migrate`).

const url = process.env.TEST_DATABASE_URL ?? "";
const local = (() => {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
})();

describe.skipIf(!local)("şube, gerçek Postgres", () => {
  let pool: pg.Pool;
  let sql: <T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<T[]>;
  const tag = `t${Date.now().toString(36)}`;
  const itemId = `mnu-${tag}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    pool = new pg.Pool({ connectionString: url });
    sql = async (text, params = []) =>
      (await pool.query(text, params)).rows as never;
    await sql(
      `insert into public.menu_items (id, "categoryKey", name, "priceMinor", "priceMinorL", "isActive", "sortOrder", "updatedAt")
       values ($1, 'dessert', 'Cheesecake', 18000, 0, true, 1, '2026-11-20T08:00:00.000Z')`,
      [itemId],
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("şubenin satırı: ekle, ikinci ekleme stale, koşullu güncelle, olmayan kalem gone", async () => {
    const {
      getBranchAvailability,
      writeBranchAvailability,
      listBranchAvailability,
    } = await import("@/lib/admin/menu-availability");
    expect(await getBranchAvailability(itemId, "marina")).toBeNull();
    const first = await writeBranchAvailability(
      itemId,
      "marina",
      false,
      "lafpos:Selin",
      null,
    );
    expect(first.ok).toBe(true);
    expect(
      await writeBranchAvailability(itemId, "marina", false, "x", null),
    ).toEqual({ ok: false, reason: "stale" });
    const seen = await getBranchAvailability(itemId, "marina");
    expect(seen).toMatchObject({ isActive: false, updatedBy: "lafpos:Selin" });
    const reopened = await writeBranchAvailability(
      itemId,
      "marina",
      true,
      "lafpos:Selin",
      seen,
      new Date("2026-11-21T12:00:00.000Z"),
    );
    expect(reopened.ok).toBe(true);
    // Eski görüntüyle ikinci yazım hiçbir şey ezmez.
    expect(
      await writeBranchAvailability(itemId, "marina", false, "x", seen),
    ).toEqual({ ok: false, reason: "stale" });
    expect(
      await writeBranchAvailability(
        `${itemId}-yok`,
        "marina",
        false,
        "x",
        null,
      ),
    ).toEqual({ ok: false, reason: "gone" });
    // Tuzla'nın satırı yok: orada Satışta.
    expect((await listBranchAvailability("tuzla", [itemId])).size).toBe(0);
    expect(
      (await listBranchAvailability("marina", [itemId])).get(itemId)?.isActive,
    ).toBe(true);
  });

  it("sipariş fiyatı: şubenin Tükendi'si ve menünün seçenek fiyatı (S8)", async () => {
    const { previewAppOrderLines } = await import("@/lib/admin/store");
    // Lafmaliyet'te 55 TL yapılan Extra Shot (mnu-0081) ve iki boylu latte.
    await sql(
      `insert into public.menu_items (id, "categoryKey", name, "priceMinor", "priceMinorL", "isActive", "sortOrder", "updatedAt")
       values ('mnu-0081', 'extras', 'Extra Shot', 5500, 0, false, 2, ''),
              ($1, 'espresso', 'Latte', 13000, 15000, true, 3, '')
       on conflict (id) do update set "priceMinor" = excluded."priceMinor", "priceMinorL" = excluded."priceMinorL"`,
      [`${itemId}-latte`],
    );
    const rates = {
      menu: 10,
      karaoke: 20,
      beans: 1,
      pantry: 1,
      gift: 20,
      gear: 20,
      merch: 20,
      shipping: 20,
    };
    const line = {
      menuItemId: `${itemId}-latte`,
      qty: 1,
      size: "L" as const,
      options: {
        milk: "normal" as const,
        roast: "intense" as const,
        sugar: 0,
        syrup: "none" as const,
        extraShot: true,
        note: "",
      },
    };
    const priced = await previewAppOrderLines([line], rates, "tuzla");
    expect(priced.ok && priced.items[0]?.unitPriceMinor).toBe(15000 + 5500);
    // Marina'da tükenen cheesecake Tuzla'da satılır, Marina masasında satılmaz.
    const cake = { ...line, menuItemId: itemId, size: "single" as const };
    await sql(
      `insert into public.menu_item_availability ("menuItemId", branch, "isActive", "updatedAt", "updatedBy")
       values ($1, 'tuzla', true, '', '') on conflict do nothing`,
      [itemId],
    );
    expect((await previewAppOrderLines([cake], rates, "tuzla")).ok).toBe(true);
    const atMarina = await previewAppOrderLines([cake], rates, "marina");
    expect(atMarina.ok).toBe(true); // 1. test Marina'da yeniden açtı
    await sql(
      `update public.menu_item_availability set "isActive" = false where "menuItemId" = $1 and branch = 'marina'`,
      [itemId],
    );
    const closed = await previewAppOrderLines([cake], rates, "marina");
    expect(closed).toMatchObject({
      ok: false,
      result: { reason: "bad_line" },
    });
    expect((await previewAppOrderLines([cake], rates, "tuzla")).ok).toBe(true);
  });

  it("masa listesi şubeye yazılır; başka şubenin kodu listeyi reddettirir", async () => {
    const { importCafeTables, resolveActiveTable } =
      await import("@/lib/admin/cafe-tables");
    const { generateTableCode } = await import("@/lib/admin/cafe-tables-core");
    const marinaCode = generateTableCode();
    const tuzlaCode = generateTableCode();
    // Köşkün panelinden eklenmiş, şubesiz (eski) masa: Tuzla'nın.
    await sql(
      `insert into public.cafe_tables (id, code, name, "sortOrder", "isActive", "createdAt", "updatedAt")
       values ($1, $2, 'S4', 1, true, '', '')`,
      [`tbl-${tag}`, tuzlaCode],
    );
    const created = await importCafeTables(
      [{ code: marinaCode, name: "S4", active: true }],
      "marina",
    );
    expect("created" in created && created.created[0]?.branch).toBe("marina");
    expect(await resolveActiveTable(marinaCode)).toMatchObject({
      branch: "marina",
    });
    // Eski (şubesiz) masa Tuzla'nın.
    expect(await resolveActiveTable(tuzlaCode)).toMatchObject({
      branch: "tuzla",
    });
    const refused = await importCafeTables(
      [
        { code: marinaCode, name: "S4 yeni", active: true },
        { code: tuzlaCode, name: "S4", active: true },
      ],
      "marina",
    );
    expect(refused).toEqual({
      wrongBranch: { index: 1, code: tuzlaCode },
    });
    // Reddedilen listeden hiçbir şey yazılmadı.
    const [row] = await sql<{ name: string }>(
      `select name from public.cafe_tables where code = $1`,
      [marinaCode],
    );
    expect(row?.name).toBe("S4");
  });

  it("bar ekranı okuması ve çağrılar şubeye göre", async () => {
    const { listPanelOpenOrderRows, countPanelAwaitingPaymentOrders } =
      await import("@/lib/admin/store");
    const { listOpenTableCalls, ackTableCall } =
      await import("@/lib/admin/table-calls");
    const now = new Date();
    const iso = now.toISOString();
    for (const [n, branch] of [
      [1, "tuzla"],
      [2, "marina"],
    ] as const) {
      await sql(
        `insert into public.orders (id, "orderNo", status, kind, source, fulfillment, "tableCode", "tableName", "customerName", "customerEmail", "paidAt", "createdAt", "totalMinor", "subtotalMinor", items, branch)
         values ($1, $2, 'paid', 'cafe', '', 'table', 'K7Q2M9X4TB', 'S4', 'Ada Yılmaz', 'ada@example.test', $3, $3, 13000, 13000, '[]'::jsonb, $4)`,
        [
          `ord-${tag}-${n}`,
          900000 + n + Math.floor(Math.random() * 1000),
          iso,
          branch,
        ],
      );
      await sql(
        `insert into public.table_calls (id, "tableCode", "tableName", reason, "createdAt", branch)
         values ($1, 'K7Q2M9X4TB', 'S4', 'water', $2, $3)`,
        [`call-${tag}-${n}`, iso, branch],
      );
    }
    const since = new Date(now.getTime() - 60_000).toISOString();
    const live = { dueSince: since, readySince: since };
    const marina = await listPanelOpenOrderRows(since, 50, live, "marina");
    expect(marina.map((o) => o.id)).toContain(`ord-${tag}-2`);
    expect(marina.map((o) => o.id)).not.toContain(`ord-${tag}-1`);
    const tuzla = await listPanelOpenOrderRows(since, 50, live, "tuzla");
    expect(tuzla.map((o) => o.id)).toContain(`ord-${tag}-1`);
    expect(tuzla.map((o) => o.id)).not.toContain(`ord-${tag}-2`);
    expect(await countPanelAwaitingPaymentOrders(since, "marina")).toBe(0);

    const marinaCalls = await listOpenTableCalls(now, 50, "marina");
    expect(marinaCalls.map((c) => c.id)).toContain(`call-${tag}-2`);
    expect(marinaCalls.map((c) => c.id)).not.toContain(`call-${tag}-1`);
    // Marina'nın kasası Tuzla'nın çağrısını kapatamaz; kendi çağrısını kapatır.
    expect(
      await ackTableCall(`call-${tag}-1`, "lafpos:Selin", now, "marina"),
    ).toEqual({ ok: false, reason: "wrong_branch" });
    const [open] = await sql<{ ackedAt: string }>(
      `select "ackedAt" from public.table_calls where id = $1`,
      [`call-${tag}-1`],
    );
    expect(open?.ackedAt).toBe("");
    expect(
      await ackTableCall(`call-${tag}-2`, "lafpos:Selin", now, "marina"),
    ).toMatchObject({ ok: true, already: false });
  });
});
