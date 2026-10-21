import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * /admin/olay-kaydi: filters by date range and record id, a link from each
 * row to its record (and to that record's whole history), and the payload
 * as labelled fields instead of a raw JSON.stringify: every name and every
 * known value in Turkish (SYS-10). Paged, with a page per event (SYS-09)
 * and compact rows (SYS-11).
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: vi.fn(async () => null),
  requireRole: vi.fn(async () => ({})),
}));

const view = await import("@/lib/admin/audit-view");
const { listAuditLogs } = await import("@/lib/admin/audit");
const { parseFilters } = await import("@/lib/admin/list-params");

beforeEach(() => {
  seen.length = 0;
});

describe("auditRecordHref", () => {
  it.each([
    ["product", "prd-0001", "/admin/urunler/prd-0001/duzenle"],
    ["menu_item", "mnu-0042", "/admin/menu/mnu-0042/duzenle"],
    ["category", "cat-3", "/admin/kategoriler/cat-3/duzenle"],
    ["promo", "prm-0003", "/admin/promosyon/prm-0003/duzenle"],
    ["order", "ord-10023", "/admin/siparisler/ord-10023"],
    ["order_item", "ord-10023#2", "/admin/siparisler/ord-10023"],
    ["cafe_table", "tbl-0003", "/admin/masalar/tbl-0003/duzenle"],
    ["stock", "prd-0001", "/admin/stok-hareketleri?productId=prd-0001"],
    ["customer", "Ayse@Ornek.com", "/admin/musteriler/ayse%40ornek.com"],
    ["campaign_email", "cmp-0001", "/admin/bulten/kampanya/cmp-0001"],
    ["legal_doc", "gizlilik", "/admin/hukuk/gizlilik"],
    ["app_post", "apost-001", "/admin/mobil/gonderiler/apost-001"],
    ["karaoke_reservation", "krk-00042", "/admin/mobil/karaoke/krk-00042"],
    ["karaoke_reservation", " krk-100000 ", "/admin/mobil/karaoke/krk-100000"],
  ])("%s %s → %s", (entity, id, href) => {
    expect(view.auditRecordHref(entity, id)).toBe(href);
  });

  it("sends a karaoke id that cannot be a booking's to the list", () => {
    // The booking page answers only `krk-` + digits; anything else would be
    // its 404.
    for (const id of ["KRK-00042", "krk-", "krk-42/../x", "42"]) {
      expect(view.auditRecordHref("karaoke_reservation", id)).toBe(
        "/admin/mobil/karaoke",
      );
    }
  });

  it("links nowhere when there is no page, or the account is closed", () => {
    expect(view.auditRecordHref("coupon", "cpn-1")).toBeNull();
    expect(view.auditRecordHref("auth", "x")).toBeNull();
    // A closed account is logged by its customer id: the address is gone.
    expect(view.auditRecordHref("customer", "cus-0042")).toBeNull();
    expect(view.auditRecordHref("product", "  ")).toBeNull();
  });
});

describe("auditPayloadEntries", () => {
  it("labels, flattens and formats what the actions write", () => {
    const entries = view.auditPayloadEntries({
      name: "Sirena",
      isActive: false,
      delta: -3,
      amountMinor: 125_000,
      rotatedAt: "2026-10-16T21:30:00.000Z",
      tags: ["vegan", "yeni"],
      ok: { op: "deactivate", updated: 2 },
      empty: "",
    });
    const by = Object.fromEntries(entries.map((e) => [e.key, e]));
    expect(by.name).toMatchObject({ label: "Ad", value: "Sirena" });
    expect(by.isActive).toMatchObject({ label: "Aktif", value: "hayır" });
    expect(by.delta.value).toBe("-3");
    expect(by.amountMinor.value).toBe("₺1.250,00");
    // The köşk's clock: 00:30 on the 17th.
    expect(by.rotatedAt.value).toMatch(/17 Eki 2026 00:30/);
    expect(by.tags.value).toBe("vegan, yeni");
    // A nested key is named segment by segment; a known value in Turkish.
    expect(by["ok.op"]).toMatchObject({
      label: "ok · İşlem",
      value: "Pasif etme",
    });
    expect(by["ok.updated"]).toMatchObject({
      label: "ok · Güncellenen",
      value: "2",
    });
    expect(by.empty.value).toBe("-");
    expect(entries.map((e) => e.key)[0]).toBe("name");
  });

  it("clips a long value and survives junk", () => {
    const [long] = view.auditPayloadEntries({ note: "x".repeat(1000) });
    expect(long.value.length).toBeLessThanOrEqual(300);
    expect(long.value.endsWith("…")).toBe(true);
    expect(view.auditPayloadEntries(null)).toEqual([]);
    expect(view.auditPayloadEntries({ list: [{ a: 1 }] })[0].value).toBe(
      '[{"a":1}]',
    );
  });
});

