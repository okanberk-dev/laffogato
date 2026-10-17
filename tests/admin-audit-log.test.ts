import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * /admin/olay-kaydi: filters by date range and record id, a link from each
 * row to its record (and to that record's whole history), and the payload
 * as labelled fields instead of a raw JSON.stringify.
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
  ])("%s %s → %s", (entity, id, href) => {
    expect(view.auditRecordHref(entity, id)).toBe(href);
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
    expect(by["ok.op"].value).toBe("deactivate");
    expect(by["ok.updated"].value).toBe("2");
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

describe("the page", () => {
  it("renders the filters, the record links and a readable payload", async () => {
    vi.resetModules();
    vi.doMock("next/link", () => ({
      default: ({
        href,
        children,
        ...rest
      }: {
        href: string;
        children?: ReactNode;
      }) => createElement("a", { href, ...rest }, children),
    }));
    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ push: vi.fn() }),
    }));
    vi.doMock("@/lib/admin/auth", () => ({
      requireRole: vi.fn(async () => ({})),
    }));
    const listed = vi.fn(async () => [
      {
        id: "aud-0000001",
        actor: "patron@laffogato.net",
        action: "update",
        entity: "product",
        entityId: "prd-0001",
        payload: { name: "Sirena", isActive: true },
        createdAt: "2026-10-16T09:00:00.000Z",
      },
    ]);
    vi.doMock("@/lib/admin/audit", () => ({ listAuditLogs: listed }));
    const { default: AuditLogPage } =
      await import("@/app/admin/olay-kaydi/page");
    const html = renderToStaticMarkup(
      await AuditLogPage({
        searchParams: Promise.resolve({
          entityId: "prd-0001",
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
      }),
    );
    expect(html).toContain('type="date"');
    expect(html).toContain('name="entityId"');
    expect(html).toContain('href="/admin/urunler/prd-0001/duzenle"');
    expect(html).toContain(
      'href="/admin/olay-kaydi?entity=product&amp;entityId=prd-0001"',
    );
    expect(html).toMatch(/<dt[^>]*>Ad<\/dt><dd[^>]*>Sirena<\/dd>/);
    expect(html).not.toContain("{&quot;name&quot;");
  });
});
