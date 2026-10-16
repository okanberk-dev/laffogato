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
 * Same in-memory Postgres as `mobile-loyalty-refund-settle.test.ts`, plus a
 * gate that can pause one query so two requests interleave on purpose.
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
    for (let i = 0; i < 200 && !state.paused; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(state.paused).toBe(true);
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
/** The fixed seed list: 3000 cases, run in chunks of 100. */
const SEEDS = Array.from({ length: CASES }, (_, i) => 7919 * (i + 1));

type Coupon = Awaited<ReturnType<typeof listCustomerCoupons>>[number];

async function runCase(seed: number): Promise<void> {
  for (const t of Object.values(tables)) t.length = 0;
  let card = 6;
  setCardSize(card);
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const orders = new Map<string, AdminOrder>();
  const held: { code: string; no: number }[] = [];
  let n = 0;
  let orderNo = 50000;
  const log: string[] = [];
  const where = () => `seed ${seed}: ${log.join(" | ")}`;
  const live = () => [...orders.values()].filter((o) => o.status === "paid");

  for (let step = 0; step < STEPS; step += 1) {
    tick();
    const before = await listCustomerCoupons(MEMBER);
    const reversalsBefore = ledger().filter(
      (x) => x.kind === "reversal",
    ).length;
    let released = false;

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
        if (r() < 0.25) {
          await Promise.all([onOrderReversed(next), onOrderReversed(next)]);
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
        await onOrderReversed(next, { full: true });
      }
    } else if (op === 6) {
      const o = live().length ? pick(live()) : null;
      if (o) {
        const next = { ...o, status: "cancelled" } as AdminOrder;
        orders.set(o.id, next);
        log.push(`cancel ${o.id}`);
        if (r() < 0.25) {
          await Promise.all([
            onOrderReversed(next, { full: true }),
            onOrderReversed(next, { full: true }),
          ]);
        } else await onOrderReversed(next, { full: true });
      }
    } else if (op === 7 || op === 8) {
      log.push("redeem");
      // What the app shows is what the redeem does: a card shown ready is
      // granted, and none is granted that is not shown.
      const ready = core.computeStampBalance(rows(), card).rewardsReady;
      const res = await redeemStamps(MEMBER);
      expect(res.ok, `redeem with ${ready} ready: ${where()}`).toBe(ready > 0);
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

    const after = await listCustomerCoupons(MEMBER);
    const now = Date.now();
    const unusedFreeDrinks = unusedLive(after).filter(
      (c) =>
        c.source === "loyalty" &&
        !(c.expiresAt && Date.parse(c.expiresAt) < now),
    );

    // (a) The stamps cover every standing card, or nothing unused is left.
    if (covered() < 0) {
      expect(unusedFreeDrinks, `(a) covered ${covered()}: ${where()}`).toEqual(
        [],
      );
    }

    // (b) A used coupon is never withdrawn.
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

    // (c) Nothing is withdrawn by a step that reversed no stamp and
    // released no coupon.
    const reversedNow =
      ledger().filter((x) => x.kind === "reversal").length > reversalsBefore;
    const wasActive = new Set(
      before.filter((c) => c.isActive).map((c) => c.id),
    );
    const withdrawn: Coupon[] = after.filter(
      (c) => wasActive.has(c.id) && !c.isActive,
    );
    if (!reversedNow && !released) {
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
    if (reversedNow || released) {
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
