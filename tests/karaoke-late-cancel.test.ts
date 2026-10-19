import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The karaoke cancellation policy's money paths (P2a, operator decision D9,
 * 17 Eki 2026), through the real karaoke.ts and karaoke-payment.ts over an
 * in-memory table. The POS, the mail, the audit log and the settings are
 * scripted.
 *
 * - A booking keeps the policy it was made under (snapshot at create; a
 *   legacy row reads 2 hours / 0 %).
 * - A member's late cancel: refused at 0 %; at 1..99 % the booking is
 *   cancelled with round(paid × P / 100) owed and nothing sent to the POS
 *   (PayNkolay refunds whole payments only), the köşk alerted, the share
 *   then recorded by hand ("Elle iade edildi"); at 100 % the POS refunds
 *   everything, and a declined or unanswered refund is never a refund
 *   (rule 29).
 * - The köşk's cancel is always the whole payment (MSY m.16/4).
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  tables: new Map<string, Row[]>(),
  /** The lock's app version (null: shut, the code's own value). */
  appVersion: null as string | null,
  settings: {} as Record<string, unknown>,
  pos: "ok" as "ok" | "refused" | "timeout",
  refunds: [] as Array<{ ref: string; amountMinor: number }>,
  cancellations: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
  seq: 100,
}));

// ─── An in-memory stand-in for the query builder (src/lib/db/client.ts) ────

type Filter = (row: Row) => boolean;

