import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The köşk's late cancel made good, and the hour cancelled late and sold
 * again (19 Eki 2026; karaoke terms §7, §8, §9; OP-KARAOKE-GOODWILL,
 * ASK-OTH-3-CFG, D-KAR-1-99), through the real karaoke.ts and
 * karaoke-payment.ts over an in-memory table. The POS, the mail, the audit
 * log and the settings are scripted; `karaoke_charge_resold_hours` and
 * `karaoke_give_make_good_hour` are mirrored in JS the way the migration
 * writes them (tests/db-integration-karaoke-make-good.test.ts runs the real
 * ones, and their races, against Postgres).
 *
 * - Make-good: only `ariza`, `kapanis`, `diger`, only after the booking's
 *   own free moment, only what a late cancel would keep (> 0): the whole
 *   payment under 2 h / 0 %. `mucbir`, `misafir`, `yeniden` never. One of
 *   "Telafi saati ver" / "Telafi ödendi" closes the other; the IBAN is
 *   never stored.
 * - Resale: an hour cancelled late and paid for again refunds the share
 *   kept for it, each hour once, to the booking that cancelled it last; the
 *   debt is owed by hand (`refunding` + a staff alert) and a refund by hand
 *   asks only for what is left.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  tables: new Map<string, Row[]>(),
  appVersion: null as string | null,
  settings: {} as Record<string, unknown>,
  pos: "ok" as "ok" | "refused" | "timeout",
  refunds: [] as Array<{ ref: string; amountMinor: number }>,
  cancellations: [] as Array<Record<string, unknown>>,
  confirmations: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  /** What happened, in order (an rpc, a mail): the resale before the mail. */
  events: [] as string[],
  /** Runs once, inside the next rpc: another person's write in between. */
  beforeRpc: null as null | (() => void),
  /** Runs once, just before the next UPDATE is applied (the same, for writes). */
  beforeUpdate: null as null | (() => void),
  seq: 100,
}));

// ─── An in-memory stand-in for the query builder (src/lib/db/client.ts) ────

type Filter = (row: Row) => boolean;

/** karaoke_charge_resold_hours, as 20261020203619_karaoke_make_good.sql. */
function chargeResoldHoursSql(id: string, hours: number[]): number {
  const r = (h.tables.get("karaoke_reservations") ?? []).find(
    (x) => x.id === id,
  );
  if (
    !r ||
    r.status !== "cancelled" ||
    typeof r.refundMinor !== "number" ||
    !["refunding", "refunded"].includes(String(r.paymentStatus)) ||
    r.makeGoodFor
  ) {
    return 0;
  }
  const start = Number(r.startHour);
  const length = Number(r.hours);
  const counted = (r.resoldHours as number[] | null) ?? [];
  const fresh = [...new Set(hours)]
    .filter((x) => x >= start && x < start + length && !counted.includes(x))
    .sort((a, b) => a - b);
  if (fresh.length === 0) return 0;
  const before = Number(r.resaleRefundMinor ?? 0);
  const share = Number(r.refundMinor) - before;
  const kept = Number(r.paidMinor) - share;
  if (kept <= 0) return 0;
  const after = Math.round((kept * (counted.length + fresh.length)) / length);
  const wasRefunded = r.paymentStatus === "refunded";
  const refundBefore = Number(r.refundMinor);
  r.resoldHours = [...counted, ...fresh];
  r.resaleRefundMinor = after;
  r.refundMinor = share + after;
  if (after > before) {
    r.paymentStatus = "refunding";
    // What had already gone back when it owes money again.
    if (wasRefunded) r.refundSettledMinor = refundBefore;
  }
  return after - before;
}

/** karaoke_release_make_good_hour, as the same migration writes it. */
function releaseMakeGoodHourSql(a: Record<string, unknown>): string {
  const rows = h.tables.get("karaoke_reservations") ?? [];
  const hour = rows.find(
    (x) =>
      x.id === a.p_id &&
      x.status === "confirmed" &&
      x.paymentStatus === "none" &&
      x.makeGoodFor,
  );
  if (!hour) return "raced";
  hour.status = "cancelled";
  hour.updatedAt = a.p_now;
  if (a.p_reopen) {
    const original = rows.find(
      (x) =>
        x.id === hour.makeGoodFor &&
        x.makeGoodPaidMinor == null &&
        x.makeGoodUsedAt != null,
    );
    if (original) {
      original.makeGoodUsedAt = null;
      return "reopened";
    }
  }
  return "cancelled";
}

/** karaoke_give_make_good_hour, as the same migration writes it. */
function giveMakeGoodHourSql(a: Record<string, unknown>): {
  data: unknown;
  error: { code: string; message: string } | null;
} {
  const rows = h.tables.get("karaoke_reservations") ?? [];
  const r = rows.find((x) => x.id === a.p_for);
  if (
    !r ||
    r.status !== "cancelled" ||
    r.makeGoodMinor == null ||
    r.makeGoodUntil == null ||
    r.makeGoodUsedAt != null
  ) {
    return { data: "not_open", error: null };
  }
  if (String(a.p_today) > String(r.makeGoodUntil)) {
    return { data: "expired", error: null };
  }
  const start = Number(a.p_start_hour);
  const length = Number(r.hours);
  // karaoke_reservations_no_overlap
  if (
    rows.some(
      (x) =>
        x.status !== "cancelled" &&
        x.date === a.p_date &&
        start < Number(x.startHour) + Number(x.hours) &&
        Number(x.startHour) < start + length,
    )
  ) {
    return { data: null, error: { code: "23P01", message: "no_overlap" } };
  }
  // karaoke_reservations_make_good_once
  if (rows.some((x) => x.makeGoodFor === r.id && x.status !== "cancelled")) {
    return { data: null, error: { code: "23505", message: "make_good_once" } };
  }
  r.makeGoodUsedAt = a.p_now;
  rows.push({
    id: a.p_id,
    customerEmail: r.customerEmail,
    customerName: r.customerName,
    contactEmail: r.contactEmail ?? "",
    contactPhone: r.contactPhone ?? "",
    contactConsentAt: r.contactConsentAt ?? "",
    date: a.p_date,
    startHour: start,
    hours: length,
    guests: a.p_guests,
    status: "confirmed",
    priceMinor: 0,
    discountMinor: 0,
    totalMinor: 0,
    note: `Telafi: ${String(r.id).toUpperCase()}`,
    createdAt: a.p_now,
    updatedAt: a.p_now,
    paymentStatus: "none",
    paymentDueAt: "",
    paidAt: "",
    refundedAt: "",
    paidMinor: 0,
    paymentRef: "",
    channel: "staff",
    legalConsent: null,
    guest: r.guest === true,
    taxRatePct: a.p_tax_rate_pct,
    freeCancelHours: a.p_free_cancel_hours,
    lateRefundPercent: a.p_late_refund_percent,
    cancelDeadline: a.p_cancel_deadline,
    cancellationRules: a.p_cancellation_rules,
    refundMinor: null,
    makeGoodFor: r.id,
  });
  return { data: "given", error: null };
}

