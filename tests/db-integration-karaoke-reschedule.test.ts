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
 * "Saati değiştir" (27 Eki 2026) against a real Postgres: the booking
 * moves, its deadline is recounted under the rule it was booked under
 * (`karaokeMovedDeadline`: back from the new start for a booking made before
 * 28 Eki 2026; from its making, ending at the latest the minute before the
 * new start, for one made since), `updatedAt` (the last status decision)
 * stays, the member is mailed once with the old and new evening and the
 * recounted last free moment, and the move loses to a booking or a change
 * that lands in between - the JS check, the exclusion constraint and the
 * guarded UPDATE. Only the mail is scripted. Skipped without
 * TEST_DATABASE_URL, like the other db-integration suites.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

/**
 * Runs once, just before the next query whose text matches `re`: a test
 * puts a second person's write between the move's read and its write.
 */
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
  moves: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
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
vi.mock("@/lib/admin/store", async () => {
  const { DEFAULT_MOBILE_APP_CONFIG } = await import("@/lib/mobile/app-config");
  settings.value.mobileApp = DEFAULT_MOBILE_APP_CONFIG;
  return { getSettings: async () => settings.value };
});
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/mobile/loyalty", () => ({ getLoyalty: async () => null }));
vi.mock("@/lib/customer/store", () => ({
  ensureCardUserKey: async () => "",
  rememberCardUserKey: async () => {},
}));
vi.mock("@/lib/email/send", () => ({
  sendKaraokeRescheduleEmail: async (k: Record<string, unknown>) => {
    mail.moves.push(k);
    return true;
  },
  sendKaraokeConfirmationEmail: async () => true,
  sendKaraokeCancellationEmail: async () => true,
  sendKaraokePaidOperatorEmail: async () => ({ ok: true }),
  sendKaraokeMoneyAlertEmail: async (k: Record<string, unknown>) => {
    mail.alerts.push(k);
    return { ok: true };
  },
  sendKaraokeOperatorEmail: async () => ({ ok: true }),
  sendKaraokeLateRequestEmail: async () => true,
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    refund: async () => {
      throw new Error("no refund expected in this suite");
    },
  }),
}));

process.env.KARAOKE_LINK_SECRET = "k".repeat(40);

