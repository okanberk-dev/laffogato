import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder, AdminRefund } from "@/lib/admin/store";
import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import { createDb, type Executor } from "@/lib/db/client";

/**
 * Third review of 16 Eki 2026: the reward settlement is one invariant.
 *
 *   covered = lifetimeStamps − Σ cost of every redeemed card still standing
 *
 * A card's cost is what its own `redeem` row consumed, never the current
 * `stampTarget`. Whenever stamps are reversed, a held coupon is released or
 * a card is redeemed, unused free drinks are taken back (newest first, each
 * with its own card marked unredeemed) while `covered < 0`; once none is
 * unused the rest is paid by the next stamps.
 *
 * The four defects the review reproduced against the old "allowance":
 * a withdrawal that overspent it, a shrink-then-restore of the card, a
 * redeem racing a cancel, and a courier-only refund that took a stamp. Then
 * a randomized property test over sequences of every operation.
 *
 * Fourth review (same day): a withdrawal is two writes (the card's
 * `unredeem` row, then the coupon), and a request can die between them, or
 * lose the answer of a write that committed. The "review 4" blocks pin the
 * four defects it reproduced: a half-done withdrawal nobody finished, legacy
 * coupons matched to different cards by two settlements at once, a till
 * correction that never settled, and a coupon insert that outlived the row
 * rolled back for it. The property test now also fails one write per step at
 * random (before or after it commits) and requires the next trigger to leave
 * the ledger settled.
 *
 * Same in-memory Postgres as `mobile-loyalty-refund-settle.test.ts`, plus a
 * gate that can pause or fail one query so requests interleave and die on
 * purpose.
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

const baseExec: Executor = async ({ text, params }) => {
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

/** Optional gate: a hook may pause a query until released. */
let gate:
  ((q: { text: string; params: unknown[] }) => Promise<void> | void) | null =
  null;
const exec: Executor = async (q) => {
  if (gate) await gate(q as { text: string; params: unknown[] });
  return baseExec(q);
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
  reverseCounterStamp,
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
  gate = null;
});

afterEach(() => {
  vi.useRealTimers();
});

const core = await import("@/lib/mobile/loyalty-core");

type LedgerRow = Parameters<typeof core.stampCoverage>[0][number] & {
  id: string;
  orderId: string;
  createdAt: string;
};
const rows = () => ledger() as unknown as LedgerRow[];
const covered = () => core.stampCoverage(rows());
const unredeems = () => ledger().filter((r) => r.kind === "unredeem");

function unusedLive<T extends { isActive: boolean; redeemedAt: string }>(
  cs: readonly T[],
): T[] {
  return cs.filter((c) => c.isActive && !c.redeemedAt);
}

/** Pauses the first query `match` accepts until the returned release runs. */
function pauseAt(match: RegExp) {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const state = { paused: false };
  gate = async (q) => {
    if (!state.paused && match.test(q.text)) {
      state.paused = true;
      await held;
    }
  };
  return {
    state,
    release: () => {
      gate = null;
      release();
    },
  };
}

async function untilPaused(state: { paused: boolean }) {
  for (let i = 0; i < 500 && !state.paused; i += 1) {
    await new Promise((r) => setImmediate(r));
  }
  expect(state.paused).toBe(true);
}

/**
 * Fails the first query `match` accepts, once: the way a timeout, a dropped
 * connection or a killed lambda looks to the code. `after` lets the statement
 * commit first and loses only its answer.
 */
function failOnce(match: RegExp, after = false) {
  const state = { fired: false };
  gate = async (q) => {
    if (state.fired || !match.test(q.text)) return;
    state.fired = true;
    if (after) await baseExec(q);
    throw Object.assign(new Error("connection terminated"), { code: "" });
  };
  return state;
}

it("reads the arithmetic below against the default card of 6", () => {
  expect(TARGET).toBe(6);
});

describe("defect 1: a withdrawal no longer overspends an allowance", () => {
  it("takes back the second free drink as well as the first", async () => {
    await counterStamps(5);
    const a = order("ord-1", 20000); // ₺200 → 1 → 6
    await pay(a);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // C1
    await reverse({ ...a, status: "cancelled" }, true); // 5 against a card of 6
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(covered()).toBe(5);
    expect((await getLoyalty(MEMBER)).stamps).toBe(5);

    const b = order("ord-2", 20000); // +1 → 6
    await pay(b);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // C2
    await reverse({ ...b, status: "cancelled" }, true); // 5 again

    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(unredeems()).toHaveLength(2);
    expect(covered()).toBe(5);
    expect(await getLoyalty(MEMBER)).toMatchObject({
      lifetimeStamps: 5,
      stamps: 5,
      rewardsReady: 0,
    });
  });

  it("a debt of one stamp takes one card, and the next real debt still takes the next", async () => {
    await counterStamps(11);
    const a = order("ord-1", 20000); // 12 = two cards
    await pay(a);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    await reverse({ ...a, status: "cancelled" }, true); // 11: one short
    expect(
      (await loyaltyCoupons()).map((c) => [c.isActive, c.redeemedAt]),
    ).toEqual([
      [false, ""],
      [true, ""],
    ]);
    expect(covered()).toBe(5);
    // The next real debt of one stamp takes the next card too.
    const b = order("ord-2", 20000); // +1 → 12
    await pay(b);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // C3
    expect(covered()).toBe(0);
    await reverse({ ...b, status: "cancelled" }, true); // 11 − 12 = −1
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);
    expect(unredeems()).toHaveLength(2);
    expect(covered()).toBe(5);
  });
});