function fakeDb() {
  const table = (name: string) => {
    if (!h.tables.has(name)) h.tables.set(name, []);
    return h.tables.get(name)!;
  };
  return {
    rpc(fn: string, args: Record<string, unknown>) {
      h.rpcs.push({ fn, args });
      h.events.push(`rpc:${fn}`);
      if (h.beforeRpc) {
        const run = h.beforeRpc;
        h.beforeRpc = null;
        run();
      }
      if (fn === "karaoke_give_make_good_hour") {
        const res = giveMakeGoodHourSql(args);
        return Promise.resolve({
          ...res,
          status: res.error ? 409 : 200,
        });
      }
      const data =
        fn === "karaoke_charge_resold_hours"
          ? chargeResoldHoursSql(String(args.p_id), args.p_hours as number[])
          : fn === "karaoke_release_make_good_hour"
            ? releaseMakeGoodHourSql(args)
            : null;
      return Promise.resolve({ data, error: null, status: 200 });
    },
    from(name: string) {
      const filters: Filter[] = [];
      let op: "select" | "insert" | "update" | "delete" = "select";
      let payload: Row | Row[] | null = null;
      let returning = false;
      let single = false;
      let limit = Infinity;
      const q = {
        select(_cols?: string) {
          if (op !== "select") returning = true;
          return q;
        },
        insert(rows: Row | Row[]) {
          op = "insert";
          payload = rows;
          return q;
        },
        update(patch: Row) {
          op = "update";
          payload = patch;
          return q;
        },
        delete() {
          op = "delete";
          return q;
        },
        eq(col: string, v: unknown) {
          filters.push((r) => (v === null ? r[col] == null : r[col] === v));
          return q;
        },
        neq(col: string, v: unknown) {
          filters.push((r) => (v === null ? r[col] != null : r[col] !== v));
          return q;
        },
        ieq(col: string, v: string) {
          filters.push(
            (r) => String(r[col] ?? "").toLowerCase() === v.toLowerCase(),
          );
          return q;
        },
        in(col: string, list: unknown[]) {
          filters.push((r) => list.includes(r[col]));
          return q;
        },
        gte(col: string, v: string) {
          filters.push((r) => String(r[col] ?? "") >= v);
          return q;
        },
        lt(col: string, v: string) {
          filters.push((r) => String(r[col] ?? "") < v);
          return q;
        },
        order() {
          return q;
        },
        limit(n: number) {
          limit = n;
          return q;
        },
        maybeSingle() {
          single = true;
          return q;
        },
        then<T>(
          resolve: (v: {
            data: unknown;
            error: { code?: string; message: string } | null;
            status: number;
          }) => T,
        ) {
          const rows = table(name);
          const match = () => rows.filter((r) => filters.every((f) => f(r)));
          if (op === "insert") {
            const list = Array.isArray(payload) ? payload : [payload as Row];
            for (const row of list) {
              if (
                name === "payment_transactions" &&
                rows.some(
                  (r) =>
                    r.provider === row.provider &&
                    r.providerRef === row.providerRef,
                )
              ) {
                return Promise.resolve(
                  resolve({
                    data: null,
                    error: { code: "23505", message: "duplicate" },
                    status: 409,
                  }),
                );
              }
              // karaoke_reservations_make_good_once
              if (
                name === "karaoke_reservations" &&
                row.makeGoodFor &&
                rows.some(
                  (r) =>
                    r.makeGoodFor === row.makeGoodFor &&
                    r.status !== "cancelled",
                )
              ) {
                return Promise.resolve(
                  resolve({
                    data: null,
                    error: { code: "23505", message: "make_good_once" },
                    status: 409,
                  }),
                );
              }
              rows.push(structuredClone(row));
            }
            return Promise.resolve(
              resolve({ data: null, error: null, status: 201 }),
            );
          }
          if (op === "update") {
            if (h.beforeUpdate) {
              const run = h.beforeUpdate;
              h.beforeUpdate = null;
              run();
            }
            const hit = match();
            for (const r of hit) Object.assign(r, structuredClone(payload));
            return Promise.resolve(
              resolve({
                data: returning ? hit.map((r) => ({ id: r.id })) : null,
                error: null,
                status: 200,
              }),
            );
          }
          if (op === "delete") {
            const hit = new Set(match());
            h.tables.set(
              name,
              rows.filter((r) => !hit.has(r)),
            );
            return Promise.resolve(
              resolve({ data: null, error: null, status: 200 }),
            );
          }
          const found = match()
            .slice(0, limit)
            .map((r) => structuredClone(r));
          return Promise.resolve(
            resolve({
              data: single ? (found[0] ?? null) : found,
              error: null,
              status: 200,
            }),
          );
        },
      };
      return q;
    },
  };
}

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = fakeDb();
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/db/counters", () => ({
  nextSeq: vi.fn(async () => {
    h.seq += 1;
    return h.seq;
  }),
}));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => h.settings),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(async (row: Record<string, unknown>) => {
    h.audits.push(row);
  }),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit: vi.fn(async () => {}),
  reserveLoginAttempt: vi.fn(async () => ({
    blocked: false,
    retryAfterSeconds: 0,
  })),
}));
vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: async () => "" }));
vi.mock("@/lib/mobile/loyalty", () => ({ getLoyalty: async () => null }));
vi.mock("@/lib/mobile/checkout-ref", () => ({
  recordPendingCheckout: vi.fn(async () => {}),
}));
vi.mock("@/lib/mobile/karaoke-notify", () => ({
  notifyOperatorOfReservation: vi.fn(async () => {}),
}));
vi.mock("@/lib/mobile/karaoke-link", () => ({
  karaokeLinkUrl: () => "https://laffogato.net/rezervasyon?t=x",
  verifyKaraokeLink: () => true,
}));
vi.mock("@/lib/email/send", () => ({
  sendKaraokeCancellationEmail: vi.fn(async (k: Record<string, unknown>) => {
    h.cancellations.push(k);
    return true;
  }),
  sendKaraokeConfirmationEmail: vi.fn(async (k: Record<string, unknown>) => {
    h.confirmations.push(k);
    h.events.push(`mail:confirmation:${String(k.code)}`);
    return true;
  }),
  sendKaraokeLateRequestEmail: vi.fn(async () => true),
  sendKaraokeMoneyAlertEmail: vi.fn(async (a: Record<string, unknown>) => {
    h.alerts.push(a);
    return { ok: true };
  }),
  sendKaraokePaidOperatorEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/payment", async () => {
  const { PaymentRefusedError } = await import("@/lib/payment/provider");
  return {
    getPaymentProvider: () => ({
      name: "fakepos",
      refund: async (ref: string, amountMinor: number) => {
        if (h.pos === "refused") {
          throw new PaymentRefusedError("paynkolay refund reddedildi");
        }
        if (h.pos === "timeout") throw new Error("socket hang up");
        h.refunds.push({ ref, amountMinor });
        return { providerRef: ref, status: "succeeded" };
      },
    }),
  };
});
// The app lock (karaoke-time.ts) is the code's own null; a test that needs a
// late share opens it as the app follow-up would.
vi.mock("@/lib/mobile/karaoke-time", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/lib/mobile/karaoke-time")>();
  return {
    ...real,
    effectiveKaraokeCancelPolicy: (
      s: Parameters<typeof real.effectiveKaraokeCancelPolicy>[0],
    ) => real.effectiveKaraokeCancelPolicy(s, h.appVersion),
  };
});

const { DEFAULT_MOBILE_APP_CONFIG } = await import("@/lib/mobile/app-config");
const payment = await import("@/lib/mobile/karaoke-payment");
const core = await import("@/lib/mobile/karaoke-make-good-core");
const time = await import("@/lib/mobile/karaoke-time");
const panel = await import("@/lib/admin/karaoke-panel");

// 30 Ekim 2026, 20:00 in Tuzla.
const START = Date.parse("2026-10-30T17:00:00.000Z");
const HOUR = 3600_000;
const at = (hoursBefore: number) => new Date(START - hoursBefore * HOUR);
const MEMBER = {
  kind: "member" as const,
  email: "eda@example.com",
  emailVerified: true,
};
const staff = (cause: string) => ({
  kind: "staff" as const,
  actor: "yonetici@kosk",
  canRefund: true,
  reason: "Oda arızalı",
  cause: cause as never,
});

function settingsWith(policy: { hours: number; percent: number }) {
  return {
    karaokePrepay: true,
    karaokeHourlyMinor: 100_000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "",
    email: "kosk@example.com",
    taxRates: { karaoke: 20 },
    karaokeFreeCancelHours: policy.hours,
    karaokeLateRefundPercent: policy.percent,
    karaokeCancelPolicyAt: "2026-10-18T09:00:00.000Z",
    mobileApp: {
      ...DEFAULT_MOBILE_APP_CONFIG,
      minSupportedAppVersion: "1.1.0",
    },
  };
}

/** A paid, confirmed booking with its payment row. */
function booking(over: Partial<Row> = {}, paidMinor = 200_000): Row {
  const id = String(over.id ?? "krk-00042");
  const ref = String(over.paymentRef ?? "PNK-1");
  return {
    id,
    customerEmail: "eda@example.com",
    customerName: "Eda Yılmaz",
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: paidMinor,
    discountMinor: 0,
    totalMinor: paidMinor,
    note: "",
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:05:00.000Z",
    paymentStatus: "paid",
    paymentDueAt: "",
    paidAt: "2026-10-20T09:05:00.000Z",
    refundedAt: "",
    paidMinor,
    paymentRef: ref,
    channel: "web",
    guest: false,
    contactEmail: "",
    ...over,
  };
}