describe("date range", () => {
  it("turns bas / bit into the köşk's midnights, the end exclusive", () => {
    expect(view.istanbulDayRange("2026-10-01", "2026-10-03")).toEqual({
      from: "2026-09-30T21:00:00.000Z",
      to: "2026-10-03T21:00:00.000Z",
    });
    expect(view.istanbulDayRange(undefined, undefined)).toEqual({});
  });

  it("the shared fields keep known values only and swap a backwards range", () => {
    const f = parseFilters(
      {
        entity: "spaceship",
        action: "delete",
        entityId: "  prd-0001 ",
        bas: "2026-10-05",
        bit: "2026-10-01",
      },
      view.AUDIT_FILTER_FIELDS,
    );
    expect(f).toEqual({
      action: "delete",
      entityId: "prd-0001",
      bas: "2026-10-01",
      bit: "2026-10-05",
    });
  });
});

describe("listAuditLogs", () => {
  it("filters by record id and the date range in SQL", async () => {
    await listAuditLogs({
      entity: "product",
      entityId: "prd-0001",
      from: "2026-09-30T21:00:00.000Z",
      to: "2026-10-03T21:00:00.000Z",
      limit: 500,
    });
    const q = seen.find((s) => /FROM "audit_logs"/.test(s.text))!;
    expect(q.text).toMatch(/"entityId" = \$\d+/);
    expect(q.text).toMatch(/"createdAt" >= \$\d+/);
    expect(q.text).toMatch(/"createdAt" < \$\d+/);
    expect(q.params).toEqual(
      expect.arrayContaining([
        "product",
        "prd-0001",
        "2026-09-30T21:00:00.000Z",
        "2026-10-03T21:00:00.000Z",
      ]),
    );
  });

  it("matches the Kim box literally: %, _ and the backslash itself", async () => {
    // ILIKE's escape character is the backslash. Escaping % and _ but not
    // the backslash let "a\" turn the closing % into a literal one, so the
    // search looked for "a%" and found nothing.
    await listAuditLogs({ actor: "Ali_%\\" });
    const q = seen.find((s) => /FROM "audit_logs"/.test(s.text))!;
    expect(q.text).toMatch(/"actor" ILIKE \$\d+/);
    expect(q.params).toContain("%ali\\_\\%\\\\%");
  });
});