describe("defect 2: changing the card size withdraws nothing", () => {
  it("shrink, redeem on the small card, restore: a refund that reverses nothing keeps every coupon", async () => {
    // An old, settled refund: under the allowance it left budget behind.
    const a = order("ord-1", 20000);
    await pay(a);
    await reverse({ ...a, status: "cancelled" }, true);

    await counterStamps(6);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // C1, cost 6

    setCardSize(4);
    await counterStamps(2); // 8 − 6 = 2: the old card still cost 6
    expect(await getLoyalty(MEMBER)).toMatchObject({
      stamps: 2,
      rewardsReady: 0,
    });
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(false);
    await counterStamps(2); // 10 − 6 = 4: a card of 4
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // C2, cost 4
    expect(covered()).toBe(0);

    setCardSize(6);
    const b = order("ord-2", 20000); // +1 → 11
    await pay(b);
    // A ₺1 goodwill refund: ₺199 still earns 1, nothing reversed.
    await reverse(refunded(b, 100));
    expect(reversals("ord-2")).toHaveLength(0);
    expect((await getOrderStamps(MEMBER)).get("ord-2")).toBe(1);
    expect((await loyaltyCoupons()).every((c) => c.isActive)).toBe(true);
    // Its cancel reverses the one stamp; 10 still cover 6 + 4.
    await reverse({ ...b, status: "cancelled" }, true);
    expect(covered()).toBe(0);
    expect((await loyaltyCoupons()).every((c) => c.isActive)).toBe(true);
    expect(unredeems()).toHaveLength(0);
  });

  it("growing the card makes no debt, and a settlement with nothing reversed takes nothing", async () => {
    await counterStamps(12);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    setCardSize(8); // the balance reads 12 against 16, but nothing is owed
    expect(covered()).toBe(0);
    await settleLoyaltyDebt(MEMBER);
    expect((await loyaltyCoupons()).every((c) => c.isActive)).toBe(true);
    setCardSize(3);
    await settleLoyaltyDebt(MEMBER);
    expect((await loyaltyCoupons()).every((c) => c.isActive)).toBe(true);
    expect(unredeems()).toHaveLength(0);
  });

  it("a real reversal after the card changed takes back exactly what it uncovered", async () => {
    setCardSize(4);
    await counterStamps(3);
    const a = order("ord-1", 20000); // 4
    await pay(a);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true); // cost 4
    setCardSize(8);
    await reverse({ ...a, status: "cancelled" }, true); // 3 − 4 = −1
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    const [row] = unredeems();
    expect(row.delta).toBe(4); // the card's own cost, not the new size
    expect(covered()).toBe(3);
  });
});

describe("defect 3: a redeem racing a cancel", () => {
  async function setUp() {
    await counterStamps(2);
    const paid = order("ord-1", 100000); // +4 → 6
    await pay(paid);
    tick();
    const first = await redeemStamps(MEMBER);
    if (!first.ok) throw new Error("redeem 1");
    tick();
    expect(await redeemCustomerCoupon(first.coupon.code, MEMBER, 20001)).toBe(
      true,
    );
    await counterStamps(6); // lifetime 12, one card used, 6 available
    return paid;
  }

  it("the cancel lands between the redeem row and the coupon: the new coupon is taken back", async () => {
    const paid = await setUp();
    const pause = pauseAt(/^INSERT INTO "customer_coupons"/);
    tick();
    const redeeming = redeemStamps(MEMBER);
    await untilPaused(pause.state);
    // The admin cancels ord-1 while the coupon insert is in flight. Its
    // settlement finds no unused coupon to take yet.
    gate = null;
    await onOrderReversed({ ...paid, status: "cancelled" }, { full: true });
    expect(covered()).toBe(8 - 12);
    pause.release();
    const res = await redeeming;

    expect(res.ok).toBe(false);
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(8);
    const cs = await loyaltyCoupons();
    expect(unusedLive(cs)).toHaveLength(0);
    expect(cs).toHaveLength(2);
    // The used one is untouched, the new one withdrawn with its own card.
    expect(cs.filter((c) => c.redeemedAt).every((c) => c.isActive)).toBe(true);
    expect(covered()).toBe(2);
  });

  it("the cancel lands before the redeem row: no coupon is minted", async () => {
    const paid = await setUp();
    const pause = pauseAt(/^INSERT INTO "loyalty_stamps"/);
    tick();
    const redeeming = redeemStamps(MEMBER); // passed its balance check
    await untilPaused(pause.state);
    gate = null;
    await onOrderReversed({ ...paid, status: "cancelled" }, { full: true });
    pause.release();
    expect((await redeeming).ok).toBe(false);
    expect(await loyaltyCoupons()).toHaveLength(1);
    expect(ledger().filter((r) => r.kind === "redeem")).toHaveLength(1);
  });

  it("a cancel after the redeem finished takes the coupon back itself", async () => {
    const paid = await setUp();
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    await reverse({ ...paid, status: "cancelled" }, true);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(covered()).toBe(2);
  });
});

