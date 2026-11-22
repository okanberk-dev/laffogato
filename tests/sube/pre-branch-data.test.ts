import { existsSync, readFileSync } from "node:fs";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Şubelerden önce yazılmış veri (db/migrations/20261122090000_pre_branch_lafpos_data.sql).
//
// 20261121150719_branches.sql var olan her şeyi Tuzla'ya yazdı. İki şey
// aslında Tuzla'nın değildi ya da yeni kurala uymadı:
//
// 1. LafPOS'un (Marina kasası) şubelerden önce gönderdiği masa kodları
//    Tuzla'da kaldı: bu kodlardan gelen QR siparişi ve çağrı Tuzla'ya düştü,
//    kasanın sonraki listesi 409 wrong_branch ile bütünüyle reddedildi.
// 2. Panelin ya da LafPOS'un eski tek bayrakla bastığı Tükendi
//    menu_items."isActive"=false kaldı, yani "her şubede menüden kalktı":
//    Marina kapanıyor ve LafPOS açamıyor (site_closed).
//
// Tuzla'nın gördüğü değişmez: masaları, kapanmış siparişleri ve Tükendi'leri
// olduğu gibi kalır. Gerçek Postgres ister (TEST_DATABASE_URL), yoksa atlanır.

const url = process.env.TEST_DATABASE_URL ?? "";
const local = (() => {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
})();

const FIX = new URL(
  "../../db/migrations/20261122090000_pre_branch_lafpos_data.sql",
  import.meta.url,
);

