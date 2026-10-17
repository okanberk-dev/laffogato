import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The köşk writing off a pay-at-the-venue evening that is already over
 * (admin audit KAR-13, karar D7): "İptal et" on last week's booking used to
 * mail the customer a cancellation days after the evening. Now the row is
 * cancelled and audited, and no mail leaves. A cancellation before the
 * evening still mails, and a member still cannot cancel late at all.
 *
 * The real karaoke.ts and karaoke-payment.ts over a fake table; the mail,
 * the audit log and the payment seams are mocks.
 */

const h = vi.hoisted(() => ({
  cancelMail: vi.fn(async () => true),
  confirmMail: vi.fn(async () => true),
  logAudit: vi.fn(async () => {}),
}));

let row: Record<string, unknown> | null = null;
const writes: Array<{ text: string; params: unknown[] }> = [];
const exec: Executor = async ({ text, params }) => {
  if (text.startsWith("SELECT")) {
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }
  writes.push({ text, params });
  if (text.startsWith("UPDATE") && row) {
    row = { ...row, status: "cancelled" };
    return { rows: [{ id: row.id }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/email/send", () => ({
  sendKaraokeCancellationEmail: h.cancelMail,
  sendKaraokeConfirmationEmail: h.confirmMail,
  sendKaraokeMoneyAlertEmail: vi.fn(async () => ({ ok: true })),
  sendKaraokePaidOperatorEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({ karaokePrepay: true })),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit: vi.fn(),
  reserveLoginAttempt: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: async () => "" }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/mobile/checkout-ref", () => ({
  recordPendingCheckout: vi.fn(async () => {}),
}));
vi.mock("@/lib/mobile/karaoke-notify", () => ({
  notifyOperatorOfReservation: vi.fn(),
}));
vi.mock("@/lib/mobile/karaoke-link", () => ({
  karaokeLinkUrl: () => "https://laffogato.net/rezervasyon?t=x",
  verifyKaraokeLink: vi.fn(),
}));

const { cancelKaraokeReservation } =
  await import("@/lib/mobile/karaoke-payment");
const { setReservationStatus } = await import("@/lib/mobile/karaoke");

// 15:00 in Tuzla on 17 Ekim.
const NOW = new Date("2026-10-17T12:00:00.000Z");
const STAFF = {
  kind: "staff" as const,
  actor: "kosk@laffogato",
  canRefund: false,
};

function booking(date: string, startHour = 20): Record<string, unknown> {
  return {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda",
    date,
    startHour,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    paymentStatus: "none",
    contactEmail: "",
    guest: false,
  };
}

beforeEach(() => {
  row = null;
  writes.length = 0;
  h.cancelMail.mockClear();
  h.confirmMail.mockClear();
  h.logAudit.mockClear();
});

describe("the köşk cancels a pay-at-the-venue booking", () => {
  it("an evening already over: cancelled and audited, no mail to the customer", async () => {
    row = booking("2026-10-10");
    const res = await cancelKaraokeReservation("krk-00042", STAFF, {
      now: NOW,
    });
    expect(res).toMatchObject({ ok: true, refunded: false, silent: true });
    expect(writes.some((w) => w.text.startsWith("UPDATE"))).toBe(true);
    expect(h.cancelMail).not.toHaveBeenCalled();
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "transition",
        payload: expect.objectContaining({ status: "cancelled", ended: true }),
      }),
    );
  });

  it("today's evening once it has ended counts as over too", async () => {
    row = booking("2026-10-17", 10);
    const res = await cancelKaraokeReservation("krk-00042", STAFF, {
      now: NOW,
    });
    expect(res).toMatchObject({ ok: true, silent: true });
    expect(h.cancelMail).not.toHaveBeenCalled();
  });

  it("an evening still to come mails the cancellation as before", async () => {
    row = booking("2026-10-17", 20);
    const res = await cancelKaraokeReservation("krk-00042", STAFF, {
      now: NOW,
    });
    expect(res).toMatchObject({ ok: true, notified: true });
    expect(res.ok && "silent" in res).toBe(false);
    expect(h.cancelMail).toHaveBeenCalledTimes(1);
  });

  it("a member still cannot cancel late at all", async () => {
    row = booking("2026-10-10");
    const res = await cancelKaraokeReservation(
      "krk-00042",
      { kind: "member", email: "eda@example.com", emailVerified: true },
      { now: NOW },
    );
    expect(res).toMatchObject({ ok: false });
    expect(writes).toHaveLength(0);
    expect(h.cancelMail).not.toHaveBeenCalled();
  });
});

describe("setReservationStatus notify: false", () => {
  it("writes the change and sends nothing; the default still mails", async () => {
    row = booking("2026-10-10");
    const quiet = await setReservationStatus("krk-00042", "cancelled", NOW, {
      notify: false,
    });
    expect(quiet).toMatchObject({ ok: true, notified: true });
    expect(h.cancelMail).not.toHaveBeenCalled();

    row = booking("2026-10-10");
    await setReservationStatus("krk-00042", "cancelled", NOW);
    expect(h.cancelMail).toHaveBeenCalledTimes(1);
  });
});
