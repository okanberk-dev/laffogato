import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A promo code's orders, for its view page (admin audit PEO-24): the list
 * said "12/50" and nothing showed which orders the twelve were. The read
 * matches the code as the order stored it, newest first, a page of rows
 * plus a count of all of them, and only the columns the row shows.
 */

type Call = [string, ...unknown[]];

const h = vi.hoisted(() => ({
  queries: [] as Array<{ table: string; calls: Call[] }>,
  rows: [] as Record<string, unknown>[],
  count: 0,
  error: null as { code: string; message: string } | null,
}));

vi.mock("@/lib/db", () => {
  function chain(table: string) {
    const q = { table, calls: [] as Call[] };
    h.queries.push(q);
    const self: Record<string, unknown> = {};
    for (const name of ["select", "eq", "order", "limit"]) {
      self[name] = (...args: unknown[]) => {
        q.calls.push([name, ...args]);
        return self;
      };
    }
    self.then = (resolve: (v: unknown) => void) => {
      const head = q.calls.some(
        (c) => c[0] === "select" && (c[2] as { head?: boolean })?.head,
      );
      resolve(
        head
          ? { data: null, count: h.count, error: h.error, status: 200 }
          : { data: h.rows, error: h.error, status: 200 },
      );
    };
    return self;
  }
  return {
    TABLES: { orders: "orders" },
    getDb: () => ({ from: chain }),
  };
});

const { listPromoOrders, PROMO_ORDERS_LIMIT } =
  await import("@/lib/admin/promo-usage");

beforeEach(() => {
  h.queries = [];
  h.rows = [];
  h.count = 0;
  h.error = null;
});

describe("listPromoOrders", () => {
  it("reads the code's orders newest first, and counts them all", async () => {
    h.rows = [
      {
        id: "ord-9",
        orderNo: 10009,
        status: "paid",
        fulfillment: "pickup",
        discountMinor: "2500",
        totalMinor: 7500,
        createdAt: "2026-10-02T09:00:00.000Z",
        customerEmail: "should-not-be-read@ornek.com",
      },
    ];
    h.count = 31;
    const out = await listPromoOrders("YAZ25");
    expect(out.total).toBe(31);
    expect(out.rows).toEqual([
      {
        id: "ord-9",
        orderNo: 10009,
        status: "paid",
        fulfillment: "pickup",
        discountMinor: 2500,
        totalMinor: 7500,
        createdAt: "2026-10-02T09:00:00.000Z",
      },
    ]);
    const [list, count] = h.queries;
    expect(list.table).toBe("orders");
    expect(list.calls).toContainEqual(["eq", "promoCode", "YAZ25"]);
    expect(list.calls).toContainEqual([
      "order",
      "createdAt",
      { ascending: false },
    ]);
    expect(list.calls).toContainEqual(["limit", PROMO_ORDERS_LIMIT]);
    // No name, e-mail or address in what the page reads.
    const columns = String(list.calls.find((c) => c[0] === "select")?.[1]);
    expect(columns).not.toMatch(/customer|address|phone|email/i);
    expect(count.calls).toContainEqual(["eq", "promoCode", "YAZ25"]);
  });

  it("asks nothing for an empty code", async () => {
    await expect(listPromoOrders("")).resolves.toEqual({ rows: [], total: 0 });
    expect(h.queries).toHaveLength(0);
  });

  it("throws on a database error, so the page can say the read failed", async () => {
    h.error = { code: "57P01", message: "terminating connection" };
    await expect(listPromoOrders("YAZ25")).rejects.toThrow();
  });
});