describe("defect 4: a courier-only refund", () => {
  it("keeps the stamp when only the courier fee is refunded", async () => {
    // ₺150 of goods + ₺30 courier.
    const paid = order("ord-1", 18000, { shippingMinor: 3000 });
    await pay(paid);
    expect((await getOrderStamps(MEMBER)).get("ord-1")).toBe(1);
    const courier = refunded(paid, 3000);
    await reverse(courier);
    expect((await getOrderStamps(MEMBER)).get("ord-1")).toBe(1);
    expect(reversals("ord-1")).toHaveLength(0);
    // ₺15 more is goods: ₺135 kept, under ₺140.
    await reverse(refunded(courier, 1500));
    expect((await getOrderStamps(MEMBER)).has("ord-1")).toBe(false);
  });

  it("a refund larger than the fee is goods past the fee", async () => {
    // ₺700 of goods (3) + ₺50 courier; ₺110 back = ₺50 fee + ₺60 goods → ₺640 → 2.
    const paid = order("ord-2", 75000, { shippingMinor: 5000 });
    await pay(paid);
    expect((await getOrderStamps(MEMBER)).get("ord-2")).toBe(3);
    await reverse(refunded(paid, 11000));
    expect((await getOrderStamps(MEMBER)).get("ord-2")).toBe(2);
  });
});

describe("legacy coupons (granted before cards and coupons were linked)", () => {
  it("are still taken back when their stamps are reversed", async () => {
    await counterStamps(2);
    const paid = order("ord-1", 100000); // 6
    await pay(paid);
    // A redeem written by the previous deployment: plain ids on both sides.
    tick();
    ledger().push({
      id: "stamp-legacy-1",
      customerEmail: MEMBER,
      kind: "redeem",
      delta: -6,
      source: "app",
      orderId: "",
      note: "",
      actor: "",
      createdAt: new Date(clock).toISOString(),
    });
    tick();
    const legacy = await grantCoupon({
      email: MEMBER,
      kind: "fixed",
      value: 28000,
      source: "loyalty",
    });
    expect(legacy.id).toMatch(/^cpn-\d{4}$/);
    await reverse({ ...paid, status: "cancelled" }, true);
    const [c] = await loyaltyCoupons();
    expect(c).toMatchObject({ id: legacy.id, isActive: false });
    expect(unredeems().map((r) => r.id)).toEqual([
      core.unredeemId("stamp-legacy-1"),
    ]);
  });
});

// ── fourth review (16 Eki 2026): failures between the writes ─────────────

/** A card redeemed by the previous deployment: plain ids on both sides. */
async function legacyCard(id: string, cost = 6) {
  tick();
  ledger().push({
    id,
    customerEmail: MEMBER,
    kind: "redeem",
    delta: -cost,
    source: "app",
    orderId: "",
    note: "",
    actor: "",
    createdAt: new Date(clock).toISOString(),
  });
  tick();
  return grantCoupon({
    email: MEMBER,
    kind: "fixed",
    value: 28000,
    source: "loyalty",
  });
}

