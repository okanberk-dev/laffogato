import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_FILTER_FIELDS,
  customerSearch,
  customerSearchDigits,
  parseCustomerListParams,
  toCustomerCounts,
  toCustomerListRow,
  type CustomerCounts,
  type CustomerListRow,
} from "@/lib/admin/customer-list-core";
import { parseFilters } from "@/lib/admin/list-params";
import { TR_FOLD_SQL_FROM, TR_FOLD_SQL_TO } from "@/lib/admin/text-fold";

/**
 * Müşteriler (admin audit PEO-13, PEO-05, PEO-17, PEO-21, PEO-20): the URL
 * the list reads, the search it hands to SQL, and the page drawn from one
 * page of rows and the tab counts. The SQL itself runs against a real
 * Postgres in tests/db-integration-customer-list.test.ts.
 */

const MIGRATION = readFileSync(
  "db/migrations/20261019120000_admin_customer_list.sql",
  "utf8",
);

describe("the list's URL", () => {
  it("reads the tab, the filters, the sort and the page", () => {
    const p = parseCustomerListParams({
      filter: "inactive",
      q: "  Ali  ",
      izin: "var",
      eposta: "dogrulanmamis",
      sirala: "harcama",
      yon: "desc",
      sayfa: "3",
    });
    expect(p.tab).toBe("inactive");
    expect(p.values).toEqual({
      q: "Ali",
      izin: "var",
      eposta: "dogrulanmamis",
    });
    expect(p.query).toEqual({
      search: "ali",
      digits: "",
      consent: "yes",
      verified: "no",
    });
    expect(p.sort).toEqual({ key: "harcama", dir: "desc" });
    expect(p.page).toBe(3);
    expect(p.narrowed).toBe(true);
  });

  it("drops what it cannot use, and the bare list is not narrowed", () => {
    const p = parseCustomerListParams({
      filter: "everyone",
      izin: "maybe",
      sirala: "telefon",
      sayfa: "-2",
    });
    expect(p.tab).toBeNull();
    expect(p.values).toEqual({});
    expect(p.query).toEqual({
      search: "",
      digits: "",
      consent: "",
      verified: "",
    });
    expect(p.sort).toEqual({ key: "hareket", dir: "desc" });
    expect(p.page).toBe(1);
    expect(p.narrowed).toBe(false);
  });

  it("keeps the old ?filter=members and ?filter=guests links working", () => {
    expect(parseCustomerListParams({ filter: "members" }).tab).toBe("members");
    expect(parseCustomerListParams({ filter: "guests" }).tab).toBe("guests");
  });

  it("the bar and the page agree on the fields", () => {
    expect(
      parseFilters({ q: "x", izin: "yok" }, CUSTOMER_FILTER_FIELDS),
    ).toEqual({ q: "x", izin: "yok" });
  });
});

describe("the search handed to SQL", () => {
  it("is folded the Turkish way, so ismail finds İsmail (PEO-05)", () => {
    // The old filter: "İsmail".toLowerCase() is "i̇smail" (i + U+0307).
    expect("İsmail Yılmaz".toLowerCase().includes("ismail")).toBe(false);
    for (const typed of ["ismail", "İSMAİL", "ISMAIL", "İsmail"]) {
      expect(customerSearch(typed).search, typed).toBe("ismail");
    }
    expect(customerSearch("Irmak").search).toBe("irmak");
    expect(customerSearch("ÇAĞLA").search).toBe("çağla");
  });

  it("escapes LIKE's wildcards", () => {
    expect(customerSearch("50%_a\\b").search).toBe("50\\%\\_a\\\\b");
  });

  it("reads a phone number as its digits", () => {
    expect(customerSearchDigits("0532 123 45 67")).toBe("5321234567");
    expect(customerSearchDigits("+90 (532) 123-45-67")).toBe("5321234567");
    expect(customerSearchDigits("532 12")).toBe("53212");
    expect(customerSearchDigits("123")).toBe("");
    expect(customerSearchDigits("ali 0532")).toBe("");
    expect(customerSearch("").digits).toBe("");
  });

  it("SQL folds with the same letters as foldTr", () => {
    // admin_fold_tr writes U+0307 as chr(775): an invisible character in
    // the file would not survive an editor.
    const from = TR_FOLD_SQL_FROM.replace("̇", "");
    expect(TR_FOLD_SQL_FROM.endsWith("̇")).toBe(true);
    expect(MIGRATION).toContain(`'${from}' || chr(775)`);
    expect(MIGRATION).toContain(`'${TR_FOLD_SQL_TO}'`);
    // Every text the search reads goes through it.
    for (const col of ["x.email", "x.name", "x.phone"]) {
      expect(MIGRATION).toContain(`public.admin_fold_tr(${col}) like`);
    }
  });

  it("SQL leaves closed accounts and the till's guest address out (D13)", () => {
    expect(MIGRATION).toMatch(
      /lower\(btrim\(o\."customerEmail"\)\) not like '%@anon\.local'/,
    );
    expect(MIGRATION).toMatch(
      /lower\(btrim\(c\.email\)\) not like '%@anon\.local'/,
    );
    expect(MIGRATION).toContain("<> 'guest@laffogato.local'");
    // The reports' rule: abandoned checkouts and cancellations are no spend.
    expect(MIGRATION).toContain(
      "o.status not in ('pending_payment', 'cancelled') as counts",
    );
  });
});

