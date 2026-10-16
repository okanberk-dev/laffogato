import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder, AdminRefund } from "@/lib/admin/store";
import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import { createDb, type Executor } from "@/lib/db/client";

/**
 * Review of 16 Eki 2026, two defects of the per-320 TL stamp rule:
 *
 * 1. A PARTIAL refund kept every stamp: only a full refund or a cancel
 *    reversed, and any reversal row read as "the whole order is gone". Now
 *    the order's stamps are re-derived after every refund from the goods it
 *    still has (`stampsFor(goods − refunded goods)`), one reversal row per
 *    stamp taken back, idempotent and safe when two refunds land together.
 * 2. A reversal after the stamps had already paid for a free-drink coupon or
 *    a milestone gift left those coupons live while the clamp at 0 hid the
 *    debt. Now the unused ones are taken back (`settleLoyaltyDebt`), a used
 *    one stays used and the next stamps pay the debt off.
 *
 * Runs the real ledger (`loyalty.ts`), coupon (`customer/coupons.ts`),
 * free-drink and milestone modules against an in-memory Postgres that keeps
 * the guarantees they rely on: primary keys, the partial unique index on an
 * order's `earn` row, the unique coupon code and guarded UPDATEs.
 */

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {
  loyalty_stamps: [],
  customer_coupons: [],
  customer_milestone_rewards: [],
};
const seqs: Record<string, number> = {};

function duplicate(): never {
  throw Object.assign(new Error("duplicate key"), { code: "23505" });
}

/** `"col" = $n AND …` → predicate. */
function whereOf(text: string, params: unknown[]): (r: Row) => boolean {
  const m = /WHERE (.*?)(?: ORDER BY| LIMIT| RETURNING|$)/.exec(text);
  if (!m) return () => true;
  const conds = Array.from(m[1].matchAll(/"(\w+)" = \$(\d+)/g), (c) => ({
    col: c[1],
    value: params[Number(c[2]) - 1],
  }));
  return (r) => conds.every((c) => r[c.col] === c.value);
}

function keyClash(table: string, row: Row, rows: Row[]): boolean {
  if (table === "customer_milestone_rewards") {
    return rows.some(
      (r) =>
        r.customerEmail === row.customerEmail && r.milestone === row.milestone,
    );
  }
  if (rows.some((r) => r.id === row.id)) return true;
  if (table === "customer_coupons") {
    return rows.some((r) => r.code === row.code);
  }
  if (table === "loyalty_stamps" && row.kind === "earn" && row.orderId) {
    return rows.some((r) => r.kind === "earn" && r.orderId === row.orderId);
  }
  return false;
}

