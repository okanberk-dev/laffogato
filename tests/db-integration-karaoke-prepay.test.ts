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
 * Karaoke online prepayment (operator, 16 Eki 2026) against a real Postgres:
 * the overlap constraint, the open-bookings trigger (now per phone for
 * guests), the payment-state checks and the unique payment reference are
 * all exercised for real; only the POS and the mail are scripted.
 *
 * Skipped without TEST_DATABASE_URL, like the other db-integration suites.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

/**
 * Runs once, just before the next INSERT or UPDATE: a test puts a second
 * person's action between another call's read and its first write.
 */
const dbHook = vi.hoisted(() => ({
  beforeWrite: null as null | (() => Promise<void>),
}));

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
  if (dbHook.beforeWrite && /^(INSERT|UPDATE)\b/.test(q.text)) {
    const run = dbHook.beforeWrite;
    dbHook.beforeWrite = null;
    await run();
  }
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

/** The scripted POS: what it answers, and what it was asked. */
const pos = vi.hoisted(() => ({
  lookup: new Map<
    string,
    "paid" | "unpaid" | "down" | { amountMinor: number; ref: string }
  >(),
  refund: "ok" as "ok" | "refused" | "timeout",
  /** Holds the next refund call at the POS until `release` settles. */
  hold: null as null | { entered: () => void; release: Promise<void> },
  refunds: [] as Array<{ ref: string; amountMinor?: number }>,
  sessions: [] as Array<{
    orderId: string;
    amountMinor: number;
    email: string;
    cardUserKey?: string;
  }>,
  failSession: false,
}));
const mail = vi.hoisted(() => ({
  confirmations: [] as Array<Record<string, unknown>>,
  cancellations: [] as Array<Record<string, unknown>>,
  paidNotices: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
  requested: [] as Array<Record<string, unknown>>,
}));
const settings = vi.hoisted(() => ({
  value: {
    karaokePrepay: true,
    karaokeHourlyMinor: 100_000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "",
    email: "kosk@example.com",
    mobileApp: null as unknown,
  },
}));
const loyalty = vi.hoisted(() => ({ tier: "" }));
/** Makes the member's cancellation mail fail (the panel must say so). */
const mailDown = vi.hoisted(() => ({ cancellation: false }));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "10.9.8.7" }),
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("@/lib/admin/store", async () => {
  const { DEFAULT_MOBILE_APP_CONFIG } = await import("@/lib/mobile/app-config");
  settings.value.mobileApp = DEFAULT_MOBILE_APP_CONFIG;
  return { getSettings: async () => settings.value };
});
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/mobile/loyalty", () => ({
  getLoyalty: async () => ({ tier: loyalty.tier }),
}));
vi.mock("@/lib/customer/store", () => ({
  ensureCardUserKey: async () => "MEMBERKEY01",
  rememberCardUserKey: async () => {},
}));
vi.mock("@/lib/email/send", () => ({
  sendKaraokeConfirmationEmail: async (k: Record<string, unknown>) => {
    mail.confirmations.push(k);
    return true;
  },
  sendKaraokeCancellationEmail: async (k: Record<string, unknown>) => {
    mail.cancellations.push(k);
    return !mailDown.cancellation;
  },
  sendKaraokePaidOperatorEmail: async (k: Record<string, unknown>) => {
    mail.paidNotices.push(k);
    return { ok: true };
  },
  sendKaraokeMoneyAlertEmail: async (k: Record<string, unknown>) => {
    mail.alerts.push(k);
    return { ok: true };
  },
  sendKaraokeOperatorEmail: async (k: Record<string, unknown>) => {
    mail.requested.push(k);
    return { ok: true };
  },
}));
vi.mock("@/lib/payment", async () => {
  const { PaymentRefusedError } = await import("@/lib/payment/provider");
  return {
    getPaymentProvider: () => ({
      name: "fakepos",
      createCheckoutSession: async (input: {
        orderId: string;
        amountMinor: number;
        customer: { email: string };
        cardUserKey?: string;
      }) => {
        if (pos.failSession) throw new Error("POS down");
        pos.sessions.push({
          orderId: input.orderId,
          amountMinor: input.amountMinor,
          email: input.customer.email,
          cardUserKey: input.cardUserKey,
        });
        return {
          providerRef: input.orderId,
          redirectUrl: `https://laffogato.net/odeme/paynkolay?d=x&s=${input.orderId}`,
          expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
        };
      },
      lookupPayment: async (orderId: string) => {
        const answer = pos.lookup.get(orderId) ?? "unpaid";
        if (answer === "down") throw new Error("POS unreachable");
        if (answer === "unpaid") return null;
        const amount = answer === "paid" ? undefined : answer;
        return {
          status: "succeeded",
          orderId,
          providerRef: amount?.ref ?? `REF-${orderId}`,
          amountMinor: amount?.amountMinor ?? 200_000,
          currency: "TRY",
          raw: { source: "test" },
          trxDate: "2026-10-16",
        };
      },
      refund: async (ref: string, amountMinor?: number) => {
        if (pos.hold) {
          const gate = pos.hold;
          pos.hold = null;
          gate.entered();
          await gate.release;
        }
        if (pos.refund === "refused") {
          throw new PaymentRefusedError(
            "paynkolay refund reddedildi: responseCode=5",
          );
        }
        if (pos.refund === "timeout") throw new Error("socket hang up");
        pos.refunds.push({ ref, amountMinor });
        return { providerRef: ref, status: "succeeded" };
      },
    }),
  };
});

process.env.KARAOKE_LINK_SECRET = "k".repeat(40);

const karaoke = await import("@/lib/mobile/karaoke");
const pay = await import("@/lib/mobile/karaoke-payment");
const audit = await import("@/lib/admin/audit");
const { staffReleasedIds } = await import("@/lib/admin/karaoke-panel");
const link = await import("@/lib/mobile/karaoke-link");
const { istanbulClock } = await import("@/lib/mobile/venue");