function seed(...rows: Row[]): void {
  h.tables.set("karaoke_reservations", rows);
  h.tables.set(
    "payment_transactions",
    rows
      .filter((r) => r.paymentRef)
      .map((r) => ({
        orderId: r.id,
        provider: "fakepos",
        providerRef: r.paymentRef,
        status: "succeeded",
        amountMinor: r.paidMinor,
        trxDate: "2026-10-20",
      })),
  );
}

const rowOf = (id: string) =>
  h.tables.get("karaoke_reservations")!.find((r) => r.id === id)!;
const claimOf = (ref: string) =>
  h.tables
    .get("payment_transactions")!
    .find((r) => r.providerRef === `${ref}:refund`);

beforeEach(() => {
  h.tables.clear();
  h.appVersion = null;
  h.settings = settingsWith({ hours: 2, percent: 0 });
  h.pos = "ok";
  h.refunds.length = 0;
  h.cancellations.length = 0;
  h.confirmations.length = 0;
  h.alerts.length = 0;
  h.audits.length = 0;
  h.rpcs.length = 0;
  h.events.length = 0;
  h.beforeRpc = null;
  h.beforeUpdate = null;
});

// ─── The rules, pure ───────────────────────────────────────────────────────

describe("the make-good rules (karaoke terms §8)", () => {
  const r = {
    date: "2026-10-30",
    startHour: 20,
    status: "confirmed",
    paidMinor: 200_000,
    totalMinor: 200_000,
    createdAt: "2026-10-20T09:00:00.000Z",
  };

  it("six calendar months, the last month's own day or its last (TBK m.92/3)", () => {
    expect(core.addCalendarMonths("2026-10-19", 6)).toBe("2027-04-19");
    expect(core.addCalendarMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(core.addCalendarMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(core.addCalendarMonths("2026-12-31", 6)).toBe("2027-06-30");
  });

  it("only the köşk's own reasons, only after the free moment, only what a late cancel keeps", () => {
    // 2 h / 0 %, one hour before the start: a late cancel keeps everything.
    for (const cause of ["ariza", "kapanis", "diger"] as const) {
      expect(core.karaokeMakeGoodFor(r, cause, at(1))).toEqual({
        until: "2027-04-30",
        minor: 200_000,
      });
    }
    // Force majeure, a guest's request, an hour given away: never.
    for (const cause of ["mucbir", "misafir", "yeniden", undefined] as const) {
      expect(core.karaokeMakeGoodFor(r, cause, at(1))).toBeNull();
    }
    // Inside the free window, the deadline minute included: none.
    expect(core.karaokeMakeGoodFor(r, "ariza", at(3))).toBeNull();
    expect(
      core.karaokeMakeGoodFor(r, "ariza", new Date(START - 2 * HOUR + 30_000)),
    ).toBeNull();
    // After the start (a closed köşk recorded the next day): everything.
    expect(core.karaokeMakeGoodFor(r, "kapanis", at(-5))?.minor).toBe(200_000);
    // Paid but never confirmed: the guest's own late cancel is refused all
    // the same (2 h / 0 %), so the köşk's late cancel makes it good too
    // (review R3: whoever bears the late rule gets the make-good).
    expect(
      core.karaokeMakeGoodFor({ ...r, status: "requested" }, "ariza", at(1)),
    ).toEqual({ until: "2027-04-30", minor: 200_000 });
    // Under a late share such a booking goes back in full when its guest
    // cancels late (it was never confirmed): nothing kept, nothing made good.
    expect(
      core.karaokeMakeGoodFor(
        {
          ...r,
          status: "requested",
          freeCancelHours: 24,
          lateRefundPercent: 50,
        },
        "ariza",
        at(10),
      ),
    ).toBeNull();
  });

  it("follows the booking's own rule: the kept part of a share, nothing at 100 %", () => {
    const half = { ...r, freeCancelHours: 24, lateRefundPercent: 50 };
    expect(core.karaokeMakeGoodFor(half, "ariza", at(10))?.minor).toBe(100_000);
    const all = { ...r, freeCancelHours: 24, lateRefundPercent: 100 };
    expect(core.karaokeMakeGoodFor(all, "ariza", at(10))).toBeNull();
  });
});

describe("the resale rules (ASK-OTH-3-CFG)", () => {
  const late = (over: Partial<Row>) =>
    ({
      id: "krk-a",
      date: "2026-10-30",
      startHour: 20,
      hours: 2,
      status: "cancelled",
      paymentStatus: "refunding",
      paidMinor: 200_000,
      totalMinor: 200_000,
      refundMinor: 100_000,
      updatedAt: "2026-10-30T10:00:00.000Z",
      ...over,
    }) as never;

  it("each hour to the booking that cancelled it last, never twice", () => {
    const a = late({});
    const b = late({
      id: "krk-b",
      startHour: 20,
      hours: 1,
      updatedAt: "2026-10-30T12:00:00.000Z",
    });
    const sold = {
      id: "krk-c",
      date: "2026-10-30",
      startHour: 20,
      hours: 3,
      totalMinor: 300_000,
    };
    expect(core.resaleAllocation(sold, [a, b])).toEqual([
      { id: "krk-b", hours: [20] },
      { id: "krk-a", hours: [21] },
    ]);
    // An hour already refunded to its last canceller is not counted again.
    const bDone = late({
      id: "krk-b",
      hours: 1,
      updatedAt: "2026-10-30T12:00:00.000Z",
      resoldHours: [20],
    });
    expect(core.resaleAllocation(sold, [a, bDone])).toEqual([
      { id: "krk-a", hours: [21] },
    ]);
  });

  it("a booking that went back in full, a free hour and an hour booked for nothing are no part of it", () => {
    const full = late({ paymentStatus: "refunded", refundMinor: null });
    const sold = {
      id: "krk-c",
      date: "2026-10-30",
      startHour: 20,
      hours: 2,
      totalMinor: 200_000,
    };
    expect(core.resaleAllocation(sold, [full])).toEqual([]);
    expect(
      core.resaleAllocation({ ...sold, makeGoodFor: "krk-a" }, [late({})]),
    ).toEqual([]);
    // Another day.
    expect(
      core.resaleAllocation({ ...sold, date: "2026-10-31" }, [late({})]),
    ).toEqual([]);
    // 0 TL (a 100 % ORO discount): the köşk earned nothing from the hour,
    // so there is nothing to set off (TBK m.325/2 kıyasen).
    expect(
      core.resaleAllocation({ ...sold, totalMinor: 0 }, [late({})]),
    ).toEqual([]);
    // Paid at the köşk (a total above 0): a sale like any other.
    expect(core.resaleAllocation(sold, [late({})])).toEqual([
      { id: "krk-a", hours: [20, 21] },
    ]);
  });

  it("the parts add up to exactly what was kept", () => {
    const kept = 1001;
    const parts = [1, 2, 3].map((n) => core.resaleRefundTotal(kept, 3, n));
    expect(parts.at(-1)).toBe(kept);
    expect(parts).toEqual([334, 667, 1001]);
  });
});

// ─── The köşk cancels late ─────────────────────────────────────────────────

describe("a köşk cancel after the free moment", () => {
  it("ariza: the whole refund, and a make-good of what a late cancel keeps", async () => {
    seed(booking());
    const res = await payment.cancelKaraokeReservation(
      "krk-00042",
      staff("ariza"),
      { now: at(1) },
    );
    expect(res).toMatchObject({
      ok: true,
      refunded: true,
      makeGood: { minor: 200_000, until: "2027-04-30" },
    });
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
    expect(rowOf("krk-00042")).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunded",
      makeGoodUntil: "2027-04-30",
      makeGoodMinor: 200_000,
    });
    expect(rowOf("krk-00042").makeGoodUsedAt ?? null).toBeNull();
    // The guest's mail offers it, with the amount and the last day.
    expect(h.cancellations.at(-1)).toMatchObject({
      cancelCause: "ariza",
      refundedMinor: 200_000,
      makeGood: { minor: 200_000, until: "30 Nisan 2027" },
    });
  });

  it("before the free moment ends: the whole refund, no make-good", async () => {
    seed(booking());
    const res = await payment.cancelKaraokeReservation(
      "krk-00042",
      staff("kapanis"),
      { now: at(5) },
    );
    expect(res).toMatchObject({ ok: true, refunded: true });
    expect(res.ok && res.makeGood).toBeFalsy();
    expect(rowOf("krk-00042").makeGoodUntil ?? null).toBeNull();
    expect(h.cancellations.at(-1)?.makeGood).toBeUndefined();
  });

  it.each(["mucbir", "yeniden"])("%s: never a make-good", async (cause) => {
    seed(booking());
    const res = await payment.cancelKaraokeReservation(
      "krk-00042",
      staff(cause),
      { now: at(1) },
    );
    expect(res).toMatchObject({ ok: true, refunded: true });
    expect(rowOf("krk-00042").makeGoodMinor ?? null).toBeNull();
  });

  it("misafir refunded in full anyway: not the köşk's cancel, no make-good", async () => {
    seed(booking());
    const res = await payment.cancelKaraokeReservation(
      "krk-00042",
      {
        ...staff("misafir"),
        channel: "telefon",
        requestedAt: at(1),
        fullRefund: true,
      },
      { now: at(1) },
    );
    expect(res).toMatchObject({ ok: true, refunded: true });
    expect(rowOf("krk-00042").makeGoodMinor ?? null).toBeNull();
  });

  it("a declined refund: the booking stands and nothing is made good", async () => {
    seed(booking());
    h.pos = "refused";
    const res = await payment.cancelKaraokeReservation(
      "krk-00042",
      staff("ariza"),
      { now: at(1) },
    );
    expect(res).toMatchObject({ ok: false, reason: "refund_refused" });
    expect(rowOf("krk-00042")).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
      makeGoodUntil: null,
      makeGoodMinor: null,
    });
  });

  it("an unanswered refund keeps the make-good for when it is settled", async () => {
    seed(booking());
    h.pos = "timeout";
    const res = await payment.cancelKaraokeReservation(
      "krk-00042",
      staff("diger"),
      { now: at(1) },
    );
    expect(res).toMatchObject({ ok: false, reason: "refund_unknown" });
    expect(rowOf("krk-00042")).toMatchObject({
      paymentStatus: "refunding",
      makeGoodMinor: 200_000,
    });
    // The person settles it: the guest's mail then carries the make-good.
    const settled = await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(0),
    );
    expect(settled.ok).toBe(true);
    expect(h.cancellations.at(-1)).toMatchObject({
      makeGood: { minor: 200_000 },
    });
  });
});

