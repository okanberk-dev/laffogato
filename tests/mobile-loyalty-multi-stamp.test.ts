import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import { createDb, type Executor } from "@/lib/db/client";

/**
 * Operator, 15 Eki 2026: "alt limit 140 TL ama 140 TL'den 320 TL'ye kadar 1
 * tane sayılsın, damga toplam miktar ile hesaplansın". A paid app cafe order
 * now writes ONE earn row whose delta is its stamp count; these tests run the
 * ledger wiring (`./loyalty.ts`) against an in-memory `loyalty_stamps` that
 * keeps Postgres' two guarantees - the primary key and the partial unique
 * index on an order's `earn` row.
 */

type Row = {
  id: string;
  customerEmail: string;
  kind: string;
  delta: number;
  source: string;
  orderId: string;
  note: string;
  actor: string;
  createdAt: string;
};

const ledger: Row[] = [];
let seq = 0;

function duplicate(): never {
  throw Object.assign(new Error("duplicate key"), { code: "23505" });
}

const exec: Executor = async ({ text, params }) => {
  if (/next_seq/.test(text)) {
    seq += 1;
    return { rows: [{ result: seq }], rowCount: 1 };
  }
  if (/^SELECT .* FROM "loyalty_stamps"/.test(text)) {
    return { rows: ledger.map((r) => ({ ...r })), rowCount: ledger.length };
  }
  if (/^INSERT INTO "loyalty_stamps"/.test(text)) {
    const cols = Array.from(
      text.slice(text.indexOf("(") + 1, text.indexOf(")")).matchAll(/"(\w+)"/g),
      (m) => m[1],
    );
    const row = Object.fromEntries(
      cols.map((c, i) => [c, params[i]]),
    ) as unknown as Row;
    row.delta = Number(row.delta);
    if (ledger.some((r) => r.id === row.id)) duplicate();
    if (
      row.kind === "earn" &&
      row.orderId &&
      ledger.some((r) => r.kind === "earn" && r.orderId === row.orderId)
    ) {
      duplicate();
    }
    ledger.push(row);
    return { rows: [], rowCount: 1 };
  }
  if (/^DELETE FROM "loyalty_stamps"/.test(text)) {
    const at = ledger.findIndex((r) => r.id === params[0]);
    if (at >= 0) ledger.splice(at, 1);
    return { rows: [], rowCount: at >= 0 ? 1 : 0 };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({ mobileApp: DEFAULT_MOBILE_APP_CONFIG })),
  customerLoyaltyOrders: vi.fn(async () => []),
  orderChannel: (o: { channel?: string }) => o.channel ?? "web",
  orderKind: (o: { kind?: string }) => o.kind ?? "shop",
}));

const grantFreeDrinkCoupon = vi.fn(async () => ({ id: "cpn-0001" }));
vi.mock("@/lib/mobile/free-drink", () => ({
  FREE_DRINK_REWARD: {},
  grantFreeDrinkCoupon,
}));
const grantMilestoneGifts = vi.fn(async () => []);
vi.mock("@/lib/mobile/milestones", () => ({ grantMilestoneGifts }));
vi.mock("@/lib/mobile/invite", () => ({
  rewardInviteOnFirstPaidOrder: vi.fn(async () => undefined),
}));

const {
  onOrderPaid,
  onOrderReversed,
  redeemStamps,
  getLoyalty,
  getOrderStamps,
  addCounterStamp,
} = await import("@/lib/mobile/loyalty");

const MEMBER = "eda@example.com";
const TARGET = DEFAULT_MOBILE_APP_CONFIG.loyalty.stampTarget;

function order(
  id: string,
  totalMinor: number,
  shippingMinor = 0,
  extra: Partial<Record<"channel" | "kind", string>> = {},
): AdminOrder {
  return {
    id,
    orderNo: 10000 + Number(id.replace(/\D/g, "")),
    customerEmail: MEMBER,
    totalMinor,
    shippingMinor,
    discountMinor: 0,
    channel: "app",
    kind: "cafe",
    ...extra,
  } as unknown as AdminOrder;
}

beforeEach(() => {
  ledger.length = 0;
  seq = 0;
  grantFreeDrinkCoupon.mockClear();
  grantMilestoneGifts.mockClear();
});