const exec: Executor = async ({ text, params }) => {
  if (/next_seq/.test(text)) {
    const name = String(params[0] ?? "x");
    seqs[name] = (seqs[name] ?? 0) + 1;
    return { rows: [{ result: seqs[name] }], rowCount: 1 };
  }
  const table = /(?:FROM|INTO|UPDATE) "(\w+)"/.exec(text)?.[1] ?? "";
  const rows = tables[table];
  if (!rows) return { rows: [], rowCount: 0 };

  if (text.startsWith("SELECT")) {
    let out = rows.filter(whereOf(text, params)).map((r) => ({ ...r }));
    const order = /ORDER BY "(\w+)" (ASC|DESC)/.exec(text);
    if (order) {
      const [, col, dir] = order;
      out = out
        .map((r, i) => ({ r, i }))
        .sort((a, b) => {
          const x = String(a.r[col]);
          const y = String(b.r[col]);
          const c = x === y ? a.i - b.i : x < y ? -1 : 1;
          return dir === "DESC" && x !== y ? -c : c;
        })
        .map(({ r }) => r);
    }
    return { rows: out, rowCount: out.length };
  }
  if (text.startsWith("INSERT")) {
    const cols = Array.from(
      text.slice(text.indexOf("(") + 1, text.indexOf(")")).matchAll(/"(\w+)"/g),
      (m) => m[1],
    );
    const row = Object.fromEntries(cols.map((c, i) => [c, params[i]]));
    if (keyClash(table, row, rows)) duplicate();
    rows.push(row);
    return { rows: [], rowCount: 1 };
  }
  if (text.startsWith("UPDATE")) {
    const set = /SET (.*?) WHERE/.exec(text)?.[1] ?? "";
    const assigns = Array.from(set.matchAll(/"(\w+)" = \$(\d+)/g), (a) => ({
      col: a[1],
      value: params[Number(a[2]) - 1],
    }));
    const hit = rows.filter(whereOf(text, params));
    for (const r of hit) for (const a of assigns) r[a.col] = a.value;
    const returned = /RETURNING/.test(text)
      ? hit.map((r) => ({ id: r.id }))
      : [];
    return { rows: returned, rowCount: hit.length };
  }
  if (text.startsWith("DELETE")) {
    const match = whereOf(text, params);
    const keep = rows.filter((r) => !match(r));
    const removed = rows.length - keep.length;
    rows.splice(0, rows.length, ...keep);
    return { rows: [], rowCount: removed };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const MENU = [
  {
    id: "m-1",
    name: "Filtre Kahve",
    categoryKey: "hot",
    priceMinor: 9000,
    isActive: true,
  },
  {
    id: "m-2",
    name: "Americano",
    categoryKey: "espresso",
    priceMinor: 11000,
    isActive: true,
  },
];

vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({ mobileApp: DEFAULT_MOBILE_APP_CONFIG })),
  customerLoyaltyOrders: vi.fn(async () => []),
  listMenuItems: vi.fn(async () => MENU),
  orderChannel: (o: { channel?: string }) => o.channel ?? "web",
  orderKind: (o: { kind?: string }) => o.kind ?? "shop",
}));
vi.mock("@/lib/mobile/invite", () => ({
  rewardInviteOnFirstPaidOrder: vi.fn(async () => undefined),
}));

const {
  addCounterStamp,
  getLoyalty,
  getOrderStamps,
  onOrderPaid,
  onOrderReversed,
  redeemStamps,
  settleLoyaltyDebt,
} = await import("@/lib/mobile/loyalty");
const {
  grantCoupon,
  listCustomerCoupons,
  redeemCustomerCoupon,
  releaseCustomerCoupon,
} = await import("@/lib/customer/coupons");
const { getSettings } = await import("@/lib/admin/store");
const { listMilestoneGrants } = await import("@/lib/mobile/milestones");

const MEMBER = "eda@example.com";
const TARGET = DEFAULT_MOBILE_APP_CONFIG.loyalty.stampTarget;

let clock = Date.parse("2026-10-16T09:00:00.000Z");
/** Every write gets its own instant, so "newest" is never a tie. */
function tick(): void {
  clock += 60_000;
  vi.setSystemTime(clock);
}

function order(
  id: string,
  totalMinor: number,
  extra: Partial<AdminOrder> = {},
): AdminOrder {
  return {
    id,
    orderNo: 10000 + Number(id.replace(/\D/g, "")),
    customerEmail: MEMBER,
    totalMinor,
    shippingMinor: 0,
    discountMinor: 0,
    status: "paid",
    refunds: [],
    channel: "app",
    kind: "cafe",
    ...extra,
  } as unknown as AdminOrder;
}

let refundSeq = 0;
function refunded(o: AdminOrder, ...amounts: number[]): AdminOrder {
  const refunds: AdminRefund[] = amounts.map((amountMinor) => ({
    id: `rfn-${(refundSeq += 1)}`,
    amountMinor,
    reason: "test",
    createdAt: new Date(clock).toISOString(),
  }));
  return { ...o, refunds: [...o.refunds, ...refunds] };
}

const ledger = () => tables.loyalty_stamps;
const reversals = (orderId: string) =>
  ledger().filter((r) => r.kind === "reversal" && r.orderId === orderId);

async function counterStamps(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    tick();
    await addCounterStamp(MEMBER, "kasa@laffogato.net");
  }
}