// ─── Using it ──────────────────────────────────────────────────────────────

describe("Telafi saati ver / Telafi ödendi", () => {
  async function cancelledLate(): Promise<void> {
    seed(
      booking({
        contactEmail: "eda@example.com",
        contactPhone: "+905321234567",
      }),
    );
    await payment.cancelKaraokeReservation("krk-00042", staff("ariza"), {
      now: at(1),
    });
  }

  it("gives a free confirmed hour of the same length to the same guest", async () => {
    await cancelledLate();
    const res = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 21 },
      "yonetici@kosk",
      at(0),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const hour = rowOf(res.reservation.id);
    expect(hour).toMatchObject({
      customerEmail: "eda@example.com",
      contactPhone: "+905321234567",
      date: "2026-11-06",
      startHour: 21,
      hours: 2,
      guests: 4,
      status: "confirmed",
      paymentStatus: "none",
      totalMinor: 0,
      paidMinor: 0,
      channel: "staff",
      note: "Telafi: KRK-00042",
      makeGoodFor: "krk-00042",
      legalConsent: null,
    });
    expect(typeof rowOf("krk-00042").makeGoodUsedAt).toBe("string");
    // Its confirmation says nothing is paid for it.
    expect(h.confirmations.at(-1)).toMatchObject({
      makeGoodHourFor: "krk-00042",
      payment: { kind: "venue" },
    });
    // The other option closes, and so does a second hour.
    expect(
      await payment.recordKaraokeMakeGoodPaid(
        "krk-00042",
        { paidOn: "2026-10-30", amountMinor: 200_000 },
        "yonetici@kosk",
        at(0),
      ),
    ).toMatchObject({ ok: false, reason: "not_open" });
    expect(
      await payment.giveKaraokeMakeGoodHour(
        "krk-00042",
        { date: "2026-11-07", startHour: 21 },
        "yonetici@kosk",
        at(0),
      ),
    ).toMatchObject({ ok: false, reason: "not_open" });
    expect(h.audits.map((a) => (a.payload as Row).event)).toEqual(
      expect.arrayContaining(["make_good_hour_given", "make_good_hour"]),
    );
  });

  it("a day or an hour the room does not take points at its own box", async () => {
    await cancelledLate();
    const late = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 23 },
      "yonetici@kosk",
      at(0),
    );
    // 23:00 for two hours runs past the 24:00 close: the hour's box.
    expect(late).toMatchObject({ ok: false, reason: "invalid", field: "saat" });
    const past = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-10-29", startHour: 20 },
      "yonetici@kosk",
      at(0),
    );
    expect(past).toMatchObject({
      ok: false,
      reason: "invalid",
      field: "tarih",
    });
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("open");
  });

  it("a taken hour is refused and the make-good stays open", async () => {
    await cancelledLate();
    h.tables.get("karaoke_reservations")!.push(
      booking({
        id: "krk-00050",
        date: "2026-11-06",
        startHour: 20,
        paymentRef: "PNK-9",
      }),
    );
    const res = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 21 },
      "yonetici@kosk",
      at(0),
    );
    expect(res).toMatchObject({ ok: false, reason: "slot_taken" });
    expect(rowOf("krk-00042").makeGoodUsedAt ?? null).toBeNull();
  });

  it("records the transfer's day and amount, never an IBAN, and closes the hour", async () => {
    await cancelledLate();
    const less = await payment.recordKaraokeMakeGoodPaid(
      "krk-00042",
      { paidOn: "2026-10-30", amountMinor: 199_999 },
      "yonetici@kosk",
      at(0),
    );
    expect(less).toMatchObject({ ok: false, reason: "invalid" });
    const ahead = await payment.recordKaraokeMakeGoodPaid(
      "krk-00042",
      { paidOn: "2026-11-30", amountMinor: 200_000 },
      "yonetici@kosk",
      at(0),
    );
    expect(ahead).toMatchObject({ ok: false, reason: "invalid" });
    const ok = await payment.recordKaraokeMakeGoodPaid(
      "krk-00042",
      { paidOn: "2026-10-30", amountMinor: 200_000 },
      "yonetici@kosk",
      at(0),
      { reason: "Havale yapıldı" },
    );
    expect(ok.ok).toBe(true);
    const r = rowOf("krk-00042");
    expect(r).toMatchObject({
      makeGoodPaidMinor: 200_000,
      makeGoodPaidOn: "2026-10-30",
    });
    expect(JSON.stringify(r).toLowerCase()).not.toContain("iban");
    expect(core.makeGoodStateOf(r as never)).toBe("paid");
    expect(
      await payment.giveKaraokeMakeGoodHour(
        "krk-00042",
        { date: "2026-11-06", startHour: 21 },
        "yonetici@kosk",
        at(0),
      ),
    ).toMatchObject({ ok: false, reason: "not_open" });
  });

  it("past its last day the free hour is gone, the money is not", async () => {
    await cancelledLate();
    const later = new Date("2027-05-01T09:00:00.000Z");
    expect(
      await payment.giveKaraokeMakeGoodHour(
        "krk-00042",
        { date: "2027-05-02", startHour: 21 },
        "yonetici@kosk",
        later,
      ),
    ).toMatchObject({ ok: false, reason: "expired" });
    expect(
      await payment.recordKaraokeMakeGoodPaid(
        "krk-00042",
        { paidOn: "2027-05-01", amountMinor: 200_000 },
        "yonetici@kosk",
        later,
      ),
    ).toMatchObject({ ok: true });
  });

  it("the free hour cancelled before it begins opens the make-good again", async () => {
    await cancelledLate();
    const given = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 21 },
      "yonetici@kosk",
      at(0),
    );
    expect(given.ok).toBe(true);
    if (!given.ok) return;
    const res = await payment.cancelKaraokeReservation(
      given.reservation.id,
      MEMBER,
      { now: at(0) },
    );
    expect(res).toMatchObject({ ok: true, refunded: false });
    expect(rowOf(given.reservation.id).status).toBe("cancelled");
    expect(rowOf("krk-00042").makeGoodUsedAt).toBeNull();
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("open");
    // The cancel and the reopen were one statement.
    expect(h.rpcs.map((c) => c.fn)).toContain("karaoke_release_make_good_hour");
    expect(h.audits.map((a) => (a.payload as Row).event)).toContain(
      "make_good_reopened",
    );
  });

  it("a free hour written off once it began does not open the make-good again", async () => {
    await cancelledLate();
    const given = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 21 },
      "yonetici@kosk",
      at(0),
    );
    expect(given.ok).toBe(true);
    if (!given.ok) return;
    // 6 Kasım 23:30 in Tuzla: the hour began at 21:00 and is over.
    const res = await payment.cancelKaraokeReservation(
      given.reservation.id,
      staff("diger"),
      { now: new Date("2026-11-06T20:30:00.000Z") },
    );
    expect(res).toMatchObject({ ok: true, refunded: false, silent: true });
    expect(rowOf(given.reservation.id).status).toBe("cancelled");
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("hour");
  });

  it("an hour taken between the check and the write: refused, the make-good stays open", async () => {
    await cancelledLate();
    // Another booking takes 21:00 after the page's check, inside the write.
    h.beforeRpc = () => {
      h.tables.get("karaoke_reservations")!.push(
        booking({
          id: "krk-00051",
          date: "2026-11-06",
          startHour: 21,
          hours: 1,
          paymentRef: "PNK-8",
        }),
      );
    };
    const res = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 21 },
      "yonetici@kosk",
      at(0),
    );
    expect(res).toMatchObject({ ok: false, reason: "slot_taken" });
    expect(rowOf("krk-00042").makeGoodUsedAt ?? null).toBeNull();
    expect(
      h.tables.get("karaoke_reservations")!.filter((r) => r.makeGoodFor),
    ).toEqual([]);
    expect(h.confirmations).toEqual([]);
    expect(
      h.audits.filter((a) =>
        String((a.payload as Row).event).startsWith("make_good"),
      ),
    ).toEqual([]);
  });

  it("the money recorded in between: the hour is refused, nothing written", async () => {
    await cancelledLate();
    h.beforeRpc = () => {
      Object.assign(rowOf("krk-00042"), {
        makeGoodUsedAt: at(0).toISOString(),
        makeGoodPaidMinor: 200_000,
        makeGoodPaidOn: "2026-10-30",
      });
    };
    const res = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 21 },
      "yonetici@kosk",
      at(0),
    );
    expect(res).toMatchObject({ ok: false, reason: "raced" });
    expect(
      h.tables.get("karaoke_reservations")!.filter((r) => r.makeGoodFor),
    ).toEqual([]);
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("paid");
  });

  it("a note with an IBAN or a card number is refused and nothing is written", async () => {
    await cancelledLate();
    for (const note of [
      "Havale TR33 0006 1005 1978 6457 8413 26 hesabına",
      "tr330006100519786457841326",
      "Hesap 33 0006 1005 1978 6457 8413 26",
      "Kart 4111 1111 1111 1111",
    ]) {
      const res = await payment.recordKaraokeMakeGoodPaid(
        "krk-00042",
        { paidOn: "2026-10-30", amountMinor: 200_000 },
        "yonetici@kosk",
        at(0),
        { reason: note },
      );
      expect(res, note).toMatchObject({
        ok: false,
        reason: "invalid",
        field: "reason",
      });
    }
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("open");
    expect(JSON.stringify(h.audits)).not.toMatch(/0006|4111/);
    // A note without one passes.
    const ok = await payment.recordKaraokeMakeGoodPaid(
      "krk-00042",
      { paidOn: "2026-10-30", amountMinor: 200_000 },
      "yonetici@kosk",
      at(0),
      { reason: "30 Eki havale yapıldı, dekont no 123456789012345 muhasebede" },
    );
    expect(ok.ok).toBe(true);
  });

  it("the free hour's page names its market value, KDV declared by the köşk", () => {
    const v = panel.makeGoodHourMarketValue(100_000, 2, 20);
    expect(v.amountMinor).toBe(200_000);
    expect(v.note).toBe(
      "Emsal bedel ₺2.000,00 (saatlik ücret ₺1.000,00 x 2 saat, KDV %20 dahil), KDV köşkçe beyan edilir. Misafirden para alınmaz.",
    );
  });

  it("the panel offers both while open, needs the refund right, and none on a booking without one", () => {
    const now = at(0);
    const ctx = { today: "2026-10-30", now, prepay: true, canRefund: true };
    const open = booking({
      status: "cancelled",
      paymentStatus: "refunded",
      makeGoodUntil: "2027-04-30",
      makeGoodMinor: 200_000,
    }) as never;
    const v = panel.karaokeRowView(open, ctx);
    expect(v.makeGood).toBe("open");
    expect(v.plan.makeGoodHour).toEqual({});
    expect(v.plan.makeGoodPaid).toEqual({});
    const staffOnly = panel.karaokeRowView(open, { ...ctx, canRefund: false });
    expect(staffOnly.plan.makeGoodHour?.disabledReason).toBe(
      panel.REFUND_PERMISSION_REASON,
    );
    const expired = panel.karaokeRowView(open, {
      ...ctx,
      now: new Date("2027-05-01T09:00:00.000Z"),
    });
    expect(expired.plan.makeGoodHour?.disabledReason).toMatch(/son günü/);
    expect(expired.plan.makeGoodPaid).toEqual({});
    const none = panel.karaokeRowView(booking() as never, ctx);
    expect(none.plan.makeGoodHour).toBeNull();
    expect(none.plan.makeGoodPaid).toBeNull();
    // The free hour reads as one, and bills nothing (its KDV is declared on
    // the market value).
    const hour = booking({
      paymentStatus: "none",
      totalMinor: 0,
      paidMinor: 0,
      channel: "staff",
      makeGoodFor: "krk-00042",
    }) as never;
    expect(panel.paymentLabel(hour)).toBe("Telafi saati, ücretsiz");
    expect(panel.channelLabel("staff")).toBe("Köşk (telafi saati)");
    expect(
      panel.karaokeBillableMinor(hour, new Date("2026-11-01T00:00:00Z")),
    ).toBeNull();
  });
});

