import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The money review of the karaoke make-good and resale (PR #191, money
 * lens, 21 Ekim 2026): each test states what the money must do, and each
 * failed on the reviewed head (012ecac5). Same harness as
 * tests/db-integration-karaoke-make-good.test.ts: real Postgres, only the
 * POS and the mails scripted; the audit log is the REAL one (audit_logs,
 * append-only: rows are read by their time), so a note that reaches it is
 * visible.
 *
 * - M1: "Elle iade edildi" records a share only at the amount the page
 *   showed (the form posts it); a resale in between makes it refuse.
 * - M2: the IBAN / card note filter sees through the usual separators, and
 *   nothing of such a note reaches audit_logs.
 * - M3: each refund by hand stays on its own day in Gün sonu.
 * - M4: an hour booked for 0 TL is no sale.
 * - M5: a refused POS refund takes the make-good back in the same write.
 * - M6: "Telafi ödendi" takes exactly the make-good, and a too large
 *   amount is a field error.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

/** Runs once, just before the next query whose text matches `re`. */
const dbHook = vi.hoisted(() => ({
  before: null as null | { re: RegExp; run: () => Promise<void> },
}));

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
  const hook = dbHook.before;
  if (hook && hook.re.test(q.text)) {
    dbHook.before = null;
    await hook.run();
  }
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

const mail = vi.hoisted(() => ({
  confirmations: [] as Array<Record<string, unknown>>,
  cancellations: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
  /** Runs once inside the next money alert (a second person acts then). */
  onAlert: null as null | ((k: Record<string, unknown>) => Promise<void>),
}));
const pos = vi.hoisted(() => ({
  refunds: [] as Array<{ ref: string; amountMinor: number }>,
  refund: null as null | ((ref: string, amountMinor: number) => Promise<void>),
}));
const settings = vi.hoisted(() => ({
  value: {
    karaokePrepay: true,
    karaokeHourlyMinor: 100_000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "",
    email: "kosk@example.com",
    taxRates: { karaoke: 20 },
    karaokeFreeCancelHours: 2,
    karaokeLateRefundPercent: 0,
    mobileApp: null as unknown,
  },
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});
// The real store (the Gün sonu sheet reads through it), with the panel's
// settings scripted.
vi.mock("@/lib/admin/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/store")>();
  const { DEFAULT_MOBILE_APP_CONFIG } = await import("@/lib/mobile/app-config");
  settings.value.mobileApp = DEFAULT_MOBILE_APP_CONFIG;
  return { ...real, getSettings: async () => settings.value };
});
vi.mock("@/lib/mobile/loyalty", () => ({ getLoyalty: async () => null }));
vi.mock("@/lib/customer/store", () => ({
  ensureCardUserKey: async () => "",
  rememberCardUserKey: async () => {},
}));
vi.mock("@/lib/email/send", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/email/send")>();
  return {
    ...real,
    sendKaraokeConfirmationEmail: async (k: Record<string, unknown>) => {
      mail.confirmations.push(k);
      return true;
    },
    sendKaraokeCancellationEmail: async (k: Record<string, unknown>) => {
      mail.cancellations.push(k);
      return true;
    },
    sendKaraokePaidOperatorEmail: async () => ({ ok: true }),
    sendKaraokeMoneyAlertEmail: async (k: Record<string, unknown>) => {
      mail.alerts.push(k);
      const hook = mail.onAlert;
      if (hook) {
        mail.onAlert = null;
        await hook(k);
      }
      return { ok: true };
    },
    sendKaraokeOperatorEmail: async () => ({ ok: true }),
    sendKaraokeLateRequestEmail: async () => true,
  };
});
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    refund: async (ref: string, amountMinor: number) => {
      pos.refunds.push({ ref, amountMinor });
      if (!pos.refund) throw new Error("no refund expected here");
      await pos.refund(ref, amountMinor);
    },
  }),
}));

process.env.KARAOKE_LINK_SECRET = "k".repeat(40);

const pay = await import("@/lib/mobile/karaoke-payment");
const karaoke = await import("@/lib/mobile/karaoke");
const core = await import("@/lib/mobile/karaoke-make-good-core");
const { PaymentRefusedError } = await import("@/lib/payment/provider");
const { parseMoneyInput } = await import("@/lib/utils/format");
const { istanbulClock } = await import("@/lib/mobile/venue");

function dayAhead(days: number): string {
  const [y, m, d] = istanbulClock(new Date()).date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}
const TODAY = () => istanbulClock(new Date()).date;
/** Written as code points: the source carries no such characters. */
const NBSP = String.fromCharCode(0xa0);
const EN_DASH = String.fromCharCode(0x2013);