function fakeDb() {
  const table = (name: string) => {
    if (!h.tables.has(name)) h.tables.set(name, []);
    return h.tables.get(name)!;
  };
  return {
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
          filters.push((r) => r[col] !== v);
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
              // The (provider, providerRef) unique index of payment rows.
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
              rows.push(structuredClone(row));
            }
            return Promise.resolve(
              resolve({ data: null, error: null, status: 201 }),
            );
          }
          if (op === "update") {
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
  sendKaraokeConfirmationEmail: vi.fn(async () => true),
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
// policy other than the default opens it as the app follow-up would.
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
const karaoke = await import("@/lib/mobile/karaoke");
const payment = await import("@/lib/mobile/karaoke-payment");
const time = await import("@/lib/mobile/karaoke-time");
const rateLimit = await import("@/lib/admin/rate-limit");

// 30 Ekim 2026, 20:00 in Tuzla.
const START = Date.parse("2026-10-30T17:00:00.000Z");
const HOUR = 3600_000;
const MEMBER = {
  kind: "member" as const,
  email: "eda@example.com",
  emailVerified: true,
};
const STAFF = {
  kind: "staff" as const,
  actor: "yonetici@kosk",
  canRefund: true,
  reason: "Oda arızalı",
};

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
function seedPaid(snapshot: Partial<Row> = {}, paidMinor = 200_000): void {
  h.tables.set("karaoke_reservations", [
    {
      id: "krk-00042",
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
      paymentRef: "PNK-1",
      channel: "web",
      guest: false,
      contactEmail: "",
      ...snapshot,
    },
  ]);
  h.tables.set("payment_transactions", [
    {
      orderId: "krk-00042",
      provider: "fakepos",
      providerRef: "PNK-1",
      status: "succeeded",
      amountMinor: paidMinor,
      trxDate: "2026-10-20",
    },
  ]);
}

const row = () => h.tables.get("karaoke_reservations")![0]!;
const claim = () =>
  h.tables
    .get("payment_transactions")!
    .find((r) => r.providerRef === "PNK-1:refund");
const at = (hoursBefore: number) => new Date(START - hoursBefore * HOUR);
const HALF = { freeCancelHours: 24, lateRefundPercent: 50 };

beforeEach(() => {
  h.tables.clear();
  h.appVersion = null;
  h.settings = settingsWith({ hours: 2, percent: 0 });
  h.pos = "ok";
  h.refunds.length = 0;
  h.cancellations.length = 0;
  h.alerts.length = 0;
  h.audits.length = 0;
});

describe("the snapshot at booking", () => {
  const input = {
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    note: "",
  };
  const consent = {
    acceptedAt: "2026-10-20T09:00:00.000Z",
    documents: ["karaoke-odasi-rezervasyon"],
    version: "17 Ekim 2026",
  };

  it("keeps the panel's policy, its deadline, its sentences and the version shown", async () => {
    h.appVersion = "1.1.0";
    h.settings = settingsWith({ hours: 24, percent: 50 });
    const now = new Date("2026-10-20T09:00:00.000Z");
    const res = await karaoke.createReservation(
      { email: "eda@example.com", name: "Eda Yılmaz" },
      input,
      now,
      undefined,
      { channel: "app", prepay: true, legalConsent: consent },
    );
    expect(res.ok).toBe(true);
    const stored = row();
    expect(stored).toMatchObject({
      freeCancelHours: 24,
      lateRefundPercent: 50,
      cancelDeadline: new Date(START - 24 * HOUR).toISOString(),
      cancellationRules: [...time.karaokeCancellationRules(HALF).rules],
      refundMinor: null,
    });
    // The document was rendered with the policy saved on 18 Ekim.
    expect((stored.legalConsent as { version: string }).version).toBe(
      "18 Ekim 2026",
    );
  });

  it("while the app lock is shut, a booking is made under the default", async () => {
    h.settings = settingsWith({ hours: 24, percent: 50 });
    const res = await karaoke.createReservation(
      { email: "eda@example.com", name: "Eda Yılmaz" },
      input,
      new Date("2026-10-20T09:00:00.000Z"),
      undefined,
      { channel: "app", prepay: true, legalConsent: consent },
    );
    expect(res.ok).toBe(true);
    expect(row()).toMatchObject({
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancellationRules: [
        time.KARAOKE_REFUND_RULE,
        time.KARAOKE_NO_REFUND_RULE,
      ],
    });
    expect((row().legalConsent as { version: string }).version).toBe(
      "17 Ekim 2026",
    );
  });

  it("a rule changed while the page was open: refused with the new rule, nothing held", async () => {
    // The customer read 24 h / 50 % (availability) and ticked the boxes;
    // the owner then saved 2 h / 0 %; the booking arrives with the rule it
    // was shown. Booking it would bind the customer to sentences they never
    // read (TKHK m.4/2, MSY m.5/1-h).
    h.appVersion = "1.1.0";
    h.settings = settingsWith({ hours: 24, percent: 50 });
    const shown = await karaoke.getAvailability("2026-10-30", at(48));
    h.settings = settingsWith({ hours: 2, percent: 0 });
    vi.mocked(rateLimit.reserveLoginAttempt).mockClear();
    const res = await karaoke.createReservation(
      { email: "eda@example.com", name: "Eda Yılmaz" },
      {
        ...input,
        expectedCancelPolicy: {
          freeCancelHours: shown.freeCancelHours,
          lateRefundPercent: shown.lateRefundPercent,
        },
      },
      new Date("2026-10-20T09:00:00.000Z"),
      undefined,
      { channel: "app", prepay: true, legalConsent: consent },
    );
    expect(res).toMatchObject({
      ok: false,
      status: 409,
      error: "policy_changed",
      policy: {
        freeCancelHours: 2,
        lateRefundPercent: 0,
        cancellationRules: [
          time.KARAOKE_REFUND_RULE,
          time.KARAOKE_NO_REFUND_RULE,
        ],
      },
    });
    expect(h.tables.get("karaoke_reservations") ?? []).toEqual([]);
    // Refused before the hold budget counts anything.
    expect(rateLimit.reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("the rule shown is the rule in force: booked under it", async () => {
    h.appVersion = "1.1.0";
    h.settings = settingsWith({ hours: 24, percent: 50 });
    const res = await karaoke.createReservation(
      { email: "eda@example.com", name: "Eda Yılmaz" },
      { ...input, expectedCancelPolicy: { ...HALF } },
      new Date("2026-10-20T09:00:00.000Z"),
      undefined,
      { channel: "app", prepay: true, legalConsent: consent },
    );
    expect(res.ok).toBe(true);
    expect(row()).toMatchObject({
      ...HALF,
      cancellationRules: [...time.karaokeCancellationRules(HALF).rules],
    });
  });

  it("an unreadable expectedCancelPolicy is a 400, nothing held", async () => {
    const res = await karaoke.createReservation(
      { email: "eda@example.com", name: "Eda Yılmaz" },
      { ...input, expectedCancelPolicy: { freeCancelHours: "2" } },
      new Date("2026-10-20T09:00:00.000Z"),
      undefined,
      { channel: "app", prepay: true, legalConsent: consent },
    );
    expect(res).toMatchObject({
      ok: false,
      status: 400,
      error: "invalid_request",
    });
    expect(h.tables.get("karaoke_reservations") ?? []).toEqual([]);
  });

  it("availability offers the policy a booking made now gets", async () => {
    h.appVersion = "1.1.0";
    h.settings = settingsWith({ hours: 24, percent: 50 });
    const open = await karaoke.getAvailability("2026-10-30", at(48));
    expect(open).toMatchObject({
      freeCancelHours: 24,
      lateRefundPercent: 50,
      cancellationRules: [...time.karaokeCancellationRules(HALF).rules],
    });
    h.appVersion = null;
    const shut = await karaoke.getAvailability("2026-10-30", at(48));
    expect(shut).toMatchObject({
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancellationRules: [
        time.KARAOKE_REFUND_RULE,
        time.KARAOKE_NO_REFUND_RULE,
      ],
    });
  });
});

describe("a member cancels", () => {
  it("a legacy row (no snapshot) is 2 hours / 0 %: refused late, in full early", async () => {
    // The panel says 24 h / 50 % now; the booking was made before either.
    h.appVersion = "1.1.0";
    h.settings = settingsWith({ hours: 24, percent: 50 });
    seedPaid();
    const late = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(1),
    });
    expect(late).toMatchObject({
      ok: false,
      reason: "too_late",
      message: time.KARAOKE_TOO_LATE_MESSAGE,
    });
    expect(row().status).toBe("confirmed");

    const early = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(3),
    });
    expect(early).toMatchObject({ ok: true, refunded: true });
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
  });

  it("inside the window at 0 %: refused, nothing moves", async () => {
    seedPaid({ freeCancelHours: 5, lateRefundPercent: 0 });
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(4),
    });
    expect(res).toMatchObject({ ok: false, reason: "too_late" });
    if (!res.ok) expect(res.message).toContain("5 saatten az kala");
    expect(row()).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    expect(h.refunds).toEqual([]);
  });

  it("inside the window at 50 %: cancelled, the exact share owed, nothing sent to the POS", async () => {
    seedPaid({ ...HALF }, 199_999);
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(10),
    });
    expect(res).toMatchObject({
      ok: true,
      refunded: false,
      refundOwedMinor: 100_000,
    });
    // round(199 999 × 50 / 100) = 100 000.
    expect(row()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunding",
      refundMinor: 100_000,
      paidMinor: 199_999,
    });
    expect(h.refunds).toEqual([]);
    expect(claim()).toBeUndefined();
    // The member is told the amount; the köşk is told to refund it by hand.
    expect(h.cancellations).toEqual([
      expect.objectContaining({
        refundOwedMinor: 100_000,
        refundIsShare: true,
      }),
    ]);
    expect(h.cancellations[0]).not.toHaveProperty("refundedMinor");
    expect(h.alerts).toEqual([
      expect.objectContaining({
        title: "Geç iptal: kısmi iade bekliyor",
        rows: expect.arrayContaining([{ label: "Tutar", value: "₺1.000,00" }]),
      }),
    ]);
    expect(h.audits).toEqual([
      expect.objectContaining({
        action: "refund",
        actor: "customer",
        payload: expect.objectContaining({
          event: "late_cancel_share_owed",
          amountMinor: 100_000,
          lateRefundPercent: 50,
        }),
      }),
    ]);
  });

  it("a paid booking the köşk never confirmed is refunded in full, never by the share", async () => {
    // Paid, but its hour went to another confirmed booking (or its
    // confirmation never finished): the panel's slot_lost says to cancel it
    // with a full refund. The member cancelling it inside the window must
    // not lose half of a payment for an hour that was never theirs.
    seedPaid({ ...HALF, status: "requested" });
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(10),
    });
    expect(res).toMatchObject({ ok: true, refunded: true });
    expect(res).not.toHaveProperty("refundOwedMinor");
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
    expect(row()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunded",
    });
    expect(row().refundMinor ?? null).toBeNull();
  });

  it("the owed share is never retried at the POS, and is recorded by hand at its own amount", async () => {
    seedPaid({ ...HALF });
    await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(10),
    });
    h.cancellations.length = 0;

    const retry = await payment.retryKaraokeRefund(
      "krk-00042",
      "yonetici@kosk",
      at(9),
    );
    expect(retry).toEqual({ ok: false, reason: "by_hand" });
    expect(h.refunds).toEqual([]);

    const settled = await payment.settleKaraokeRefundByHand(
      "krk-00042",
      "yonetici@kosk",
      at(9),
      { reason: "PayNkolay panelinden kısmi iade yapıldı" },
    );
    expect(settled).toMatchObject({ ok: true, refunded: true });
    expect(row()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunded",
      refundMinor: 100_000,
    });
    expect(claim()).toMatchObject({ status: "refunded", amountMinor: 100_000 });
    expect(h.cancellations).toEqual([
      expect.objectContaining({ refundedMinor: 100_000, refundIsShare: true }),
    ]);
  });

  it("from the start on, nothing: not turning up refunds nothing", async () => {
    seedPaid({ ...HALF });
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(0),
    });
    expect(res).toMatchObject({ ok: false, reason: "too_late" });
    if (!res.ok) {
      expect(res.message).toBe(
        time.karaokeCancellationRules(HALF).tooLateMessage,
      );
    }
    expect(row().paymentStatus).toBe("paid");
  });

  it("inside the window at 100 %: the POS refunds everything", async () => {
    seedPaid({ freeCancelHours: 3, lateRefundPercent: 100 });
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(1),
    });
    expect(res).toMatchObject({ ok: true, refunded: true });
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
    expect(row()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunded",
    });
    // The whole payment: no share is recorded.
    expect(row().refundMinor ?? null).toBeNull();
  });

  it("at 100 %, a declined refund puts everything back (rule 29)", async () => {
    seedPaid({ freeCancelHours: 3, lateRefundPercent: 100 });
    h.pos = "refused";
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(1),
    });
    expect(res).toMatchObject({ ok: false, reason: "refund_refused" });
    expect(row()).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    expect(claim()).toBeUndefined();
  });

  it("at 100 %, an unanswered refund is not a refund: it waits for a person", async () => {
    seedPaid({ freeCancelHours: 3, lateRefundPercent: 100 });
    h.pos = "timeout";
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(1),
    });
    expect(res).toMatchObject({ ok: false, reason: "refund_unknown" });
    expect(row()).toMatchObject({
      status: "confirmed",
      paymentStatus: "refunding",
    });
    expect(claim()).toMatchObject({ status: "refunding" });
  });

  it("a booking paid at the venue is let go late at 50 %, with nothing to refund", async () => {
    seedPaid({
      ...HALF,
      paymentStatus: "none",
      paidMinor: 0,
      paymentRef: "",
      paidAt: "",
    });
    const res = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: at(10),
    });
    expect(res).toMatchObject({ ok: true, refunded: false });
    expect(row()).toMatchObject({ status: "cancelled", paymentStatus: "none" });
    expect(h.refunds).toEqual([]);
  });
});