async function pay(o: AdminOrder): Promise<void> {
  tick();
  await onOrderPaid(o);
}

async function reverse(o: AdminOrder, full = false): Promise<void> {
  tick();
  await onOrderReversed(o, { full });
}

async function loyaltyCoupons() {
  return (await listCustomerCoupons(MEMBER)).filter(
    (c) => c.source === "loyalty",
  );
}

/** The operator changes the card size at /admin/mobil/ayarlar. */
function setCardSize(stampTarget: number): void {
  vi.mocked(getSettings).mockImplementation(
    async () =>
      ({
        mobileApp: {
          ...DEFAULT_MOBILE_APP_CONFIG,
          loyalty: { ...DEFAULT_MOBILE_APP_CONFIG.loyalty, stampTarget },
        },
      }) as unknown as Awaited<ReturnType<typeof getSettings>>,
  );
}

beforeEach(() => {
  setCardSize(DEFAULT_MOBILE_APP_CONFIG.loyalty.stampTarget);
  vi.useFakeTimers({ toFake: ["Date"] });
  clock = Date.parse("2026-10-16T09:00:00.000Z");
  vi.setSystemTime(clock);
  for (const t of Object.values(tables)) t.length = 0;
  for (const k of Object.keys(seqs)) delete seqs[k];
  refundSeq = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

it("reads the arithmetic below against the default card of 6", () => {
  expect(TARGET).toBe(6);
});

describe("partial refunds re-derive the order's stamps", () => {
  it("follows the goods kept through two partial refunds and a full one", async () => {
    const paid = order("ord-1", 100000); // ₺1.000 → ceil(1000 / 320) = 4
    await pay(paid);
    expect((await getOrderStamps(MEMBER)).get("ord-1")).toBe(4);

    // ₺100 back → ₺900 of goods kept → 3 stamps.
    const first = refunded(paid, 10000);
    await reverse(first);
    expect((await getOrderStamps(MEMBER)).get("ord-1")).toBe(3);
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(3);

    // The same settlement again (a retried webhook, a second click): nothing.
    await reverse(first);
    expect(reversals("ord-1")).toHaveLength(1);

    // ₺350 more → ₺550 kept → 2 stamps.
    const second = refunded(first, 35000);
    await reverse(second);
    expect((await getOrderStamps(MEMBER)).get("ord-1")).toBe(2);
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(2);

    // The rest back: a full refund keeps nothing.
    const all = refunded(second, 55000);
    await reverse({ ...all, status: "refunded" }, true);
    expect((await getOrderStamps(MEMBER)).has("ord-1")).toBe(false);
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(0);

    // One row per stamp, each −1, ids derived from the order and the stamp.
    expect(reversals("ord-1").map((r) => [r.id, r.delta])).toEqual([
      ["stamp-rev-ord-1:4", -1],
      ["stamp-rev-ord-1:3", -1],
      ["stamp-rev-ord-1:2", -1],
      ["stamp-rev-ord-1", -1],
    ]);
    // And a retry of the full refund adds nothing.
    await reverse({ ...all, status: "refunded" }, true);
    expect(reversals("ord-1")).toHaveLength(4);
  });

  it("drops to none once the goods kept fall under 140 TL", async () => {
    const paid = order("ord-2", 20000); // ₺200 → 1
    await pay(paid);
    await reverse(refunded(paid, 7000)); // ₺130 kept
    expect((await getOrderStamps(MEMBER)).has("ord-2")).toBe(false);
  });

  it("counts a refund against the courier fee first", async () => {
    // ₺1.000 of goods + ₺55 courier. ₺55 back: a refund cannot be split, so
    // it is the courier fee and the goods keep their 4 stamps.
    const paid = order("ord-3", 105500, { shippingMinor: 5500 });
    await pay(paid);
    expect((await getOrderStamps(MEMBER)).get("ord-3")).toBe(4);
    const courier = refunded(paid, 5500);
    await reverse(courier);
    expect((await getOrderStamps(MEMBER)).get("ord-3")).toBe(4);
    // ₺100 more is goods: ₺900 kept → 3.
    await reverse(refunded(courier, 10000));
    expect((await getOrderStamps(MEMBER)).get("ord-3")).toBe(3);
  });

  it("ends at the lower target when two refunds settle at the same moment", async () => {
    const paid = order("ord-4", 100000); // 4
    await pay(paid);
    const a = refunded(paid, 10000); // the first settlement sees ₺900 kept → 3
    const b = refunded(a, 35000); // the second sees ₺550 kept → 2
    tick();
    await Promise.all([
      onOrderReversed(a),
      onOrderReversed(b),
      onOrderReversed(b),
    ]);
    expect((await getOrderStamps(MEMBER)).get("ord-4")).toBe(2);
    expect(reversals("ord-4")).toHaveLength(2);
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(2);
  });

  it("a cancel takes back whatever partial refunds left", async () => {
    const paid = order("ord-5", 100000); // 4
    await pay(paid);
    await reverse(refunded(paid, 35000)); // ₺650 → 3
    await reverse({ ...paid, status: "cancelled" }, true);
    expect((await getOrderStamps(MEMBER)).has("ord-5")).toBe(false);
    expect(reversals("ord-5")).toHaveLength(4);
  });

  it("reads an older whole-order reversal as complete", async () => {
    await pay(order("ord-6", 100000)); // 4
    // Written by the previous deployment: one row, the whole earn delta.
    ledger().push({
      id: "stamp-rev-ord-6",
      customerEmail: MEMBER,
      kind: "reversal",
      delta: -4,
      source: "order",
      orderId: "ord-6",
      note: "",
      actor: "",
      createdAt: new Date(clock).toISOString(),
    });
    await reverse(refunded(order("ord-6", 100000), 10000));
    expect(reversals("ord-6")).toHaveLength(1);
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(0);
  });
});

describe("a reversal after the stamps were spent on a free drink", () => {
  it("takes back the unused coupon and gives the member the stamps that are left", async () => {
    await counterStamps(3);
    const paid = order("ord-1", 100000); // +4 → 7
    await pay(paid);
    tick();
    const redeemed = await redeemStamps(MEMBER);
    expect(redeemed.ok).toBe(true);
    expect((await getLoyalty(MEMBER)).stamps).toBe(1);

    // Cancelled: 7 − 4 = 3 stamps left, but a card of 6 was paid out.
    await reverse({ ...paid, status: "cancelled" }, true);
    const [coupon] = await loyaltyCoupons();
    expect(coupon).toMatchObject({ isActive: false, redeemedAt: "" });
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(1);
    expect(await getLoyalty(MEMBER)).toMatchObject({
      stamps: 3,
      rewardsReady: 0,
      lifetimeStamps: 3,
    });

    // A retry changes nothing.
    await reverse({ ...paid, status: "cancelled" }, true);
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(1);
    expect((await getLoyalty(MEMBER)).stamps).toBe(3);
  });

  it("leaves a used coupon used, shows 0 and lets the next stamps pay the debt", async () => {
    await counterStamps(3);
    const paid = order("ord-2", 100000); // 7
    await pay(paid);
    tick();
    const redeemed = await redeemStamps(MEMBER);
    if (!redeemed.ok) throw new Error("redeem failed");
    // The member drank it.
    tick();
    expect(
      await redeemCustomerCoupon(redeemed.coupon.code, MEMBER, 20001),
    ).toBe(true);

    await reverse({ ...paid, status: "cancelled" }, true);
    const [coupon] = await loyaltyCoupons();
    expect(coupon.isActive).toBe(true);
    expect(coupon.redeemedAt).not.toBe("");
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(0);
    // 3 stamps against a card of 6 already drunk: 3 owed, 0 shown.
    expect(await getLoyalty(MEMBER)).toMatchObject({
      stamps: 0,
      rewardsReady: 0,
    });

    // The next three stamps pay the debt; the fourth is the first on the card.
    await counterStamps(3);
    expect((await getLoyalty(MEMBER)).stamps).toBe(0);
    await counterStamps(1);
    expect((await getLoyalty(MEMBER)).stamps).toBe(1);
  });

  it("takes back one coupon per card no longer covered, newest first", async () => {
    await counterStamps(8);
    const paid = order("ord-3", 100000); // +4 → 12 = two cards
    await pay(paid);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);

    // 8 left against two cards (12): one card short.
    await reverse({ ...paid, status: "cancelled" }, true);
    const coupons = await loyaltyCoupons(); // newest first
    expect(coupons.map((c) => c.isActive)).toEqual([false, true]);
    expect(await getLoyalty(MEMBER)).toMatchObject({
      stamps: 2,
      lifetimeStamps: 8,
    });
  });

  it("takes back one coupon, not two, when two settlements race", async () => {
    await counterStamps(8);
    const paid = order("ord-6", 100000); // 12 = two cards
    await pay(paid);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);

    // A provider refund webhook and an admin cancel at the same moment.
    tick();
    await Promise.all([
      onOrderReversed({ ...paid, status: "cancelled" }, { full: true }),
      onOrderReversed(refunded({ ...paid, status: "refunded" }, 100000), {
        full: true,
      }),
    ]);
    const coupons = await loyaltyCoupons();
    expect(coupons.filter((c) => !c.isActive)).toHaveLength(1);
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(1);
    expect(reversals("ord-6")).toHaveLength(4);
    expect((await getLoyalty(MEMBER)).stamps).toBe(2);
  });

  it("keeps a coupon the remaining stamps still cover", async () => {
    await counterStamps(6);
    const paid = order("ord-4", 100000); // +4 → 10
    await pay(paid);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    await reverse({ ...paid, status: "cancelled" }, true);
    const [coupon] = await loyaltyCoupons();
    expect(coupon.isActive).toBe(true);
    expect((await getLoyalty(MEMBER)).stamps).toBe(0);
  });

  it("follows a partial refund too, and never touches another kind of coupon", async () => {
    tick();
    const invite = await grantCoupon({
      email: MEMBER,
      kind: "fixed",
      value: 9000,
      source: "invite",
    });
    tick();
    const manual = await grantCoupon({
      email: MEMBER,
      kind: "pct",
      value: 10,
      source: "manual",
    });
    await counterStamps(2);
    const paid = order("ord-5", 128000); // ₺1.280 → 4 → 6, one card
    await pay(paid);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);

    // ₺400 back → ₺880 kept → 3: 5 stamps against a card of 6.
    await reverse(refunded(paid, 40000));
    const all = await listCustomerCoupons(MEMBER);
    expect(all.find((c) => c.source === "loyalty")?.isActive).toBe(false);
    expect(all.find((c) => c.id === invite.id)?.isActive).toBe(true);
    expect(all.find((c) => c.id === manual.id)?.isActive).toBe(true);
    expect((await getLoyalty(MEMBER)).stamps).toBe(5);
  });
});