describe("Turkish labels (SYS-10)", () => {
  const entries = (
    payload: Record<string, unknown>,
    ctx: { entity?: string; action?: string; entityId?: string } = {},
  ) =>
    Object.fromEntries(
      view.auditPayloadEntries(payload, ctx).map((e) => [e.key, e]),
    );

  it("names a settings change's before / after / changed fields", () => {
    const by = entries(
      {
        section: "notifications",
        before: {
          shippingFlatMinor: 4_900,
          orderNotifyRoles: ["owner", "manager", "cashier"],
        },
        after: { courierFeeMinor: 7_500, orderNotifyRoles: ["owner"] },
        changed: { orderNotifyEmailsAdded: 1 },
      },
      { entity: "settings", action: "update", entityId: "notifications" },
    );
    expect(by["before.shippingFlatMinor"]).toMatchObject({
      label: "Önceki · Kargo ücreti",
      value: "₺49,00",
    });
    expect(by["after.courierFeeMinor"]).toMatchObject({
      label: "Yeni · Kurye ücreti",
      value: "₺75,00",
    });
    expect(by["before.orderNotifyRoles"]).toMatchObject({
      label: "Önceki · Bildirim alan roller",
      value: "Sahip, Yönetici, Kasiyer",
    });
    expect(by["changed.orderNotifyEmailsAdded"]).toMatchObject({
      label: "Değişti · Eklenen alıcı",
      value: "1",
    });
    // The section is the row's record (the Kayıt column names it).
    expect(by.section).toBeUndefined();
    // No raw dotted key reaches the screen.
    for (const e of Object.values(by)) {
      expect(e.label).not.toMatch(/[a-z][A-Z]|\./);
    }
  });

  it("prints the hours in Turkish day names", () => {
    const by = entries(
      {
        before: { openingHours: "mon 09:00-02:00 · tue Kapalı" },
        after: { openingHours: "sun 10:00-22:00" },
      },
      { entity: "settings", entityId: "hours" },
    );
    expect(by["before.openingHours"]).toMatchObject({
      label: "Önceki · Çalışma saatleri",
      value: "Pazartesi 09:00-02:00 · Salı Kapalı",
    });
    expect(by["after.openingHours"].value).toBe("Pazar 10:00-22:00");
  });

  it("calls a test mail's address the recipient, not a new value", () => {
    const by = entries(
      { section: "email-test", to: "okan@laffogato.com" },
      { entity: "settings", action: "send_test", entityId: "email-test" },
    );
    expect(by.to).toMatchObject({
      label: "Alıcı",
      value: "okan@laffogato.com",
    });
    expect(
      entries({ to: "a@b.co" }, { entity: "campaign_email", action: "send_test" })
        .to.label,
    ).toBe("Alıcı");
  });

  it("names an order's statuses and its transition", () => {
    const by = entries(
      {
        transition: "cancel",
        to: "cancelled",
        from: "paid",
        restock: true,
        refundedMinor: 12_000,
      },
      { entity: "order", action: "transition" },
    );
    expect(by.transition).toMatchObject({ label: "Geçiş", value: "İptal" });
    expect(by.to).toMatchObject({ label: "Yeni durum", value: "İptal edildi" });
    expect(by.from).toMatchObject({ label: "Önceki durum", value: "Ödendi" });
    expect(by.restock).toMatchObject({ label: "Stoğa dönen", value: "evet" });
    expect(by.refundedMinor.value).toBe("₺120,00");
    // A line's own state, a booking's state.
    expect(
      entries({ status: "ready" }, { entity: "order_item" }).status.value,
    ).toBe("Hazır");
    expect(
      entries({ status: "confirmed" }, { entity: "karaoke_reservation" })
        .status.value,
    ).toBe("Onaylandı");
  });

  it("calls an order's from / to a status only when they hold one", () => {
    // A system row on an order whose before / after is a KDV rate, not a
    // status (the shape main's 20261019150000_cafe_food_rate_10.sql writes).
    const rate = entries(
      { event: "kdv_rate_corrected", orderNo: 10023, from: 1, to: 10 },
      { entity: "order", action: "update", entityId: "ord-10023" },
    );
    expect(rate.from).toMatchObject({ label: "Önceki", value: "1" });
    expect(rate.to).toMatchObject({ label: "Yeni", value: "10" });
    // A string that is no status of the record keeps the plain name too,
    // and a key named like an Object method is not mistaken for one.
    const odd = entries(
      { from: "constructor", to: "somewhere" },
      { entity: "order", action: "transition" },
    );
    expect(odd.from.label).toBe("Önceki");
    expect(odd.to.label).toBe("Yeni");
    // The status pair still reads as one.
    const status = entries(
      { from: "paid", to: "cancelled" },
      { entity: "order", action: "transition" },
    );
    expect(status.from.label).toBe("Önceki durum");
    expect(status.to.label).toBe("Yeni durum");
  });

  it("names a till redemption that stopped after some stamps", () => {
    // kasa/actions.ts writes this when redeemCounterToken answers "partial".
    const by = entries(
      { kind: "code", stamps: 1, asked: 3, partial: true },
      { entity: "counter_token", action: "update" },
    );
    expect(by.stamps).toMatchObject({ label: "Damga", value: "1" });
    expect(by.asked).toMatchObject({ label: "İstenen damga", value: "3" });
    expect(by.partial).toMatchObject({ label: "Yarım kaldı", value: "evet" });
  });

  it("names the rest of what the actions write", () => {
    expect(
      entries({ needs2FA: false }, { entity: "auth" }).needs2FA,
    ).toMatchObject({ label: "2FA gerekli", value: "hayır" });
    expect(
      entries(
        { op: "delete", updated: 5, idCount: 5 },
        { entity: "product", action: "bulk_delete" },
      ).op,
    ).toMatchObject({ label: "İşlem", value: "Silme" });
    expect(
      entries({ role: "barista" }, { entity: "staff_member" }).role.value,
    ).toBe("Barista");
    expect(
      entries({ event: "code_rotated" }, { entity: "cafe_table" }).event.value,
    ).toBe("Kod yenilendi");
    // A manual order's total is kuruş though its key does not say so.
    expect(
      entries({ total: 15_000 }, { entity: "order", action: "create" }).total
        .value,
    ).toBe("₺150,00");
    expect(
      entries({ total: 120 }, { entity: "campaign_email", action: "send" })
        .total,
    ).toMatchObject({ label: "Alıcı sayısı", value: "120" });
  });

  it("names an export's filters with the list's own words", () => {
    const by = entries(
      {
        filters: { q: "eda", kanal: "manuel", bas: "2026-10-01" },
        tab: "acik",
        rows: 42,
      },
      { entity: "order", action: "export" },
    );
    expect(by["filters.q"]).toMatchObject({
      label: "Süzgeç · Arama",
      value: "eda",
    });
    expect(by["filters.kanal"].value).toBe("Panelden (manuel)");
    expect(by.tab).toMatchObject({ label: "Sekme", value: "Açık" });
    expect(by.rows).toMatchObject({ label: "Satır", value: "42" });
    const audit = entries(
      { filters: { entity: "product", action: "delete" }, rows: 3 },
      { entity: "audit_log", action: "export" },
    );
    expect(audit["filters.entity"].value).toBe("Ürün");
    expect(audit["filters.action"].value).toBe("Silme");
  });

  it("shows a settings record as its section, linked to its tab", () => {
    expect(view.auditRecordText("settings", "general")).toBe("Genel");
    expect(view.auditRecordText("settings", "notifications")).toBe("Bildirim");
    expect(view.auditRecordText("settings", "email-test")).toBe(
      "Test e-postası",
    );
    expect(view.auditRecordText("mobile_app_config", "ordering")).toBe(
      "Sipariş",
    );
    expect(view.auditRecordText("product", " prd-0001 ")).toBe("prd-0001");
    expect(view.auditRecordHref("settings", "general")).toBe("/admin/ayarlar");
    expect(view.auditRecordHref("settings", "shipping")).toBe(
      "/admin/ayarlar?sekme=shipping",
    );
    expect(view.auditRecordHref("settings", "email-test")).toBe(
      "/admin/ayarlar?sekme=email",
    );
  });

  it("offers only kinds and actions that exist, under plain names", () => {
    const entity = view.AUDIT_FILTER_FIELDS.find(
      (f) => f.type === "select" && f.name === "entity",
    );
    const values =
      entity?.type === "select" ? entity.options.map((o) => o.value) : [];
    // Nothing writes a reel: the option could only show an empty log.
    expect(values).not.toContain("reel");
    expect(values).toContain("audit_log");
    expect(view.AUDIT_ENTITY_LABELS.shop_hero_slide).toBe("Mağaza vitrini");
    expect(view.AUDIT_ACTION_LABELS["2fa_enable"]).toBe("2FA açma");
    expect(view.AUDIT_ACTION_LABELS.export).toBe("Dışa aktarma");
    expect(view.AUDIT_ACTION_TONES.export).toBe("accent");
  });

  it("reads a periodic destruction run in Turkish, rule by rule", () => {
    // src/lib/retention.ts `destructionRecord`: counts only, one row per
    // applied run, filed under the run's instant (OP-RETENTION-APPLY).
    expect(view.AUDIT_ENTITY_LABELS.retention).toBe("Periyodik imha");
    const kinds = view.AUDIT_FILTER_FIELDS.find(
      (f) => f.type === "select" && f.name === "entity",
    );
    expect(kinds?.type === "select" ? kinds.options : []).toContainEqual({
      value: "retention",
      label: "Periyodik imha",
    });
    const ctx = {
      entity: "retention",
      action: "bulk_delete",
      entityId: "2026-10-21T06:00:00.000Z",
    };
    const list = view.auditPayloadEntries(
      {
        at: "2026-10-21T06:00:00.000Z",
        results: [
          {
            id: "karaoke-guest-data",
            table: "karaoke_reservations",
            method: "clear",
            cutoff: "2023-10-19T09:00:00.000+03:00",
            matched: 3,
            destroyed: 3,
          },
          {
            id: "auth-attempts",
            table: "auth_attempts",
            method: "delete",
            cutoff: "2026-10-14T06:00:00.000Z",
            matched: 0,
            destroyed: 0,
            failed: true,
          },
        ],
      },
      ctx,
    );
    expect(list).toEqual([
      {
        key: "at",
        label: "Çalışma anı",
        value: expect.stringMatching(/21 Eki 2026 09:00/),
      },
      {
        key: "results.karaoke-guest-data",
        label: "Kural · Karaoke misafir ve iletişim bilgisi",
        value: expect.stringMatching(
          /^Alanlar boşaltıldı · Eşleşen 3 · İmha edilen 3 · Sınır 19 Eki 2023 09:00$/,
        ),
      },
      {
        key: "results.auth-attempts",
        label: "Kural · Giriş denemeleri",
        value: expect.stringMatching(
          /^Silindi · Eşleşen 0 · İmha edilen 0 · Sınır 14 Eki 2026 09:00 · Çalışmadı$/,
        ),
      },
    ]);
    // No raw JSON and no English key is left on the row.
    expect(JSON.stringify(list)).not.toMatch(/"matched"|destroyed|cutoff/);
    // The record column reads the run's instant on the köşk's clock, and
    // there is no page to link to.
    expect(
      view.auditRecordText("retention", "2026-10-21T06:00:00.000Z"),
    ).toMatch(/21 Eki 2026 09:00:00/);
    expect(
      view.auditRecordHref("retention", "2026-10-21T06:00:00.000Z"),
    ).toBeNull();
  });

  it("names the system and members, and keeps an address as it is", () => {
    expect(view.auditActorText("system")).toBe("Sistem");
    expect(view.auditActorText("customer")).toBe("Üye");
    expect(view.auditActorText("okan@laffogato.com")).toBe(
      "okan@laffogato.com",
    );
  });

  it("prints the time to the second on the köşk's clock", () => {
    // 21:30:05 UTC is 00:30:05 on the 17th in Istanbul.
    expect(view.auditTime("2026-10-16T21:30:05.000Z")).toMatch(
      /17 Eki 2026 00:30:05/,
    );
  });

  it("gives the event's own page every character", () => {
    const long = "x".repeat(1000);
    const [clipped] = view.auditPayloadEntries({ note: long });
    expect(clipped.value.length).toBe(300);
    const [full] = view.auditPayloadEntries({ note: long }, {}, { clip: false });
    expect(full.value).toBe(long);
  });

  it("accepts an event id from the URL only in its plain shape", () => {
    expect(view.auditEventIdOf("aud-0000123")).toBe("aud-0000123");
    expect(view.auditEventHref("aud-0000123")).toBe(
      "/admin/olay-kaydi/aud-0000123",
    );
    for (const bad of ["", "../x", "aud 1", "a".repeat(101), 42, null]) {
      expect(view.auditEventIdOf(bad)).toBeNull();
    }
  });
});

