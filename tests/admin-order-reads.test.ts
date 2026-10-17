import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * WP1: the admin screens read the orders they show, not the orders table.
 *
 * Five admin readers went through one `listOrders()` - every order, every
 * column, including the items, refund ledger and consent evidence jsonb.
 * Measured on a local Postgres with 20k orders: 596 ms and 27 MB of JSON per
 * call. The dashboard used it for five rows, the order list rendered all of
 * it into a client component, the customer roll-up and the three report
 * figures used a handful of columns each (and the report page called it three
 * times per view).
 *
 * Driven through the real query builder, so what is asserted is the SQL that
 * would run.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
let orderRows: Record<string, unknown>[] = [];

const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 250 }], rowCount: 1 };
  if (/FROM "orders"/.test(text)) {
    return { rows: orderRows, rowCount: orderRows.length };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");
const { parseOrderListParams, withoutStatuses } = await import(
  "@/lib/admin/order-filters"
);

function orderSelects(): string[] {
  return seen
    .map((q) => q.text)
    .filter((t) => /^SELECT /.test(t) && /FROM "orders"/.test(t))
    .filter((t) => !/count\(\*\)/i.test(t));
}

function row(orderNo: number): Record<string, unknown> {
  return {
    id: `ord-${orderNo}`,
    orderNo,
    status: "paid",
    customerEmail: `m${orderNo}@example.com`,
    customerName: "Üye",
    customerPhone: "",
    totalMinor: 10_000,
    refunds: [],
    items: [],
    createdAt: "2026-10-01T10:00:00.000Z",
  };
}

beforeEach(() => {
  seen.length = 0;
  orderRows = [];
});

describe("dashboard: five recent orders", () => {
  it("asks the database for five rows", async () => {
    orderRows = [row(10005), row(10004)];
    const recent = await store.listRecentOrders(5);
    expect(recent).toHaveLength(2);
    const [sql] = orderSelects();
    expect(sql).toMatch(/ORDER BY "orderNo" DESC LIMIT \$\d+$/);
    const q = seen.find((s) => s.text === sql)!;
    expect(q.params.at(-1)).toBe(5);
  });

  it("the page reads it instead of the whole table", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/admin/page.tsx"),
      "utf8",
    );
    expect(page).toContain("listRecentOrders(5)");
    expect(page).not.toMatch(/listOrders\(\)/);
  });
});