describe("a reversal below a milestone already given", () => {
  it("claws back the unused gift and gives it again when the stamps get back there", async () => {
    await counterStamps(7);
    const paid = order("ord-1", 100000); // +4 → 11: the tenth-stamp gift
    await pay(paid);
    const [given] = await listMilestoneGrants(MEMBER);
    expect(given).toMatchObject({ milestone: 10, itemName: "Filtre Kahve" });

    await reverse({ ...paid, status: "cancelled" }, true); // → 7
    expect(await listMilestoneGrants(MEMBER)).toEqual([]);
    const gift = (await listCustomerCoupons(MEMBER)).find(
      (c) => c.id === given.couponId,
    );
    expect(gift).toMatchObject({
      source: "milestone",
      isActive: false,
      redeemedAt: "",
    });

    // Three honest stamps later the member is at 10 again.
    await counterStamps(3);
    const [again] = await listMilestoneGrants(MEMBER);
    expect(again.milestone).toBe(10);
    expect(again.couponId).not.toBe(given.couponId);
    const fresh = (await listCustomerCoupons(MEMBER)).find(
      (c) => c.id === again.couponId,
    );
    expect(fresh?.isActive).toBe(true);
  });

  it("keeps a gift that was already used and does not give it twice", async () => {
    await counterStamps(7);
    const paid = order("ord-2", 100000); // 11
    await pay(paid);
    const [given] = await listMilestoneGrants(MEMBER);
    const gift = (await listCustomerCoupons(MEMBER)).find(
      (c) => c.id === given.couponId,
    )!;
    tick();
    expect(await redeemCustomerCoupon(gift.code, MEMBER, 20002)).toBe(true);

    await reverse({ ...paid, status: "cancelled" }, true); // → 7
    expect((await listMilestoneGrants(MEMBER)).map((g) => g.milestone)).toEqual(
      [10],
    );

    await counterStamps(3); // back at 10
    const milestoneCoupons = (await listCustomerCoupons(MEMBER)).filter(
      (c) => c.source === "milestone",
    );
    expect(milestoneCoupons).toHaveLength(1);
  });
});