// ─── The hour sold again ───────────────────────────────────────────────────

describe("an hour cancelled late and sold again", () => {
  const HALF = { freeCancelHours: 24, lateRefundPercent: 50 };

  /** A, booked 20-22 under 24 h / 50 %, cancelled late by its member. */
  async function lateCancelled(): Promise<void> {
    h.appVersion = "1.1.0";
    h.settings = settingsWith({ hours: 24, percent: 50 });
    seed(booking({ ...HALF }));
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(10),
    });
    expect(res).toMatchObject({ ok: true, refundOwedMinor: 100_000 });
  }

  /** B, a hold for `startHour`..+`hours` that its payment confirms. */
  async function soldAgain(
    id: string,
    startHour: number,
    hours: number,
    ref: string,
    now = at(5),
  ) {
    h.tables.get("karaoke_reservations")!.push(
      booking({
        id,
        customerEmail: "deniz@example.com",
        startHour,
        hours,
        status: "requested",
        paymentStatus: "pending",
        paidMinor: 0,
        paymentRef: "",
        totalMinor: 100_000 * hours,
        ...HALF,
      }),
    );
    return payment.applyKaraokePaymentSucceeded({
      reservationId: id,
      provider: "fakepos",
      providerRef: ref,
      amountMinor: 100_000 * hours,
      currency: "TRY",
      trxDate: "2026-10-30",
      now,
    });
  }

  it("the share kept for the hour is owed back, by hand, and the köşk is told", async () => {
    await lateCancelled();
    const res = await soldAgain("krk-00043", 20, 1, "PNK-2");
    expect(res).toMatchObject({ ok: true, outcome: "paid" });
    expect(rowOf("krk-00043").status).toBe("confirmed");
    // kept 100.000 over 2 hours; one hour sold: 50.000 more goes back.
    expect(rowOf("krk-00042")).toMatchObject({
      paymentStatus: "refunding",
      refundMinor: 150_000,
      resaleRefundMinor: 50_000,
      resoldHours: [20],
    });
    expect(h.alerts.at(-1)).toMatchObject({
      title: "Geç iptal edilen saat yeniden satıldı",
    });
    expect(String(h.alerts.at(-1)?.summary)).toContain("₺500,00");
    // Never sent to the POS: a person refunds it.
    expect(h.refunds).toEqual([]);
    expect(
      await payment.retryKaraokeRefund("krk-00042", "yonetici@kosk", at(4)),
    ).toMatchObject({ ok: false, reason: "by_hand" });
    // The same payment reported again counts nothing twice.
    await payment.applyKaraokePaymentSucceeded({
      reservationId: "krk-00043",
      provider: "fakepos",
      providerRef: "PNK-2",
      amountMinor: 100_000,
      currency: "TRY",
      now: at(4),
    });
    expect(rowOf("krk-00042").refundMinor).toBe(150_000);
  });

  it("after the share was refunded, a resale asks only for the rest and its mail says so", async () => {
    await lateCancelled();
    await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(9),
      { shownRefundMinor: 100_000 },
    );
    expect(rowOf("krk-00042")).toMatchObject({ paymentStatus: "refunded" });
    // The first step leaves nothing "before" it.
    expect(rowOf("krk-00042").refundSettledMinor ?? null).toBeNull();
    await soldAgain("krk-00043", 20, 2, "PNK-2");
    expect(rowOf("krk-00042")).toMatchObject({
      paymentStatus: "refunding",
      refundMinor: 200_000,
      resaleRefundMinor: 100_000,
      refundSettledMinor: 100_000,
    });
    expect(panel.refundOwedNowMinor(rowOf("krk-00042") as never)).toBe(100_000);
    const v = panel.karaokeRowView(rowOf("krk-00042") as never, {
      today: "2026-10-30",
      now: at(4),
      prepay: true,
      canRefund: true,
    });
    expect(v.attention).toContain("resale_owed");
    expect(v.plan.settle).toEqual({ kind: "share" });
    expect(v.plan.refund).toBeNull();
    h.cancellations.length = 0;
    const settled = await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(3),
      { shownRefundMinor: 200_000 },
    );
    expect(settled.ok).toBe(true);
    expect(h.cancellations.at(-1)).toMatchObject({
      refundedMinor: 100_000,
      refundIsShare: true,
      refundIsResaleTopUp: true,
    });
    // The ledger says what went back in all; the row keeps what went back
    // before the last step, so the step itself stays readable (Gün sonu).
    expect(claimOf("PNK-1")).toMatchObject({
      status: "refunded",
      amountMinor: 200_000,
    });
    expect(rowOf("krk-00042")).toMatchObject({
      paymentStatus: "refunded",
      refundMinor: 200_000,
      refundSettledMinor: 100_000,
    });
    expect(panel.refundOwedNowMinor(rowOf("krk-00042") as never)).toBe(100_000);
  });

  it("a refund by hand that a resale overtakes loses, and the larger amount stays owed", async () => {
    await lateCancelled();
    await soldAgain("krk-00043", 20, 1, "PNK-2");
    expect(rowOf("krk-00042")).toMatchObject({ refundMinor: 150_000 });
    // The person refunds the 1.500 the page showed; the other hour is sold
    // in between (its row lock, before this write).
    h.beforeUpdate = () => {
      chargeResoldHoursSql("krk-00042", [21]);
    };
    const lost = await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(4),
      { shownRefundMinor: 150_000 },
    );
    expect(lost).toMatchObject({ ok: false, reason: "raced" });
    expect(rowOf("krk-00042")).toMatchObject({
      paymentStatus: "refunding",
      refundMinor: 200_000,
    });
    // Read again, it records all of it, and says the resale was in it.
    h.cancellations.length = 0;
    const settled = await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(3),
      { shownRefundMinor: 200_000 },
    );
    expect(settled.ok).toBe(true);
    expect(h.cancellations.at(-1)).toMatchObject({
      refundedMinor: 200_000,
      refundIsShare: true,
      refundIncludesResale: true,
    });
    expect(h.cancellations.at(-1)?.refundIsResaleTopUp).toBeUndefined();
  });

  it("all of it sold again: what goes back equals the payment and still never reaches the POS", async () => {
    await lateCancelled();
    await soldAgain("krk-00043", 20, 2, "PNK-2");
    expect(rowOf("krk-00042")).toMatchObject({
      paymentStatus: "refunding",
      refundMinor: 200_000,
      resaleRefundMinor: 100_000,
    });
    // The parts add up to the whole payment, yet it stays a refund by hand:
    // the POS would send the whole payment again (rule 25).
    expect(time.isPartialRefund(rowOf("krk-00042") as never)).toBe(true);
    expect(
      await payment.retryKaraokeRefund("krk-00042", "yonetici@kosk", at(4)),
    ).toMatchObject({ ok: false, reason: "by_hand" });
    const v = panel.karaokeRowView(rowOf("krk-00042") as never, {
      today: "2026-10-30",
      now: at(4),
      prepay: true,
      canRefund: true,
    });
    expect(v.plan.refund).toBeNull();
    expect(v.plan.settle).toEqual({ kind: "share" });
    expect(h.refunds).toEqual([]);
  });

  it("charges the resale right after the sale, before the guest's mail", async () => {
    await lateCancelled();
    await soldAgain("krk-00043", 20, 1, "PNK-2");
    const charge = h.events.indexOf("rpc:karaoke_charge_resold_hours");
    const mail = h.events.indexOf("mail:confirmation:krk-00043");
    expect(charge).toBeGreaterThanOrEqual(0);
    expect(mail).toBeGreaterThan(charge);
  });

  it("each hour once, to the booking that cancelled it last", async () => {
    await lateCancelled();
    // B takes 20:00 and is cancelled late in turn.
    await soldAgain("krk-00043", 20, 1, "PNK-2", at(9));
    const bCancel = await payment.cancelKaraokeReservation(
      "krk-00043",
      { kind: "member", email: "deniz@example.com", emailVerified: true },
      { now: at(8) },
    );
    expect(bCancel).toMatchObject({ ok: true, refundOwedMinor: 50_000 });
    expect(rowOf("krk-00042").resoldHours).toEqual([20]);
    // C takes both hours: 20:00 counts to B (cancelled last), 21:00 to A.
    await soldAgain("krk-00044", 20, 2, "PNK-3", at(6));
    expect(rowOf("krk-00043")).toMatchObject({
      resoldHours: [20],
      resaleRefundMinor: 50_000,
      refundMinor: 100_000,
    });
    expect(rowOf("krk-00042")).toMatchObject({
      resoldHours: [20, 21],
      resaleRefundMinor: 100_000,
      refundMinor: 200_000,
    });
  });

  it("a free hour the köşk gives is not a sale", async () => {
    await lateCancelled();
    // Another evening the köşk cancelled late, made good on A's hours.
    h.tables.get("karaoke_reservations")!.push(
      booking({
        id: "krk-00010",
        date: "2026-10-25",
        status: "cancelled",
        paymentStatus: "refunded",
        paymentRef: "PNK-0",
        makeGoodUntil: "2027-04-25",
        makeGoodMinor: 200_000,
      }),
    );
    const given = await payment.giveKaraokeMakeGoodHour(
      "krk-00010",
      { date: "2026-10-30", startHour: 20 },
      "yonetici@kosk",
      at(5),
    );
    expect(given.ok).toBe(true);
    expect(h.rpcs.map((c) => c.fn)).toEqual(["karaoke_give_make_good_hour"]);
    expect(rowOf("krk-00042")).toMatchObject({ refundMinor: 100_000 });
    expect(rowOf("krk-00042").resoldHours ?? null).toBeNull();
  });
});

