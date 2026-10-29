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
 * The köşk's late cancel made good and the hour cancelled late and sold
 * again (20261020203619_karaoke_make_good.sql) against a real Postgres: the
 * two SQL functions, their row locks, the checks, the one live free hour
 * per booking and the open-bookings trigger, raced the way two people (or
 * two payments) race them. Only the POS, the mail and the audit log are
 * scripted. Skipped without TEST_DATABASE_URL, like the other
 * db-integration suites.
 *
 * - A sold hour is charged at most once, to its last late canceller, even
 *   when two confirmations (or the same payment twice) land at once; the
 *   parts add up to exactly what was kept (rule 20).
 * - "Telafi saati ver" and "Telafi ödendi" at once: exactly one wins; an
 *   hour that cannot be written leaves the make-good open (one statement).
 * - A refund by hand that a resale overtakes loses rather than record the
 *   larger amount as refunded.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

/**
 * Runs once, just before the next query whose text matches `re`: a test
 * puts a second person's write between another call's read and its write.
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
  confirmations: [] as Array<Record<string, unknown>>,
  cancellations: [] as Array<Record<string, unknown>>,
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

const pay = await import("@/lib/mobile/karaoke-payment");
const { istanbulClock } = await import("@/lib/mobile/venue");

/** `days` after today in Tuzla, as a booking date. */
function dayAhead(days: number): string {
  const [y, m, d] = istanbulClock(new Date()).date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

const TODAY = () => istanbulClock(new Date()).date;

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

/**
 * A booking cancelled late under 24 h / 50 % (karar D9): 2 000 paid, its
 * 1 000 share owed by hand, 1 000 kept for its two hours.
 */
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

/** An unpaid hold that its payment will confirm. */
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

/** A booking the köşk cancelled late, its 2 000 make-good open. */
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

const sorted = (v: unknown) =>
  [...((v as number[] | null) ?? [])].sort((a, b) => a - b);

maybe("karaoke make-good and resale (real Postgres)", () => {
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
    await pool!.query(
      `delete from public.auth_attempts where key like 'karaoke-%'`,
    );
    dbHook.before = null;
    for (const list of Object.values(mail)) list.length = 0;
  });

  describe("the schema", () => {
    it("holds the make-good and resale columns to their rules", async () => {
      const bad: Row[] = [
        // An amount without its last day, and the other way round.
        madeGood({ id: "krk-90901", makeGoodUntil: null }),
        madeGood({ id: "krk-90902", makeGoodMinor: null }),
        // Nothing to make good is no make-good.
        madeGood({ id: "krk-90903", makeGoodMinor: 0 }),
        // A transfer that did not use it, or without its day.
        madeGood({
          id: "krk-90904",
          makeGoodPaidMinor: 200_000,
          makeGoodPaidOn: TODAY(),
        }),
        madeGood({
          id: "krk-90905",
          makeGoodUsedAt: new Date().toISOString(),
          makeGoodPaidMinor: 200_000,
        }),
        // The resale part is part of what goes back, and so is what went.
        lateCancelled({ id: "krk-90906", resaleRefundMinor: 100_001 }),
        lateCancelled({ id: "krk-90907", refundSettledMinor: 100_001 }),
        lateCancelled({
          id: "krk-90908",
          refundMinor: null,
          resaleRefundMinor: 0,
        }),
      ];
      for (const r of bad) {
        await expect(insert(r), String(r.id)).rejects.toMatchObject({
          code: "23514",
        });
      }
    });

    it("a free hour is neither capped nor counted by the open-bookings trigger", async () => {
      // Two open bookings of her own: the cap of two is reached...
      for (const [id, startHour] of [
        ["krk-90020", 14],
        ["krk-90021", 16],
      ] as const) {
        await insert({
          ...hold(id, startHour, 1),
          customerEmail: "eda@example.com",
          status: "confirmed",
          paymentStatus: "paid",
          paidMinor: 100_000,
        });
      }
      // ...yet the köşk's free hour is written, and it uses up nothing.
      await insert(madeGood());
      const given = await pay.giveKaraokeMakeGoodHour(
        "krk-90010",
        { date: dayAhead(4), startHour: 20 },
        "yonetici@kosk",
      );
      expect(given.ok).toBe(true);
      await pool!.query(
        `update public.karaoke_reservations set status = 'cancelled' where id = 'krk-90021'`,
      );
      // Two open of her own again (the free hour not among them): refused.
      await insert({
        ...hold("krk-90022", 18, 1),
        customerEmail: "eda@example.com",
      });
      await expect(
        insert({
          ...hold("krk-90023", 12, 1),
          customerEmail: "eda@example.com",
        }),
      ).rejects.toMatchObject({ message: "TOO_MANY_OPEN_RESERVATIONS" });
    });
  });

  describe("an hour cancelled late and sold again", () => {
    it("two payments for its two hours at once: both counted, exactly what was kept", async () => {
      await insert(lateCancelled());
      await insert(hold("krk-90002", 20, 1));
      await insert(hold("krk-90003", 21, 1));
      const [x, y] = await Promise.all([
        paymentOf("krk-90002", "PNK-X", 100_000),
        paymentOf("krk-90003", "PNK-Y", 100_000),
      ]);
      expect(x).toMatchObject({ ok: true, outcome: "paid" });
      expect(y).toMatchObject({ ok: true, outcome: "paid" });
      const a = await row("krk-90001");
      expect(sorted(a.resoldHours)).toEqual([20, 21]);
      expect(a).toMatchObject({
        paymentStatus: "refunding",
        resaleRefundMinor: 100_000,
        refundMinor: 200_000,
      });
      // The köşk was told of each hour once, and of exactly 1 000 in all.
      const owed = mail.alerts.filter(
        (m) => m.title === "Geç iptal edilen saat yeniden satıldı",
      );
      expect(owed).toHaveLength(2);
      const total = await pool!.query(
        `select "refundMinor" - 100000 as owed from public.karaoke_reservations where id = 'krk-90001'`,
      );
      expect(Number(total.rows[0].owed)).toBe(100_000);
    });

    it("a late request at 0 % released the hours: an hour sold again owes back what was paid for it, and the guest is told it in those words (29 Eki 2026)", async () => {
      // A paid 2 h / 0 % booking three days ahead, booked a day ago: its
      // free window long over, the guest calls to say they will not come.
      await insert(
        lateCancelled({
          status: "confirmed",
          paymentStatus: "paid",
          refundMinor: null,
          freeCancelHours: 2,
          lateRefundPercent: 0,
          cancelDeadline: new Date(Date.now() - 22 * 3_600_000).toISOString(),
        }),
      );
      const res = await pay.cancelKaraokeReservation("krk-90001", {
        kind: "staff",
        actor: "personel@kosk",
        // No money moves: the refund right is not asked for.
        canRefund: false,
        cause: "misafir",
        channel: "telefon",
        requestedAt: new Date(),
      });
      expect(res).toMatchObject({ ok: true, released: true, refunded: false });
      expect(await row("krk-90001")).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
        refundMinor: 0,
      });
      expect(mail.cancellations.at(-1)).toMatchObject({
        cancelCause: "misafir",
        releasedForResale: true,
      });
      expect(mail.cancellations.at(-1)).not.toHaveProperty("refundedMinor");

      // The hour is free online: another guest books and pays for the
      // first of its two hours.
      await insert(hold("krk-90002", 20, 1));
      expect(await paymentOf("krk-90002", "PNK-X", 100_000)).toMatchObject({
        ok: true,
        outcome: "paid",
      });
      const owed = await row("krk-90001");
      expect(owed).toMatchObject({
        paymentStatus: "refunding",
        resaleRefundMinor: 100_000,
        refundMinor: 100_000,
      });
      expect(sorted(owed.resoldHours)).toEqual([20]);
      expect(
        mail.alerts.filter(
          (m) => m.title === "Geç iptal edilen saat yeniden satıldı",
        ),
      ).toHaveLength(1);

      // A person refunds it in PayNkolay and records it: the guest reads
      // that a resold hour went back, never a late share they did not get.
      const settled = await pay.settleKaraokeRefundByHand(
        "krk-90001",
        "yonetici@kosk",
        undefined,
        { shownRefundMinor: 100_000 },
      );
      expect(settled.ok).toBe(true);
      expect(await row("krk-90001")).toMatchObject({
        paymentStatus: "refunded",
        refundMinor: 100_000,
      });
      const last = mail.cancellations.at(-1)!;
      expect(last).toMatchObject({
        refundedMinor: 100_000,
        refundIsShare: true,
        refundIsResaleOnly: true,
      });
      expect(last).not.toHaveProperty("refundIncludesResale");
      const real =
        await vi.importActual<typeof import("@/lib/email/send")>(
          "@/lib/email/send",
        );
      expect(real.karaokeCancellationFlags(last as never)).toMatchObject({
        KARAOKE_SATIS_IADE_EDILDI: true,
        KARAOKE_KISMI_SATIS_IADE_EDILDI: false,
        KARAOKE_KISMI_IADE_EDILDI: false,
        KARAOKE_SATISA_ACILDI: false,
      });
    });

    it("the same payment reported twice at once charges its hour once", async () => {
      await insert(lateCancelled());
      await insert(hold("krk-90002", 20, 1));
      const results = await Promise.all([
        paymentOf("krk-90002", "PNK-X", 100_000),
        paymentOf("krk-90002", "PNK-X", 100_000),
      ]);
      expect(results.every((r) => r.ok)).toBe(true);
      expect(await row("krk-90001")).toMatchObject({
        resoldHours: [20],
        resaleRefundMinor: 50_000,
        refundMinor: 150_000,
      });
      expect(
        mail.alerts.filter(
          (m) => m.title === "Geç iptal edilen saat yeniden satıldı",
        ),
      ).toHaveLength(1);
    });

    it("the same hour charged from two connections at once is counted once", async () => {
      await insert(lateCancelled());
      const first = await pool!.connect();
      const second = await pool!.connect();
      try {
        await first.query("begin");
        const a = await first.query(
          `select public.karaoke_charge_resold_hours('krk-90001', '[20]'::jsonb) as n`,
        );
        // The second waits on the row lock the first holds...
        const pending = second.query(
          `select public.karaoke_charge_resold_hours('krk-90001', '[20]'::jsonb) as n`,
        );
        await new Promise((resolve) => setTimeout(resolve, 150));
        await first.query("commit");
        // ...and then finds the hour counted.
        const b = await pending;
        expect([Number(a.rows[0].n), Number(b.rows[0].n)]).toEqual([50_000, 0]);
      } finally {
        first.release();
        second.release();
      }
      expect(await row("krk-90001")).toMatchObject({
        resoldHours: [20],
        resaleRefundMinor: 50_000,
        refundMinor: 150_000,
      });
    });

    it("each hour to the booking that cancelled it last, once", async () => {
      // A cancelled 20-22 late at 10:00; B cancelled 20-21 late after it.
      await insert(lateCancelled());
      await insert(
        lateCancelled({
          id: "krk-90004",
          hours: 1,
          paymentRef: "PNK-B",
          paidMinor: 100_000,
          priceMinor: 100_000,
          totalMinor: 100_000,
          refundMinor: 50_000,
          updatedAt: new Date(Date.now() - 1_800_000).toISOString(),
        }),
      );
      await insert(hold("krk-90005", 20, 2));
      expect(await paymentOf("krk-90005", "PNK-C", 200_000)).toMatchObject({
        ok: true,
        outcome: "paid",
      });
      // 20:00 counts to B (the later), 21:00 to A.
      expect(await row("krk-90004")).toMatchObject({
        resoldHours: [20],
        resaleRefundMinor: 50_000,
        refundMinor: 100_000,
      });
      expect(await row("krk-90001")).toMatchObject({
        resoldHours: [21],
        resaleRefundMinor: 50_000,
        refundMinor: 150_000,
      });
    });

    it("a refund by hand that a resale overtakes loses; the larger amount stays owed", async () => {
      await insert(lateCancelled());
      // The person reads 1 000 owed; the hour is sold before the write.
      dbHook.before = {
        re: /^UPDATE "karaoke_reservations"/,
        run: async () => {
          await pool!.query(
            `select public.karaoke_charge_resold_hours('krk-90001', '[20, 21]'::jsonb)`,
          );
        },
      };
      const lost = await pay.settleKaraokeRefundByHand(
        "krk-90001",
        "yonetici@kosk",
        undefined,
        { shownRefundMinor: 100_000 },
      );
      expect(lost).toMatchObject({ ok: false, reason: "raced" });
      expect(await row("krk-90001")).toMatchObject({
        paymentStatus: "refunding",
        refundMinor: 200_000,
      });
      const settled = await pay.settleKaraokeRefundByHand(
        "krk-90001",
        "yonetici@kosk",
        undefined,
        { shownRefundMinor: 200_000 },
      );
      expect(settled.ok).toBe(true);
      expect(await row("krk-90001")).toMatchObject({
        paymentStatus: "refunded",
        refundMinor: 200_000,
      });
      // A sale after the refund owes only the rest, which stays readable.
      await pool!.query(
        `update public.karaoke_reservations set "refundMinor" = 100000, "resaleRefundMinor" = null, "resoldHours" = null where id = 'krk-90001'`,
      );
      expect(
        Number(
          (
            await pool!.query(
              `select public.karaoke_charge_resold_hours('krk-90001', '[20]'::jsonb) as n`,
            )
          ).rows[0].n,
        ),
      ).toBe(50_000);
      expect(await row("krk-90001")).toMatchObject({
        paymentStatus: "refunding",
        refundMinor: 150_000,
        refundSettledMinor: 100_000,
      });
    });
  });

  describe("Telafi saati ver / Telafi ödendi", () => {
    it("at the same moment: exactly one of the two wins", async () => {
      for (let i = 0; i < 4; i += 1) {
        await pool!.query(`delete from public.karaoke_reservations`);
        await insert(madeGood());
        const [hour, money] = await Promise.all([
          pay.giveKaraokeMakeGoodHour(
            "krk-90010",
            { date: dayAhead(5), startHour: 20 },
            "yonetici@kosk",
          ),
          pay.recordKaraokeMakeGoodPaid(
            "krk-90010",
            { paidOn: TODAY(), amountMinor: 200_000 },
            "sahip@kosk",
            undefined,
            { reason: "Havale yapıldı, dekont muhasebede" },
          ),
        ]);
        expect([hour.ok, money.ok].filter(Boolean)).toHaveLength(1);
        const made = await row("krk-90010");
        const hours = (
          await pool!.query(
            `select id from public.karaoke_reservations where "makeGoodFor" = 'krk-90010'`,
          )
        ).rows;
        if (hour.ok) {
          expect(made.makeGoodPaidMinor).toBeNull();
          expect(hours).toHaveLength(1);
        } else {
          expect(made.makeGoodPaidMinor).toBe(200_000);
          expect(hours).toHaveLength(0);
        }
        expect(made.makeGoodUsedAt).not.toBeNull();
      }
    });

    it("two free hours at once: one hour", async () => {
      await insert(madeGood());
      const results = await Promise.all([
        pay.giveKaraokeMakeGoodHour(
          "krk-90010",
          { date: dayAhead(5), startHour: 20 },
          "yonetici@kosk",
        ),
        pay.giveKaraokeMakeGoodHour(
          "krk-90010",
          { date: dayAhead(6), startHour: 18 },
          "sahip@kosk",
        ),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const hours = (
        await pool!.query(
          `select status, "paymentStatus", "totalMinor", channel, note, hours, guests
             from public.karaoke_reservations where "makeGoodFor" = 'krk-90010'`,
        )
      ).rows;
      expect(hours).toEqual([
        {
          status: "confirmed",
          paymentStatus: "none",
          totalMinor: 0,
          channel: "staff",
          note: "Telafi: KRK-90010",
          hours: 2,
          guests: 4,
        },
      ]);
      expect(mail.confirmations).toHaveLength(1);
      expect(mail.confirmations[0]).toMatchObject({
        makeGoodHourFor: "krk-90010",
      });
    });

    it("an hour taken between the check and the write: nothing written, the make-good open", async () => {
      await insert(madeGood());
      const day = dayAhead(5);
      dbHook.before = {
        re: /"karaoke_give_make_good_hour"/,
        run: async () => {
          await insert({
            ...hold("krk-90030", 21, 1),
            date: day,
            status: "confirmed",
            paymentStatus: "paid",
            paidMinor: 100_000,
          });
        },
      };
      const res = await pay.giveKaraokeMakeGoodHour(
        "krk-90010",
        { date: day, startHour: 20 },
        "yonetici@kosk",
      );
      expect(res).toMatchObject({ ok: false, reason: "slot_taken" });
      expect((await row("krk-90010")).makeGoodUsedAt).toBeNull();
      expect(
        (
          await pool!.query(
            `select count(*)::int as n from public.karaoke_reservations where "makeGoodFor" = 'krk-90010'`,
          )
        ).rows[0].n,
      ).toBe(0);
      // Another hour still works.
      const again = await pay.giveKaraokeMakeGoodHour(
        "krk-90010",
        { date: day, startHour: 18 },
        "yonetici@kosk",
      );
      expect(again.ok).toBe(true);
    });

    it("the free hour let go before it begins: cancelled and the make-good open again, together", async () => {
      await insert(madeGood());
      const given = await pay.giveKaraokeMakeGoodHour(
        "krk-90010",
        { date: dayAhead(5), startHour: 20 },
        "yonetici@kosk",
      );
      expect(given.ok).toBe(true);
      if (!given.ok) return;
      expect((await row("krk-90010")).makeGoodUsedAt).not.toBeNull();
      const res = await pay.cancelKaraokeReservation(given.reservation.id, {
        kind: "member",
        email: "eda@example.com",
        emailVerified: true,
      });
      expect(res).toMatchObject({ ok: true, refunded: false });
      expect((await row(given.reservation.id)).status).toBe("cancelled");
      expect((await row("krk-90010")).makeGoodUsedAt).toBeNull();
      // Open again: the money can now be recorded instead.
      const money = await pay.recordKaraokeMakeGoodPaid(
        "krk-90010",
        { paidOn: TODAY(), amountMinor: 200_000 },
        "sahip@kosk",
        undefined,
        { reason: "Misafir parayı seçti, havale yapıldı" },
      );
      expect(money.ok).toBe(true);
    });

    it("a free hour written off after it began keeps the make-good used", async () => {
      await insert(madeGood());
      const day = dayAhead(2);
      const given = await pay.giveKaraokeMakeGoodHour(
        "krk-90010",
        { date: day, startHour: 20 },
        "yonetici@kosk",
      );
      expect(given.ok).toBe(true);
      if (!given.ok) return;
      // The köşk writes it off the morning after.
      const after = new Date(Date.parse(`${day}T20:00:00.000Z`) + 86_400_000);
      const res = await pay.cancelKaraokeReservation(
        given.reservation.id,
        { kind: "staff", actor: "yonetici@kosk", canRefund: true },
        { now: after },
      );
      expect(res).toMatchObject({ ok: true, silent: true });
      expect((await row(given.reservation.id)).status).toBe("cancelled");
      expect((await row("krk-90010")).makeGoodUsedAt).not.toBeNull();
    });

    it("never writes a bank account: the IBAN note is refused before anything moves", async () => {
      await insert(madeGood());
      const res = await pay.recordKaraokeMakeGoodPaid(
        "krk-90010",
        { paidOn: TODAY(), amountMinor: 200_000 },
        "sahip@kosk",
        undefined,
        { reason: "TR33 0006 1005 1978 6457 8413 26 hesabına gönderildi" },
      );
      expect(res).toMatchObject({ ok: false, reason: "invalid" });
      const made = await row("krk-90010");
      expect(made.makeGoodUsedAt).toBeNull();
      expect(JSON.stringify(made)).not.toMatch(/0006|TR33/);
      // The table has no column for one.
      const cols = (
        await pool!.query(
          `select column_name from information_schema.columns
            where table_schema = 'public' and table_name = 'karaoke_reservations'`,
        )
      ).rows.map((r) => String(r.column_name).toLowerCase());
      expect(cols.filter((c) => /iban|account|hesap/.test(c))).toEqual([]);
    });
  });
});