describe("review 4, defect 1: a settlement that stopped between its two writes", () => {
  /** Five till stamps and a paid order: a card of 6, redeemed. */
  async function redeemedCard() {
    await counterStamps(5);
    const paid = order("ord-1", 20000);
    await pay(paid); // 6
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    return paid;
  }

  /** The cancel claims the card, then its coupon write fails once. */
  async function cancelLeavingHalfDone() {
    const paid = await redeemedCard();
    const failure = failOnce(/^UPDATE "customer_coupons"/);
    await expect(
      onOrderReversed({ ...paid, status: "cancelled" }, { full: true }),
    ).rejects.toThrow();
    expect(failure.fired).toBe(true);
    gate = null;
    // The state it leaves: the card is claimed, the coupon is still usable.
    expect(unredeems()).toHaveLength(1);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);
    expect(covered()).toBe(5);
    return paid;
  }

  it("a retried cancel finishes the withdrawal", async () => {
    const paid = await cancelLeavingHalfDone();
    await reverse({ ...paid, status: "cancelled" }, true);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(unredeems()).toHaveLength(1);
    expect(covered()).toBe(5);
    expect(await getLoyalty(MEMBER)).toMatchObject({
      lifetimeStamps: 5,
      stamps: 5,
      rewardsReady: 0,
    });
  });

  it("any settlement finishes it, even when the stamps cover every card by then", async () => {
    await cancelLeavingHalfDone();
    await counterStamps(6); // 11 stamps against no standing card
    expect(covered()).toBe(11);
    await settleLoyaltyDebt(MEMBER);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(unredeems()).toHaveLength(1);
  });

  it("a redeem is a trigger: the old coupon goes when the stamps buy a new one", async () => {
    await cancelLeavingHalfDone();
    await counterStamps(1); // 6 again
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    // One free drink for six stamps, not two.
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);
    expect(covered()).toBe(0);
  });

  it("a till correction is a trigger", async () => {
    await cancelLeavingHalfDone();
    tick();
    expect((await reverseCounterStamp(MEMBER, "kasa@laffogato.net")).ok).toBe(
      true,
    );
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
  });

  it("a coupon spent while the claim stood, and a claim that could not be dropped: the next trigger drops it", async () => {
    const paid = await redeemedCard();
    const [coupon] = await loyaltyCoupons();
    // The member pays with the coupon at the very moment the cancel's
    // settlement reaches for it, and the claim delete then fails once.
    let spent = false;
    gate = async (q) => {
      if (spent || !/^UPDATE "customer_coupons"/.test(q.text)) return;
      spent = true;
      gate = null;
      expect(await redeemCustomerCoupon(coupon.code, MEMBER, 70001)).toBe(true);
      failOnce(/^DELETE FROM "loyalty_stamps"/);
    };
    await expect(
      onOrderReversed({ ...paid, status: "cancelled" }, { full: true }),
    ).rejects.toThrow();
    gate = null;
    // The claim is left behind on a card the member really spent.
    expect(unredeems()).toHaveLength(1);
    expect(covered()).toBe(5);

    await settleLoyaltyDebt(MEMBER);
    expect(unredeems()).toHaveLength(0);
    expect(covered()).toBe(-1); // paid by the next stamp
    const [used] = await loyaltyCoupons();
    expect(used).toMatchObject({ id: coupon.id, isActive: true });
    expect(used.redeemedAt).not.toBe("");
    await counterStamps(1);
    expect(covered()).toBe(0);
  });

  it("a held coupon whose order is cancelled after a stale claim is taken back, not stranded", async () => {
    const paid = await redeemedCard();
    const [coupon] = await loyaltyCoupons();
    // The coupon is held by an unpaid order when the cancel settles, and
    // the claim delete fails: a claim stays on a held coupon.
    let held = false;
    gate = async (q) => {
      if (held || !/^UPDATE "customer_coupons"/.test(q.text)) return;
      held = true;
      gate = null;
      await redeemCustomerCoupon(coupon.code, MEMBER, 70002);
      failOnce(/^DELETE FROM "loyalty_stamps"/);
    };
    await expect(
      onOrderReversed({ ...paid, status: "cancelled" }, { full: true }),
    ).rejects.toThrow();
    gate = null;
    // The unpaid order is cancelled and hands the coupon back.
    expect(await releaseCustomerCoupon(coupon.code, MEMBER, 70002)).toBe(true);
    await settleLoyaltyDebt(MEMBER);
    // Held, the claim was stale; released, the card has no stamps behind it.
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(covered()).toBeGreaterThanOrEqual(0);
  });
});

describe("review 4, defect 2: legacy coupons and two settlements at once", () => {
  it("both legacy coupons are taken back, whoever claims which card", async () => {
    await counterStamps(5);
    const big = order("ord-1", 224000); // 2240 TL: 7 stamps, lifetime 12
    await pay(big);
    const c1 = await legacyCard("stamp-legacy-1");
    const c2 = await legacyCard("stamp-legacy-2");
    expect(covered()).toBe(0);

    // The cancel's settlement claims the newer card and stops at the coupon.
    const pause = pauseAt(/^UPDATE "customer_coupons"/);
    tick();
    const cancel = onOrderReversed(
      { ...big, status: "cancelled" },
      { full: true },
    );
    await untilPaused(pause.state);
    // A replayed refund webhook settles in the meantime, all the way.
    tick();
    await settleLoyaltyDebt(MEMBER);
    pause.release();
    await cancel;
    await settleLoyaltyDebt(MEMBER);
    await settleLoyaltyDebt(MEMBER);

    const cs = await loyaltyCoupons();
    expect(unusedLive(cs)).toEqual([]);
    expect(cs.map((c) => c.id).sort()).toEqual([c1.id, c2.id].sort());
    // Each card was withdrawn exactly once, and the paused settlement kept
    // its claim: the coupon it lost was inactive, not spent.
    expect(
      unredeems()
        .map((u) => u.id)
        .sort(),
    ).toEqual(
      [
        core.unredeemId("stamp-legacy-1"),
        core.unredeemId("stamp-legacy-2"),
      ].sort(),
    );
    expect(covered()).toBe(5);
  });

  it("control: the same sequence without the race withdraws both", async () => {
    await counterStamps(5);
    const big = order("ord-1", 224000);
    await pay(big);
    await legacyCard("stamp-legacy-1");
    await legacyCard("stamp-legacy-2");
    await reverse({ ...big, status: "cancelled" }, true);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(covered()).toBe(5);
  });

  it("a coupon spent while its settlement waited keeps its card, and only that claim goes", async () => {
    await counterStamps(5);
    const big = order("ord-1", 224000);
    await pay(big);
    const c1 = await legacyCard("stamp-legacy-1");
    const c2 = await legacyCard("stamp-legacy-2");
    const pause = pauseAt(/^UPDATE "customer_coupons"/);
    tick();
    const cancel = onOrderReversed(
      { ...big, status: "cancelled" },
      { full: true },
    );
    await untilPaused(pause.state);
    // The newer coupon (the one in flight) is spent at the checkout.
    gate = null;
    expect(await redeemCustomerCoupon(c2.code, MEMBER, 70003)).toBe(true);
    pause.release();
    await cancel;

    const cs = await loyaltyCoupons();
    expect(unusedLive(cs)).toEqual([]);
    expect(cs.find((c) => c.id === c2.id)).toMatchObject({ isActive: true });
    expect(cs.find((c) => c.id === c1.id)).toMatchObject({ isActive: false });
    // Only the older card was withdrawn; the spent one stands.
    expect(unredeems().map((u) => u.id)).toEqual([
      core.unredeemId("stamp-legacy-1"),
    ]);
    expect(covered()).toBe(5 - 6);
  });
});