describe("the late share and its sentence (D-KAR-1-99)", () => {
  it("a share of 1..99 % is a rule the panel saves, and says the resale refund", () => {
    expect(
      time.karaokeCancelPolicyRefusal({
        freeCancelHours: 24,
        lateRefundPercent: 50,
      }),
    ).toBeNull();
    const [, lateRule] = time.karaokeCancellationRules({
      freeCancelHours: 24,
      lateRefundPercent: 50,
    }).rules;
    expect(lateRule).toContain("en geç 14 gün içinde kartına iade edilir");
    expect(lateRule).toContain(
      "Geç iptal ettiğin saat başka bir misafire satılırsa o saat için sende kalan tutar da kartına iade edilir.",
    );
  });
});

// ─── The money review of PR #191 (21 Ekim 2026) ────────────────────────────

describe("review: the money fixes", () => {
  const HALF = { freeCancelHours: 24, lateRefundPercent: 50 };
  async function lateCancelled(): Promise<void> {
    h.appVersion = "1.1.0";
    h.settings = settingsWith({ hours: 24, percent: 50 });
    seed(booking({ ...HALF }));
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(10),
    });
    expect(res).toMatchObject({ ok: true, refundOwedMinor: 100_000 });
  }

  it("M1: a share is recorded only at the amount the page showed", async () => {
    await lateCancelled();
    // No amount (an old page), or another amount than the row names: refused.
    for (const opts of [{}, { shownRefundMinor: 50_000 }]) {
      const res = await payment.settleKaraokeRefundByHand(
        "krk-00042",
        "yonetici@kosk",
        at(9),
        opts,
      );
      expect(res).toMatchObject({
        ok: false,
        reason: "raced",
        message: payment.KARAOKE_SETTLE_STALE,
      });
    }
    expect(rowOf("krk-00042")).toMatchObject({ paymentStatus: "refunding" });
    expect(claimOf("PNK-1")).toBeUndefined();
    // No refund mail (the cancel's own "will be refunded" mail aside).
    expect(
      h.cancellations.filter((m) => m.refundedMinor !== undefined),
    ).toEqual([]);
    const ok = await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(9),
      { shownRefundMinor: 100_000 },
    );
    expect(ok.ok).toBe(true);
    expect(rowOf("krk-00042")).toMatchObject({
      paymentStatus: "refunded",
      refundSteps: [{ minor: 100_000, at: at(9).toISOString() }],
    });
  });

  it("M3: each refund by hand stays a step of its own, with its amount and instant", async () => {
    await lateCancelled();
    await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(9),
      {
        shownRefundMinor: 100_000,
      },
    );
    chargeResoldHoursSql("krk-00042", [20]);
    await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(3),
      {
        shownRefundMinor: 150_000,
      },
    );
    const r = rowOf("krk-00042");
    expect(r.refundSteps).toEqual([
      { minor: 100_000, at: at(9).toISOString() },
      { minor: 50_000, at: at(3).toISOString() },
    ]);
    // The booking's history shows both, not one total at the last instant.
    const items = panel
      .karaokeHistory(r as never, [])
      .filter((i) => i.id.startsWith("row-refund"));
    expect(items.map((i) => [i.at, i.description])).toEqual([
      [at(9).toISOString(), "₺1.000,00"],
      [at(3).toISOString(), "₺500,00"],
    ]);
  });

  it("M2: the IBAN and card filter sees through the usual separators", () => {
    const nbsp = String.fromCharCode(0xa0);
    const enDash = String.fromCharCode(0x2013);
    const zwsp = String.fromCharCode(0x200b);
    const groups = ["TR33", "0006", "1005", "1978", "6457", "8413", "26"];
    for (const note of [
      groups.join(" "),
      groups.join(""),
      groups.join(nbsp),
      groups.join("."),
      groups.join("/"),
      groups.join("_"),
      groups.join("  "),
      groups.join(enDash),
      groups.join(zwsp),
      groups.join("\n"),
      groups.join("\t"),
      "TR33 0006 1005 / 1978 6457 8413 26",
      "33 0006 1005 1978 6457 8413 26",
      "4111.1111.1111.1111",
      "4111 - 1111 - 1111 - 1111",
      "4111 1111 1111 1111",
      "Şube 1234 hesap 12345678",
      "hesap no: 1234567",
    ]) {
      expect(core.looksLikeBankAccount(note), JSON.stringify(note)).toBe(true);
    }
    for (const note of [
      "Havale yapıldı, dekont muhasebede",
      "18.10.2026 14:05 havale 2.000,00 TL",
      "Dekont no 123456789012345",
      "Tel 0532 123 45 67 ile teyit edildi",
      "18.10.2026 tarihinde 2.000,00 TL gönderildi, ref 20261018-1405",
      "Misafirin hesabına gönderildi",
    ]) {
      expect(core.looksLikeBankAccount(note), note).toBe(false);
    }
  });

  it("A1: a transfer's note shows only to whoever may move money", () => {
    const r = booking({ status: "cancelled", paymentStatus: "refunded" });
    const audit = [
      {
        id: "a1",
        createdAt: "2026-10-30T10:00:00.000Z",
        actor: "sahip@kosk",
        action: "refund",
        payload: {
          event: "make_good_paid",
          amountMinor: 200_000,
          paidOn: "2026-10-30",
          reason: "Dekont muhasebede",
        },
      },
    ];
    const note = (canRefund: boolean) =>
      panel
        .karaokeHistory(r as never, audit as never, { canRefund })
        .find((i) => i.id === "a1")?.description ?? "";
    expect(note(true)).toContain("Neden: Dekont muhasebede");
    expect(note(false)).not.toContain("Dekont muhasebede");
    expect(note(false)).toContain("₺2.000,00");
    // Without the option the page's default is the closed one.
    expect(
      panel.karaokeHistory(r as never, audit as never)[1]?.description,
    ).not.toContain("Dekont");
  });

  it("M6: 'Telafi ödendi' takes exactly the make-good", async () => {
    seed(
      booking({
        status: "cancelled",
        paymentStatus: "refunded",
        makeGoodUntil: "2027-04-30",
        makeGoodMinor: 200_000,
        updatedAt: at(1).toISOString(),
      }),
    );
    for (const amountMinor of [2_000_000, 200_001, 2_500_000_000, 1.5]) {
      expect(
        await payment.recordKaraokeMakeGoodPaid(
          "krk-00042",
          { paidOn: "2026-10-30", amountMinor },
          "yonetici@kosk",
          at(0),
        ),
      ).toMatchObject({ ok: false, reason: "invalid", field: "tutar" });
    }
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("open");
    expect(
      await payment.recordKaraokeMakeGoodPaid(
        "krk-00042",
        { paidOn: "2026-10-30", amountMinor: 200_000 },
        "yonetici@kosk",
        at(0),
      ),
    ).toMatchObject({ ok: true });
  });

  it("M5: a refused refund takes the make-good back in the rollback's own write", async () => {
    seed(booking());
    h.pos = "refused";
    // Whatever writes after the rollback (another person's cancel, a lost
    // line) finds no make-good left on the standing booking.
    let atRollback: Row | null = null;
    h.beforeUpdate = () => {
      // The first write marks it refunding (with the make-good)...
      h.beforeUpdate = () => {
        // ...the next is the rollback: read the row right after it.
        queueMicrotask(() => {
          atRollback = structuredClone(rowOf("krk-00042"));
        });
      };
    };
    const res = await payment.cancelKaraokeReservation(
      "krk-00042",
      staff("ariza"),
      { now: at(1) },
    );
    expect(res).toMatchObject({ ok: false, reason: "refund_refused" });
    expect(atRollback).toMatchObject({
      paymentStatus: "paid",
      makeGoodUntil: null,
      makeGoodMinor: null,
    });
  });
});

