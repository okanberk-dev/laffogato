import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { compile } from "@/lib/db/sql";

/**
 * How the app reads a member's orders - the hottest query in the product.
 *
 * `/me`, `/orders`, `/notifications` and the open-order count on the checkout
 * path all resolve to one query on `orders`. Two things were wrong with it at
 * once, and the second hid the first:
 *
 *   1. It matched with `ILIKE`. `orders_email_idx` is on
 *      `lower("customerEmail")`, and Postgres has no btree opclass for `~~*`,
 *      so the planner could never use it: every member order read was a
 *      sequential scan of the whole table.
 *   2. Two callers read the member's ENTIRE history with `select *` - items,
 *      refund ledger and consent evidence - and threw most of it away in
 *      JavaScript.
 */

const store = readFileSync(
  join(process.cwd(), "src/lib/admin/store.ts"),
  "utf8",
);
const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");

describe("the compiled case-insensitive match", () => {
  it("is equality on lower(col), which is what the index is built on", () => {
    const { text, params } = compile({
      kind: "select",
      table: "orders",
      columns: "*",
      filters: [
        { op: "ieq", column: "customerEmail", value: "Ayse@Example.com" },
      ],
      orders: [],
      limit: null,
      count: null,
      head: false,
    });
    expect(text).toContain('lower("customerEmail") = lower($1)');
    expect(text).not.toContain("ILIKE");
    expect(params).toEqual(["Ayse@Example.com"]);
  });

  it("still quotes the identifier rather than escaping it", () => {
    expect(() =>
      compile({
        kind: "select",
        table: "orders",
        columns: "*",
        filters: [
          { op: "ieq", column: "customerEmail; drop table orders", value: "x" },
        ],
        orders: [],
        limit: null,
        count: null,
        head: false,
      }),
    ).toThrow(/unsafe column identifier/);
  });

  it("matches the index expression in the schema verbatim", () => {
    expect(schema).toContain(
      'create index if not exists orders_email_idx on public.orders (lower("customerEmail"));',
    );
  });
});

describe("customerOrdersByEmail", () => {
  const body = store.slice(
    store.indexOf("async function readCustomerOrders"),
    store.indexOf("export async function getOrder("),
  );

  it("filters with ieq, not with an ILIKE prefilter", () => {
    expect(body).toContain('.ieq("customerEmail", needle)');
    expect(body).not.toContain("ilike");
  });

  it("drops the JavaScript re-filter the prefilter needed", () => {
    // `lower(col) = lower($1)` IS the exact match, so the second pass in JS -
    // and the `%_` escaping that fed it - are gone.
    expect(body).not.toContain("o.customerEmail?.trim().toLowerCase()");
    expect(body).not.toContain("replace(/[%_]/g");
  });

  it("keeps the limit in SQL", () => {
    expect(body).toContain("if (limit && limit > 0) q = q.limit(limit)");
  });
});

describe("reads that do not need the whole row", () => {
  it("gives the loyalty view three columns instead of select *", () => {
    const loyalty = readFileSync(
      join(process.cwd(), "src/lib/mobile/loyalty.ts"),
      "utf8",
    );
    // The tier counts a rolling year and `orders-50` counts a lifetime, so
    // this read cannot be paged - it can be narrowed.
    expect(loyalty).toContain("customerLoyaltyOrders(owner)");
    expect(loyalty).not.toContain("customerOrdersByEmail");
    expect(store).toContain('"status, createdAt, items"');
  });

  it("gives the notification inbox a page instead of the whole history", () => {
    const notifications = readFileSync(
      join(process.cwd(), "src/lib/mobile/notifications.ts"),
      "utf8",
    );
    expect(notifications).toContain(
      "customerOrdersByEmail(email, NOTIFICATION_ORDER_LIMIT)",
    );
  });
});