/**
 * Second review of 16 Eki 2026: a settlement must only take coupons for
 * stamps that order reversals actually took back. Growing or shrinking the
 * card changes how the balance is read, never what a member owes.
 */
describe("a change of the card size is not a debt", () => {
  it("a refund that reverses nothing keeps a coupon earned on the old card", async () => {
    const big = order("ord-1", 192000); // ₺1.920 → 6 stamps
    await pay(big);
    tick();
    const redeemed = await redeemStamps(MEMBER);
    if (!redeemed.ok) throw new Error("redeem failed");
    const small = order("ord-2", 20000); // ₺200 → 1
    await pay(small);

    setCardSize(8);
    await reverse(refunded(small, 1000)); // ₺190 kept, still 1 stamp
    expect(reversals("ord-2")).toHaveLength(0);
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(0);
    expect((await loyaltyCoupons())[0].isActive).toBe(true);

    // Cancelling the small order takes its one stamp; the card was paid by
    // the big one, whose 6 stamps still stand.
    await reverse({ ...small, status: "cancelled" }, true);
    expect(reversals("ord-2")).toHaveLength(1);
    expect((await loyaltyCoupons())[0].isActive).toBe(true);
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(0);
  });

  it("the same with till stamps (scenario A of the review)", async () => {
    await counterStamps(6);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    const paid = order("ord-7", 20000); // 1 → lifetime 7
    await pay(paid);
    setCardSize(8);
    await reverse(refunded(paid, 1000));
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(0);
    expect((await loyaltyCoupons())[0].isActive).toBe(true);
    // A settlement with no order behind it (the release hook) takes nothing
    // either.
    await settleLoyaltyDebt(MEMBER);
    expect((await loyaltyCoupons())[0].isActive).toBe(true);
  });

  it("a card that shrank and a coupon bought on it are not a debt either", async () => {
    setCardSize(8);
    await counterStamps(8);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // cost 8
    setCardSize(6);
    const paid = order("ord-1", 100000); // +4 → 12
    await pay(paid);
    // The old card cost 8: 12 − 8 = 4 left, not a card of 6 yet.
    expect(await getLoyalty(MEMBER)).toMatchObject({
      stamps: 4,
      rewardsReady: 0,
    });
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(false);
    await counterStamps(2); // 14 − 8 = 6
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // cost 6
    // ₺10 back: ₺990 kept, still 4 stamps.
    await reverse(refunded(paid, 1000));
    expect(reversals("ord-1")).toHaveLength(0);
    expect((await loyaltyCoupons()).every((c) => c.isActive)).toBe(true);
  });

  it("still takes back a coupon whose own stamps were reversed after the card grew", async () => {
    await counterStamps(3);
    const paid = order("ord-1", 100000); // +4 → 7
    await pay(paid);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // a card of 6
    setCardSize(8);
    await reverse({ ...paid, status: "cancelled" }, true); // → 3
    const [coupon] = await loyaltyCoupons();
    expect(coupon.isActive).toBe(false);
    const [unredeem] = ledger().filter((r) => r.kind === "unredeem");
    // The row carries what the card cost, not the new card size.
    expect(unredeem.delta).toBe(6);
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(3);
  });
});

