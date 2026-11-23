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

  it("closed ve kasada ödenen: şubeye göre, 48 saat, dizin (23 Kas 2026)", async () => {
    const { listPanelClosedOrderRows, listPanelTillPaidOrderIds } =
      await import("@/lib/admin/store");
    const { toPanelClosed, panelClosedSince, panelOrdersSince } =
      await import("@/lib/panel/orders-feed-core");
    const now = new Date();
    const ago = (h: number) =>
      new Date(now.getTime() - h * 3_600_000).toISOString();
    const rows: [string, string, string, Record<string, string>][] = [
      // [kimlik eki, şube, durum, sütunlar]
      ["c1", "marina", "completed", { paidAt: ago(2), completedAt: ago(1) }],
      ["c2", "marina", "shipped", { paidAt: ago(3), shippedAt: ago(2) }],
      [
        "c3",
        "marina",
        "cancelled",
        { paidAt: ago(70), stockReleasedAt: ago(5) },
      ],
      ["c4", "marina", "refunded", { paidAt: ago(4) }],
      // 48 saatten eski: ödenmiş, tamamlanmış, hepsi pencerenin dışında.
      ["c5", "marina", "completed", { paidAt: ago(80), completedAt: ago(79) }],
      // Ödenmeden iptal, elle girilen, mağaza kolisi, Tuzla'nın.
      ["c6", "marina", "cancelled", { paidAt: "", stockReleasedAt: ago(1) }],
      ["c7", "marina", "completed", { paidAt: ago(2), source: "manual" }],
      [
        "c8",
        "marina",
        "completed",
        { paidAt: ago(2), fulfillment: "shipping" },
      ],
      ["c9", "tuzla", "completed", { paidAt: ago(2), completedAt: ago(1) }],
    ];
    let n = 0;
    for (const [suffix, branch, status, cols] of rows) {
      n++;
      await sql(
        `insert into public.orders (id, "orderNo", status, kind, source, fulfillment, "paidAt", "shippedAt", "completedAt", "stockReleasedAt", "createdAt", "totalMinor", "subtotalMinor", items, branch)
         values ($1, $2, $3, 'cafe', $4, $5, $6, $7, $8, $9, $10, 13000, 13000, '[]'::jsonb, $11)`,
        [
          `ord-${tag}-${suffix}`,
          // Unique per run: the table keeps earlier runs' rows.
          1_000_000_000 + (Date.now() % 1_000_000) * 100 + n,
          status,
          cols.source ?? "app",
          cols.fulfillment ?? "table",
          cols.paidAt ?? "",
          cols.shippedAt ?? "",
          cols.completedAt ?? "",
          cols.stockReleasedAt ?? "",
          ago(90),
          branch,
        ],
      );
    }
    const read = await listPanelClosedOrderRows(
      panelOrdersSince(now),
      panelClosedSince(now),
      200,
      "marina",
    );
    const mine = read.filter((r) => r.id.startsWith(`ord-${tag}-`));
    expect(toPanelClosed(mine)).toEqual([
      { id: `ord-${tag}-c1`, outcome: "completed" },
      { id: `ord-${tag}-c2`, outcome: "completed" },
      { id: `ord-${tag}-c4`, outcome: "refunded" },
      { id: `ord-${tag}-c3`, outcome: "cancelled" },
    ]);
    // SQL'in kendisi: Tuzla'nınki, elle girilen, koli ve pencere dışı gelmez.
    expect(mine.map((r) => r.id).sort()).toEqual(
      ["c1", "c2", "c3", "c4"].map((x) => `ord-${tag}-${x}`),
    );

    await sql(
      `insert into public.payment_transactions ("orderId", provider, "providerRef", status, "amountMinor", "createdAt")
       values ($1, 'manual:nakit', $2, 'succeeded', 13000, $5),
              ($3, 'manual:havale', $4, 'succeeded', 13000, $5),
              ($3, 'paynkolay', $6, 'failed', 13000, $5)`,
      [
        `ord-${tag}-c1`,
        `manual-${tag}-c1`,
        `ord-${tag}-c2`,
        `manual-${tag}-c2`,
        now.toISOString(),
        `pnk-${tag}-c2`,
      ],
    );
    expect(
      await listPanelTillPaidOrderIds([
        `ord-${tag}-c1`,
        `ord-${tag}-c2`,
        `ord-${tag}-c4`,
      ]),
    ).toEqual(new Set([`ord-${tag}-c1`]));

    const [index] = await sql<{ indexdef: string }>(
      `select indexdef from pg_indexes where indexname = 'orders_branch_kind_paid_idx'`,
    );
    expect(index?.indexdef).toMatch(/\(branch, kind, "paidAt"\)/);
  });

  it("şube fiyatı: satırlar, Marina masasının sipariş fiyatı ve QR menüsü (23 Kas 2026)", async () => {
    const { insertBranchPrice, listBranchPrices, deleteFutureBranchPrice } =
      await import("@/lib/admin/menu-branch-prices");
    const { previewAppOrderLines, listMenuForCustomerLive } =
      await import("@/lib/admin/store");
    const { priceLabel } = await import("@/lib/utils/format");
    const latteId = `${itemId}-bp`;
    const name = `Latte ${tag}`;
    await sql(
      `insert into public.menu_items (id, "categoryKey", name, "priceMinor", "priceMinorL", "isActive", "sortOrder", "updatedAt")
       values ($1, 'espresso', $2, 13000, 15000, true, 4, '2026-11-20T08:00:00.000Z')`,
      [latteId, name],
    );
    const now = Date.now();
    const inForce = new Date(now - 60_000).toISOString();
    const later = new Date(now + 3_600_000).toISOString();
    const row = (
      effectiveFrom: string,
      priceMinor: number | null,
      priceMinorL: number,
    ) => ({
      menuItemId: latteId,
      branch: "marina",
      priceMinor,
      priceMinorL,
      effectiveFrom,
      createdAt: new Date(now).toISOString(),
      createdBy: "panel:Ayşe",
    });
    expect((await insertBranchPrice(row(inForce, 14500, 16500))).ok).toBe(true);
    // Aynı an ikinci kez: panelin görüntüsü eski.
    expect(await insertBranchPrice(row(inForce, 14000, 0))).toEqual({
      ok: false,
      reason: "stale",
    });
    expect((await insertBranchPrice(row(later, 15000, 17000))).ok).toBe(true);
    expect(
      await insertBranchPrice({
        ...row(later, 15000, 0),
        menuItemId: `${latteId}-yok`,
      }),
    ).toEqual({ ok: false, reason: "gone" });
    // Tablonun kendi denetimleri: UTC dışı an, L'li tabana dönüş.
    await expect(
      sql(
        `insert into public.menu_item_branch_prices ("menuItemId", branch, "priceMinor", "effectiveFrom")
         values ($1, 'marina', 100, '2026-11-25T05:00:00+03:00')`,
        [latteId],
      ),
    ).rejects.toThrow();
    await expect(
      sql(
        `insert into public.menu_item_branch_prices ("menuItemId", branch, "priceMinor", "priceMinorL", "effectiveFrom")
         values ($1, 'marina', null, 100, '2026-11-25T02:00:00.000Z')`,
        [latteId],
      ),
    ).rejects.toThrow();
    expect(
      (await listBranchPrices("marina", [latteId])).map((r) => r.effectiveFrom),
    ).toEqual([inForce, later]);
    expect(await listBranchPrices("tuzla", [latteId])).toEqual([]);

    // Sipariş fiyatı siparişin şubesinde: Marina masası Marina'nın fiyatı,
    // Tuzla taban; yarınki satır bugün geçmez.
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
    const line = (size: "M" | "L") => ({
      menuItemId: latteId,
      qty: 1,
      size,
      options: {
        milk: "normal" as const,
        roast: "intense" as const,
        sugar: 0,
        syrup: "none" as const,
        extraShot: false,
        note: "",
      },
    });
    const unit = async (size: "M" | "L", branch: string) => {
      const res = await previewAppOrderLines([line(size)], rates, branch);
      return res.ok ? res.items[0]?.unitPriceMinor : null;
    };
    expect(await unit("M", "marina")).toBe(14500);
    expect(await unit("L", "marina")).toBe(16500);
    expect(await unit("M", "tuzla")).toBe(13000);
    expect(await unit("L", "tuzla")).toBe(15000);

    // Masanın QR menüsü (Marina) şubenin fiyatını yazar; sitenin sayfaları
    // (Tuzla) tabanı.
    const shown = async (branch: string) =>
      (await listMenuForCustomerLive(branch)).espresso?.items.find(
        (i) => i.name === name,
      );
    expect(await shown("marina")).toMatchObject({
      price: priceLabel(14500),
      priceL: priceLabel(16500),
    });
    expect(await shown("tuzla")).toMatchObject({
      price: priceLabel(13000),
      priceL: priceLabel(15000),
    });

    // Yalnız henüz başlamamış satır geri alınır.
    expect(
      await deleteFutureBranchPrice(latteId, "marina", inForce, new Date()),
    ).toBe(false);
    expect(
      await deleteFutureBranchPrice(latteId, "marina", later, new Date()),
    ).toBe(true);
    expect(await listBranchPrices("marina", [latteId])).toHaveLength(1);
  });
});