type Row = Record<string, unknown>;

async function insert(row: Row): Promise<void> {
  const cols = Object.keys(row);
  const values = cols.map((c) => {
    const v = row[c];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  await pool!.query(
    `insert into public.karaoke_reservations (${cols
      .map((c) => `"${c}"`)
      .join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
    values,
  );
}

async function row(id: string): Promise<Row> {
  const r = await pool!.query(
    `select * from public.karaoke_reservations where id = $1`,
    [id],
  );
  return r.rows[0] as Row;
}

async function paymentRow(
  id: string,
  ref: string,
  amountMinor: number,
): Promise<void> {
  await pool!.query(
    `insert into public.payment_transactions
       ("orderId", provider, "providerRef", status, "amountMinor", currency, raw, "trxDate", "createdAt")
     values ($1, 'fakepos', $2, 'succeeded', $3, 'TRY', null, $4, $5)`,
    [id, ref, amountMinor, TODAY(), new Date().toISOString()],
  );
}

/** As the PR's suite: 2 000 paid, 24 h / 50 %, its 1 000 share owed by hand. */
function lateCancelled(over: Row = {}): Row {
  return {
    id: "krk-90001",
    customerEmail: "eda@example.com",
    customerName: "Eda",
    date: dayAhead(3),
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "cancelled",
    priceMinor: 200_000,
    totalMinor: 200_000,
    paymentStatus: "refunding",
    paidMinor: 200_000,
    paidAt: new Date().toISOString(),
    paymentRef: "PNK-A",
    refundMinor: 100_000,
    freeCancelHours: 24,
    lateRefundPercent: 50,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
    ...over,
  };
}

function hold(id: string, startHour: number, hours: number): Row {
  return {
    id,
    customerEmail: `${id}@example.com`,
    customerName: "Deniz",
    date: dayAhead(3),
    startHour,
    hours,
    guests: 2,
    status: "requested",
    priceMinor: 100_000 * hours,
    totalMinor: 100_000 * hours,
    paymentStatus: "pending",
    paymentDueAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    channel: "web",
    freeCancelHours: 2,
    lateRefundPercent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function madeGood(over: Row = {}): Row {
  return {
    id: "krk-90010",
    customerEmail: "eda@example.com",
    customerName: "Eda",
    contactEmail: "eda@example.com",
    contactPhone: "+905321234567",
    date: dayAhead(1),
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "cancelled",
    priceMinor: 200_000,
    totalMinor: 200_000,
    paymentStatus: "refunded",
    paidMinor: 200_000,
    paidAt: new Date(Date.now() - 86_400_000).toISOString(),
    refundedAt: new Date().toISOString(),
    paymentRef: "PNK-G",
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    makeGoodUntil: dayAhead(180),
    makeGoodMinor: 200_000,
    ...over,
  };
}

function paymentOf(id: string, ref: string, amountMinor: number) {
  return pay.applyKaraokePaymentSucceeded({
    reservationId: id,
    provider: "fakepos",
    providerRef: ref,
    amountMinor,
    currency: "TRY",
    trxDate: TODAY(),
  });
}

maybe("karaoke make-good and resale: the money review (real Postgres)", () => {
  let release: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 6 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.end();
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query(`delete from public.karaoke_reservations`);
    await pool!.query(
      `delete from public.payment_transactions where "orderId" like 'krk-%'`,
    );
    // audit_logs refuses deletes (kept ten years): tests read their own rows
    // by time.
    await pool!.query(
      `delete from public.auth_attempts where key like 'karaoke-%'`,
    );
    mail.confirmations.length = 0;
    mail.cancellations.length = 0;
    mail.alerts.length = 0;
    mail.onAlert = null;
    dbHook.before = null;
    pos.refunds.length = 0;
    pos.refund = null;
  });

  it("M1: 'Elle iade edildi' from the page that showed 1 000 must not record (and mail) 1 500 after a resale", async () => {
    await insert(lateCancelled());
    await paymentRow("krk-90001", "PNK-A", 200_000);
    // The page shows 1 000 owed; the person refunds 1 000 in PayNkolay's
    // panel. Before they press the button, A's 20:00 hour is sold again.
    await insert(hold("krk-90002", 20, 1));
    expect(await paymentOf("krk-90002", "PNK-X", 100_000)).toMatchObject({
      ok: true,
      outcome: "paid",
    });
    expect(await row("krk-90001")).toMatchObject({
      paymentStatus: "refunding",
      refundMinor: 150_000,
      resaleRefundMinor: 50_000,
      refundSettledMinor: null,
    });
    // The press: the form posts the amount its page showed (1 000).
    const res = await pay.settleKaraokeRefundByHand(
      "krk-90001",
      "yonetici@kosk",
      undefined,
      {
        reason: "PayNkolay panelinden 1.000 TL kısmi iade yapıldı",
        shownRefundMinor: 100_000,
      },
    );
    expect(res).toMatchObject({
      ok: false,
      reason: "raced",
      message: pay.KARAOKE_SETTLE_STALE,
    });
    // A press without the amount (an old page) records nothing either.
    expect(
      await pay.settleKaraokeRefundByHand("krk-90001", "yonetici@kosk"),
    ).toMatchObject({ ok: false, reason: "raced" });
    const a = await row("krk-90001");
    const claim = (
      await pool!.query(
        `select "amountMinor" from public.payment_transactions where "providerRef" = 'PNK-A:refund'`,
      )
    ).rows[0];
    const recorded =
      a.paymentStatus === "refunded"
        ? Number(a.refundMinor)
        : Number(a.refundSettledMinor ?? 0);
    // Correct: refused as stale, nothing recorded, nothing mailed.
    expect(recorded).toBe(0);
    expect(claim).toBeUndefined();
    expect(mail.cancellations).toEqual([]);
    // From the page read again (1 500 shown): all of it is recorded.
    const again = await pay.settleKaraokeRefundByHand(
      "krk-90001",
      "yonetici@kosk",
      undefined,
      {
        reason: "PayNkolay panelinden 1.500 TL iade yapıldı",
        shownRefundMinor: 150_000,
      },
    );
    expect(again.ok).toBe(true);
    expect(await row("krk-90001")).toMatchObject({
      paymentStatus: "refunded",
      refundMinor: 150_000,
    });
    expect(mail.cancellations.map((m) => m.refundedMinor)).toEqual([150_000]);
  });

  it("M2: the IBAN / card note filter catches the usual ways people write them", () => {
    const shouldRefuse = [
      // Baselines the PR covers.
      "TR33 0006 1005 1978 6457 8413 26",
      "TR330006100519786457841326",
      "4111 1111 1111 1111",
      // Bypasses claimed.
      ["TR33", "0006", "1005", "1978", "6457", "8413", "26"].join(NBSP),
      "TR33.0006.1005.1978.6457.8413.26",
      "TR33/0006/1005/1978/6457/8413/26",
      "TR33_0006_1005_1978_6457_8413_26",
      "TR33  0006  1005  1978  6457  8413  26",
      ["TR33", "0006", "1005", "1978", "6457", "8413", "26"].join(EN_DASH),
      "TR33 0006 1005 / 1978 6457 8413 26",
      "4111.1111.1111.1111",
      "4111 - 1111 - 1111 - 1111",
      "Şube 1234 hesap 12345678",
    ];
    const result = shouldRefuse.map((s) => [
      JSON.stringify(s),
      core.looksLikeBankAccount(s),
    ]);
    expect(result.filter(([, hit]) => !hit).map(([s]) => s)).toEqual([]);
  });

  it("M2: an NBSP-separated IBAN typed with 'Telafi ödendi' is written into audit_logs", async () => {
    await insert(madeGood());
    const t0 = new Date().toISOString();
    const iban = ["TR33", "0006", "1005", "1978", "6457", "8413", "26"].join(
      NBSP,
    );
    const res = await pay.recordKaraokeMakeGoodPaid(
      "krk-90010",
      { paidOn: TODAY(), amountMinor: 200_000 },
      "sahip@kosk",
      undefined,
      { reason: `${iban} hesabına gönderildi` },
    );
    const audit = (
      await pool!.query(
        `select payload::text as p from public.audit_logs where "entityId" = 'krk-90010' and "createdAt" >= $1`,
        [t0],
      )
    ).rows.map((r) => String(r.p));
    expect(res).toMatchObject({ ok: false, reason: "invalid" });
    expect(audit.join("\n")).not.toMatch(/0006.{0,6}1005/);
  });

  it("M3: Gün sonu keeps day 1's refund of a share whose hour was sold on day 2", async () => {
    const day1 = new Date("2026-10-12T11:00:00.000Z"); // 14:00 Tuzla
    const day3 = new Date("2026-10-14T11:00:00.000Z");
    await insert(lateCancelled({ date: "2026-10-20" }));
    await paymentRow("krk-90001", "PNK-A", 200_000);
    const { loadDayClose } = await import("@/lib/admin/day-close");
    const karaokeRefunds = async (day: string, now: Date) =>
      (await loadDayClose(day, now)).refunds
        .filter((r) => r.kind === "karaoke")
        .map((r) => [r.label, r.time, r.amountMinor]);

    // Day 1: the 1 000 share refunded by hand.
    expect(
      (
        await pay.settleKaraokeRefundByHand(
          "krk-90001",
          "yonetici@kosk",
          day1,
          { shownRefundMinor: 100_000 },
        )
      ).ok,
    ).toBe(true);
    const day1Before = await karaokeRefunds("2026-10-12", day1);
    // Day 2: one of its hours sold again (the app path's SQL).
    await pool!.query(
      `select public.karaoke_charge_resold_hours('krk-90001', '[20]'::jsonb)`,
    );
    const day1AfterResale = await karaokeRefunds("2026-10-12", day3);
    // Day 3: the 500 top-up refunded by hand (the page shows 1 500 in all).
    expect(
      (
        await pay.settleKaraokeRefundByHand(
          "krk-90001",
          "yonetici@kosk",
          day3,
          { shownRefundMinor: 150_000 },
        )
      ).ok,
    ).toBe(true);
    const day1After = await karaokeRefunds("2026-10-12", day3);
    const day3Sheet = await karaokeRefunds("2026-10-14", day3);
    const claim = (
      await pool!.query(
        `select "amountMinor", "createdAt" from public.payment_transactions where "providerRef" = 'PNK-A:refund'`,
      )
    ).rows;
    expect(day1Before).toEqual([["KRK-90001", "14:00", 100_000]]);
    // While the rest is owed, day 1's refund is still day 1's.
    expect(day1AfterResale).toEqual([["KRK-90001", "14:00", 100_000]]);
    expect(day3Sheet).toEqual([["KRK-90001", "14:00", 50_000]]);
    // What went back on day 1 is still day 1's.
    expect(day1After).toEqual([["KRK-90001", "14:00", 100_000]]);
    // The claim row still says what went back in all.
    expect(claim.map((c) => Number(c.amountMinor))).toEqual([150_000]);
  });

  it("M4: an hour booked for 0 TL (100 % ORO) is no sale: the late canceller is not refunded for it", async () => {
    await insert(lateCancelled());
    await insert({
      ...hold("krk-90002", 20, 1),
      discountMinor: 100_000,
      totalMinor: 0,
    });
    const hold0 = await karaoke.getReservation("krk-90002");
    const started = await pay.startKaraokePayment(hold0!, null);
    expect(started.ok).toBe(true);
    const sold = await row("krk-90002");
    const a = await row("krk-90001");
    expect(sold).toMatchObject({ status: "confirmed", paidMinor: 0 });
    // Correct: nothing owed for an hour that brought no money.
    expect(a).toMatchObject({ refundMinor: 100_000, resoldHours: null });
  });

  it("M5: a mücbir cancel inside the refused refund's alert never leaves an open make-good (nor mails one)", async () => {
    await insert({
      id: "krk-90050",
      customerEmail: "eda@example.com",
      customerName: "Eda",
      contactEmail: "eda@example.com",
      date: dayAhead(1),
      startHour: 20,
      hours: 2,
      guests: 4,
      status: "confirmed",
      priceMinor: 200_000,
      totalMinor: 200_000,
      paymentStatus: "paid",
      paidMinor: 200_000,
      paidAt: new Date(Date.now() - 86_400_000).toISOString(),
      paymentRef: "PNK-B",
      freeCancelHours: 24,
      lateRefundPercent: 50,
      // Past its own free moment: a köşk cancel for its own reason makes good.
      cancelDeadline: new Date(Date.now() - 3_600_000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    await paymentRow("krk-90050", "PNK-B", 200_000);
    let calls = 0;
    pos.refund = async () => {
      calls += 1;
      if (calls === 1) throw new PaymentRefusedError("declined");
    };
    let second: unknown = null;
    // A colleague cancels it as force majeure while the first cancel's
    // "iade YAPILAMADI" alert is being sent.
    mail.onAlert = async () => {
      second = await pay.cancelKaraokeReservation("krk-90050", {
        kind: "staff",
        actor: "sahip@kosk",
        canRefund: true,
        cause: "mucbir",
        reason: "Bölgede elektrik kesintisi",
      });
    };
    const first = await pay.cancelKaraokeReservation("krk-90050", {
      kind: "staff",
      actor: "yonetici@kosk",
      canRefund: true,
      cause: "ariza",
      reason: "Ses sistemi arızalı",
    });
    const b = await row("krk-90050");
    expect(first).toMatchObject({ ok: false, reason: "refund_refused" });
    expect(second).toMatchObject({ ok: true, refunded: true });
    expect(b).toMatchObject({ status: "cancelled", paymentStatus: "refunded" });
    // Correct: a mücbir cancel makes nothing good.
    expect(b.makeGoodMinor).toBeNull();
    expect(mail.cancellations.filter((m) => m.makeGood)).toEqual([]);
  });

  it("M5 (variant): the make-good taken back in a write of its own: a failure there leaves it on the live booking, and the guest's own late cancel then carries it", async () => {
    await insert({
      id: "krk-90051",
      customerEmail: "eda@example.com",
      customerName: "Eda",
      contactEmail: "eda@example.com",
      date: dayAhead(1),
      startHour: 20,
      hours: 2,
      guests: 4,
      status: "confirmed",
      priceMinor: 200_000,
      totalMinor: 200_000,
      paymentStatus: "paid",
      paidMinor: 200_000,
      paidAt: new Date(Date.now() - 86_400_000).toISOString(),
      paymentRef: "PNK-C",
      freeCancelHours: 24,
      lateRefundPercent: 50,
      cancelDeadline: new Date(Date.now() - 3_600_000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    await paymentRow("krk-90051", "PNK-C", 200_000);
    pos.refund = async () => {
      throw new PaymentRefusedError("declined");
    };
    // The database drops the line on the write that takes the make-good
    // back (the rollback to paid was a separate write and landed).
    dbHook.before = {
      re: /^UPDATE "karaoke_reservations" SET "makeGoodUntil"/,
      run: async () => {
        throw new Error("Connection terminated unexpectedly");
      },
    };
    let firstError: unknown = null;
    try {
      await pay.cancelKaraokeReservation("krk-90051", {
        kind: "staff",
        actor: "yonetici@kosk",
        canRefund: true,
        cause: "ariza",
      });
    } catch (err) {
      firstError = err instanceof Error ? err.message : err;
    }
    // The cancel was refused (no money moved): nothing thrown, the booking
    // stands, and its make-good went in the same write as the rollback.
    expect(firstError).toBeNull();
    const standing = await row("krk-90051");
    expect(standing).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
    });
    expect(standing.makeGoodMinor).toBeNull();
    expect(standing.makeGoodUntil).toBeNull();
    // Later the guest cancels it herself, late (50 % share): no make-good
    // rides along, and none is mailed.
    const own = await pay.cancelKaraokeReservation("krk-90051", {
      kind: "member",
      email: "eda@example.com",
      emailVerified: true,
    });
    expect(own).toMatchObject({ ok: true, refundOwedMinor: 100_000 });
    const b = await row("krk-90051");
    expect(core.makeGoodStateOf(b as never)).toBe("none");
    expect(mail.cancellations.filter((m) => m.makeGood)).toEqual([]);
  });

  it("M6: 'Telafi ödendi' refuses an amount far above the make-good (a slipped key)", async () => {
    await insert(madeGood());
    // "20000" typed for a 2 000 make-good is 20 000 TL.
    expect(parseMoneyInput("20000")).toBe(2_000_000);
    const res = await pay.recordKaraokeMakeGoodPaid(
      "krk-90010",
      { paidOn: TODAY(), amountMinor: 2_000_000 },
      "sahip@kosk",
      undefined,
      { reason: "Havale yapıldı" },
    );
    expect(res).toMatchObject({ ok: false, reason: "invalid", field: "tutar" });
    const made = await row("krk-90010");
    expect(made.makeGoodPaidMinor).toBeNull();
    expect(made.makeGoodUsedAt).toBeNull();
    // Exactly the make-good is recorded.
    expect(
      await pay.recordKaraokeMakeGoodPaid(
        "krk-90010",
        { paidOn: TODAY(), amountMinor: 200_000 },
        "sahip@kosk",
        undefined,
        { reason: "Havale yapıldı" },
      ),
    ).toMatchObject({ ok: true });
  });

  it("M6: an amount past the integer column ('25.000.000') is a field error, not a database error", async () => {
    await insert(madeGood());
    expect(parseMoneyInput("25.000.000")).toBe(2_500_000_000);
    let thrown: unknown = null;
    let res: unknown = null;
    try {
      res = await pay.recordKaraokeMakeGoodPaid(
        "krk-90010",
        { paidOn: TODAY(), amountMinor: 2_500_000_000 },
        "sahip@kosk",
        undefined,
        { reason: "Havale yapıldı" },
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeNull();
    expect(res).toMatchObject({ ok: false, reason: "invalid" });
  });
});