describe("paging (SYS-09)", () => {
  it("reads one page newest first, ties broken by id", async () => {
    await listAuditLogs({ entity: "order", limit: 50, offset: 100 });
    const q = seen.find((s) => /FROM "audit_logs"/.test(s.text))!;
    expect(q.text).toMatch(
      /ORDER BY "createdAt" DESC, "id" DESC LIMIT \$\d+ OFFSET \$\d+/,
    );
    expect(q.params).toEqual(expect.arrayContaining(["order", 50, 100]));
  });

  it("counts the rows the same filters match", async () => {
    const { countAuditLogs } = await import("@/lib/admin/audit");
    await countAuditLogs({ actor: "ali", from: "2026-10-01T00:00:00.000Z" });
    const q = seen.find((s) => /count\(\*\)/.test(s.text))!;
    expect(q.text).toMatch(/FROM "audit_logs"/);
    expect(q.text).toMatch(/"actor" ILIKE \$\d+/);
    expect(q.text).toMatch(/"createdAt" >= \$\d+/);
  });

  it("reads one event by its id", async () => {
    const { getAuditLog } = await import("@/lib/admin/audit");
    expect(await getAuditLog("aud-0000001")).toBeNull();
    const q = seen.find((s) => /FROM "audit_logs"/.test(s.text))!;
    expect(q.text).toMatch(/"id" = \$\d+/);
    expect(q.params).toContain("aud-0000001");
  });
});