/** `days` after today in Tuzla, as a booking date. */
function dayAhead(days: number): string {
  const [y, m, d] = istanbulClock(new Date()).date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

const CONSENT = {
  acceptedAt: new Date().toISOString(),
  documents: ["karaoke-odasi-rezervasyon"],
  version: "16 Ekim 2026",
  confirmations: ["on-bilgilendirme", "hizmet-sozlesmesi", "kvkk-aydinlatma"],
  surface: "web" as const,
  ip: "10.9.8.7",
  userAgent: "vitest",
};

let seq = 0;
function member(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    id: `cus-${seq}`,
    email: `uye${seq}-${Date.now()}@example.com`,
    name: "Eda Mancuso",
    phone: "+905321234567",
    emailVerified: true,
    ...overrides,
  } as unknown as import("@/lib/customer/store").PublicCustomer;
}
function contactOf(
  c: { email: string; name: string },
  phone = "+905321234567",
) {
  return {
    name: c.name,
    email: c.email,
    phone,
    consentAt: new Date().toISOString(),
  };
}

async function bookMember(
  c: ReturnType<typeof member>,
  req: Partial<{
    date: string;
    startHour: number;
    hours: number;
    guests: number;
  }> = {},
) {
  const res = await pay.bookKaraoke(
    c,
    { date: dayAhead(3), startHour: 20, hours: 2, guests: 4, note: "", ...req },
    {
      channel: "web",
      prepay: true,
      contact: contactOf(c),
      legalConsent: CONSENT,
      buyerIp: "10.9.8.7",
    },
  );
  if (!res.ok) throw new Error(`booking refused: ${res.message}`);
  return res;
}

async function row(id: string) {
  const r = await pool!.query(
    `select * from public.karaoke_reservations where id = $1`,
    [id],
  );
  return r.rows[0] as Record<string, unknown>;
}

