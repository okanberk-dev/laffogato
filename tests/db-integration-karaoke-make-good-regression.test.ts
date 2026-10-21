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
 * The regression review of the karaoke make-good (PR #191, 21 Ekim 2026),
 * against a real Postgres (the real SQL functions, the real mail renderer;
 * only the POS and Resend's HTTP call are scripted).
 *
 * R3: a PAID booking still `requested` is bound by the late rule like a
 *     confirmed one (the guest's own late cancel is `too_late`), so the
 *     köşk's late cancel makes it good too (Haksız Şartlar Yön. EK-1 (ç);
 *     orchestrator decision A, 21 Ekim 2026).
 * R4: the free hour cancelled before it starts opens the make-good again,
 *     and its cancellation mail names the amount and the last day, as the
 *     free hour's confirmation promised.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  const r = await pool!.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

const h = vi.hoisted(() => ({
  sent: [] as Array<{ subject: string; html: string; text: string }>,
  refunds: [] as Array<{ ref: string; amountMinor: number }>,
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/store", async () => {
  const { DEFAULT_MOBILE_APP_CONFIG } = await import("@/lib/mobile/app-config");
  return {
    getSettings: async () => ({
      karaokePrepay: true,
      karaokeHourlyMinor: 100_000,
      karaokeCapacity: 8,
      karaokeNotifyEmail: "",
      email: "kosk@example.com",
      emailFrom: "",
      emailReplyTo: "",
      taxRates: { karaoke: 20 },
      karaokeFreeCancelHours: 2,
      karaokeLateRefundPercent: 0,
      mobileApp: DEFAULT_MOBILE_APP_CONFIG,
    }),
  };
});
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/mobile/loyalty", () => ({ getLoyalty: async () => null }));
vi.mock("@/lib/customer/store", () => ({
  ensureCardUserKey: async () => "",
  rememberCardUserKey: async () => {},
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    refund: async (ref: string, amountMinor: number) => {
      h.refunds.push({ ref, amountMinor });
      return { providerRef: ref, status: "succeeded" };
    },
  }),
}));

process.env.KARAOKE_LINK_SECRET = "k".repeat(40);
process.env.RESEND_API_KEY = "re_test";

const pay = await import("@/lib/mobile/karaoke-payment");
const core = await import("@/lib/mobile/karaoke-make-good-core");
const time = await import("@/lib/mobile/karaoke-time");

// 30 Ekim 2026, 20:00 in Tuzla.
const START = Date.parse("2026-10-30T17:00:00.000Z");
const HOUR = 3_600_000;
const at = (hoursBefore: number) => new Date(START - hoursBefore * HOUR);
const MEMBER = {
  kind: "member" as const,
  email: "eda@example.com",
  emailVerified: true,
};
const ariza = {
  kind: "staff" as const,
  actor: "yonetici@kosk",
  canRefund: true,
  reason: "Oda arızalı",
  cause: "ariza" as const,
};

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

/** A paid booking for 30 Ekim 20:00-22:00 under 2 h / 0 %, with its payment. */
async function paidBooking(id: string, status: string): Promise<void> {
  await insert({
    id,
    customerEmail: "eda@example.com",
    customerName: "Eda",
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    status,
    priceMinor: 200_000,
    totalMinor: 200_000,
    paymentStatus: "paid",
    paidMinor: 200_000,
    paidAt: "2026-10-20T09:05:00.000Z",
    paymentRef: `PNK-${id}`,
    channel: "web",
    freeCancelHours: 2,
    lateRefundPercent: 0,
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:05:00.000Z",
  });
  await pool!.query(
    `insert into public.payment_transactions
       ("orderId", provider, "providerRef", status, "amountMinor", currency, "trxDate", "createdAt")
     values ($1, 'fakepos', $2, 'succeeded', 200000, 'TRY', '2026-10-20', '2026-10-20T09:05:00.000Z')`,
    [id, `PNK-${id}`],
  );
}

/** The text and the HTML of a mail, tags and line breaks folded. */
function both(m: { html: string; text: string }): string[] {
  return [
    m.html
      .replace(/<[^>]+>/g, "")
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " "),
    m.text.replace(/\s+/g, " "),
  ];
}