function row(over: Record<string, unknown> = {}) {
  return {
    id: "aud-0000001",
    actor: "patron@laffogato.net",
    action: "update",
    entity: "product",
    entityId: "prd-0001",
    payload: { name: "Sirena", isActive: true },
    createdAt: "2026-10-16T09:00:00.000Z",
    ...over,
  };
}

async function loadPages(
  rows: Record<string, unknown>[],
  total: number,
  one: Record<string, unknown> | null = null,
  /** The request's cookies: the list's remembered search lives there. */
  jar: Record<string, string> = {},
) {
  vi.resetModules();
  vi.doMock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) =>
        name in jar ? { name, value: jar[name] } : undefined,
    }),
  }));
  vi.doMock("next/link", () => ({
    default: ({
      href,
      children,
      prefetch: _prefetch,
      ...rest
    }: {
      href: string;
      children?: ReactNode;
      prefetch?: boolean;
    }) => createElement("a", { href, ...rest }, children),
    useLinkStatus: () => ({ pending: false }),
  }));
  vi.doMock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/admin/olay-kaydi",
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  }));
  vi.doMock("@/lib/admin/auth", () => ({
    requireRole: vi.fn(async () => ({})),
  }));
  const listed = vi.fn(async () => rows);
  const counted = vi.fn(async () => total);
  const got = vi.fn(async () => one);
  vi.doMock("@/lib/admin/audit", () => ({
    listAuditLogs: listed,
    countAuditLogs: counted,
    getAuditLog: got,
  }));
  const { default: ListPage } = await import("@/app/admin/olay-kaydi/page");
  const { default: EventPage } =
    await import("@/app/admin/olay-kaydi/[id]/page");
  return { ListPage, EventPage, listed, counted, got };
}