describe("the exact last moment (`cancellableUntil`)", () => {
  // The contract's "son an" and the terms' "bu an dahil" (ASK-Y3-4): the
  // deadline itself still refunds in full; a millisecond later the late
  // rule applies. The app's endpoint and the web pages (/uye/hesap/karaoke,
  // /rezervasyon) all cancel through this one function.
  const LINK = { kind: "link" as const, token: "x" };
  const DEADLINE = START - 2 * HOUR;
  const ms = (d: number) => ({ now: new Date(DEADLINE + d) });

  it("the member, under the default rule: in full up to and at it, too_late after", async () => {
    for (const d of [-1, 0]) {
      seedPaid();
      h.refunds.length = 0;
      const res = await payment.cancelKaraokeReservation(
        "krk-00042",
        MEMBER,
        ms(d),
      );
      expect(res, `deadline ${d} ms`).toMatchObject({
        ok: true,
        refunded: true,
      });
      expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
      expect(row()).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
      });
    }
    seedPaid();
    h.refunds.length = 0;
    const after = await payment.cancelKaraokeReservation(
      "krk-00042",
      MEMBER,
      ms(1),
    );
    expect(after).toMatchObject({
      ok: false,
      reason: "too_late",
      message: time.KARAOKE_TOO_LATE_MESSAGE,
    });
    expect(row()).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    expect(h.refunds).toEqual([]);
  });

  it("the member, under a late share: in full at the stored deadline, the share after", async () => {
    const deadline = START - 24 * HOUR;
    const snapshot = {
      ...HALF,
      cancelDeadline: new Date(deadline).toISOString(),
    };
    seedPaid(snapshot);
    const at0 = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: new Date(deadline),
    });
    expect(at0).toMatchObject({ ok: true, refunded: true });
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
    expect(row().refundMinor ?? null).toBeNull();

    seedPaid(snapshot);
    h.refunds.length = 0;
    const after = await payment.cancelKaraokeReservation("krk-00042", MEMBER, {
      now: new Date(deadline + 1),
    });
    expect(after).toMatchObject({ ok: true, refunded: false });
    expect(row()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunding",
      refundMinor: 100_000,
    });
    expect(h.refunds).toEqual([]);
  });

  it("a link holder: the same moment", async () => {
    seedPaid({
      guest: true,
      customerEmail: "",
      contactEmail: "eda@example.com",
    });
    const at0 = await payment.cancelKaraokeReservation(
      "krk-00042",
      LINK,
      ms(0),
    );
    expect(at0).toMatchObject({ ok: true, refunded: true });

    seedPaid({
      guest: true,
      customerEmail: "",
      contactEmail: "eda@example.com",
    });
    h.refunds.length = 0;
    const after = await payment.cancelKaraokeReservation(
      "krk-00042",
      LINK,
      ms(1),
    );
    expect(after).toMatchObject({ ok: false, reason: "too_late" });
    expect(h.refunds).toEqual([]);
  });
});

describe("the member's confirmation", () => {
  it("prints the booking's own sentences, not the panel's current ones", async () => {
    const send = await import("@/lib/email/send");
    const confirm = vi.mocked(send.sendKaraokeConfirmationEmail);
    confirm.mockClear();
    const shown = time.karaokeCancellationRules(HALF).rules;
    seedPaid({ ...HALF, cancellationRules: [...shown] });
    await karaoke.notifyReservationStatus(row() as never);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellation: {
          rules: shown,
          venueUntil: "rezervasyon saatinden önce",
        },
      }),
    );
  });
});

describe("the köşk cancels", () => {
  it("always the whole payment, whatever the booking's late share", async () => {
    seedPaid({ ...HALF });
    const res = await payment.cancelKaraokeReservation("krk-00042", STAFF, {
      now: at(10),
    });
    expect(res).toMatchObject({ ok: true, refunded: true });
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
    expect(row()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunded",
    });
    // The whole payment: no share is recorded.
    expect(row().refundMinor ?? null).toBeNull();
    expect(h.cancellations).toEqual([
      expect.objectContaining({ refundedMinor: 200_000, refundIsShare: false }),
    ]);
  });
});