describe("review 4, defect 3: the till correction", () => {
  it("two clicks at once never take more than the member had left", async () => {
    await counterStamps(6);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    await counterStamps(1); // one stamp left over the free drink
    const pause = pauseAt(/^INSERT INTO "loyalty_stamps"/);
    tick();
    const first = reverseCounterStamp(MEMBER, "kasa@laffogato.net");
    await untilPaused(pause.state);
    const second = await reverseCounterStamp(MEMBER, "kasa@laffogato.net");
    pause.release();
    const firstResult = await first;

    expect([firstResult.ok, second.ok].sort()).toEqual([false, true]);
    expect(covered()).toBe(0);
    // The free drink is still the member's, and no debt is left behind.
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);
    expect(ledger().filter((r) => r.kind === "reversal")).toHaveLength(1);
  });

  it("a click that finds the stamps spent is refused, as before", async () => {
    await counterStamps(6);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    tick();
    expect(await reverseCounterStamp(MEMBER, "kasa@laffogato.net")).toEqual({
      ok: false,
      error: "no_stamps",
    });
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);
  });

  it("a milestone gift above the new lifetime is taken back, and earned again later", async () => {
    await counterStamps(10);
    expect((await listMilestoneGrants(MEMBER)).map((g) => g.milestone)).toEqual(
      [10],
    );
    tick();
    expect((await reverseCounterStamp(MEMBER, "kasa@laffogato.net")).ok).toBe(
      true,
    );
    expect((await getLoyalty(MEMBER)).lifetimeStamps).toBe(9);
    const gifts = () =>
      listCustomerCoupons(MEMBER).then((cs) =>
        cs.filter((c) => c.source === "milestone"),
      );
    expect((await gifts()).map((c) => c.isActive)).toEqual([false]);
    expect(await listMilestoneGrants(MEMBER)).toEqual([]);
    // The tenth stamp, honestly this time.
    await counterStamps(1);
    expect(unusedLive(await gifts())).toHaveLength(1);
    expect((await listMilestoneGrants(MEMBER)).map((g) => g.milestone)).toEqual(
      [10],
    );
  });

  it("a settlement that fails after the row does not fail the correction; the next trigger finishes it", async () => {
    await counterStamps(10);
    tick();
    const failure = failOnce(/^UPDATE "customer_coupons"/);
    const res = await reverseCounterStamp(MEMBER, "kasa@laffogato.net");
    expect(res.ok).toBe(true);
    expect(failure.fired).toBe(true);
    gate = null;
    const gift = () =>
      listCustomerCoupons(MEMBER).then((cs) =>
        cs.filter((c) => c.source === "milestone"),
      );
    expect(unusedLive(await gift())).toHaveLength(1); // not yet taken back
    await settleLoyaltyDebt(MEMBER);
    expect(unusedLive(await gift())).toHaveLength(0);
  });
});

