import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { bulkRefusal } from "@/lib/admin/order-actions";
import * as storeModule from "@/lib/admin/store";
import {
  BULK_ORDER_TRANSITIONS,
  isPublishWindowOpen,
  isReportableOrder,
  parsePublishInstant,
  toDateTimeLocalInput,
} from "@/lib/admin/store";
import { bulkOrderSchema } from "@/lib/admin/bulk-schema";
import {
  evaluateCoupon,
  type CustomerCoupon,
} from "@/lib/customer/coupon-utils";

const storeSource = readFileSync("src/lib/admin/store.ts", "utf8");

describe("publish windows", () => {
  it("reads a panel-typed wall clock as Istanbul time, not as the server's", () => {
    // Vercel runs in UTC, so "23:59" meaning Istanbul midnight used to drop
    // the post at 02:59 the next morning.
    expect(parsePublishInstant("2026-09-30T23:59")).toBe(
      Date.parse("2026-09-30T20:59:00.000Z"),
    );
    expect(parsePublishInstant("2026-09-05T09:00:00")).toBe(
      Date.parse("2026-09-05T06:00:00.000Z"),
    );
  });

  it("takes an explicit offset as written", () => {
    expect(parsePublishInstant("2026-09-30T20:59:00.000Z")).toBe(
      Date.parse("2026-09-30T20:59:00.000Z"),
    );
  });

  it("reports text that is not a time as no time at all", () => {
    expect(parsePublishInstant("30.09.2026")).toBeNull();
    expect(parsePublishInstant("yakında")).toBeNull();
    expect(parsePublishInstant("  ")).toBeNull();
  });

  it("fails closed on an unparsable bound instead of publishing forever", () => {
    const now = Date.parse("2026-09-05T09:00:00.000Z");
    // NaN compares false both ways, so a mistyped Bitiş used to read as
    // "no end date" and left the campaign live for good.
    expect(
      isPublishWindowOpen({ startsAt: "", endsAt: "30.09.2026" }, now),
    ).toBe(false);
    expect(isPublishWindowOpen({ startsAt: "yakında", endsAt: "" }, now)).toBe(
      false,
    );
  });

  it("round-trips a stored instant back into the panel's datetime input", () => {
    // The three /admin/mobil forms are <input type="datetime-local">, which
    // speaks the local wall clock; the column holds a UTC instant. What the
    // form shows must be what the store would write again unchanged.
    expect(toDateTimeLocalInput("2026-09-30T20:59:00.000Z")).toBe(
      "2026-09-30T23:59",
    );
    expect(
      parsePublishInstant(toDateTimeLocalInput("2026-09-30T20:59:00.000Z")),
    ).toBe(Date.parse("2026-09-30T20:59:00.000Z"));
  });

  it("shows an empty field rather than text the input cannot hold", () => {
    expect(toDateTimeLocalInput("")).toBe("");
    expect(toDateTimeLocalInput("30.09.2026")).toBe("");
  });

  it("publishes inside the window and nowhere else", () => {
    const now = Date.parse("2026-09-05T09:00:00.000Z");
    const row = {
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-09-30T00:00:00.000Z",
    };
    expect(isPublishWindowOpen(row, now)).toBe(true);
    expect(isPublishWindowOpen({ startsAt: "", endsAt: "" }, now)).toBe(true);
    expect(
      isPublishWindowOpen(
        { ...row, startsAt: "2026-09-06T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
    // endsAt before startsAt is never open.
    expect(
      isPublishWindowOpen(
        {
          startsAt: "2026-09-30T00:00:00.000Z",
          endsAt: "2026-09-01T00:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("reports", () => {
  it("does not book an abandoned checkout as revenue", () => {
    // Every app order starts pending_payment and stays there for up to 45
    // minutes; twenty abandoned ones used to add twenty orders and their
    // full totals to "Net ciro".
    expect(isReportableOrder({ status: "pending_payment" })).toBe(false);
    expect(isReportableOrder({ status: "cancelled" })).toBe(false);
    expect(isReportableOrder({ status: "paid" })).toBe(true);
    expect(isReportableOrder({ status: "preparing" })).toBe(true);
    expect(isReportableOrder({ status: "shipped" })).toBe(true);
    expect(isReportableOrder({ status: "completed" })).toBe(true);
    // A refunded order keeps its row; the refund ledger is subtracted from it.
    expect(isReportableOrder({ status: "refunded" })).toBe(true);
  });
});

describe("bulk status change", () => {
  it("offers only statuses the transition machine can reach", () => {
    expect(Object.keys(BULK_ORDER_TRANSITIONS).sort()).toEqual([
      "cancelled",
      "completed",
      "preparing",
      "shipped",
    ]);
  });

  it("keeps `paid` and `refunded` out - they owe a ledger row", () => {
    expect(BULK_ORDER_TRANSITIONS.paid).toBeUndefined();
    expect(BULK_ORDER_TRANSITIONS.refunded).toBeUndefined();
  });

  it("accepts at the request boundary exactly what the store can reach", () => {
    // bulk-schema.ts cannot import the server-only store, so the two lists are
    // written separately; this is what keeps them from drifting apart.
    const reachable = Object.keys(BULK_ORDER_TRANSITIONS).sort();
    for (const status of reachable) {
      expect(
        bulkOrderSchema.safeParse({
          ids: "ord-1",
          op: "set_status",
          value: status,
        }).success,
      ).toBe(true);
    }
    for (const status of ["pending_payment", "paid", "refunded"]) {
      expect(
        bulkOrderSchema.safeParse({
          ids: "ord-1",
          op: "set_status",
          value: status,
        }).success,
      ).toBe(false);
    }
  });

  it("goes through the order page's own operations rather than writing the column", () => {
    // The raw `update({ status }).in("id", ids)` left the stock claimed, the
    // coupon burned and the loyalty stamp standing on a bulk cancel.
    const ops = readFileSync("src/lib/admin/order-ops.ts", "utf8");
    const body = ops.slice(ops.indexOf("export async function runBulkOrderAction"));
    expect(body).toContain("bulkRefusal(order, op, actor.role");
    expect(body).toContain("await cancelOrder(");
    expect(body).toContain("await moveOrder(id, op, actor)");
    expect(body).not.toContain(".update(");
    expect("bulkUpdateOrders" in storeModule).toBe(false);
  });

  it("gives the stock back when a manual order fails after the claim", () => {
    // placeOrder already did; createManualOrder left the units claimed.
    const body = storeSource.slice(
      storeSource.indexOf("export async function createManualOrder"),
      storeSource.indexOf("export interface AppCafeLineInput"),
    );
    expect(body.indexOf("claimOrderStock(resolved)")).toBeLessThan(
      body.indexOf("} catch (err) {"),
    );
    expect(body).toContain("await releaseClaimedStock(resolved);");
  });

  it("does not settle unpaid orders with a bulk 'hazırlanıyor'", () => {
    // start_preparing from pending_payment stamps paidAt, awards the stamp
    // and counts revenue - a bulk "paid" by another name.
    expect(
      bulkRefusal(
        { status: "pending_payment", totalMinor: 100, refunds: [] },
        "start_preparing",
        "owner",
        false,
      ),
    ).toBe("ödemesi alınmadı");
  });

  it("refuses 'Hazırlamaya başla' on an unpaid order in the store itself", () => {
    // Every caller, not only the panel: the move settles the order.
    const body = storeSource.slice(
      storeSource.indexOf("export async function transitionOrder("),
      storeSource.indexOf("async function noticeCancelled"),
    );
    expect(body).toContain('transition === "start_preparing" &&');
    expect(body).toContain("opts.paymentReceived !== true");
  });

  it("answers an empty or unknown bulk choice in Turkish", () => {
    const empty = bulkOrderSchema.safeParse({ ids: "ord-1", op: "set_status", value: "" });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe("Bir işlem seç.");
    const none = bulkOrderSchema.safeParse({ ids: " , ", op: "set_status", value: "completed" });
    expect(none.error?.issues[0]?.message).toBe("Hiç kayıt seçilmedi.");
  });
});

describe("manual orders and the 45-minute sweep", () => {
  it("marks a panel order as manual and keeps the sweep away from it", () => {
    // A manual "Ödeme bekleniyor" order (a phone order paid on delivery) has
    // no POS payment to wait for; the sweep cancelled it and handed its
    // stock back without telling anyone.
    const create = storeSource.slice(
      storeSource.indexOf("export async function createManualOrder"),
      storeSource.indexOf("export interface AppCafeLineInput"),
    );
    expect(create).toContain('source: "manual"');
    const sweep = storeSource.slice(
      storeSource.indexOf("export async function expireStalePendingOrders"),
      storeSource.indexOf("export async function supersedeUnpaidWebOrders"),
    );
    expect(sweep).toContain('.neq("source", "manual")');
    const supersede = storeSource.slice(
      storeSource.indexOf("export async function supersedeUnpaidWebOrders"),
      storeSource.indexOf("export async function isOwnUnpaidWebOrder"),
    );
    expect(supersede).toContain('order.source !== "manual"');
  });

  it("backfills the manual orders written before the column", () => {
    const migration = readFileSync(
      "db/migrations/20261017100000_admin_order_management.sql",
      "utf8",
    );
    expect(migration).toContain("add column if not exists source text not null default ''");
    expect(migration).toMatch(/set source = 'manual'[\s\S]*payload ->> 'manual' = 'true'/);
  });
});

function coupon(overrides: Partial<CustomerCoupon> = {}): CustomerCoupon {
  return {
    id: "cpn-1",
    customerEmail: "eda@example.com",
    code: "HOSGELDIN10",
    title: "Hoş geldin",
    kind: "pct",
    value: 10,
    minSubtotalMinor: 30000,
    source: "welcome",
    expiresAt: "",
    redeemedAt: "",
    redeemedOrderNo: 0,
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("money in messages the app shows verbatim", () => {
  it("prints the min spend the way the app prints every other price", () => {
    // "300.00 ₺" sat under a summary that said "250₺": English decimal point,
    // stray space, and two currency styles on one screen.
    const result = evaluateCoupon(coupon(), 25000, Date.parse("2026-09-05"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Bu kupon için en az 300₺ alışveriş gerek.");
    }
  });

  it("leaves no toFixed money in the store's customer-facing text", () => {
    expect(storeSource).not.toContain("toFixed(2)} ₺");
  });
});