const karaoke = await import("@/lib/mobile/karaoke");
const { istanbulClock } = await import("@/lib/mobile/venue");

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** The instant `hour`:00 on `date` begins in Tuzla. */
function startOf(date: string, hour: number): number {
  return Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00+03:00`);
}

/** "30 Ekim 2026, 18:00": the mail's "Son ücretsiz iptal" for an instant. */
function freeUntilLabel(at: number): string {
  const local = new Date(at + 3 * HOUR).toISOString();
  return `${karaoke.formatReservationDate(local.slice(0, 10))}, ${local.slice(11, 16)}`;
}

/** `days` after today in Tuzla, as a booking date. */
function dayAhead(days: number): string {
  const [y, m, d] = istanbulClock(new Date()).date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

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

const UPDATED_AT = new Date(Date.now() - 3_600_000).toISOString();

/** A paid, confirmed evening three days out, 20:00 - 22:00, 24 h / 50 %. */
function paid(over: Row = {}): Row {
  const date = (over.date as string | undefined) ?? dayAhead(3);
  const startHour = (over.startHour as number | undefined) ?? 20;
  return {
    id: "krk-91001",
    customerEmail: "eda@example.com",
    customerName: "Eda",
    contactEmail: "eda@example.com",
    date,
    startHour,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 200_000,
    totalMinor: 200_000,
    paymentStatus: "paid",
    paidMinor: 200_000,
    paidAt: new Date(Date.now() - 86_400_000).toISOString(),
    paymentRef: "PNK-R",
    channel: "web",
    freeCancelHours: 24,
    lateRefundPercent: 50,
    cancelDeadline: new Date(
      Date.parse(`${date}T${String(startHour).padStart(2, "0")}:00:00+03:00`) -
        24 * 3_600_000,
    ).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    updatedAt: UPDATED_AT,
    ...over,
  };
}

maybe("moving a karaoke booking (real Postgres)", () => {
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
    dbHook.before = null;
    for (const list of Object.values(mail)) list.length = 0;
  });

  it("a booking made before 28 Eki 2026 keeps counting back from its new start", async () => {
    // The fixture: 24 h / 50 %, made two days ago, its deadline its start
    // minus 24 hours: the rule it was booked under (counted back from the
    // start). Moving it must not take that window away by counting it from
    // the booking instead.
    await insert(paid());
    const before = await row("krk-91001");
    type Booking = Parameters<typeof karaoke.karaokeCountsBackFromStart>[0];
    expect(karaoke.karaokeCountsBackFromStart(before as Booking)).toBe(true);

    const to = { date: dayAhead(5), startHour: 21 };
    const res = await karaoke.rescheduleReservation("krk-91001", to);
    expect(res.ok).toBe(true);

    const newStart = startOf(to.date, 21);
    const after = await row("krk-91001");
    // Back from the new start, as it was promised.
    expect(after.cancelDeadline).toBe(
      new Date(newStart - 24 * HOUR).toISOString(),
    );
    // Never recounted from its making: that window closed a day ago.
    const fromMaking = Math.min(
      Date.parse(String(before.createdAt)) + 24 * HOUR,
      newStart - MINUTE,
    );
    expect(after.cancelDeadline).not.toBe(new Date(fromMaking).toISOString());
    // Still a booking of the earlier rule after the move, so a later move
    // counts back from its start again.
    expect(karaoke.karaokeCountsBackFromStart(after as Booking)).toBe(true);
    expect(after).toMatchObject({ freeCancelHours: 24, lateRefundPercent: 50 });

    // The mail prints the recounted last free moment, and the rule the
    // booking was made under (it stores no sentences: the earlier pair).
    expect(mail.moves).toHaveLength(1);
    expect(mail.moves[0]).toMatchObject({
      cancellation: {
        rules: karaoke.legacyKaraokeCancellationRules({
          freeCancelHours: 24,
          lateRefundPercent: 50,
        }),
        venueUntil: "rezervasyon saatinden önce",
        freeUntil: freeUntilLabel(newStart - 24 * HOUR),
      },
    });
  });

  it("a booking made under the 28 Eki rule keeps two hours from its making, ending at the latest the minute before the new start", async () => {
    // Made 90 minutes before a 20:00 start: its window ran to 19:59, the
    // minute before the start (`karaokeDeadlineFor`). Moved to the same
    // hour two days later, the window is its making plus two hours, long
    // before the new start.
    const date = dayAhead(3);
    const start = startOf(date, 20);
    const made = start - 90 * MINUTE;
    await insert(
      paid({
        freeCancelHours: 2,
        lateRefundPercent: 0,
        createdAt: new Date(made).toISOString(),
        cancelDeadline: new Date(start - MINUTE).toISOString(),
        cancellationRules: [
          karaoke.KARAOKE_REFUND_RULE,
          karaoke.KARAOKE_NO_REFUND_RULE,
        ],
      }),
    );
    type Booking = Parameters<typeof karaoke.karaokeCountsBackFromStart>[0];
    expect(
      karaoke.karaokeCountsBackFromStart((await row("krk-91001")) as Booking),
    ).toBe(false);
    const res = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(5),
      startHour: 20,
    });
    expect(res.ok).toBe(true);
    expect((await row("krk-91001")).cancelDeadline).toBe(
      new Date(made + 2 * HOUR).toISOString(),
    );
    // The mail: the booking's own pair, the venue wording of the rule
    // counted from the booking, and the recounted last free moment.
    expect(mail.moves.at(-1)).toMatchObject({
      cancellation: {
        rules: [karaoke.KARAOKE_REFUND_RULE, karaoke.KARAOKE_NO_REFUND_RULE],
        venueUntil:
          "rezervasyonu yaptıktan sonraki 2 saat içinde, rezervasyon saati gelmeden",
        freeUntil: freeUntilLabel(made + 2 * HOUR),
      },
    });

    // Moved earlier than its window's end: the window ends the minute
    // before the new start (12:59 for 13:00), never at the start itself,
    // which is refused.
    await pool!.query(`delete from public.karaoke_reservations`);
    const earlyMade = startOf(dayAhead(4), 12);
    await insert(
      paid({
        date: dayAhead(4),
        freeCancelHours: 2,
        lateRefundPercent: 0,
        createdAt: new Date(earlyMade).toISOString(),
        cancelDeadline: new Date(earlyMade + 2 * HOUR).toISOString(),
      }),
    );
    const moved = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(4),
      startHour: 13,
    });
    expect(moved.ok).toBe(true);
    const newStart = startOf(dayAhead(4), 13);
    expect((await row("krk-91001")).cancelDeadline).toBe(
      new Date(newStart - MINUTE).toISOString(),
    );
    expect(mail.moves.at(-1)).toMatchObject({
      cancellation: { freeUntil: freeUntilLabel(newStart - MINUTE) },
    });
  });

  it("a booking of the 28 Eki rule whose making cannot be read keeps its deadline, capped the minute before the new start", async () => {
    // `createdAt` defaults to '' in the table: no making to count from.
    const date = dayAhead(4);
    const stored = startOf(date, 14);
    await insert(
      paid({
        date,
        freeCancelHours: 2,
        lateRefundPercent: 0,
        createdAt: "",
        cancelDeadline: new Date(stored).toISOString(),
      }),
    );
    // Moved later: the stored deadline stands.
    expect(
      (
        await karaoke.rescheduleReservation("krk-91001", {
          date,
          startHour: 21,
        })
      ).ok,
    ).toBe(true);
    expect((await row("krk-91001")).cancelDeadline).toBe(
      new Date(stored).toISOString(),
    );
    // Moved before it: the minute before the new start.
    expect(
      (
        await karaoke.rescheduleReservation("krk-91001", {
          date,
          startHour: 13,
        })
      ).ok,
    ).toBe(true);
    expect((await row("krk-91001")).cancelDeadline).toBe(
      new Date(startOf(date, 13) - MINUTE).toISOString(),
    );
  });

  it("moves the evening, its deadline with it, and mails the member once", async () => {
    await insert(paid());
    const to = { date: dayAhead(4), startHour: 21 };
    const res = await karaoke.rescheduleReservation("krk-91001", to);
    expect(res).toMatchObject({
      ok: true,
      previous: { date: dayAhead(3), startHour: 20 },
      notified: true,
    });

    const after = await row("krk-91001");
    expect(after).toMatchObject({
      date: to.date,
      startHour: 21,
      hours: 2,
      status: "confirmed",
      paymentStatus: "paid",
      totalMinor: 200_000,
      paidMinor: 200_000,
      freeCancelHours: 24,
      lateRefundPercent: 50,
      // The last status decision, not this move.
      updatedAt: UPDATED_AT,
    });
    // 24 hours before the new start, on the köşk's clock.
    expect(after.cancelDeadline).toBe(
      new Date(
        Date.parse(`${to.date}T21:00:00+03:00`) - 24 * 3_600_000,
      ).toISOString(),
    );

    expect(mail.moves).toHaveLength(1);
    expect(mail.moves[0]).toMatchObject({
      to: "eda@example.com",
      time: "21:00 - 23:00",
      code: "krk-91001",
      payment: { kind: "online", paidMinor: 200_000 },
      previous: { time: "20:00 - 22:00" },
    });
    // The new link is signed for the new evening's end.
    const link = String(mail.moves[0]!.manageUrl);
    const exp = Number(decodeURIComponent(link.split("t=")[1]!).split(".")[1]);
    expect(exp * 1000).toBe(Date.parse(`${to.date}T23:00:00+03:00`));
  });

  it("a row from before the policy snapshot keeps counting from its own hour", async () => {
    await insert(
      paid({
        cancelDeadline: null,
        freeCancelHours: null,
        lateRefundPercent: null,
      }),
    );
    const res = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(3),
      startHour: 18,
    });
    expect(res.ok).toBe(true);
    expect((await row("krk-91001")).cancelDeadline).toBeNull();
  });

  it("refuses an hour another booking holds, and an unpaid hold's too", async () => {
    await insert(paid());
    await insert(
      paid({
        id: "krk-91002",
        customerEmail: "can@example.com",
        contactEmail: "can@example.com",
        startHour: 22,
        status: "requested",
        paymentStatus: "pending",
        paidMinor: 0,
        paidAt: "",
        paymentRef: "",
        paymentDueAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      }),
    );
    const res = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(3),
      startHour: 21,
    });
    expect(res).toEqual({ ok: false, reason: "slot_taken" });
    expect((await row("krk-91001")).startHour).toBe(20);
    expect(mail.moves).toHaveLength(0);
  });

  it("may move within its own hours on the same day", async () => {
    await insert(paid());
    const res = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(3),
      startHour: 21,
    });
    expect(res.ok).toBe(true);
    expect((await row("krk-91001")).startHour).toBe(21);
  });

  it("a booking that lands between the read and the write wins (no_overlap)", async () => {
    await insert(paid());
    const date = dayAhead(5);
    dbHook.before = {
      re: /update .*karaoke_reservations/i,
      run: () =>
        insert(
          paid({
            id: "krk-91003",
            customerEmail: "can@example.com",
            contactEmail: "can@example.com",
            date,
            startHour: 19,
          }),
        ),
    };
    const res = await karaoke.rescheduleReservation("krk-91001", {
      date,
      startHour: 20,
    });
    expect(res).toEqual({ ok: false, reason: "slot_taken" });
    expect((await row("krk-91001")).date).toBe(dayAhead(3));
    expect(mail.moves).toHaveLength(0);
  });

  it("a cancel that lands between the read and the write wins; nothing is mailed", async () => {
    await insert(paid());
    dbHook.before = {
      re: /update .*karaoke_reservations/i,
      run: async () => {
        await pool!.query(
          `update public.karaoke_reservations set status = 'cancelled', "paymentStatus" = 'refunded' where id = 'krk-91001'`,
        );
      },
    };
    const res = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(4),
      startHour: 20,
    });
    expect(res).toEqual({ ok: false, reason: "raced" });
    expect((await row("krk-91001")).date).toBe(dayAhead(3));
    expect(mail.moves).toHaveLength(0);
  });

  it("checks the new hours like a booking's", async () => {
    await insert(paid());
    const past = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(-1),
      startHour: 20,
    });
    expect(past).toMatchObject({
      ok: false,
      reason: "invalid",
      field: "tarih",
    });
    const late = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(4),
      startHour: 23,
    });
    expect(late).toMatchObject({ ok: false, reason: "invalid", field: "saat" });
    const far = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(400),
      startHour: 20,
    });
    expect(far).toMatchObject({ ok: false, reason: "invalid", field: "tarih" });
    const same = await karaoke.rescheduleReservation("krk-91001", {
      date: dayAhead(3),
      startHour: 20,
    });
    expect(same).toEqual({ ok: false, reason: "same_slot" });
    expect(mail.moves).toHaveLength(0);
  });

  it("never moves a cancelled booking, an unpaid hold or one that is over", async () => {
    await insert(
      paid({ id: "krk-91010", status: "cancelled", paymentStatus: "refunded" }),
    );
    await insert(
      paid({
        id: "krk-91011",
        startHour: 12,
        status: "requested",
        paymentStatus: "pending",
        paymentDueAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      }),
    );
    await insert(paid({ id: "krk-91012", date: dayAhead(-2) }));
    const to = { date: dayAhead(6), startHour: 14 };
    expect(await karaoke.rescheduleReservation("krk-91010", to)).toEqual({
      ok: false,
      reason: "cancelled",
    });
    expect(await karaoke.rescheduleReservation("krk-91011", to)).toEqual({
      ok: false,
      reason: "payment_open",
    });
    expect(await karaoke.rescheduleReservation("krk-91012", to)).toEqual({
      ok: false,
      reason: "ended",
    });
    expect(await karaoke.rescheduleReservation("krk-99999", to)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("a confirmed booking moved onto an hour cancelled late sells it again", async () => {
    const date = dayAhead(3);
    // 2 000 paid, cancelled late under 24 h / 50 %: 1 000 kept for 18-20.
    await insert(
      paid({
        id: "krk-91020",
        customerEmail: "deniz@example.com",
        contactEmail: "deniz@example.com",
        date,
        startHour: 18,
        status: "cancelled",
        paymentStatus: "refunding",
        refundMinor: 100_000,
      }),
    );
    await insert(paid({ date }));
    const res = await karaoke.rescheduleReservation("krk-91001", {
      date,
      startHour: 18,
    });
    expect(res.ok).toBe(true);
    const late = await row("krk-91020");
    expect(late.resoldHours).toEqual([18, 19]);
    expect(late.resaleRefundMinor).toBe(100_000);
    expect(mail.alerts.length).toBeGreaterThan(0);
  });
});