describe("the page", () => {
  it("renders the filters, the record links and a readable payload", async () => {
    const { ListPage, listed } = await loadPages(
      [
        row(),
        row({
          id: "aud-0000002",
          actor: "system",
          entity: "karaoke_reservation",
          entityId: "krk-00042",
          payload: { event: "refund_unanswered", amountMinor: 200_000 },
          createdAt: "2026-10-16T08:00:00.000Z",
        }),
      ],
      2,
      null,
      // "Kayıt no" is typed text: it comes from the list's cookie, not the
      // address (lib/admin/list-search-core.ts).
      { adm_q_audit: "entityId=prd-0001" },
    );
    const html = renderToStaticMarkup(
      await ListPage({
        searchParams: Promise.resolve({
          bas: "2026-10-16",
          bit: "2026-10-16",
        }),
      }),
    );
    expect(listed).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "prd-0001",
        from: "2026-10-15T21:00:00.000Z",
        to: "2026-10-16T21:00:00.000Z",
        limit: 50,
        offset: 0,
      }),
    );
    expect(html).toContain('type="date"');
    expect(html).toMatch(/name="entityId"[^>]*value="prd-0001"/);
    expect(html).toContain('href="/admin/urunler/prd-0001/duzenle"');
    // "Geçmişi" posts the record id (a member's is their e-mail): the
    // kind rides in the address, the id in the body.
    expect(html).toContain(
      '<input type="hidden" name="_path" value="/admin/olay-kaydi"/><input type="hidden" name="_do" value="apply"/><input type="hidden" name="entity" value="product"/><input type="hidden" name="entityId" value="prd-0001"/><button type="submit"',
    );
    expect(html).not.toMatch(/href="[^"]*entityId=/);
    // A karaoke row opens its booking's own page, not the list.
    expect(html).toContain('href="/admin/mobil/karaoke/krk-00042"');
    expect(html).not.toContain('href="/admin/mobil/karaoke"');
    // Name above value, so a narrow column keeps the value readable.
    expect(html).toMatch(/<dt[^>]*>Ad<\/dt><dd[^>]*>Sirena<\/dd>/);
    expect(html).not.toContain("{&quot;name&quot;");
    // Each event opens its own page; the system reads as Sistem.
    expect(html).toContain('href="/admin/olay-kaydi/aud-0000001"');
    expect(html).toContain(">Sistem<");
    // Seconds, so two events in one minute do not look the same.
    expect(html).toMatch(/16 Eki 2026 12:00:00/);
  });

  it("pages through the log 50 at a time, with the filters kept", async () => {
    const { ListPage, listed } = await loadPages(
      Array.from({ length: 50 }, (_, i) =>
        row({ id: `aud-${String(1000 - i).padStart(7, "0")}` }),
      ),
      120,
    );
    const html = renderToStaticMarkup(
      await ListPage({
        searchParams: Promise.resolve({ action: "update", sayfa: "2" }),
      }),
    );
    expect(listed).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", limit: 50, offset: 50 }),
    );
    expect(html).toContain("51-100 / 120");
    expect(html).toContain('href="/admin/olay-kaydi?action=update&amp;sayfa=3"');
    // The whole log of 500 rows rendered twice is gone.
    expect(html).not.toContain("En yeni 500 olay");
    // The CSV keeps the filters and drops the page.
    expect(html).toContain('href="/admin/olay-kaydi/csv?action=update"');
  });

  it("shows three fields and links to the rest", async () => {
    const { ListPage } = await loadPages(
      [
        row({
          id: "aud-0000009",
          entity: "settings",
          entityId: "notifications",
          payload: {
            section: "notifications",
            before: { orderNotifyEnabled: true, orderNotifyRoles: ["owner"] },
            after: { orderNotifyEnabled: false, orderNotifyRoles: [] },
            changed: { notificationEmail: false },
          },
        }),
      ],
      1,
    );
    const html = renderToStaticMarkup(
      await ListPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Önceki · Yeni sipariş e-postası");
    expect(html).toContain("+2 alan daha");
    expect(html).not.toContain("Değişti · Bildirim adresi");
    // The record is the section's name, linked to its tab.
    expect(html).toContain('href="/admin/ayarlar?sekme=notifications"');
    expect(html).toMatch(/>Bildirim<\/a>/);
  });

  it("fits the table next to the sidebar: the actor moves under the time below xl (SYS-11)", async () => {
    const { ListPage } = await loadPages(
      [row({ actor: "okan.berk.manavoglu.uzun@laffogato.com" })],
      1,
    );
    const html = renderToStaticMarkup(
      await ListPage({ searchParams: Promise.resolve({}) }),
    );
    // The Kim column only from xl; under it, the time cell carries the actor.
    expect(html).toMatch(/<th[^>]*class="[^"]*hidden xl:table-cell[^"]*"[^>]*>Kim<\/th>/);
    expect(html).toMatch(
      /<span class="min-w-0 text-\[var\(--admin-text-soft\)\] xl:hidden"><span class="block truncate text-xs" title="okan\.berk\.manavoglu\.uzun@laffogato\.com">/,
    );
    // Ayrıntı no longer claims 14rem of a 720 px table.
    expect(html).not.toContain("min-w-[14rem]");
  });

  it("says what the log is in plain words, under the sidebar's names", async () => {
    const { ListPage } = await loadPages([], 0);
    const html = renderToStaticMarkup(
      await ListPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain(">Sistem<");
    expect(html).toContain(">Olay kaydı</h1>");
    expect(html).not.toMatch(/mutasyon/i);
    expect(html).not.toContain(">Denetim<");
    expect(html).toContain("Henüz olay yok.");
    // Nothing to export: no CSV link.
    expect(html).not.toContain("/admin/olay-kaydi/csv");
  });

  it("gives a page past the end a way back", async () => {
    const { ListPage } = await loadPages([], 30);
    const html = renderToStaticMarkup(
      await ListPage({ searchParams: Promise.resolve({ sayfa: "9" }) }),
    );
    expect(html).toContain("Bu sayfada olay yok.");
    expect(html).toContain('href="/admin/olay-kaydi"');
  });
});