describe("review 4, defect 4: a coupon insert that commits but loses its answer", () => {
  it("the coupon is taken back with the redeem row: the stamps buy exactly one free drink", async () => {
    await counterStamps(6);
    const failure = failOnce(/^INSERT INTO "customer_coupons"/, true);
    tick();
    await expect(redeemStamps(MEMBER)).rejects.toThrow();
    gate = null;
    expect(failure.fired).toBe(true);

    const cs = await loyaltyCoupons();
    expect(cs).toHaveLength(1); // it was written
    expect(unusedLive(cs)).toHaveLength(0); // and withdrawn again
    expect(ledger().filter((r) => r.kind === "redeem")).toHaveLength(0);
    expect((await getLoyalty(MEMBER)).rewardsReady).toBe(1);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);
    // The six stamps are spent once: nothing left for a second drink.
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(false);
  });

  it("if the withdrawal fails too, the next settlement takes the orphan", async () => {
    await counterStamps(6);
    // The insert commits and loses its answer; the withdrawal then fails once.
    let step = 0;
    gate = async (q) => {
      if (step === 0 && /^INSERT INTO "customer_coupons"/.test(q.text)) {
        step = 1;
        await baseExec(q);
        throw Object.assign(new Error("socket hang up"), { code: "" });
      }
      if (step === 1 && /^UPDATE "customer_coupons"/.test(q.text)) {
        step = 2;
        throw Object.assign(new Error("socket hang up"), { code: "" });
      }
    };
    tick();
    await expect(redeemStamps(MEMBER)).rejects.toThrow();
    gate = null;
    expect(step).toBe(2);
    // The redeem row is gone and its coupon is not: an active free drink
    // that no card paid for.
    expect(ledger().filter((r) => r.kind === "redeem")).toHaveLength(0);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);

    await settleLoyaltyDebt(MEMBER);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(0);
    expect(unredeems()).toHaveLength(0);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
    expect(unusedLive(await loyaltyCoupons())).toHaveLength(1);
  });

  it("a redeem row that commits but loses its answer is taken back, not left without a coupon", async () => {
    await counterStamps(6);
    const failure = failOnce(/^INSERT INTO "loyalty_stamps"/, true);
    tick();
    await expect(redeemStamps(MEMBER)).rejects.toThrow();
    gate = null;
    expect(failure.fired).toBe(true);
    expect(ledger().filter((r) => r.kind === "redeem")).toHaveLength(0);
    expect(await loyaltyCoupons()).toHaveLength(0);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
  });
});

describe("review 4: a redeem that cannot read the ledger back", () => {
  it("gives the row back instead of leaving a card with no coupon", async () => {
    await counterStamps(6);
    // The balance check reads the ledger first; the coverage check second.
    let reads = 0;
    gate = (q) => {
      if (!/^SELECT .*"loyalty_stamps"/.test(q.text)) return;
      reads += 1;
      if (reads === 2) {
        throw Object.assign(new Error("connection terminated"), { code: "" });
      }
    };
    tick();
    await expect(redeemStamps(MEMBER)).rejects.toThrow();
    gate = null;
    expect(reads).toBe(2);
    expect(ledger().filter((r) => r.kind === "redeem")).toHaveLength(0);
    expect(await loyaltyCoupons()).toHaveLength(0);
    tick();
    expect((await redeemStamps(MEMBER)).ok).toBe(true);
  });
});

describe("api output stays as it was", () => {
  it("coupon codes stay random; the id is the stamp sequence and never reaches the code", async () => {
    await counterStamps(12);
    tick();
    const r1 = await redeemStamps(MEMBER);
    tick();
    const r2 = await redeemStamps(MEMBER);
    if (!r1.ok || !r2.ok) throw new Error("redeem");
    expect(r1.coupon.id).toMatch(/^cpn-stamp-\d{6}$/);
    expect(r1.coupon.code).toMatch(/^[A-Z]+-[A-HJ-NP-Z2-9]{6}$/);
    expect(r1.coupon.code).not.toContain("stamp");
    expect(r1.coupon.code).not.toBe(r2.coupon.code);
  });
});

// ── property test ───────────────────────────────────────────────────────

/** Deterministic PRNG (LCG), so a failing case replays from its seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CASES = 3000;
const STEPS = 18;
const CHUNK = 100;
/** Chance that a step has one of its writes fail. */
const FAILURE_RATE = 0.3;
/** The fixed seed list: 3000 cases, run in chunks of 100. */
const SEEDS = Array.from({ length: CASES }, (_, i) => 7919 * (i + 1));

type Coupon = Awaited<ReturnType<typeof listCustomerCoupons>>[number];

/**
 * Fails the `nth` write (INSERT, UPDATE or DELETE) of the step, once. `after`
 * lets it commit first and loses only the answer, the way a dropped
 * connection does.
 */
function injectFailure(nth: number, after: boolean) {
  const state = { writes: 0, fired: false };
  gate = async (q) => {
    if (!/^(INSERT|UPDATE|DELETE)/.test(q.text)) return;
    state.writes += 1;
    if (state.writes !== nth) return;
    state.fired = true;
    if (after) await baseExec(q);
    throw Object.assign(new Error("connection terminated"), { code: "" });
  };
  return state;
}

/** Runs the calls at once; rethrows the first failure after all have ended. */
async function together(...calls: (() => Promise<unknown>)[]): Promise<void> {
  const settled = await Promise.allSettled(calls.map((call) => call()));
  const failed = settled.find((s) => s.status === "rejected");
  if (failed) throw (failed as PromiseRejectedResult).reason;
}

