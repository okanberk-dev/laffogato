import pg from "pg";
import {
  afterAll,
  afterEach,
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
 * The free hour the köşk gives as a make-good, and who may let it go (PR
 * #191, access review, 21 Ekim 2026), against a real Postgres: the
 * production modules; only the POS, the mail transport, the audit log, the
 * admin session and Next's cache are scripted. Skipped without
 * TEST_DATABASE_URL.
 *
 * - A2: Personel (role `staff`: panel `karaoke` WITHOUT `refunds`) cannot
 *   cancel the free hour inside the window where its guest's own cancel is
 *   refused (2 h / 0 %, the only policy live today): that would open a used
 *   make-good a manager could then pay out. The server refuses it
 *   (`free_hour_forbidden`, its own message) and the panel draws the plain
 *   İptal disabled with the refund right's reason. Before the guest's own
 *   deadline, or for someone with the refund right, it goes through.
 * - A4: an account closure is held to the free hour's own rule as the
 *   member would be; inside that window the hour stands, the make-good stays
 *   used, and the köşk is told in the free hour's own words.
 * - A3 (judged not a defect): under a late share of 1..99 % the guest's
 *   late cancel of the free hour is accepted and opens the make-good again,
 *   which the free hour's confirmation promises ("telafin o zaman geri
 *   gelir"). The policy lock (KARAOKE_POLICY_APP_VERSION, null) is lifted
 *   ONLY inside `openPolicy()` below.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
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
const audits = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
}));
const session = vi.hoisted(() => ({ role: "staff" as string }));
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

// The lock is only ever lifted by `openPolicy()` (minSupportedAppVersion
// "1.1.0", above the default "1.0.0"); with the default config this wrapper
// answers exactly like the real function with KARAOKE_POLICY_APP_VERSION =
// null (the lock holds).
vi.mock("@/lib/mobile/karaoke-time", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/lib/mobile/karaoke-time")>();
  return {
    ...real,
    effectiveKaraokeCancelPolicy: (
      s: Parameters<typeof real.effectiveKaraokeCancelPolicy>[0],
    ) => real.effectiveKaraokeCancelPolicy(s, "1.1.0"),
  };
});
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
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(async (row: Record<string, unknown>) => {
    audits.rows.push(row);
  }),
}));
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
// The Server Action's own gate: the session is whatever `session.role` says.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "signed-token" }) }),
}));
vi.mock("@/lib/admin/change-marker", () => ({
  readChangeMarker: vi.fn(async () => null),
}));
vi.mock("@/lib/admin/auth", () => {
  const me = () => ({
    email: "personel@kosk",
    role: session.role,
    expiresAt: 0,
  });
  return {
    ADMIN_COOKIE_NAME: "laffogato_panel_session",
    readSessionFromCookieValue: me,
    requireRole: vi.fn(async () => me()),
    getAdminSession: vi.fn(async () => me()),
  };
});

process.env.KARAOKE_LINK_SECRET = "k".repeat(40);

const pay = await import("@/lib/mobile/karaoke-payment");
const { istanbulClock } = await import("@/lib/mobile/venue");
const { karaokeStartInstant, karaokeSelfCancelTerms } =
  await import("@/lib/mobile/karaoke-time");
const { makeGoodStateOf } = await import("@/lib/mobile/karaoke-make-good-core");
const { getReservation } = await import("@/lib/mobile/karaoke");
const { karaokeActionPlan, REFUND_PERMISSION_REASON } =
  await import("@/lib/admin/karaoke-panel");
const actions = await import("@/app/admin/mobil/karaoke/actions");
const { DEFAULT_MOBILE_APP_CONFIG } = await import("@/lib/mobile/app-config");

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