describe("the event's own page", () => {
  it("shows every field unclipped, the raw record and the links", async () => {
    const note = `${"uzun ".repeat(100)}son`;
    const { EventPage, got } = await loadPages(
      [],
      0,
      row({
        id: "aud-0000077",
        actor: "system",
        action: "transition",
        entity: "order",
        entityId: "ord-10023",
        payload: { transition: "cancel", to: "cancelled", reason: note },
        createdAt: "2026-10-16T21:30:05.000Z",
      }),
    );
    const html = renderToStaticMarkup(
      await EventPage({ params: Promise.resolve({ id: "aud-0000077" }) }),
    );
    expect(got).toHaveBeenCalledWith("aud-0000077");
    expect(html).toContain("17 Eki 2026 00:30:05");
    expect(html).toContain("Sistem");
    expect(html).toContain("Durum geçişi · Sipariş");
    expect(html).toContain('href="/admin/siparisler/ord-10023"');
    expect(html).toContain(
      '<input type="hidden" name="entity" value="order"/><input type="hidden" name="entityId" value="ord-10023"/><button type="submit"',
    );
    expect(html).not.toMatch(/href="[^"]*entityId=/);
    expect(html).toContain("Yeni durum");
    expect(html).toContain("İptal edildi");
    // The list clips at 300 characters; this page does not.
    expect(html).toContain(note);
    expect(html).toContain("Ham kayıt (JSON)");
    expect(html).toContain("&quot;transition&quot;: &quot;cancel&quot;");
  });

  it("answers 404 for an unknown or malformed id, without a read for the latter", async () => {
    const { EventPage, got } = await loadPages([], 0, null);
    await expect(
      EventPage({ params: Promise.resolve({ id: "aud-0404" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(got).toHaveBeenCalledTimes(1);
    await expect(
      EventPage({ params: Promise.resolve({ id: "../etc" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(got).toHaveBeenCalledTimes(1);
  });
});