// ─── The access and regression reviews of PR #191 (21 Ekim 2026) ───────────

describe("review: who may let the free hour go, and what its mail says", () => {
  /** A make-good open on krk-00042, its free hour given for 6 Kasım 21:00. */
  async function freeHour(): Promise<string> {
    seed(
      booking({
        contactEmail: "eda@example.com",
        contactPhone: "+905321234567",
      }),
    );
    await payment.cancelKaraokeReservation("krk-00042", staff("ariza"), {
      now: at(1),
    });
    const given = await payment.giveKaraokeMakeGoodHour(
      "krk-00042",
      { date: "2026-11-06", startHour: 21 },
      "yonetici@kosk",
      at(0),
    );
    if (!given.ok) throw new Error(given.reason);
    return given.reservation.id;
  }
  // 6 Kasım 2026, 20:50 in Tuzla: ten minutes before the free hour.
  const LATE = new Date("2026-11-06T17:50:00.000Z");
  const PERSONEL = {
    kind: "staff" as const,
    actor: "personel@kosk",
    canRefund: false,
  };

  it("A2: Personel cannot let the free hour go where its guest no longer may; the panel says why", async () => {
    const id = await freeHour();
    expect(
      await payment.cancelKaraokeReservation(id, MEMBER, { now: LATE }),
    ).toMatchObject({ ok: false, reason: "too_late" });
    expect(
      await payment.cancelKaraokeReservation(id, PERSONEL, { now: LATE }),
    ).toMatchObject({ ok: false, reason: "free_hour_forbidden" });
    expect(rowOf(id).status).toBe("confirmed");
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("hour");
    const plan = (canRefund: boolean) =>
      panel.karaokeActionPlan(rowOf(id) as never, {
        now: LATE,
        prepay: true,
        canRefund,
      }).cancel;
    expect(plan(false)).toEqual({
      kind: "plain",
      disabledReason: panel.REFUND_PERMISSION_REASON,
    });
    expect(plan(true)).toEqual({ kind: "plain" });
    // With the refund right it goes, and opens the make-good again.
    expect(
      await payment.cancelKaraokeReservation(
        id,
        { ...PERSONEL, actor: "yonetici@kosk", canRefund: true },
        { now: LATE },
      ),
    ).toMatchObject({ ok: true });
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("open");
  });

  it("A2: before its guest's own deadline Personel may let it go, as the guest could", async () => {
    const id = await freeHour();
    expect(
      await payment.cancelKaraokeReservation(id, PERSONEL, { now: at(0) }),
    ).toMatchObject({ ok: true });
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("open");
  });

  it("A4: an account closure is held to the free hour's own rule", async () => {
    const id = await freeHour();
    expect(
      await payment.cancelKaraokeReservation(
        id,
        { kind: "account", email: "eda@example.com" },
        { now: LATE },
      ),
    ).toMatchObject({ ok: false, reason: "too_late" });
    expect(core.makeGoodStateOf(rowOf("krk-00042") as never)).toBe("hour");
  });

  it("R4: the free hour let go before it began: its mail names the make-good open again", async () => {
    const id = await freeHour();
    h.cancellations.length = 0;
    expect(
      await payment.cancelKaraokeReservation(id, MEMBER, { now: at(0) }),
    ).toMatchObject({ ok: true });
    expect(h.cancellations.at(-1)).toMatchObject({
      code: id,
      makeGood: { minor: 200_000, until: "30 Nisan 2027" },
    });
  });
});