async function runCase(seed: number): Promise<void> {
  for (const t of Object.values(tables)) t.length = 0;
  let card = 6;
  setCardSize(card);
  const r = rng(seed);
  // A second stream for the failures and the till corrections, so the
  // operations below keep the sequences they always had.
  const x = rng(seed ^ 0x5bd1e995);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const orders = new Map<string, AdminOrder>();
  const held: { code: string; no: number }[] = [];
  let n = 0;
  let orderNo = 50000;
  const log: string[] = [];
  const where = () => `seed ${seed}: ${log.join(" | ")}`;
  const live = () => [...orders.values()].filter((o) => o.status === "paid");
  /** A write failed in the last step: how its caller tries again, if it may. */
  let pending: { redo: (() => Promise<unknown>) | null } | null = null;

  for (let step = 0; step < STEPS; step += 1) {
    tick();
    const before = await listCustomerCoupons(MEMBER);
    const reversalsBefore = ledger().filter(
      (x) => x.kind === "reversal",
    ).length;
    let released = false;
    let redo: (() => Promise<unknown>) | null = null;
    // Drawn every step, used or not, so the stream never shifts.
    const failRoll = x();
    const failAt = 1 + Math.floor(x() * 3);
    const failAfter = x() < 0.5;
    const tillRoll = x();
    const tillTwice = x() < 0.3;
    const healed = pending !== null;
    let injected: ReturnType<typeof injectFailure> | null = null;

    const operate = async (): Promise<void> => {
      if (tillRoll < 0.07) {
        // The till's "-1": a click, sometimes two at once.
        log.push(tillTwice ? "till -1 x2" : "till -1");
        const click = () => reverseCounterStamp(MEMBER, "kasa@laffogato.net");
        if (tillTwice) await together(click, click);
        else await click();
        return;
      }
      const op = Math.floor(r() * 12);
      if (op === 0) {
        log.push("till");
        await addCounterStamp(MEMBER, "kasa@laffogato.net");
      } else if (op <= 2) {
        n += 1;
        const goods = 10000 + Math.floor(r() * 120000);
        const ship = r() < 0.3 ? 3000 + Math.floor(r() * 4000) : 0;
        const o = order(`ord-${n}`, goods + ship, { shippingMinor: ship });
        orders.set(o.id, o);
        log.push(`pay ${o.id} ${goods}+${ship}`);
        redo = () => onOrderPaid(o);
        await onOrderPaid(o);
        if (r() < 0.2) await onOrderPaid(o); // a duplicate webhook
      } else if (op === 3 || op === 4) {
        // A partial refund, sometimes settled twice at once.
        const o = live().length ? pick(live()) : null;
        if (o) {
          const left =
            o.totalMinor - o.refunds.reduce((s, x) => s + x.amountMinor, 0);
          const amt = Math.max(1, Math.floor(r() * left * 0.6));
          const next = refunded(o, amt);
          orders.set(o.id, next);
          log.push(`refund ${o.id} ${amt}`);
          redo = () => onOrderReversed(next);
          if (r() < 0.25) {
            await together(redo, redo);
          } else await onOrderReversed(next);
        }
      } else if (op === 5) {
        const o = live().length ? pick(live()) : null;
        if (o) {
          const left =
            o.totalMinor - o.refunds.reduce((s, x) => s + x.amountMinor, 0);
          const next = {
            ...refunded(o, left),
            status: "refunded",
          } as AdminOrder;
          orders.set(o.id, next);
          log.push(`full refund ${o.id}`);
          redo = () => onOrderReversed(next, { full: true });
          await onOrderReversed(next, { full: true });
        }
      } else if (op === 6) {
        const o = live().length ? pick(live()) : null;
        if (o) {
          const next = { ...o, status: "cancelled" } as AdminOrder;
          orders.set(o.id, next);
          log.push(`cancel ${o.id}`);
          redo = () => onOrderReversed(next, { full: true });
          if (r() < 0.25) {
            await together(redo, redo);
          } else await onOrderReversed(next, { full: true });
        }
      } else if (op === 7 || op === 8) {
        log.push("redeem");
        // What the app shows is what the redeem does: a card shown ready is
        // granted, and none is granted that is not shown.
        const ready = core.computeStampBalance(rows(), card).rewardsReady;
        const res = await redeemStamps(MEMBER);
        if (!injected?.fired) {
          expect(res.ok, `redeem with ${ready} ready: ${where()}`).toBe(
            ready > 0,
          );
        }
      } else if (op === 9) {
        // Spend a coupon at a paid checkout, or hold it in an unpaid order.
        const unused = unusedLive(before).filter(
          (c) => c.source === "loyalty" || c.source === "milestone",
        );
        if (unused.length) {
          const c = pick(unused);
          const no = (orderNo += 1);
          await redeemCustomerCoupon(c.code, MEMBER, no);
          const hold = r() < 0.5;
          if (hold) held.push({ code: c.code, no });
          log.push(`${hold ? "hold" : "use"} ${c.code}`);
        }
      } else if (op === 10) {
        // The unpaid order is cancelled: the store hands the coupon back and
        // settles (`releaseOrderInventory`).
        if (held.length) {
          const h = held.splice(Math.floor(r() * held.length), 1)[0];
          log.push(`release ${h.code}`);
          if (await releaseCustomerCoupon(h.code, MEMBER, h.no)) {
            released = true;
            await settleLoyaltyDebt(MEMBER);
          }
        }
      } else {
        card = 3 + Math.floor(r() * 8);
        log.push(`card ${card}`);
        setCardSize(card);
      }
    };

    if (pending) {
      // The step after a failure is the next trigger: the caller tries again
      // (a replayed webhook, a second click on the cancel) and a settlement
      // runs. Whatever the failure left half done is finished now.
      log.push("retry + settle");
      const again = pending.redo;
      pending = null;
      if (again) await again();
      await settleLoyaltyDebt(MEMBER);
    } else {
      if (failRoll < FAILURE_RATE) {
        injected = injectFailure(failAt, failAfter);
        log.push(`[write ${failAt} fails ${failAfter ? "after" : "before"}]`);
      }
      try {
        await operate();
      } catch (err) {
        if (!injected?.fired) throw err;
      } finally {
        gate = null;
      }
      if (injected?.fired) pending = { redo };
    }
    const failedStep = Boolean(injected?.fired);

    const after = await listCustomerCoupons(MEMBER);
    const now = Date.now();
    const unusedFreeDrinks = unusedLive(after).filter(
      (c) =>
        c.source === "loyalty" &&
        !(c.expiresAt && Date.parse(c.expiresAt) < now),
    );

    // (b) A used coupon is never withdrawn, whatever failed.
    expect(
      after.filter((c) => c.redeemedAt && !c.isActive),
      `(b) ${where()}`,
    ).toEqual([]);
    const wasUsed = new Map(before.map((c) => [c.id, c.redeemedAt]));
    for (const c of after) {
      if (wasUsed.get(c.id) && !released) {
        expect(c.isActive, `(b) ${c.id}: ${where()}`).toBe(true);
      }
    }
    // A step with a failed write may leave a withdrawal half done; the next
    // step, a trigger, finishes it and everything below holds again.
    if (failedStep) continue;

    // (a) The stamps cover every standing card, or nothing unused is left.
    if (covered() < 0) {
      expect(unusedFreeDrinks, `(a) covered ${covered()}: ${where()}`).toEqual(
        [],
      );
    }

    // Nothing is left half done: no unused coupon on a withdrawn card, no
    // claim on a coupon the member spent, no coupon without its card.
    for (const c of after) {
      const own = c.source === "loyalty" ? core.redeemIdOfCoupon(c.id) : null;
      if (!own) continue;
      const claimed = unredeems().some((u) => u.id === core.unredeemId(own));
      if (c.isActive && !c.redeemedAt) {
        expect(
          ledger().some((x) => x.kind === "redeem" && x.id === own),
          `orphan ${c.id}: ${where()}`,
        ).toBe(true);
        expect(claimed, `half-done ${c.id}: ${where()}`).toBe(false);
      }
      if (c.redeemedAt) {
        expect(claimed, `stale claim ${c.id}: ${where()}`).toBe(false);
      }
    }

    // (c) Nothing is withdrawn by a step that reversed no stamp and
    // released no coupon (a retry after a failure may finish one).
    const reversedNow =
      ledger().filter((x) => x.kind === "reversal").length > reversalsBefore;
    const wasActive = new Set(
      before.filter((c) => c.isActive).map((c) => c.id),
    );
    const withdrawn: Coupon[] = after.filter(
      (c) => wasActive.has(c.id) && !c.isActive,
    );
    if (!reversedNow && !released && !healed) {
      expect(withdrawn, `(c) ${where()}`).toEqual([]);
    }

    // The ledger stays what the orders say.
    const held2 = core.stampsByOrder(rows());
    for (const o of orders.values()) {
      const earn = rows().find((x) => x.kind === "earn" && x.orderId === o.id);
      const want = Math.min(
        earn ? Number(earn.delta) : 0,
        core.stampTargetForOrder(o, { full: o.status !== "paid" }),
      );
      expect(held2.get(o.id) ?? 0, `${o.id}: ${where()}`).toBe(want);
    }
    // One standing card per live free drink.
    const standing =
      ledger().filter((x) => x.kind === "redeem").length - unredeems().length;
    expect(
      after.filter((c) => c.source === "loyalty" && c.isActive).length,
      `cards vs coupons: ${where()}`,
    ).toBe(standing);
    // No unused milestone gift above the lifetime after a reversal settled.
    const lifetime = core.computeStampBalance(rows()).lifetimeStamps;
    if (reversedNow || released || healed) {
      for (const g of await listMilestoneGrants(MEMBER)) {
        const c = after.find((x) => x.id === g.couponId);
        if (c && c.isActive && !c.redeemedAt) {
          expect(g.milestone, `milestone: ${where()}`).toBeLessThanOrEqual(
            lifetime,
          );
        }
      }
    }
  }
}

describe(`property: ${CASES} random sequences keep the invariant`, () => {
  for (let i = 0; i < CASES; i += CHUNK) {
    const chunk = SEEDS.slice(i, i + CHUNK);
    it(`seeds ${i + 1}-${i + chunk.length}`, { timeout: 120_000 }, async () => {
      for (const seed of chunk) await runCase(seed);
    });
  }
});