describe("onOrderPaid writes the order's stamp count", () => {
  it("writes one earn row per order whose delta follows the ₺320 step", async () => {
    await onOrderPaid(order("ord-1", 13999));
    await onOrderPaid(order("ord-2", 14000));
    await onOrderPaid(order("ord-3", 32000));
    await onOrderPaid(order("ord-4", 32001));
    await onOrderPaid(order("ord-5", 64001));
    expect(ledger.map((r) => [r.orderId, r.kind, r.delta])).toEqual([
      ["ord-2", "earn", 1],
      ["ord-3", "earn", 1],
      ["ord-4", "earn", 2],
      ["ord-5", "earn", 3],
    ]);
  });

  it("does not count the courier fee", async () => {
    // ₺300 of goods + ₺55 courier = ₺355 paid: one stamp, not two.
    await onOrderPaid(order("ord-6", 35500, 5500));
    expect(ledger.map((r) => r.delta)).toEqual([1]);
  });

  it("earns nothing on a shop or web order, whatever its size", async () => {
    await onOrderPaid(order("ord-7", 90000, 0, { kind: "shop" }));
    await onOrderPaid(order("ord-8", 90000, 0, { channel: "web" }));
    expect(ledger).toEqual([]);
  });

  it("is idempotent on the order: a second webhook writes nothing", async () => {
    await onOrderPaid(order("ord-9", 70000));
    await onOrderPaid(order("ord-9", 70000));
    expect(ledger.map((r) => r.delta)).toEqual([3]);
    expect((await getOrderStamps(MEMBER)).get("ord-9")).toBe(3);
  });
});

describe("reversing a multi-stamp order", () => {
  it("takes back exactly what the order earned, once", async () => {
    await onOrderPaid(order("ord-1", 20000)); // 1
    const big = order("ord-2", 70000); // 3
    await onOrderPaid(big);
    expect((await getLoyalty(MEMBER)).stamps).toBe(4);

    await Promise.all([onOrderReversed(big), onOrderReversed(big)]);
    const reversals = ledger.filter((r) => r.kind === "reversal");
    expect(reversals).toHaveLength(1);
    expect(reversals[0]).toMatchObject({ orderId: "ord-2", delta: -3 });
    const after = await getLoyalty(MEMBER);
    expect(after.stamps).toBe(1);
    expect(after.lifetimeStamps).toBe(1);
    expect((await getOrderStamps(MEMBER)).has("ord-2")).toBe(false);
  });

  it("still takes back one stamp for an order stamped under the old rule", async () => {
    ledger.push({
      id: "stamp-000900",
      customerEmail: MEMBER,
      kind: "earn",
      delta: 1,
      source: "order",
      orderId: "ord-old",
      note: "",
      actor: "",
      createdAt: "2026-10-01T10:00:00.000Z",
    });
    await onOrderReversed(order("ord-old", 90000));
    expect(ledger.find((r) => r.kind === "reversal")?.delta).toBe(-1);
  });
});

describe("a multi-stamp order crossing the card", () => {
  it("fills one card and carries the remainder", async () => {
    // 5 till stamps (one per scan), then a ₺700 order: 5 + 3 = 8 → one full
    // card of 6, 2 on the next.
    for (let i = 0; i < 5; i += 1) await addCounterStamp(MEMBER, "kasa@x.com");
    expect(ledger.every((r) => r.delta === 1)).toBe(true);
    await onOrderPaid(order("ord-1", 70000));
    const view = await getLoyalty(MEMBER);
    expect(view).toMatchObject({ stamps: 2, rewardsReady: 1, lifetimeStamps: 8 });
    // Milestones are read from the new lifetime count after the order.
    expect(grantMilestoneGifts).toHaveBeenLastCalledWith(MEMBER, 8);
  });

  it("issues one coupon per full card when one order fills two", async () => {
    // ₺4.000 of goods = ceil(400000 / 32000) = 13 stamps → 2 cards of 6, 1 over.
    await onOrderPaid(order("ord-2", 400000));
    expect(ledger[0].delta).toBe(13);
    expect((await getLoyalty(MEMBER)).rewardsReady).toBe(2);

    const first = await redeemStamps(MEMBER);
    const second = await redeemStamps(MEMBER);
    const third = await redeemStamps(MEMBER);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third).toEqual({
      ok: false,
      error: "not_enough_stamps",
      stampTarget: TARGET,
    });
    expect(grantFreeDrinkCoupon).toHaveBeenCalledTimes(2);
    expect(await getLoyalty(MEMBER)).toMatchObject({
      stamps: 1,
      rewardsReady: 0,
      lifetimeStamps: 13,
    });
    expect(grantMilestoneGifts).toHaveBeenCalledWith(MEMBER, 13);
  });
});