describe.skipIf(!local)("şubelerden önceki LafPOS verisi", () => {
  let pool: pg.Pool;
  let sql: <T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<T[]>;
  const tag = `p${Date.now().toString(36)}`;
  const iso = "2026-11-20T18:00:00.000Z";
  let lafposCode = "";
  let tuzlaCode = "";
  let n = 0;

  const audit = (
    entity: string,
    entityId: string,
    action: string,
    payload: object,
    createdAt: string,
    actor = "",
  ) =>
    sql(
      `insert into public.audit_logs (id, actor, action, entity, "entityId", payload, "createdAt")
       values ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        `aud-${tag}-${++n}`,
        actor,
        action,
        entity,
        entityId,
        JSON.stringify(payload),
        createdAt,
      ],
    );

  const order = (id: string, code: string, status: string) =>
    sql(
      `insert into public.orders (id, "orderNo", status, kind, source, fulfillment, "tableCode", "tableName", "customerName", "customerEmail", "paidAt", "createdAt", "totalMinor", "subtotalMinor", items)
       values ($1, $2, $3, 'cafe', '', 'table', $4, 'M1', 'Ada Yılmaz', 'ada@example.test', $5, $5, 13000, 13000, '[]'::jsonb)`,
      [
        id,
        800000 + Math.floor(Math.random() * 100000),
        status,
        code,
        new Date().toISOString(),
      ],
    );

  const item = (id: string, isActive: boolean) =>
    sql(
      `insert into public.menu_items (id, "categoryKey", name, "priceMinor", "priceMinorL", "isActive", "sortOrder", "updatedAt")
       values ($1, 'dessert', 'Cheesecake', 18000, 0, $2, 1, '2026-11-20T08:00:00.000Z')`,
      [id, isActive],
    );

  const runFix = async () => {
    expect(existsSync(FIX)).toBe(true);
    await pool.query(readFileSync(FIX, "utf8"));
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    pool = new pg.Pool({ connectionString: url });
    sql = async (text, params = []) =>
      (await pool.query(text, params)).rows as never;
    const { generateTableCode } = await import("@/lib/admin/cafe-tables-core");
    lafposCode = generateTableCode();
    tuzlaCode = generateTableCode();

    // Masalar: biri LafPOS'un (şubesiz audit, via lafpos), biri köşkün.
    for (const [id, code] of [
      [`tbl-${tag}-l`, lafposCode],
      [`tbl-${tag}-t`, tuzlaCode],
    ]) {
      await sql(
        `insert into public.cafe_tables (id, code, name, "sortOrder", "isActive", "createdAt", "updatedAt")
         values ($1, $2, 'M1', 1, true, $3, $3)`,
        [id, code, iso],
      );
    }
    await audit(
      "cafe_table",
      `tbl-${tag}-l`,
      "create",
      { name: "M1", code: lafposCode, isActive: true, via: "lafpos" },
      iso,
      "lafpos:LafPOS",
    );
    await audit(
      "cafe_table",
      `tbl-${tag}-t`,
      "create",
      { name: "M1", code: tuzlaCode, isActive: true },
      iso,
      "admin:Okan",
    );
    await order(`ord-${tag}-open`, lafposCode, "paid");
    await order(`ord-${tag}-done`, lafposCode, "completed");
    await order(`ord-${tag}-tuzla`, tuzlaCode, "paid");
    await sql(
      `insert into public.table_calls (id, "tableCode", "tableName", reason, "createdAt", "ackedAt")
       values ($1, $2, 'M1', 'water', $3, ''), ($4, $2, 'M1', 'water', $3, $3)`,
      [`call-${tag}-open`, lafposCode, iso, `call-${tag}-acked`],
    );

    // Tükendi'ler: köşk paneli, LafPOS, sitenin formu, panel sonra form.
    for (const [id, active] of [
      [`mnu-${tag}-panel`, false],
      [`mnu-${tag}-lafpos`, false],
      [`mnu-${tag}-form`, false],
      [`mnu-${tag}-later`, false],
      [`mnu-${tag}-open`, true],
    ] as const) {
      await item(id, active);
    }
    const off = { name: "Cheesecake", isActive: false };
    await audit(
      "menu_item",
      `mnu-${tag}-panel`,
      "update",
      { ...off, via: "panel" },
      iso,
      "panel:Ayşe",
    );
    await audit(
      "menu_item",
      `mnu-${tag}-lafpos`,
      "update",
      { ...off, via: "lafpos" },
      iso,
      "lafpos:Selin",
    );
    await audit(
      "menu_item",
      `mnu-${tag}-form`,
      "update",
      off,
      iso,
      "admin:Okan",
    );
    await audit(
      "menu_item",
      `mnu-${tag}-later`,
      "update",
      { ...off, via: "panel" },
      iso,
      "panel:Ayşe",
    );
    await audit(
      "menu_item",
      `mnu-${tag}-later`,
      "update",
      off,
      "2026-11-20T19:00:00.000Z",
      "admin:Okan",
    );
    await audit(
      "menu_item",
      `mnu-${tag}-open`,
      "update",
      { ...off, via: "panel" },
      iso,
      "panel:Ayşe",
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("LafPOS'un eski masa kodu Marina'nın listesini reddettiriyordu; düzeltmeden sonra kabul", async () => {
    const { importCafeTables } = await import("@/lib/admin/cafe-tables");
    const { generateTableCode } = await import("@/lib/admin/cafe-tables-core");
    const list = [
      { code: lafposCode, name: "M1", active: true },
      { code: generateTableCode(), name: "M2", active: true },
    ];
    expect(await importCafeTables(list, "marina")).toEqual({
      wrongBranch: { index: 0, code: lafposCode },
    });
    await runFix();
    await runFix(); // yeniden çalıştırılabilir
    const after = await importCafeTables(list, "marina");
    expect("created" in after && after.created.length).toBe(1);

    const branches = Object.fromEntries(
      (
        await sql<{ code: string; branch: string }>(
          `select code, branch from public.cafe_tables where code = any($1)`,
          [[lafposCode, tuzlaCode]],
        )
      ).map((r) => [r.code, r.branch]),
    );
    expect(branches).toEqual({ [lafposCode]: "marina", [tuzlaCode]: "tuzla" });

    const orders = Object.fromEntries(
      (
        await sql<{ id: string; branch: string }>(
          `select id, branch from public.orders where id like $1`,
          [`ord-${tag}-%`],
        )
      ).map((r) => [r.id, r.branch]),
    );
    expect(orders).toEqual({
      [`ord-${tag}-open`]: "marina",
      [`ord-${tag}-done`]: "tuzla",
      [`ord-${tag}-tuzla`]: "tuzla",
    });
    const calls = Object.fromEntries(
      (
        await sql<{ id: string; branch: string }>(
          `select id, branch from public.table_calls where id like $1`,
          [`call-${tag}-%`],
        )
      ).map((r) => [r.id, r.branch]),
    );
    expect(calls).toEqual({
      [`call-${tag}-open`]: "marina",
      [`call-${tag}-acked`]: "tuzla",
    });
  });

  it("eski Tükendi'ler şubesine iner: Tuzla aynı kalır, Marina açılabilir", async () => {
    await runFix();
    await runFix();
    const { listBranchAvailability } =
      await import("@/lib/admin/menu-availability");
    const { soldAtBranch, planAvailabilityWrite } =
      await import("@/lib/panel/menu-availability-core");
    const ids = ["panel", "lafpos", "form", "later", "open"].map(
      (k) => `mnu-${tag}-${k}`,
    );
    const items = Object.fromEntries(
      (
        await sql<{ id: string; isActive: boolean; updatedAt: string }>(
          `select id, "isActive", "updatedAt" from public.menu_items where id = any($1)`,
          [ids],
        )
      ).map((r) => [r.id.slice(`mnu-${tag}-`.length), r]),
    );
    const tuzla = await listBranchAvailability("tuzla", ids);
    const marina = await listBranchAvailability("marina", ids);
    const at = (rows: typeof tuzla, k: string) =>
      soldAtBranch(items[k]!, rows.get(`mnu-${tag}-${k}`));

    // Damga değişmez (lafmaliyet'in işareti siteUpdatedAt'e bakar).
    for (const k of Object.keys(items)) {
      expect(items[k]!.updatedAt).toBe("2026-11-20T08:00:00.000Z");
    }
    // Köşk panelinin Tükendi'si: Tuzla'da kapalı, Marina'da satışta.
    expect(items.panel!.isActive).toBe(true);
    expect([at(tuzla, "panel"), at(marina, "panel")]).toEqual([false, true]);
    expect(tuzla.get(`mnu-${tag}-panel`)).toMatchObject({
      updatedAt: "2026-11-20T08:00:00.000Z",
      updatedBy: "panel:Ayşe",
    });
    // LafPOS'un Tükendi'si: iki şubede de kapalı kalır, ama artık Marina açabilir.
    expect(items.lafpos!.isActive).toBe(true);
    expect([at(tuzla, "lafpos"), at(marina, "lafpos")]).toEqual([false, false]);
    expect(
      planAvailabilityWrite(
        { onMenu: true, branchRow: marina.get(`mnu-${tag}-lafpos`) ?? null },
        true,
        "lafpos",
      ),
    ).toEqual({ kind: "branch", isActive: true });
    // Sitenin kendi formu (via yok) ya da son kaydı form olan: dokunulmaz.
    for (const k of ["form", "later"]) {
      expect(items[k]!.isActive).toBe(false);
      expect(tuzla.get(`mnu-${tag}-${k}`)).toBeUndefined();
      expect(marina.get(`mnu-${tag}-${k}`)).toBeUndefined();
    }
    // Zaten satışta olan kaleme satır yazılmaz.
    expect(tuzla.get(`mnu-${tag}-open`)).toBeUndefined();
  });
});
