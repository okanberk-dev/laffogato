import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Ödemeyi tamamla" on an unpaid karaoke hold (`reopenKaraokePayment`, §7.1).
 *
 * PayNkolay takes a second sale on the same `clientRefCode`, so a new page for
 * a hold whose first payment went through but never came back would charge the
 * member twice. The POS is asked first, and only a clear "no payment" opens a
 * page: a POS that cannot be asked is never "unpaid" (CLAUDE.md rule 29), and
 * neither is money collected at the wrong amount - that is money at the POS, a
 * second page would charge on top of it.
 *
 * The real module over a fake database: the reservation read, the payment
 * page and the POS lookup are the seams.
 */

const h = vi.hoisted(() => ({
  row: null as null | Record<string, unknown>,
  lookupPayment: vi.fn(),
  createCheckoutSession: vi.fn(),
  reserveLoginAttempt: vi.fn(),
  moneyAlert: vi.fn(),
}));

vi.mock("@/lib/mobile/karaoke", () => ({
  createReservation: vi.fn(),
  formatReservationDate: () => "30 Ekim 2026",
  formatReservationTime: () => "20:00-22:00",
  getReservation: vi.fn(async () => h.row),
  karaokeHoldKey: (email: string) => email,
  listMine: vi.fn(),
  notifyReservationStatus: vi.fn(),
  setReservationStatus: vi.fn(),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit: vi.fn(),
  reserveLoginAttempt: h.reserveLoginAttempt,
}));
vi.mock("@/lib/admin/store", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: async () => "" }));
vi.mock("@/lib/email/send", () => ({
  sendKaraokeMoneyAlertEmail: h.moneyAlert,
  sendKaraokePaidOperatorEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "paynkolay",
    lookupPayment: h.lookupPayment,
    createCheckoutSession: h.createCheckoutSession,
  }),
}));
vi.mock("@/lib/mobile/checkout-ref", () => ({
  recordPendingCheckout: vi.fn(async () => {}),
}));
vi.mock("@/lib/mobile/karaoke-notify", () => ({
  notifyOperatorOfReservation: vi.fn(),
}));
vi.mock("@/lib/mobile/venue", () => ({ istanbulClock: vi.fn() }));

/** Every query answers "one row moved, no error"; nothing is persisted. */
function query(): unknown {
  const result = { data: [{ id: "krk-00042" }], error: null, status: 200 };
  const q: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
            Promise.resolve(result).then(ok, fail);
        }
        return () => q;
      },
    },
  );
  return q;
}
vi.mock("@/lib/db", () => ({
  getDb: () => ({ from: () => query() }),
  TABLES: {
    karaokeReservations: "karaoke_reservations",
    paymentTransactions: "payment_transactions",
  },
}));

const { reopenKaraokePayment } = await import("@/lib/mobile/karaoke-payment");

const NOW = new Date("2026-10-16T10:10:00.000Z");
const HOLD = {
  id: "krk-00042",
  customerEmail: "eda@example.com",
  customerName: "Eda",
  date: "2026-10-30",
  startHour: 20,
  hours: 2,
  guests: 4,
  status: "requested",
  priceMinor: 200_000,
  discountMinor: 0,
  totalMinor: 200_000,
  note: "",
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  paymentStatus: "pending",
  paymentDueAt: "2026-10-16T10:30:00.000Z",
  contactEmail: "eda@example.com",
  contactPhone: "+905321234567",
  channel: "app",
};
const OWNER = {
  kind: "member" as const,
  customer: {
    id: "cus-1",
    email: "eda@example.com",
    name: "Eda",
    phone: "",
    emailVerified: true,
  },
};

const reopen = () => reopenKaraokePayment(OWNER, "krk-00042", { now: NOW });

beforeEach(() => {
  h.row = { ...HOLD };
  h.lookupPayment.mockReset();
  h.createCheckoutSession.mockReset();
  h.createCheckoutSession.mockResolvedValue({
    providerRef: "krk-00042",
    redirectUrl: "https://laffogato.net/odeme/paynkolay?d=a&s=b",
    expiresAt: "2026-10-16T10:40:00.000Z",
  });
  h.reserveLoginAttempt.mockReset();
  h.reserveLoginAttempt.mockResolvedValue({
    blocked: false,
    retryAfterSeconds: 0,
    remaining: 7,
  });
  h.moneyAlert.mockReset();
  h.moneyAlert.mockResolvedValue({ ok: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("reopening a karaoke hold's payment page", () => {
  it("opens a page when the POS says there is no payment (the control)", async () => {
    h.lookupPayment.mockResolvedValue(null);
    const result = await reopen();
    expect(result.ok).toBe(true);
    expect(h.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("refuses with payment_unknown when the POS cannot be asked, and opens nothing", async () => {
    h.lookupPayment.mockRejectedValue(new Error("timed out after 5000 ms"));
    const result = await reopen();
    expect(result).toMatchObject({ ok: false, reason: "payment_unknown" });
    expect(h.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("never reopens on an amount mismatch: money is at the POS", async () => {
    h.lookupPayment.mockResolvedValue({
      status: "succeeded",
      orderId: "krk-00042",
      providerRef: "IKSIRPF102168",
      amountMinor: 150_000,
      currency: "TRY",
      raw: {},
      trxDate: "2026-10-16",
    });
    const result = await reopen();
    expect(result).toMatchObject({ ok: false, reason: "payment_unknown" });
    expect(h.createCheckoutSession).not.toHaveBeenCalled();
    // …and a person is told about the odd amount, as the sweep would.
    expect(h.moneyAlert).toHaveBeenCalledTimes(1);
  });

  it("asks the POS only after the reopen budget", async () => {
    h.reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 540,
      remaining: 0,
    });
    const result = await reopen();
    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(h.lookupPayment).not.toHaveBeenCalled();
    expect(h.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("only the reopen reads a mismatch as unknown; the sweep and a cancel still let the hour go", () => {
    const src = readFileSync("src/lib/mobile/karaoke-payment.ts", "utf8");
    const reopenFn = src.slice(
      src.indexOf("export async function reopenKaraokePayment"),
      src.indexOf("// ─── Booking a payment"),
    );
    expect(reopenFn).toContain('onAmountMismatch: "unknown"');
    expect(src.match(/onAmountMismatch: "unknown"/g)).toHaveLength(1);
    expect(src).toContain('{ onAmountMismatch = "unpaid" }');
  });
});

describe("the web page's notice for it", () => {
  it("has its own sentence, not 'already paid or expired'", async () => {
    const { payNoticeCode, KARAOKE_RESULT_NOTICES } =
      await import("@/lib/mobile/karaoke-notices");
    const code = payNoticeCode("payment_unknown");
    expect(code).not.toBe(payNoticeCode("not_payable"));
    expect(KARAOKE_RESULT_NOTICES[code]?.text).toMatch(/doğrulanamadı/);
  });
});