maybe("karaoke make-good: the regression review (real Postgres)", () => {
  let release: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
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
    h.sent.length = 0;
    h.refunds.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        h.sent.push({
          subject: body.subject,
          html: body.html,
          text: body.text,
        });
        return new Response(JSON.stringify({ id: "1" }), { status: 200 });
      }),
    );
  });

  describe("R3: a paid booking the köşk never confirmed (status requested)", () => {
    const base = {
      date: "2026-10-30",
      startHour: 20,
      hours: 2,
      paymentStatus: "paid",
      paidMinor: 200_000,
      totalMinor: 200_000,
      freeCancelHours: 2,
      lateRefundPercent: 0,
      createdAt: "2026-10-20T09:00:00.000Z",
    };

    it("pure: the guest's own late cancel is refused for both statuses, and the make-good exists for both", () => {
      const confirmed = { ...base, status: "confirmed" };
      const requested = { ...base, status: "requested" };
      // The guest's side: karaokeSelfCancelTerms ignores the status.
      expect(time.karaokeSelfCancelTerms(confirmed, at(1))).toEqual({
        kind: "refused",
      });
      expect(time.karaokeSelfCancelTerms(requested, at(1))).toEqual({
        kind: "refused",
      });
      // The köşk's side.
      expect(core.karaokeMakeGoodFor(confirmed, "ariza", at(1))).toEqual({
        until: "2027-04-30",
        minor: 200_000,
      });
      const missing = core.karaokeMakeGoodFor(requested, "ariza", at(1));
      // The claim: whoever is bound by the late rule (refused) gets the
      // make-good when the köşk lets go as late.
      expect(
        missing,
        "requested + paid, 2 h / 0 %, 1 h before the start: no make-good",
      ).not.toBeNull();
    });

    it.each(["confirmed", "requested"])(
      "end to end (%s): member late cancel vs. köşk 'ariza' cancel",
      async (status) => {
        const id = status === "confirmed" ? "krk-91001" : "krk-91002";
        await paidBooking(id, status);
        // The guest, one hour before the start: refused for both.
        const own = await pay.cancelKaraokeReservation(id, MEMBER, {
          now: at(1),
        });
        expect(own).toMatchObject({ ok: false, reason: "too_late" });
        expect((await row(id)).status).toBe(status);
        // The köşk, the same minute, for a broken room.
        const res = await pay.cancelKaraokeReservation(id, ariza, {
          now: at(1),
        });
        expect(res).toMatchObject({ ok: true, refunded: true });
        expect(h.refunds).toEqual([{ ref: `PNK-${id}`, amountMinor: 200_000 }]);
        expect(
          res.ok ? res.makeGood : undefined,
          `${status}: the guest was bound by the late rule but got no make-good`,
        ).toMatchObject({ minor: 200_000 });
      },
    );
  });

  describe("R4: the free hour cancelled before it starts", () => {
    it("re-opens the make-good, and the cancellation mail says how much and until when", async () => {
      // A booking the köşk cancelled late for a broken room (make-good open).
      await paidBooking("krk-91010", "confirmed");
      const cancelled = await pay.cancelKaraokeReservation("krk-91010", ariza, {
        now: at(1),
      });
      expect(cancelled).toMatchObject({
        ok: true,
        makeGood: { minor: 200_000, until: "2027-04-30" },
      });
      h.sent.length = 0;

      // "Telafi saati ver": a free hour on 6 Kasım 21:00.
      const given = await pay.giveKaraokeMakeGoodHour(
        "krk-91010",
        { date: "2026-11-06", startHour: 21 },
        "yonetici@kosk",
        at(0),
      );
      expect(given.ok).toBe(true);
      if (!given.ok) return;
      expect(h.sent.map((m) => m.subject)).toEqual([
        "L'Affogato - Karaoke rezervasyonun onaylandı",
      ]);
      // The confirmation's promise.
      expect(both(h.sent[0]!)[1]).toContain("telafin o zaman geri gelir");
      h.sent.length = 0;

      // The guest cancels the free hour from its page, well before it starts.
      const res = await pay.cancelKaraokeReservation(
        given.reservation.id,
        MEMBER,
        { now: at(0) },
      );
      expect(res).toMatchObject({ ok: true, refunded: false });
      // The real SQL function re-opened the make-good.
      const original = await row("krk-91010");
      expect(original.makeGoodUsedAt).toBeNull();
      expect(core.makeGoodStateOf(original as never)).toBe("open");

      // The mail the guest gets for that cancel.
      expect(h.sent).toHaveLength(1);
      const [html, text] = both(h.sent[0]!);
      for (const [name, part] of [
        ["html", html],
        ["text", text],
      ] as const) {
        expect
          .soft(part, `${name}: the reopened amount`)
          .toContain("₺2.000,00");
        expect
          .soft(part, `${name}: the last day`)
          .toContain("30 Nisan 2027 tarihine kadar");
      }
    });
  });
});