const MEMBER = {
  kind: "member" as const,
  email: "eda@example.com",
  emailVerified: true,
};
const PERSONEL = {
  kind: "staff" as const,
  actor: "personel@kosk",
  canRefund: false,
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** The panel's late share is open: 2 h / `percent` %, app minimum 1.1.0. */
function openPolicy(percent: number): void {
  settings.value.karaokeFreeCancelHours = 2;
  settings.value.karaokeLateRefundPercent = percent;
  settings.value.mobileApp = {
    ...DEFAULT_MOBILE_APP_CONFIG,
    minSupportedAppVersion: "1.1.0",
  };
}

maybe("karaoke make-good: who may let the free hour go (real Postgres)", () => {
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
      `delete from public.auth_attempts where key like 'karaoke-%'`,
    );
    for (const list of Object.values(mail)) list.length = 0;
    audits.rows.length = 0;
    session.role = "staff";
    settings.value.karaokeFreeCancelHours = 2;
    settings.value.karaokeLateRefundPercent = 0;
    settings.value.mobileApp = DEFAULT_MOBILE_APP_CONFIG;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /**
   * The production path: a make-good open on a booking the köşk cancelled
   * late, the free hour given through `giveKaraokeMakeGoodHour` (so its
   * snapshot is what production writes), and the instant `minutes` before
   * that hour starts. `percent` > 0 lifts the policy lock first (A3 only).
   */
  async function freeHour(minutes: number, percent = 0) {
    await insert(madeGood());
    if (percent > 0) openPolicy(percent);
    const given = await pay.giveKaraokeMakeGoodHour(
      "krk-90010",
      { date: dayAhead(5), startHour: 20 },
      "yonetici@kosk",
    );
    if (!given.ok) throw new Error(`could not give the hour: ${given.reason}`);
    const hour = given.reservation;
    const start = karaokeStartInstant(hour.date, hour.startHour);
    return { hour, start, now: new Date(start.getTime() - minutes * 60_000) };
  }

  describe("A2: Personel (no refund right) and a used make-good", () => {
    it("setup check: the free hour is confirmed, unpaid, snapshotted 2 h / 0 %, and the make-good is used", async () => {
      const { hour } = await freeHour(10);
      expect(await row(hour.id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "none",
        makeGoodFor: "krk-90010",
        freeCancelHours: 2,
        lateRefundPercent: 0,
      });
      const original = await row("krk-90010");
      expect(original.makeGoodUsedAt).not.toBeNull();
      expect(makeGoodStateOf(original as never)).toBe("hour");
    });

    it("characterisation (control): 10 minutes before the start the guest's OWN cancel of the free hour is too_late", async () => {
      const { hour, now } = await freeHour(10);
      const stored = (await getReservation(hour.id))!;
      expect(karaokeSelfCancelTerms(stored, now)).toEqual({ kind: "refused" });
      const res = await pay.cancelKaraokeReservation(hour.id, MEMBER, { now });
      expect(res).toMatchObject({ ok: false, reason: "too_late" });
      expect((await row(hour.id)).status).toBe("confirmed");
      expect((await row("krk-90010")).makeGoodUsedAt).not.toBeNull();
    });

    it("the panel draws Personel's plain İptal on that free hour disabled, with the refund right's reason", async () => {
      const { hour, now } = await freeHour(10);
      const stored = (await getReservation(hour.id))!;
      const plan = karaokeActionPlan(stored, {
        now,
        prepay: true,
        canRefund: false,
      });
      expect(plan.cancel).toEqual({
        kind: "plain",
        disabledReason: REFUND_PERMISSION_REASON,
      });
      // Someone with the refund right may let it go.
      expect(
        karaokeActionPlan(stored, { now, prepay: true, canRefund: true })
          .cancel,
      ).toEqual({ kind: "plain" });
      // And no make-good action: those two are the refund right's.
      expect(plan.makeGoodHour).toBeNull();
      expect(plan.makeGoodPaid).toBeNull();
    });

    it("INVARIANT: a staff cancel WITHOUT the refund right never opens a used make-good again", async () => {
      const { hour, now } = await freeHour(10);
      const res = await pay.cancelKaraokeReservation(hour.id, PERSONEL, {
        now,
      });
      expect(res).toMatchObject({ ok: false, reason: "free_hour_forbidden" });
      expect((await row(hour.id)).status).toBe("confirmed");
      expect((await row("krk-90010")).makeGoodUsedAt).not.toBeNull();
    });

    it("INVARIANT (through the Server Action, a Personel session): İptal et on the free hour never opens the make-good", async () => {
      const { hour, now } = await freeHour(10);
      // The action reads the clock itself: put it 10 minutes before the start.
      vi.useFakeTimers({ toFake: ["Date"], now });
      session.role = "staff";
      const answer = await actions.cancelReservationAction(
        null,
        form({ id: hour.id, beklenen: "odenmemis" }),
      );
      vi.useRealTimers();
      expect(answer.ok).toBe(false);
      expect(!answer.ok && answer.error).toMatch(/telafi saati/);
      expect(!answer.ok && answer.error).not.toMatch(/ödenmiş/);
      expect((await row(hour.id)).status).toBe("confirmed");
      expect((await row("krk-90010")).makeGoodUsedAt).not.toBeNull();
    });

    it("characterisation (control): the same cancel by Sahip/Yönetici (refund right) reopens it, the authority the spec gives", async () => {
      const { hour, now } = await freeHour(10);
      const res = await pay.cancelKaraokeReservation(
        hour.id,
        { kind: "staff", actor: "yonetici@kosk", canRefund: true },
        { now },
      );
      expect(res).toMatchObject({ ok: true, refunded: false });
      expect((await row("krk-90010")).makeGoodUsedAt).toBeNull();
    });

    it("after Personel's refused cancel the make-good stays used: no cash payout can be recorded", async () => {
      const { hour, now } = await freeHour(10);
      await pay.cancelKaraokeReservation(hour.id, PERSONEL, { now });
      const original = await row("krk-90010");
      expect(makeGoodStateOf(original as never)).toBe("hour");
      const money = await pay.recordKaraokeMakeGoodPaid(
        "krk-90010",
        { paidOn: TODAY(), amountMinor: 200_000 },
        "sahip@kosk",
        undefined,
        { reason: "Misafir parayı seçti, havale yapıldı" },
      );
      expect(money).toMatchObject({ ok: false, reason: "not_open" });
      expect((await row("krk-90010")).makeGoodPaidMinor).toBeNull();
    });

    it("the Server Action refuses the form the panel posts (beklenen=odenmemis) from Personel for the free hour, in its own words", async () => {
      const { hour, now } = await freeHour(10);
      vi.useFakeTimers({ toFake: ["Date"], now });
      session.role = "staff";
      const answer = await actions.cancelReservationAction(
        null,
        form({ id: hour.id, beklenen: "odenmemis" }),
      );
      vi.useRealTimers();
      expect(answer).toEqual({
        ok: false,
        error:
          "Bu bir telafi saati ve misafir onu artık kendisi iptal edemiyor: iptal etmek kullanılmış telafiyi yeniden açar. Bunu yalnız sahip ya da yönetici yapar.",
      });
      expect((await row(hour.id)).status).toBe("confirmed");
    });

    it("nothing is reopened, so nothing is audited as reopened under Personel's name", async () => {
      const { hour, now } = await freeHour(10);
      audits.rows.length = 0;
      await pay.cancelKaraokeReservation(hour.id, PERSONEL, { now });
      expect(
        audits.rows.filter(
          (r) =>
            (r.payload as Record<string, unknown> | undefined)?.event ===
            "make_good_reopened",
        ),
      ).toEqual([]);
    });

    it("found correct: the two make-good Server Actions refuse Personel on the server and write nothing (a manager is let through)", async () => {
      await insert(madeGood());
      session.role = "staff";
      const give = await actions.giveKaraokeMakeGoodHourAction(
        null,
        form({ id: "krk-90010", tarih: dayAhead(5), saat: "20" }),
      );
      const paid = await actions.recordKaraokeMakeGoodPaidAction(
        null,
        form({
          id: "krk-90010",
          havaleTarihi: TODAY(),
          tutar: "2.000,00",
          reason: "Havale yapıldı",
        }),
      );
      expect(give.ok).toBe(false);
      expect(paid.ok).toBe(false);
      expect(!give.ok && give.error).toMatch(/sahip ya da yönetici/);
      expect(!paid.ok && paid.error).toMatch(/sahip ya da yönetici/);
      expect((await row("krk-90010")).makeGoodUsedAt).toBeNull();
      expect(
        (
          await pool!.query(
            `select count(*)::int as n from public.karaoke_reservations where "makeGoodFor" = 'krk-90010'`,
          )
        ).rows[0].n,
      ).toBe(0);
      // Same forms, a manager's session: the refusal above was the role.
      session.role = "manager";
      const ok = await actions.giveKaraokeMakeGoodHourAction(
        null,
        form({ id: "krk-90010", tarih: dayAhead(5), saat: "20" }),
      );
      expect(ok.ok).toBe(true);
    });

    it("A4: closing the member's account 10 minutes before the free hour leaves it and its used make-good as they are, and says so in the free hour's words", async () => {
      const { hour, now } = await freeHour(10);
      expect(
        await pay.cancelKaraokeReservation(hour.id, MEMBER, { now }),
      ).toMatchObject({ ok: false, reason: "too_late" });
      await pay.cancelKaraokeForClosedAccount("eda@example.com", now);
      expect((await row(hour.id)).status).toBe("confirmed");
      expect((await row("krk-90010")).makeGoodUsedAt).not.toBeNull();
      const alert = mail.alerts.find((a) =>
        String(a.title).includes("telafi saati"),
      ) as { title: string; summary: string; rows: Array<{ value: string }> };
      expect(alert.title).toBe(
        "Kapanan hesabın ücretsiz iptal süresi geçmiş telafi saati",
      );
      expect(alert.summary).toContain("KRK-90010 için");
      expect(alert.summary).not.toMatch(/ödenmiş/);
      expect(alert.rows.map((r) => r.value)).toContain("₺2.000,00");
    });

    it("A4 (control): a closure before the free hour's own deadline lets it go and opens the make-good, as the member could", async () => {
      await insert(madeGood());
      const given = await pay.giveKaraokeMakeGoodHour(
        "krk-90010",
        { date: dayAhead(5), startHour: 20 },
        "yonetici@kosk",
      );
      expect(given.ok).toBe(true);
      if (!given.ok) return;
      await pay.cancelKaraokeForClosedAccount("eda@example.com");
      expect((await row(given.reservation.id)).status).toBe("cancelled");
      expect((await row("krk-90010")).makeGoodUsedAt).toBeNull();
    });

    it("control: Personel cancelling the free hour BEFORE the guest's own deadline is no leak (the guest could do it)", async () => {
      // 5 days ahead, the real clock: the guest's own window is open.
      await insert(madeGood());
      const given = await pay.giveKaraokeMakeGoodHour(
        "krk-90010",
        { date: dayAhead(5), startHour: 20 },
        "yonetici@kosk",
      );
      expect(given.ok).toBe(true);
      if (!given.ok) return;
      const stored = (await getReservation(given.reservation.id))!;
      expect(karaokeSelfCancelTerms(stored, new Date())).toEqual({
        kind: "full",
      });
      const res = await pay.cancelKaraokeReservation(
        given.reservation.id,
        PERSONEL,
      );
      expect(res.ok).toBe(true);
      expect((await row("krk-90010")).makeGoodUsedAt).toBeNull();
    });
  });

  describe("A3: a late share of 1..99 % and the free hour", () => {
    it("dormancy: with KARAOKE_POLICY_APP_VERSION null a 50 % panel setting still snapshots 2 h / 0 % on a free hour", async () => {
      const real = await vi.importActual<
        typeof import("@/lib/mobile/karaoke-time")
      >("@/lib/mobile/karaoke-time");
      expect(real.KARAOKE_POLICY_APP_VERSION).toBeNull();
      expect(
        real.effectiveKaraokeCancelPolicy({
          karaokeFreeCancelHours: 2,
          karaokeLateRefundPercent: 50,
          mobileApp: { minSupportedAppVersion: "99.0.0" },
        }),
      ).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
      // And through the production path with the panel saying 50 % but the
      // minimum app version below the unlocking build (openPolicy not called):
      settings.value.karaokeLateRefundPercent = 50;
      const { hour } = await freeHour(10);
      expect(await row(hour.id)).toMatchObject({
        freeCancelHours: 2,
        lateRefundPercent: 0,
      });
    });

    it("setup check: with the lock lifted the free hour is snapshotted 2 h / 50 % and the terms read 'late 50' one hour before the start", async () => {
      const { hour, now } = await freeHour(60, 50);
      expect(await row(hour.id)).toMatchObject({
        status: "confirmed",
        paymentStatus: "none",
        makeGoodFor: "krk-90010",
        freeCancelHours: 2,
        lateRefundPercent: 50,
      });
      const stored = (await getReservation(hour.id))!;
      expect(karaokeSelfCancelTerms(stored, now)).toEqual({
        kind: "late",
        percent: 50,
      });
    });

    it("characterisation: the free hour's confirmation mail promises it - 'rezervasyon saatinden önce ... telafin o zaman geri gelir'", async () => {
      await freeHour(60, 50);
      expect(mail.confirmations).toHaveLength(1);
      const k = mail.confirmations[0]! as {
        makeGoodHourFor?: string;
        cancellation?: { venueUntil: string | null };
      };
      expect(k.makeGoodHourFor).toBe("krk-90010");
      expect(k.cancellation?.venueUntil).toBe("rezervasyon saatinden önce");
      // The sentence the guest actually reads, rendered by the real mailer.
      const sent: Array<{ html: string; text: string }> = [];
      process.env.RESEND_API_KEY = "re_test";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: { body: string }) => {
          const b = JSON.parse(init.body);
          sent.push({ html: b.html, text: b.text });
          return new Response(JSON.stringify({ id: "1" }), { status: 200 });
        }),
      );
      const realSend =
        await vi.importActual<typeof import("@/lib/email/send")>(
          "@/lib/email/send",
        );
      await realSend.sendKaraokeConfirmationEmail(k as never);
      const text = sent[0]!.text.replace(/\s+/g, " ");
      expect(text).toContain(
        "Planın değişirse rezervasyon saatinden önce rezervasyon sayfandan iptal edebilirsin; telafin o zaman geri gelir.",
      );
    });

    it("A3, by design: the member's late cancel under 2 h / 50 % is accepted and opens the whole make-good, as the confirmation promised", async () => {
      const { hour, now } = await freeHour(60, 50);
      const res = await pay.cancelKaraokeReservation(hour.id, MEMBER, { now });
      expect(res).toMatchObject({ ok: true, refunded: false });
      const original = await row("krk-90010");
      expect(original.makeGoodUsedAt).toBeNull();
      expect(original.makeGoodMinor).toBe(200_000);
      expect(makeGoodStateOf(original as never)).toBe("open");
    });

    it("control (pre-existing rule, same on main): any unpaid booking under 2 h / 50 % is cancellable by the member until the start, no share kept", async () => {
      openPolicy(50);
      const date = dayAhead(5);
      await insert({
        id: "krk-90040",
        customerEmail: "eda@example.com",
        customerName: "Eda",
        date,
        startHour: 20,
        hours: 1,
        guests: 2,
        status: "confirmed",
        priceMinor: 100_000,
        totalMinor: 100_000,
        paymentStatus: "none",
        channel: "web",
        freeCancelHours: 2,
        lateRefundPercent: 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const now = new Date(
        karaokeStartInstant(date, 20).getTime() - 60 * 60_000,
      );
      const stored = (await getReservation("krk-90040"))!;
      expect(karaokeSelfCancelTerms(stored, now)).toEqual({
        kind: "late",
        percent: 50,
      });
      expect(
        await pay.cancelKaraokeReservation("krk-90040", MEMBER, { now }),
      ).toMatchObject({ ok: true, refunded: false });
      expect((await row("krk-90040")).status).toBe("cancelled");
    });

    it("controls: at 0 % the late cancel is refused; at 100 % the whole make-good coming back is right (a late cancel that refunds everything)", async () => {
      const zero = await freeHour(60);
      expect(
        await pay.cancelKaraokeReservation(zero.hour.id, MEMBER, {
          now: zero.now,
        }),
      ).toMatchObject({ ok: false, reason: "too_late" });
      expect((await row("krk-90010")).makeGoodUsedAt).not.toBeNull();

      await pool!.query(`delete from public.karaoke_reservations`);
      const full = await freeHour(60, 100);
      const stored = (await getReservation(full.hour.id))!;
      expect(karaokeSelfCancelTerms(stored, full.now)).toEqual({
        kind: "late",
        percent: 100,
      });
      expect(
        await pay.cancelKaraokeReservation(full.hour.id, MEMBER, {
          now: full.now,
        }),
      ).toMatchObject({ ok: true });
      expect((await row("krk-90010")).makeGoodUsedAt).toBeNull();
    });
  });
});