describe("order list: one filtered, numbered page", () => {
  const base = {
    query: parseOrderListParams({}).query,
    sort: { column: "orderNo" as const, ascending: false },
    page: 1,
    pageSize: 50,
  };

  it("reads one page with LIMIT and OFFSET, and counts the matches", async () => {
    orderRows = [row(10010), row(10009)];
    const page = await store.listOrdersFiltered({ ...base, page: 3 });
    expect(page.orders.map((o) => o.orderNo)).toEqual([10010, 10009]);
    expect(page.total).toBe(250);
    const [sql] = orderSelects();
    expect(sql).toMatch(/ORDER BY "orderNo" DESC LIMIT \$\d+ OFFSET \$\d+$/);
    const q = seen.find((s) => s.text === sql)!;
    expect(q.params.slice(-2)).toEqual([50, 100]);
  });

  it("breaks ties by order number so a page boundary never repeats a row", async () => {
    await store.listOrdersFiltered({
      ...base,
      sort: { column: "totalMinor", ascending: true },
    });
    const [sql] = orderSelects();
    expect(sql).toContain('ORDER BY "totalMinor" ASC, "orderNo" DESC');
  });

  it("searches number, name and e-mail in one box, with % and _ taken literally", async () => {
    const { query } = parseOrderListParams({ q: "%50_ #" });
    await store.listOrdersFiltered({ ...base, query });
    const [sql] = orderSelects();
    expect(sql).toMatch(/\("customerName" ILIKE \$\d+ OR "customerEmail" ILIKE \$\d+\)/);
    const q = seen.find((s) => s.text === sql)!;
    expect(q.params).toContain("%\\%50\\_ #%");
    seen.length = 0;
    const byNo = parseOrderListParams({ q: "#10023" }).query;
    await store.listOrdersFiltered({ ...base, query: byNo });
    const [sql2] = orderSelects();
    expect(sql2).toMatch(/\("orderNo" = \$\d+ OR "customerName" ILIKE/);
    expect(seen.find((s) => s.text === sql2)!.params).toContain(10023);
  });

  it("turns every filter into SQL, and the count runs the same WHERE", async () => {
    const { query } = parseOrderListParams({
      durum: "acik",
      kanal: "manuel",
      tur: "shop",
      teslimat: "shipping",
      odeme: "iadeli",
      dikkat: "1",
      bas: "2026-10-01",
      bit: "2026-10-02",
    });
    await store.listOrdersFiltered({ ...base, query });
    const [sql] = orderSelects();
    expect(sql).toContain('"status" IN (');
    expect(sql).toContain('"source" = $');
    expect(sql).toContain('"kind" = $');
    expect(sql).toContain('"fulfillment" = $');
    expect(sql).toContain('"refunds" <> $');
    expect(sql).toContain('"attention" <> $');
    expect(sql).toContain('"createdAt" >= $');
    expect(sql).toContain('"createdAt" < $');
    const q = seen.find((s) => s.text === sql)!;
    // Istanbul days (UTC+3): 1 Oct starts at 30 Sep 21:00Z; 2 Oct runs to 2 Oct 21:00Z.
    expect(q.params).toContain("2026-09-30T21:00:00.000Z");
    expect(q.params).toContain("2026-10-02T21:00:00.000Z");
    const count = seen.find((s) => /count\(\*\)/i.test(s.text))!;
    expect(count.text.slice(count.text.indexOf("WHERE"))).toBe(
      sql.slice(sql.indexOf("WHERE"), sql.indexOf(" ORDER BY")),
    );
  });

  it("counts every status tab with the other filters, without the tab's own", async () => {
    const { query } = parseOrderListParams({ durum: "paid", kanal: "app" });
    const counts = await store.countOrdersByStatus(withoutStatuses(query));
    expect(Object.keys(counts).sort()).toEqual(
      ["cancelled", "completed", "paid", "pending_payment", "preparing", "refunded", "shipped"],
    );
    const countSql = seen.filter((s) => /count\(\*\)/i.test(s.text));
    expect(countSql).toHaveLength(7);
    for (const c of countSql) {
      expect(c.text).toContain('"channel" = $');
      expect(c.text).not.toContain('"status" IN');
    }
  });

  it("there is no whole-table order reader left to fall back to", () => {
    expect("listOrders" in store).toBe(false);
    expect("listOrdersPage" in store).toBe(false);
  });
});

describe("customer roll-up and reports read only their columns", () => {
  it("listCustomers projects the six columns it sums", async () => {
    orderRows = [row(10002), row(10001)];
    const customers = await store.listCustomers();
    expect(customers).toHaveLength(2);
    for (const sql of orderSelects()) {
      expect(sql).not.toMatch(/^SELECT \*/);
      expect(sql).not.toContain('"items"');
      expect(sql).not.toContain('"legalConsent"');
    }
  });

  it("the three report figures never select *, and only top products reads items", async () => {
    orderRows = [row(10001)];
    await store.analyticsHeadline();
    await store.revenueBuckets("day", 7);
    const withoutItems = orderSelects();
    expect(withoutItems).toHaveLength(2);
    for (const sql of withoutItems) {
      expect(sql).not.toMatch(/^SELECT \*/);
      expect(sql).not.toContain('"items"');
    }
    seen.length = 0;
    await store.topProducts(5);
    const [top] = orderSelects();
    expect(top).toMatch(/^SELECT "status", "items" FROM "orders"/);
  });
});