describe("rows and counts from SQL", () => {
  it("reads bigint columns, which node-postgres returns as strings", () => {
    const row = toCustomerListRow({
      email: "a@b.com",
      name: "A",
      phone: "",
      isMember: true,
      isActive: false,
      emailVerified: true,
      memberSince: "2026-01-01T00:00:00.000Z",
      marketingConsent: false,
      orderCount: "3",
      lifetimeValueMinor: "123456",
      refundedMinor: "0",
      lastOrderAt: "",
      lastActivity: "2026-01-01T00:00:00.000Z",
    });
    expect(row.orderCount).toBe(3);
    expect(row.lifetimeValueMinor).toBe(123_456);
    expect(row.isActive).toBe(false);
  });

  it("keys the counts by tab, a missing tab as zero", () => {
    const counts = toCustomerCounts([
      {
        kind: "all",
        customers: "12",
        orderCount: "30",
        lifetimeValueMinor: "900000",
        refundedMinor: "5000",
      },
      { kind: "members", customers: "7", orderCount: "20" },
      { kind: "bogus", customers: "99" },
    ]);
    expect(counts.all).toEqual({
      customers: 12,
      orderCount: 30,
      lifetimeValueMinor: 900_000,
      refundedMinor: 5_000,
      oldestDeletionAt: "",
    });
    expect(counts.members.customers).toBe(7);
    expect(counts.guests.customers).toBe(0);
    expect(counts.inactive.customers).toBe(0);
    expect(counts.deletion.customers).toBe(0);
  });
});

// ── The page ────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  rows: [] as CustomerListRow[],
  counts: null as CustomerCounts | null,
  denied: false,
  reads: [] as string[],
  pageInput: null as unknown,
}));

vi.mock("next/link", () => ({
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async (section: string) => {
    h.reads.push(`gate:${section}`);
    if (h.denied) throw new Error("NEXT_REDIRECT");
    return { email: "kosk@laffogato", role: "manager", expiresAt: 0 };
  }),
}));
vi.mock("@/lib/admin/customer-list", () => ({
  listCustomerPage: vi.fn(async (input: unknown) => {
    h.reads.push("page");
    h.pageInput = input;
    return h.rows;
  }),
  countCustomers: vi.fn(async () => {
    h.reads.push("counts");
    return h.counts;
  }),
}));

const { default: CustomersPage } = await import("@/app/admin/musteriler/page");

function totals(customers: number, orderCount = 0, value = 0, refunded = 0) {
  return {
    customers,
    orderCount,
    lifetimeValueMinor: value,
    refundedMinor: refunded,
    oldestDeletionAt: "",
  };
}

function customer(over: Partial<CustomerListRow>): CustomerListRow {
  return {
    email: "ayse@ornek.com",
    name: "Ayşe Yılmaz",
    phone: "0532 000 00 00",
    isMember: true,
    isActive: true,
    emailVerified: true,
    memberSince: "2026-03-01T09:00:00.000Z",
    marketingConsent: false,
    orderCount: 4,
    lifetimeValueMinor: 128_000,
    refundedMinor: 0,
    lastOrderAt: "2026-10-01T09:00:00.000Z",
    lastActivity: "2026-10-01T09:00:00.000Z",
    deletionRequestedAt: "",
    ...over,
  };
}

async function render(
  sp: Record<string, string> = {},
): Promise<{ html: string; text: string }> {
  const el = await CustomersPage({ searchParams: Promise.resolve(sp) });
  const html = renderToStaticMarkup(el);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return { html, text };
}

beforeEach(() => {
  h.rows = [];
  h.counts = {
    all: totals(0),
    members: totals(0),
    guests: totals(0),
    inactive: totals(0),
    deletion: totals(0),
  };
  h.denied = false;
  h.reads = [];
  h.pageInput = null;
});

