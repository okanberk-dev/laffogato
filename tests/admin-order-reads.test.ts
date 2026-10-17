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

describe("order list: one keyset page", () => {
  it("reads one row more than the page and points at the next page", async () => {
    orderRows = [row(10010), row(10009), row(10008)];
    const page = await store.listOrdersPage({ pageSize: 2 });
    expect(page.orders.map((o) => o.orderNo)).toEqual([10010, 10009]);
    expect(page.nextBefore).toBe(10009);
    expect(page.total).toBe(250);
    const [sql] = orderSelects();
    expect(sql).toMatch(/LIMIT \$\d+$/);
    expect(seen.find((s) => s.text === sql)!.params.at(-1)).toBe(3);
    expect(sql).not.toContain('"orderNo" <');
  });

  it("an older page filters below `before` and ends when nothing is left", async () => {
    orderRows = [row(10008)];
    const page = await store.listOrdersPage({ before: 10009, pageSize: 2 });
    expect(page.nextBefore).toBeNull();
    const [sql] = orderSelects();
    expect(sql).toContain('"orderNo" < $');
    expect(seen.find((s) => s.text === sql)!.params).toContain(10009);
  });

  it("defaults to a bounded page", async () => {
    await store.listOrdersPage({});
    const [sql] = orderSelects();
    expect(seen.find((s) => s.text === sql)!.params.at(-1)).toBe(
      store.ORDERS_PAGE_SIZE + 1,
    );
  });

  it("there is no whole-table order reader left to fall back to", () => {
    expect("listOrders" in store).toBe(false);
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