maybe("karaoke prepayment (real Postgres)", () => {
  let release: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_ });
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
      `delete from public.auth_attempts where key like 'karaoke-%' or key like 'checkout-reopen%'`,
    );
    pos.lookup.clear();
    pos.refund = "ok";
    pos.hold = null;
    dbHook.beforeWrite = null;
    pos.refunds.length = 0;
    pos.sessions.length = 0;
    pos.failSession = false;
    for (const list of Object.values(mail)) list.length = 0;
    settings.value.karaokePrepay = true;
    loyalty.tier = "";
    mailDown.cancellation = false;
    vi.mocked(audit.logAudit).mockClear();
  });

  describe("booking", () => {
    it("holds the hour unpaid, records the consent, and opens a page for exactly the total", async () => {
      const c = member();
      const res = await bookMember(c);
      const r = await row(res.reservation.id);
      expect(r.status).toBe("requested");
      expect(r.paymentStatus).toBe("pending");
      expect(r.channel).toBe("web");
      expect(r.guest).toBe(false);
      expect(r.legalConsent).toMatchObject({
        documents: ["karaoke-odasi-rezervasyon"],
        confirmations: [
          "on-bilgilendirme",
          "hizmet-sozlesmesi",
          "kvkk-aydinlatma",
        ],
        ip: "10.9.8.7",
        userAgent: "vitest",
      });
      expect(pos.sessions).toEqual([
        {
          orderId: res.reservation.id,
          amountMinor: 200_000,
          email: c.email,
          cardUserKey: "MEMBERKEY01",
        },
      ]);
      expect(res.payment?.redirectUrl).toContain("/odeme/paynkolay");
      // Nobody hears of an unpaid hold: no "requested" notice, no member mail.
      expect(mail.requested).toHaveLength(0);
      expect(mail.confirmations).toHaveLength(0);
    });

    it("refuses a paid booking without its consent record", async () => {
      const c = member();
      const res = await pay.bookKaraoke(
        c,
        { date: dayAhead(3), startHour: 20, hours: 2, guests: 4 },
        { channel: "web", prepay: true, contact: contactOf(c) },
      );
      expect(res).toMatchObject({
        ok: false,
        status: 400,
        field: "legalConsent",
      });
    });

    it("lets the hour go at once when no payment page could be opened", async () => {
      pos.failSession = true;
      const c = member();
      const res = await pay.bookKaraoke(
        c,
        { date: dayAhead(3), startHour: 20, hours: 2, guests: 4 },
        {
          channel: "web",
          prepay: true,
          contact: contactOf(c),
          legalConsent: CONSENT,
        },
      );
      expect(res).toMatchObject({
        ok: false,
        status: 503,
        error: "payment_unavailable",
      });
      const r = (
        await pool!.query(
          `select status, "paymentStatus" from public.karaoke_reservations`,
        )
      ).rows;
      expect(r).toEqual([{ status: "cancelled", paymentStatus: "expired" }]);
      // The hour is free for the next person.
      pos.failSession = false;
      await bookMember(member());
    });

    it("settles a zero total as free and confirms it, with no page", async () => {
      loyalty.tier = "oro";
      const config = settings.value.mobileApp as {
        karaoke: { oroDiscountPct: number };
      };
      const before = config.karaoke.oroDiscountPct;
      settings.value.mobileApp = {
        ...config,
        karaoke: { ...config.karaoke, oroDiscountPct: 100 },
      };
      try {
        const res = await bookMember(member());
        expect(res.payment).toBeNull();
        const r = await row(res.reservation.id);
        expect(r).toMatchObject({
          status: "confirmed",
          paymentStatus: "paid",
          totalMinor: 0,
        });
        expect(pos.sessions).toHaveLength(0);
      } finally {
        settings.value.mobileApp = {
          ...config,
          karaoke: { ...config.karaoke, oroDiscountPct: before },
        };
      }
    });

    it("with prepayment off, takes the old request paid at the venue", async () => {
      settings.value.karaokePrepay = false;
      const c = member();
      const res = await pay.bookKaraoke(
        c,
        { date: dayAhead(3), startHour: 20, hours: 2, guests: 4 },
        { channel: "web", prepay: true, contact: contactOf(c) },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.payment).toBeNull();
      expect((await row(res.reservation.id)).paymentStatus).toBe("none");
      expect(mail.requested).toHaveLength(1);
    });
  });

  describe("never confirmed without its money", () => {
    it("refuses the staff confirm of an unpaid hold", async () => {
      const res = await bookMember(member());
      const done = await karaoke.setReservationStatus(
        res.reservation.id,
        "confirmed",
      );
      expect(done).toEqual({ ok: false, reason: "payment_open" });
      expect((await row(res.reservation.id)).status).toBe("requested");
    });

    it("refuses to confirm a pay-at-the-venue request while prepayment is on", async () => {
      settings.value.karaokePrepay = false;
      const c = member();
      const res = await pay.bookKaraoke(
        c,
        { date: dayAhead(3), startHour: 20, hours: 2, guests: 4 },
        { channel: "web", prepay: false, contact: contactOf(c) },
      );
      if (!res.ok) throw new Error("refused");
      settings.value.karaokePrepay = true;
      expect(
        await karaoke.setReservationStatus(res.reservation.id, "confirmed"),
      ).toEqual({
        ok: false,
        reason: "payment_open",
      });
      settings.value.karaokePrepay = false;
      const ok = await karaoke.setReservationStatus(
        res.reservation.id,
        "confirmed",
      );
      expect(ok.ok).toBe(true);
    });

    it("the database itself refuses a pending hold marked confirmed", async () => {
      const res = await bookMember(member());
      await expect(
        pool!.query(
          `update public.karaoke_reservations set status = 'confirmed' where id = $1`,
          [res.reservation.id],
        ),
      ).rejects.toThrow(/karaoke_reservations_payment_state_check/);
    });
  });

  describe("a confirmed payment", () => {
    it("pays and confirms once, mailing the member and the köşk exactly once", async () => {
      const res = await bookMember(member());
      const input = {
        reservationId: res.reservation.id,
        provider: "fakepos",
        providerRef: res.reservation.id,
        amountMinor: 200_000,
        currency: "TRY",
        trxDate: "2026-10-16",
      };
      const first = await pay.applyKaraokePaymentSucceeded(input);
      const again = await pay.applyKaraokePaymentSucceeded(input);
      expect(first).toMatchObject({ ok: true, outcome: "paid" });
      expect(again).toMatchObject({ ok: true, outcome: "repeat" });
      const r = await row(res.reservation.id);
      expect(r).toMatchObject({
        status: "confirmed",
        paymentStatus: "paid",
        paidMinor: 200_000,
      });
      expect(mail.confirmations).toHaveLength(1);
      expect(mail.confirmations[0]).toMatchObject({
        payment: { kind: "online", paidMinor: 200_000 },
      });
      // The receipt carries the booking's signed page.
      expect(String(mail.confirmations[0]!.manageUrl)).toMatch(
        /\/rezervasyon\?t=krk-/,
      );
      expect(mail.paidNotices).toHaveLength(1);
    });

    it("does not confirm a payment of the wrong amount, and tells a person", async () => {
      const res = await bookMember(member());
      const out = await pay.applyKaraokePaymentSucceeded({
        reservationId: res.reservation.id,
        provider: "fakepos",
        providerRef: res.reservation.id,
        amountMinor: 100,
        currency: "TRY",
      });
      expect(out).toMatchObject({ ok: true, outcome: "amount_mismatch" });
      expect((await row(res.reservation.id)).paymentStatus).toBe("pending");
      expect(mail.alerts).toHaveLength(1);
    });

    it("sends back a payment that arrives for a hold that already lapsed", async () => {
      const res = await bookMember(member());
      await pool!.query(
        `update public.karaoke_reservations set status = 'cancelled', "paymentStatus" = 'expired' where id = $1`,
        [res.reservation.id],
      );
      const out = await pay.applyKaraokePaymentSucceeded({
        reservationId: res.reservation.id,
        provider: "fakepos",
        providerRef: res.reservation.id,
        amountMinor: 200_000,
        currency: "TRY",
      });
      expect(out).toMatchObject({ ok: true, outcome: "refunded" });
      expect(pos.refunds).toEqual([
        { ref: res.reservation.id, amountMinor: 200_000 },
      ]);
      const r = await row(res.reservation.id);
      expect(r).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
      });
      expect(mail.alerts).toHaveLength(1);
      expect(mail.cancellations).toHaveLength(1);
    });

    it("sends back a second charge and leaves the paid booking alone", async () => {
      const res = await bookMember(member());
      const base = {
        reservationId: res.reservation.id,
        provider: "fakepos",
        amountMinor: 200_000,
        currency: "TRY",
      };
      await pay.applyKaraokePaymentSucceeded({ ...base, providerRef: "FIRST" });
      const out = await pay.applyKaraokePaymentSucceeded({
        ...base,
        providerRef: "SECOND",
      });
      expect(out).toMatchObject({ ok: true, outcome: "refunded" });
      expect(pos.refunds).toEqual([{ ref: "SECOND", amountMinor: 200_000 }]);
      expect(await row(res.reservation.id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "paid",
        paymentRef: "FIRST",
      });
    });
  });

  describe("the sweep (CLAUDE.md rule 29)", () => {
    const later = (ms: number) => new Date(Date.now() + ms);

    it("leaves a hold alone while its page and the bank's grace are open", async () => {
      const res = await bookMember(member());
      expect(await pay.expireUnpaidReservations(later(20 * 60_000))).toBe(0);
      expect((await row(res.reservation.id)).paymentStatus).toBe("pending");
    });

    it("asks the POS and frees the hour of a hold nobody paid", async () => {
      const res = await bookMember(member());
      expect(await pay.expireUnpaidReservations(later(2 * 3600_000))).toBe(1);
      expect(await row(res.reservation.id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "expired",
      });
      // An abandoned checkout is no decision anyone made: no inbox item.
      const inbox = await karaoke.listReservationDecisions(
        String((await row(res.reservation.id)).customerEmail),
        "2000-01-01",
      );
      expect(inbox).toHaveLength(0);
    });

    it("books a payment the return never brought, instead of expiring it", async () => {
      const res = await bookMember(member());
      pos.lookup.set(res.reservation.id, "paid");
      await pay.expireUnpaidReservations(later(2 * 3600_000));
      expect(await row(res.reservation.id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "paid",
      });
    });

    it("never reads an unreachable POS as unpaid - until a day has passed", async () => {
      const res = await bookMember(member());
      pos.lookup.set(res.reservation.id, "down");
      expect(await pay.expireUnpaidReservations(later(2 * 3600_000))).toBe(0);
      expect((await row(res.reservation.id)).paymentStatus).toBe("pending");
      expect(await pay.expireUnpaidReservations(later(25 * 3600_000))).toBe(1);
    });
  });

  describe("the member cancels", () => {
    async function paidBooking(c = member()) {
      const res = await bookMember(c);
      await pay.applyKaraokePaymentSucceeded({
        reservationId: res.reservation.id,
        provider: "fakepos",
        providerRef: res.reservation.id,
        amountMinor: 200_000,
        currency: "TRY",
      });
      return { c, id: res.reservation.id };
    }
    const asMember = (c: { email: string }) => ({
      kind: "member" as const,
      email: c.email,
      emailVerified: true,
    });

    it("more than two hours before: refunds in full, then cancels and mails", async () => {
      const { c, id } = await paidBooking();
      const out = await pay.cancelKaraokeReservation(id, asMember(c));
      expect(out).toMatchObject({ ok: true, refunded: true });
      expect(pos.refunds).toEqual([{ ref: id, amountMinor: 200_000 }]);
      expect(await row(id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
      });
      expect(mail.cancellations.at(-1)).toMatchObject({
        refundedMinor: 200_000,
      });
    });

    it("inside the last two hours: refused with the no-refund rule, nothing moves", async () => {
      const { c, id } = await paidBooking();
      const r = await karaoke.getReservation(id);
      const start = karaoke
        .karaokeStartInstant(r!.date, r!.startHour)
        .getTime();
      for (const now of [
        new Date(start - 2 * 3600_000),
        new Date(start - 3600_000),
      ]) {
        const out = await pay.cancelKaraokeReservation(id, asMember(c), {
          now,
        });
        expect(out).toMatchObject({ ok: false, reason: "too_late" });
        expect(out.ok ? "" : out.message).toContain(
          "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
        );
      }
      expect(pos.refunds).toHaveLength(0);
      expect((await row(id)).paymentStatus).toBe("paid");
    });

    it("a refund the POS declined puts the booking back as paid", async () => {
      const { c, id } = await paidBooking();
      pos.refund = "refused";
      const out = await pay.cancelKaraokeReservation(id, asMember(c));
      expect(out).toMatchObject({ ok: false, reason: "refund_refused" });
      expect(await row(id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "paid",
      });
      // And it can be tried again: the claim was released.
      pos.refund = "ok";
      expect(await pay.cancelKaraokeReservation(id, asMember(c))).toMatchObject(
        { ok: true, refunded: true },
      );
    });

    it("a refund whose answer never came is NOT rolled back (rule 29's twin)", async () => {
      const { c, id } = await paidBooking();
      pos.refund = "timeout";
      const out = await pay.cancelKaraokeReservation(id, asMember(c));
      expect(out).toMatchObject({ ok: false, reason: "refund_unknown" });
      expect(await row(id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "refunding",
      });
      expect(mail.alerts).toHaveLength(1);
      // A second press does not send a second refund.
      pos.refund = "ok";
      expect(await pay.cancelKaraokeReservation(id, asMember(c))).toMatchObject(
        { ok: false, reason: "not_cancellable" },
      );
      expect(pos.refunds).toHaveLength(0);
    });

    it("another member's booking answers like a missing one", async () => {
      const { id } = await paidBooking();
      expect(
        await pay.cancelKaraokeReservation(id, asMember(member())),
      ).toEqual({ ok: false, reason: "not_found" });
      expect(
        await pay.cancelKaraokeReservation(id, {
          kind: "member",
          email: "x@y.z",
          emailVerified: false,
        }),
      ).toEqual({
        ok: false,
        reason: "not_found",
      });
    });

    it("an unpaid hold is released after the POS says no payment; kept when it cannot say", async () => {
      const c = member();
      const res = await bookMember(c);
      pos.lookup.set(res.reservation.id, "down");
      expect(
        await pay.cancelKaraokeReservation(res.reservation.id, asMember(c)),
      ).toMatchObject({
        ok: false,
        reason: "payment_unknown",
      });
      pos.lookup.set(res.reservation.id, "unpaid");
      expect(
        await pay.cancelKaraokeReservation(res.reservation.id, asMember(c)),
      ).toMatchObject({
        ok: true,
        refunded: false,
      });
    });
  });

  describe("the köşk cancels", () => {
    it("needs the refund permission for a paid booking, and refunds it in full", async () => {
      const res = await bookMember(member());
      const id = res.reservation.id;
      await pay.applyKaraokePaymentSucceeded({
        reservationId: id,
        provider: "fakepos",
        providerRef: id,
        amountMinor: 200_000,
        currency: "TRY",
      });
      expect(
        await pay.cancelKaraokeReservation(id, {
          kind: "staff",
          actor: "staff@kosk",
          canRefund: false,
        }),
      ).toMatchObject({ ok: false, reason: "refund_forbidden" });
      expect(
        await pay.cancelKaraokeReservation(id, {
          kind: "staff",
          actor: "owner@kosk",
          canRefund: true,
        }),
      ).toMatchObject({ ok: true, refunded: true });
    });

    it("the old pay-at-the-venue path refuses a paid booking", async () => {
      const res = await bookMember(member());
      await pay.applyKaraokePaymentSucceeded({
        reservationId: res.reservation.id,
        provider: "fakepos",
        providerRef: res.reservation.id,
        amountMinor: 200_000,
        currency: "TRY",
      });
      expect(
        await karaoke.setReservationStatus(res.reservation.id, "cancelled"),
      ).toEqual({
        ok: false,
        reason: "payment_open",
      });
    });
  });

  describe("guests (no account)", () => {
    async function bookGuest(
      email: string,
      phone: string,
      startHour = 20,
      days = 3,
    ) {
      return pay.bookKaraoke(
        null,
        { date: dayAhead(days), startHour, hours: 1, guests: 2 },
        {
          channel: "web",
          prepay: false,
          contact: {
            name: "Ada Lovelace",
            email,
            phone,
            consentAt: new Date().toISOString(),
          },
          legalConsent: CONSENT,
          buyerIp: `10.0.${seq}.1`,
        },
      );
    }

    it("is always prepaid, never discounted by a member's tier, never in that member's list", async () => {
      const m = member();
      loyalty.tier = "oro";
      const res = await bookGuest(m.email, "+905551112233");
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const r = await row(res.reservation.id);
      expect(r).toMatchObject({
        guest: true,
        paymentStatus: "pending",
        discountMinor: 0,
        totalMinor: 100_000,
      });
      expect(pos.sessions[0]).toMatchObject({
        email: m.email,
        cardUserKey: undefined,
      });
      expect(await karaoke.listMine(m.email)).toHaveLength(0);
      // The member cannot cancel it through their account either.
      expect(
        await pay.cancelKaraokeReservation(res.reservation.id, {
          kind: "member",
          email: m.email,
          emailVerified: true,
        }),
      ).toEqual({ ok: false, reason: "not_found" });
    });

    it("is refused while prepayment is off", async () => {
      settings.value.karaokePrepay = false;
      expect(
        await bookGuest("misafir@example.com", "+905551112233"),
      ).toMatchObject({ ok: false, status: 400 });
    });

    it("is capped per phone number, whatever address is typed", async () => {
      const phone = "+905559998877";
      expect(
        (await bookGuest(`a${Date.now()}@example.com`, phone, 14)).ok,
      ).toBe(true);
      expect(
        (await bookGuest(`b${Date.now()}@example.com`, phone, 16)).ok,
      ).toBe(true);
      expect(
        await bookGuest(`c${Date.now()}@example.com`, phone, 18),
      ).toMatchObject({
        ok: false,
        error: "too_many_reservations",
      });
    });

    it("the trigger holds the phone cap even when the JS check is skipped", async () => {
      const phone = "+905557776655";
      const insert = (id: string, hour: number) =>
        pool!.query(
          `insert into public.karaoke_reservations (id, "customerEmail", "customerName", date, "startHour", hours, guests, status, "priceMinor", "discountMinor", "totalMinor", note, "createdAt", "updatedAt", "contactPhone", guest, "paymentStatus")
           values ($1, $2, 'G', $3, $4, 1, 2, 'requested', 1, 0, 1, '', now()::text, now()::text, $5, true, 'pending')`,
          [id, `${id}@example.com`, dayAhead(4), hour, phone],
        );
      await insert("krk-90001", 12);
      await insert("krk-90002", 13);
      await expect(insert("krk-90003", 14)).rejects.toThrow(
        /TOO_MANY_OPEN_RESERVATIONS/,
      );
    });

    it("reaches the booking only through its signed link, and cancels it there", async () => {
      const email = `misafir${Date.now()}@example.com`;
      const res = await bookGuest(email, "+905551234567");
      if (!res.ok) throw new Error("refused");
      const r = (await karaoke.getReservation(res.reservation.id))!;
      const token = link.signKaraokeLink(r);
      expect(link.verifyKaraokeLink(token, r)).toBe(true);
      // A token for another booking, a changed address, an expiry stretched,
      // a signature edited: none open it.
      const other = { ...r, id: "krk-99999" };
      expect(link.verifyKaraokeLink(link.signKaraokeLink(other), r)).toBe(
        false,
      );
      expect(
        link.verifyKaraokeLink(token, {
          ...r,
          contactEmail: "baska@example.com",
        }),
      ).toBe(false);
      const [id, exp, sig] = token.split(".");
      expect(
        link.verifyKaraokeLink(`${id}.${Number(exp) + 3600}.${sig}`, r),
      ).toBe(false);
      // The first character (the last one's low bits are base64 padding, so
      // editing it may decode to the same bytes).
      const flipped = `${sig![0] === "A" ? "B" : "A"}${sig!.slice(1)}`;
      expect(link.verifyKaraokeLink(`${id}.${exp}.${flipped}`, r)).toBe(false);
      // Expired after the block ends.
      expect(
        link.verifyKaraokeLink(token, r, new Date(Number(exp) * 1000 + 1000)),
      ).toBe(false);

      expect(
        await pay.cancelKaraokeReservation(r.id, {
          kind: "link",
          token: `${id}.${exp}.${"A".repeat(43)}`,
        }),
      ).toEqual({ ok: false, reason: "not_found" });
      expect(
        await pay.cancelKaraokeReservation(r.id, { kind: "link", token }),
      ).toMatchObject({ ok: true });
    });
  });

  describe("account closure", () => {
    it("refunds a paid future booking and cancels it", async () => {
      const c = member();
      const res = await bookMember(c);
      await pay.applyKaraokePaymentSucceeded({
        reservationId: res.reservation.id,
        provider: "fakepos",
        providerRef: res.reservation.id,
        amountMinor: 200_000,
        currency: "TRY",
      });
      await pay.cancelKaraokeForClosedAccount(c.email);
      expect(await row(res.reservation.id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
      });
      expect(pos.refunds).toHaveLength(1);
    });

    it("still releases the hour when the POS does not answer the refund, and flags it", async () => {
      const c = member();
      const res = await bookMember(c);
      await pay.applyKaraokePaymentSucceeded({
        reservationId: res.reservation.id,
        provider: "fakepos",
        providerRef: res.reservation.id,
        amountMinor: 200_000,
        currency: "TRY",
      });
      pos.refund = "timeout";
      await pay.cancelKaraokeForClosedAccount(c.email);
      expect(await row(res.reservation.id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunding",
      });
      expect(mail.alerts.length).toBeGreaterThan(0);
    });
  });

  describe("review fixes (security pass, 16 Eki 2026)", () => {
    const pay1 = async (id: string, ref = id) =>
      pay.applyKaraokePaymentSucceeded({
        reservationId: id,
        provider: "fakepos",
        providerRef: ref,
        amountMinor: 200_000,
        currency: "TRY",
      });

    it("closing an account does not refund a paid booking inside the last two hours", async () => {
      const c = member();
      const res = await bookMember(c);
      await pay1(res.reservation.id);
      const r = (await karaoke.getReservation(res.reservation.id))!;
      const start = karaoke.karaokeStartInstant(r.date, r.startHour).getTime();
      await pay.cancelKaraokeForClosedAccount(
        c.email,
        new Date(start - 3600_000),
      );
      expect(pos.refunds).toHaveLength(0);
      expect(await row(r.id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "paid",
      });
      expect(mail.alerts.at(-1)).toMatchObject({ key: "account-late" });
    });

    it("closing an account never touches a guest booking made with its address", async () => {
      const c = member();
      const g = await pay.bookKaraoke(
        null,
        { date: dayAhead(5), startHour: 20, hours: 1, guests: 2 },
        {
          channel: "web",
          prepay: true,
          contact: {
            name: "Ada Lovelace",
            email: c.email,
            phone: "+905550001122",
            consentAt: new Date().toISOString(),
          },
          legalConsent: CONSENT,
          buyerIp: "10.7.7.7",
        },
      );
      if (!g.ok) throw new Error(g.message);
      await pay.applyKaraokePaymentSucceeded({
        reservationId: g.reservation.id,
        provider: "fakepos",
        providerRef: g.reservation.id,
        amountMinor: 100_000, // one hour
        currency: "TRY",
      });
      await pay.cancelKaraokeForClosedAccount(c.email);
      expect(await row(g.reservation.id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "paid",
        guest: true,
      });
      expect(pos.refunds).toHaveLength(0);
    });

    it("guest holds under a member's address use neither the member's cap nor budget", async () => {
      const c = member();
      for (const [hour, phone] of [
        [14, "+905550000001"],
        [16, "+905550000002"],
      ] as const) {
        const g = await pay.bookKaraoke(
          null,
          { date: dayAhead(6), startHour: hour, hours: 1, guests: 2 },
          {
            channel: "web",
            prepay: true,
            contact: {
              name: "Ada Lovelace",
              email: c.email,
              phone,
              consentAt: new Date().toISOString(),
            },
            legalConsent: CONSENT,
            buyerIp: `10.8.${hour}.1`,
          },
        );
        expect(g.ok).toBe(true);
      }
      // The member still books their own two.
      await bookMember(c, { date: dayAhead(7), startHour: 18 });
      await bookMember(c, { date: dayAhead(7), startHour: 21 });
    });

    it("caps unpaid guest holds across the whole room", async () => {
      for (let i = 0; i < karaoke.KARAOKE_GUEST_PENDING_CAP; i += 1) {
        const g = await pay.bookKaraoke(
          null,
          { date: dayAhead(8), startHour: 12 + i, hours: 1, guests: 2 },
          {
            channel: "web",
            prepay: true,
            contact: {
              name: "Ada Lovelace",
              email: `g${i}-${Date.now()}@example.com`,
              phone: `+90555123000${i}`,
              consentAt: new Date().toISOString(),
            },
            legalConsent: CONSENT,
            buyerIp: `10.9.${i}.1`,
          },
        );
        expect(g.ok).toBe(true);
      }
      const over = await pay.bookKaraoke(
        null,
        { date: dayAhead(8), startHour: 20, hours: 1, guests: 2 },
        {
          channel: "web",
          prepay: true,
          contact: {
            name: "Ada Lovelace",
            email: `over-${Date.now()}@example.com`,
            phone: "+905551239999",
            consentAt: new Date().toISOString(),
          },
          legalConsent: CONSENT,
          buyerIp: "10.9.99.1",
        },
      );
      expect(over).toMatchObject({ ok: false, error: "too_many_reservations" });
      // A member is not held back by it.
      await bookMember(member(), { date: dayAhead(8), startHour: 22 });
    });

    it("a retried refund the POS refuses after an unanswered first one stays 'refunding'", async () => {
      const c = member();
      const res = await bookMember(c);
      await pay1(res.reservation.id);
      pos.refund = "timeout";
      await pay.cancelKaraokeReservation(res.reservation.id, {
        kind: "member",
        email: c.email,
        emailVerified: true,
      });
      expect((await row(res.reservation.id)).paymentStatus).toBe("refunding");
      pos.refund = "refused"; // e.g. "already refunded"
      const retry = await pay.retryKaraokeRefund(
        res.reservation.id,
        "owner@kosk",
      );
      expect(retry).toMatchObject({ ok: false, reason: "unknown" });
      expect((await row(res.reservation.id)).paymentStatus).toBe("refunding");
      // And the person who sees it at PayNkolay can settle it.
      expect(
        await pay.settleKaraokeRefundByHand(res.reservation.id, "owner@kosk"),
      ).toMatchObject({ ok: true });
      expect(await row(res.reservation.id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
      });
    });

    it("a hold released after a day of no answer is put in front of a person", async () => {
      const res = await bookMember(member());
      pos.lookup.set(res.reservation.id, "down");
      await pay.expireUnpaidReservations(new Date(Date.now() + 25 * 3600_000));
      expect(mail.alerts.at(-1)).toMatchObject({ key: "hold-unknown" });
    });
  });

  describe("reopening a payment page", () => {
    it("is the owner's only, counted, and refused once the hold may no longer be paid", async () => {
      const c = member();
      const res = await bookMember(c);
      const owner = { kind: "member" as const, customer: c };
      expect(
        await pay.reopenKaraokePayment(
          { kind: "member", customer: member() },
          res.reservation.id,
        ),
      ).toEqual({
        ok: false,
        reason: "not_found",
      });
      const again = await pay.reopenKaraokePayment(owner, res.reservation.id);
      expect(again.ok).toBe(true);
      const late = await pay.reopenKaraokePayment(owner, res.reservation.id, {
        now: new Date(Date.now() + 31 * 60_000),
      });
      expect(late).toMatchObject({ ok: false, reason: "not_payable" });
    });
  });

  describe("the panel settles what did not settle itself (17 Eki 2026)", () => {
    const paid = (id: string) =>
      pay.applyKaraokePaymentSucceeded({
        reservationId: id,
        provider: "fakepos",
        providerRef: id,
        amountMinor: 200_000,
        currency: "TRY",
      });

    /**
     * A cancelled booking that still holds its money: a late payment for a
     * lapsed hold whose automatic refund the POS declined.
     */
    async function heldAfterCancel(): Promise<string> {
      const res = await bookMember(member());
      const id = res.reservation.id;
      await pool!.query(
        `update public.karaoke_reservations set status = 'cancelled', "paymentStatus" = 'expired' where id = $1`,
        [id],
      );
      pos.refund = "refused";
      expect(await paid(id)).toMatchObject({ outcome: "refund_refused" });
      pos.refund = "ok";
      expect(await row(id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "paid",
      });
      return id;
    }

    function auditPayloads(): Array<Record<string, unknown>> {
      return vi
        .mocked(audit.logAudit)
        .mock.calls.map(
          (c) => (c[0] as { payload?: Record<string, unknown> }).payload ?? {},
        );
    }

    it("records a refund made at PayNkolay for a cancelled booking still marked paid", async () => {
      const id = await heldAfterCancel();
      mail.cancellations.length = 0;
      const out = await pay.settleKaraokeRefundByHand(
        id,
        "owner@kosk",
        undefined,
        {
          reason: "PayNkolay panelinden iade edildi",
        },
      );
      expect(out).toMatchObject({ ok: true, refunded: true, notified: true });
      const r = await row(id);
      expect(r).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
      });
      expect(r.refundedAt).toBeTruthy();
      // Nothing was sent to the POS; the claim row records the refund.
      expect(pos.refunds).toEqual([]);
      const claim = await pool!.query(
        `select status from public.payment_transactions where "orderId" = $1 and "providerRef" = $2`,
        [id, `${id}:refund`],
      );
      expect(claim.rows).toEqual([{ status: "refunded" }]);
      expect(mail.cancellations.at(-1)).toMatchObject({
        refundedMinor: 200_000,
      });
      expect(auditPayloads()).toContainEqual(
        expect.objectContaining({
          event: "refund_settled_by_hand",
          from: "paid",
          reason: "PayNkolay panelinden iade edildi",
        }),
      );
      // Once recorded, there is nothing left to record.
      expect(await pay.settleKaraokeRefundByHand(id, "owner@kosk")).toEqual({
        ok: false,
        reason: "not_refundable",
      });
    });

    it("'İadeyi başlat' refunds it through the POS and says whether the mail left", async () => {
      const id = await heldAfterCancel();
      mailDown.cancellation = true;
      const out = await pay.retryKaraokeRefund(id, "owner@kosk", undefined, {
        reason: "Geç gelen ödeme",
      });
      expect(out).toMatchObject({ ok: true, refunded: true, notified: false });
      expect(pos.refunds).toEqual([{ ref: id, amountMinor: 200_000 }]);
      expect(await row(id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "refunded",
      });
      expect(auditPayloads()).toContainEqual(
        expect.objectContaining({
          event: "refund_retry",
          outcome: "refunded",
          reason: "Geç gelen ödeme",
        }),
      );
    });

    it("a settle that loses to a colleague's refund writes nothing", async () => {
      const id = await heldAfterCancel();
      let entered: () => void = () => {};
      const inPos = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let release: () => void = () => {};
      pos.hold = {
        entered: () => entered(),
        release: new Promise<void>((resolve) => {
          release = resolve;
        }),
      };
      const bg: { retry?: ReturnType<typeof pay.retryKaraokeRefund> } = {};
      // The settle has read the row (cancelled, still paid). Before its first
      // write, a colleague's "İadeyi başlat" takes the row to the POS.
      dbHook.beforeWrite = async () => {
        bg.retry = pay.retryKaraokeRefund(id, "manager@kosk", undefined, {
          reason: "Geç gelen ödeme",
        });
        await inPos;
      };
      const settled = await pay.settleKaraokeRefundByHand(
        id,
        "owner@kosk",
        undefined,
        { reason: "PayNkolay panelinde gördüm" },
      );
      expect(settled).toEqual({ ok: false, reason: "raced" });

      // The POS declines the colleague's refund: no money moved.
      pos.refund = "refused";
      release();
      expect(await bg.retry).toMatchObject({ ok: false, reason: "refused" });
      expect(await row(id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "paid",
      });
      // The settle that lost left no "refunded" claim behind, so the next
      // refund really goes to the POS instead of being taken as done.
      pos.refund = "ok";
      const again = await pay.retryKaraokeRefund(
        id,
        "manager@kosk",
        undefined,
        {
          reason: "Yeniden",
        },
      );
      expect(again).toMatchObject({ ok: true, refunded: true });
      expect(pos.refunds).toEqual([{ ref: id, amountMinor: 200_000 }]);
    });

    it("an unanswered refund settled by hand reports its mail too", async () => {
      const c = member();
      const res = await bookMember(c);
      await paid(res.reservation.id);
      pos.refund = "timeout";
      await pay.cancelKaraokeReservation(res.reservation.id, {
        kind: "staff",
        actor: "owner@kosk",
        canRefund: true,
        reason: "Oda arızalı",
      });
      expect((await row(res.reservation.id)).paymentStatus).toBe("refunding");
      mailDown.cancellation = true;
      const out = await pay.settleKaraokeRefundByHand(
        res.reservation.id,
        "owner@kosk",
      );
      expect(out).toMatchObject({ ok: true, notified: false });
      expect(auditPayloads()).toContainEqual(
        expect.objectContaining({ by: "staff", reason: "Oda arızalı" }),
      );
    });

    it("a hold the köşk lets go leaves the audit row the panel keeps it by", async () => {
      const res = await bookMember(member());
      pos.lookup.set(res.reservation.id, "unpaid");
      const out = await pay.cancelKaraokeReservation(res.reservation.id, {
        kind: "staff",
        actor: "staff@kosk",
        canRefund: false,
        reason: "Müşteri vazgeçti",
      });
      expect(out).toMatchObject({ ok: true, refunded: false });
      expect(await row(res.reservation.id)).toMatchObject({
        status: "cancelled",
        paymentStatus: "expired",
      });
      const calls = vi.mocked(audit.logAudit).mock.calls.map((c) => c[0]);
      const released = calls.filter(
        (c) => c.entityId === res.reservation.id && c.action === "transition",
      );
      expect(released).toHaveLength(1);
      expect(
        staffReleasedIds(
          released.map((c) => ({
            entityId: c.entityId,
            action: c.action,
            payload: c.payload ?? {},
          })),
        ).has(res.reservation.id),
      ).toBe(true);
      expect(released[0]!.payload).toMatchObject({
        reason: "Müşteri vazgeçti",
      });
    });

    it("the panel reads one booking's history and the köşk's releases from the log", async () => {
      const { listKaraokeAudit, listStaffReleasedHolds } =
        await import("@/lib/admin/karaoke-audit");
      const tag = `t${Date.now()}`;
      const ids = [`krk-9${tag.slice(-6)}1`, `krk-9${tag.slice(-6)}2`];
      const rows = [
        [
          `aud-${tag}-1`,
          "transition",
          ids[0],
          { status: "cancelled", paymentStatus: "expired", by: "staff" },
          "2026-10-17T10:00:00.000Z",
        ],
        [
          `aud-${tag}-2`,
          "transition",
          ids[1],
          { status: "cancelled", paymentStatus: "expired", by: "member" },
          "2026-10-17T10:01:00.000Z",
        ],
        [
          `aud-${tag}-3`,
          "update",
          ids[0],
          { event: "cancel_refund_unknown" },
          "2026-10-17T10:02:00.000Z",
        ],
      ] as const;
      for (const [id, action, entityId, payload, at] of rows) {
        await pool!.query(
          `insert into public.audit_logs (id, actor, action, entity, "entityId", payload, "createdAt") values ($1, 'staff@kosk', $2, 'karaoke_reservation', $3, $4, $5)`,
          [id, action, entityId, JSON.stringify(payload), at],
        );
      }
      try {
        expect([...(await listStaffReleasedHolds(ids))]).toEqual([ids[0]]);
        expect(await listStaffReleasedHolds([])).toEqual(new Set());
        const history = await listKaraokeAudit(ids[0]!);
        expect(history.map((r) => r.id)).toEqual([
          `aud-${tag}-3`,
          `aud-${tag}-1`,
        ]);
        expect(history[1]).toMatchObject({
          entityId: ids[0],
          actor: "staff@kosk",
          payload: { by: "staff" },
        });
      } finally {
        await pool!.query(`delete from public.audit_logs where id like $1`, [
          `aud-${tag}-%`,
        ]);
      }
    });

    it("the list reads a date range, newest day first, without the buyer's IP", async () => {
      const a = await bookMember(member(), { date: dayAhead(3) });
      const b = await bookMember(member(), { date: dayAhead(4) });
      const c = await bookMember(member(), { date: dayAhead(5) });
      const all = await karaoke.listReservationsForAdmin();
      expect(all.map((r) => r.id)).toEqual([
        c.reservation.id,
        b.reservation.id,
        a.reservation.id,
      ]);
      expect(all[0]!.legalConsent).toBeUndefined();
      const one = await karaoke.listReservationsForAdmin({
        from: dayAhead(4),
        to: dayAhead(4),
      });
      expect(one.map((r) => r.id)).toEqual([b.reservation.id]);
      expect(
        (await karaoke.listReservationsForDate(dayAhead(5))).map((r) => r.id),
      ).toEqual([c.reservation.id]);
    });

    it("the dashboard finds every refund still owed, whatever the day", async () => {
      const held = await heldAfterCancel();
      const res = await bookMember(member(), { date: dayAhead(6) });
      await paid(res.reservation.id);
      pos.refund = "timeout";
      await pay.cancelKaraokeReservation(res.reservation.id, {
        kind: "staff",
        actor: "owner@kosk",
        canRefund: true,
      });
      const owed = await karaoke.listKaraokeRefundsOwed();
      expect(owed.map((r) => r.id).sort()).toEqual(
        [held, res.reservation.id].sort(),
      );
    });

    it("the sweep's release leaves no such row", async () => {
      const res = await bookMember(member());
      expect(
        await pay.expireUnpaidReservations(new Date(Date.now() + 2 * 3600_000)),
      ).toBe(1);
      const calls = vi
        .mocked(audit.logAudit)
        .mock.calls.map((c) => c[0])
        .filter((c) => c.entityId === res.reservation.id);
      expect(
        staffReleasedIds(
          calls.map((c) => ({
            entityId: c.entityId,
            action: c.action,
            payload: c.payload ?? {},
          })),
        ).size,
      ).toBe(0);
    });
  });
});