describe("Müşteriler page", () => {
  it("checks the customers gate before it reads anyone", async () => {
    h.denied = true;
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
    expect(h.reads).toEqual(["gate:customers"]);
  });

  it("asks for one page of the tab, filters and sort in the URL", async () => {
    await render({
      filter: "guests",
      q: "İsmail",
      sirala: "ad",
      yon: "asc",
      sayfa: "2",
    });
    expect(h.pageInput).toEqual({
      query: { search: "ismail", digits: "", consent: "", verified: "" },
      kind: "guests",
      sort: { key: "ad", dir: "asc" },
      page: 2,
      pageSize: 50,
    });
  });

  it("draws the rows on the kit table with tabs, counts and pages", async () => {
    h.rows = [
      customer({}),
      customer({
        email: "misafir@ornek.com",
        name: "",
        phone: "",
        isMember: false,
        emailVerified: false,
        memberSince: "",
        orderCount: 1,
        lifetimeValueMinor: 15_000,
      }),
      customer({
        email: "pasif@ornek.com",
        name: "Pasif Üye",
        isActive: false,
        emailVerified: false,
        orderCount: 0,
        lifetimeValueMinor: 0,
        lastOrderAt: "",
        lastActivity: "2026-03-01T09:00:00.000Z",
      }),
    ];
    h.counts = {
      all: totals(123, 40, 2_000_000, 10_000),
      members: totals(80, 30, 1_500_000),
      guests: totals(43, 10, 500_000),
      inactive: totals(2),
      deletion: totals(0),
    };
    const { html, text } = await render();
    // Tabs carry the counts of the filtered list.
    expect(text).toMatch(/Tümü 123/);
    expect(text).toMatch(/Üyeler 80/);
    expect(text).toMatch(/Misafirler 43/);
    expect(text).toMatch(/Pasif 2/);
    // Tiles in the same scope as the tab: this tab, these filters.
    expect(text).toContain("Müşteri 123");
    expect(text).toContain("Ödenen sipariş 40");
    expect(text).toContain("Toplam harcama ₺20.000,00");
    expect(text).toContain("İade ₺100,00");
    // The pager counts the whole tab, not the page.
    expect(text).toContain("1-50 / 123");
    expect(html).toContain('href="/admin/musteriler?sayfa=3"');
    // Each row opens its member page.
    expect(html).toContain('href="/admin/musteriler/ayse%40ornek.com"');
    expect(html).toContain('href="/admin/musteriler/misafir%40ornek.com"');
    // Badges: the kit pill (10 px, AA tones), only the exceptions.
    expect(text).toContain("Misafir");
    expect(text).toContain("Pasif");
    expect(text).toContain("Doğrulanmamış");
    expect(html).not.toMatch(/text-\[9px\]/);
    // Sortable headers keep the other params.
    expect(html).toContain("sirala=harcama&amp;yon=desc");
    // A member without orders says so instead of a blank.
    expect(text).toContain("üye oldu, sipariş yok");
    // The menu reaches the orders and the edit form.
    expect(html).toContain('href="/admin/siparisler?q=ayse%40ornek.com"');
    expect(html).toContain('href="/admin/musteriler/ayse%40ornek.com/duzenle"');
    expect(html).not.toContain(
      'href="/admin/musteriler/misafir%40ornek.com/duzenle"',
    );
  });

  it("speaks Turkish and uses the panel's tokens (PEO-17, PEO-18, PEO-21)", async () => {
    h.rows = [customer({})];
    h.counts!.all = totals(1, 4, 128_000);
    const { html, text } = await render();
    expect(text).not.toMatch(/Lifetime value/i);
    expect(html).not.toMatch(
      /\b(?:text|bg|border)-(?:neutral|blue|green|amber|orange)-\d/,
    );
    // No action column headed by a bare dash (PEO-20).
    expect(html).not.toMatch(/<th[^>]*>-<\/th>/);
    expect(html).toContain('<span class="sr-only">İşlemler</span>');
  });

  it("says why the list is empty", async () => {
    expect((await render()).text).toContain(
      "Henüz üye hesabı ya da sipariş yok.",
    );
    const narrowed = await render({ q: "kimse" });
    expect(narrowed.text).toContain("Bu süzgece uyan müşteri yok.");
    expect(narrowed.html).toContain("Süzgeçleri temizle");
    // Past the last page of a tab that has rows.
    h.counts!.all = totals(10);
    const past = await render({ sayfa: "9" });
    expect(past.text).toContain("Bu sayfada müşteri yok.");
    expect(past.html).toContain('href="/admin/musteriler"');
  });
});