/**
 * A coupon is claimed when an order is created, before payment, so a
 * reversal that lands while an unpaid order holds the coupon cannot take it.
 * The cancel of that order hands it back unused, and the settlement then
 * runs again (`releaseOrderInventory` → `settleLoyaltyDebt`).
 */
describe("a reward held by an unpaid order when its stamps were reversed", () => {
  it("is taken back once the unpaid order lets go of it (scenario B)", async () => {
    const a = order("ord-1", 180000); // ₺1.800 → 6
    await pay(a);
    tick();
    const redeemed = await redeemStamps(MEMBER);
    if (!redeemed.ok) throw new Error("redeem failed");
    tick();
    expect(
      await redeemCustomerCoupon(redeemed.coupon.code, MEMBER, 20009),
    ).toBe(true);

    await reverse({ ...a, status: "refunded" }, true);
    // Held: it cannot be taken yet, and the debt stays on the ledger.
    expect((await loyaltyCoupons())[0].isActive).toBe(true);
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(0);

    // Order B is cancelled unpaid: the store hands the coupon back and
    // settles again.
    tick();
    expect(
      await releaseCustomerCoupon(redeemed.coupon.code, MEMBER, 20009),
    ).toBe(true);
    await settleLoyaltyDebt(MEMBER);
    const [coupon] = await loyaltyCoupons();
    expect(coupon).toMatchObject({ isActive: false, redeemedAt: "" });
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(1);
    expect(await getLoyalty(MEMBER)).toMatchObject({
      stamps: 0,
      lifetimeStamps: 0,
      rewardsReady: 0,
    });
    // Another settlement (a retry) changes nothing.
    await settleLoyaltyDebt(MEMBER);
    expect(ledger().filter((r) => r.kind === "unredeem")).toHaveLength(1);
  });

  it("stays used when the order that held it is paid after all", async () => {
    const a = order("ord-1", 180000); // 6
    await pay(a);
    tick();
    const redeemed = await redeemStamps(MEMBER);
    if (!redeemed.ok) throw new Error("redeem failed");
    tick();
    await redeemCustomerCoupon(redeemed.coupon.code, MEMBER, 20009);
    await reverse({ ...a, status: "refunded" }, true);
    await settleLoyaltyDebt(MEMBER);
    const [coupon] = await loyaltyCoupons();
    expect(coupon.isActive).toBe(true);
    expect(coupon.redeemedAt).not.toBe("");
    // The debt of 6 is paid by the next six stamps.
    await counterStamps(6);
    expect((await getLoyalty(MEMBER)).stamps).toBe(0);
    await counterStamps(1);
    expect((await getLoyalty(MEMBER)).stamps).toBe(1);
  });

  it("the same for a milestone gift", async () => {
    await counterStamps(7);
    const paid = order("ord-1", 100000); // +4 → 11: the tenth-stamp gift
    await pay(paid);
    const [given] = await listMilestoneGrants(MEMBER);
    const gift = (await listCustomerCoupons(MEMBER)).find(
      (c) => c.id === given.couponId,
    )!;
    tick();
    expect(await redeemCustomerCoupon(gift.code, MEMBER, 20010)).toBe(true);

    await reverse({ ...paid, status: "cancelled" }, true); // → 7
    expect((await listMilestoneGrants(MEMBER)).map((g) => g.milestone)).toEqual(
      [10],
    );

    tick();
    expect(await releaseCustomerCoupon(gift.code, MEMBER, 20010)).toBe(true);
    await settleLoyaltyDebt(MEMBER);
    expect(await listMilestoneGrants(MEMBER)).toEqual([]);
    expect(
      (await listCustomerCoupons(MEMBER)).find((c) => c.id === gift.id),
    ).toMatchObject({ isActive: false, redeemedAt: "" });
  });
});