describe("29 Eki 2026: the free hour's own rule and the late request that releases the hours", () => {
  const H = 3_600_000;
  const slot = { date: "2026-11-05", startHour: 20 };
  const start = time.karaokeStartInstant(slot.date, slot.startHour).getTime();

  it("a free hour given days ahead is released until two hours before its start", () => {
    const given = new Date(start - 5 * 24 * H);
    expect(time.karaokeMakeGoodDeadline(slot, given).getTime()).toBe(
      start - 2 * H,
    );
    expect(
      time.karaokeMakeGoodRules(slot, new Date(start - 2 * H)),
    ).toEqual([
      "Bu ücretsiz telafi saatini rezervasyon saatine 2 saatten fazla varken bırakabilirsin; telafin o zaman yeniden açılır.",
      "Rezervasyon saatine 2 saatten az kala bırakılan ya da gelinmeyen ücretsiz telafi saatinde telafi kullanılmış sayılır.",
    ]);
  });

  it("given less than four hours ahead, two hours from its giving, at the latest the minute before the start", () => {
    expect(
      time.karaokeMakeGoodDeadline(slot, new Date(start - 3 * H)).getTime(),
    ).toBe(start - H);
    expect(
      time.karaokeMakeGoodDeadline(slot, new Date(start - H)).getTime(),
    ).toBe(start - 60_000);
    expect(time.karaokeMakeGoodRules(slot, new Date(start - H))[0]).toBe(
      "Bu ücretsiz telafi saatini sana ayrıldığı andan itibaren 2 saat içinde, rezervasyon saati gelmeden bırakabilirsin; telafin o zaman yeniden açılır.",
    );
    // An instant that cannot be read: the start counted back.
    expect(
      time.karaokeMakeGoodDeadline(slot, new Date(Number.NaN)).getTime(),
    ).toBe(start - 2 * H);
  });

  it("a free hour moved keeps its own rule, recounted for the new start from its giving", () => {
    const hour = {
      date: "2026-11-05",
      startHour: 20,
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancelDeadline: new Date(start - 2 * H).toISOString(),
      createdAt: new Date(start - 5 * 24 * H).toISOString(),
      makeGoodFor: "krk-00042",
    };
    const later = { date: "2026-11-07", startHour: 21 };
    const laterStart = time
      .karaokeStartInstant(later.date, later.startHour)
      .getTime();
    expect(time.karaokeMovedDeadline(hour, later).getTime()).toBe(
      laterStart - 2 * H,
    );
    // Moved to an hour soon after it was given: two hours from its giving.
    const soon = { date: "2026-10-31", startHour: 21 };
    const given = time.karaokeStartInstant(soon.date, soon.startHour).getTime() - 3 * H;
    expect(
      time
        .karaokeMovedDeadline(
          { ...hour, createdAt: new Date(given).toISOString() },
          soon,
        )
        .getTime(),
    ).toBe(given + 2 * H);
  });

  const released = {
    id: "krk-00042",
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    status: "cancelled",
    paymentStatus: "refunded",
    paidMinor: 200_000,
    totalMinor: 200_000,
    refundMinor: 0,
    updatedAt: "2026-10-28T10:00:00.000Z",
  } as const;

  it("keptWholeOnLateCancel: only a cancelled, refunded row that gave nothing back and sold nothing again", () => {
    expect(time.keptWholeOnLateCancel(released)).toBe(true);
    expect(time.keptWholeOnLateCancel({ ...released, refundMinor: null })).toBe(
      false,
    );
    expect(
      time.keptWholeOnLateCancel({ ...released, refundMinor: 100_000 }),
    ).toBe(false);
    expect(
      time.keptWholeOnLateCancel({
        ...released,
        refundMinor: 100_000,
        resaleRefundMinor: 100_000,
      }),
    ).toBe(false);
    expect(
      time.keptWholeOnLateCancel({ ...released, status: "confirmed" }),
    ).toBe(false);
    expect(
      time.keptWholeOnLateCancel({ ...released, paymentStatus: "refunding" }),
    ).toBe(false);
  });

  it("the whole payment is the share kept, so a resold hour counts to it", () => {
    expect(core.keptShareOfCancelled(released as never)).toBe(200_000);
    expect(
      core.resaleAllocation(
        {
          id: "krk-00050",
          date: "2026-10-30",
          startHour: 21,
          hours: 1,
          totalMinor: 100_000,
        },
        [released as never],
      ),
    ).toEqual([{ id: "krk-00042", hours: [21] }]);
    expect(core.resaleRefundTotal(200_000, 2, 1)).toBe(100_000);
  });

  it("the panel, the reports and the invoice count it as kept, and say no refund was made", async () => {
    expect(panel.paymentLabel(released)).toBe("İade yok · saat satışta");
    expect(
      panel.paymentLabel({
        ...released,
        paymentStatus: "refunding",
        refundMinor: 100_000,
        resaleRefundMinor: 100_000,
      }),
    ).toBe("Kısmi iade bekliyor");
    const after = new Date("2026-10-31T00:00:00Z");
    expect(panel.karaokeBillableMinor(released, after)).toBe(200_000);
    expect(
      panel.karaokeBillableMinor(
        { ...released, refundMinor: 100_000, resaleRefundMinor: 100_000 } as never,
        after,
      ),
    ).toBe(100_000);
    const { karaokeMoneyOf } = await import("@/lib/admin/karaoke-money");
    expect(karaokeMoneyOf(released as never)).toEqual({
      paidMinor: 200_000,
      keptMinor: 200_000,
      refundPendingMinor: 0,
    });
  });

  it("the member's page never says it was refunded", async () => {
    const { karaokeStatusLine } = await import(
      "@/components/uye/karaoke-reservation-view"
    );
    expect(karaokeStatusLine(released)).toEqual({
      label: "İptal edildi, saat satışa açıldı",
      tone: "cancelled",
    });
    expect(
      karaokeStatusLine({ ...released, refundMinor: null }).label,
    ).toBe("İptal edildi, iade edildi");
  });
});
