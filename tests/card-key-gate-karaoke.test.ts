import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A member's karaoke payment mints no card key while card storage is off.
 *
 * `startKaraokePayment` used to call `ensureCardUserKey` for every member, so
 * each prepaid booking wrote a random PayNkolay member key to
 * `customers."cardUserKey"` although no card can be saved (PAYNKOLAY_CARD_
 * STORAGE off, and since 18 Ekim 2026 the legal texts do not describe saved
 * cards: `SAVED_CARDS_IN_LEGAL_TEXTS`). A key that no text names is personal
 * data nobody was told about (KVKK m.10, Aydınlatma Tebliği m.5/1-j).
 *
 * The real module over a fake database; the POS and the key are the seams.
 */

const h = vi.hoisted(() => ({
  storage: false as boolean | undefined,
  createCheckoutSession: vi.fn(),
  ensureCardUserKey: vi.fn(),
}));

vi.mock("@/lib/mobile/karaoke", () => ({
  createReservation: vi.fn(),
  formatReservationDate: () => "30 Ekim 2026",
  formatReservationTime: () => "20:00-22:00",
  getReservation: vi.fn(async () => null),
  karaokeHoldKey: (email: string) => email,
  listMine: vi.fn(),
  notifyReservationStatus: vi.fn(),
  setReservationStatus: vi.fn(),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit: vi.fn(),
  reserveLoginAttempt: vi.fn(),
}));
vi.mock("@/lib/admin/store", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/customer/store", () => ({
  ensureCardUserKey: h.ensureCardUserKey,
}));
vi.mock("@/lib/email/send", () => ({
  sendKaraokeMoneyAlertEmail: vi.fn(async () => ({ ok: true })),
  sendKaraokePaidOperatorEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "paynkolay",
    cardStorageEnabled: h.storage,
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

const { startKaraokePayment } = await import("@/lib/mobile/karaoke-payment");

type Reservation = Parameters<typeof startKaraokePayment>[0];

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
  paymentDueAt: "",
  contactEmail: "eda@example.com",
  contactPhone: "+905321234567",
  channel: "app",
  guest: false,
} as unknown as Reservation;
const MEMBER = {
  id: "cus-1",
  email: "eda@example.com",
  name: "Eda",
  phone: "",
};

/** The key the payment page was opened with. */
function sentKey(): unknown {
  const input = h.createCheckoutSession.mock.calls[0]?.[0] as
    | { cardUserKey?: string }
    | undefined;
  return input?.cardUserKey;
}

beforeEach(() => {
  h.storage = false;
  h.createCheckoutSession.mockReset();
  h.createCheckoutSession.mockResolvedValue({
    providerRef: "krk-00042",
    redirectUrl: "https://laffogato.net/odeme/paynkolay?d=a&s=b",
    expiresAt: "2026-10-16T10:40:00.000Z",
  });
  h.ensureCardUserKey.mockReset();
  h.ensureCardUserKey.mockResolvedValue("MEMBERKEY01");
});

describe("karaoke payment and the member's card key", () => {
  it("mints no key and sends none while card storage is off", async () => {
    const res = await startKaraokePayment(HOLD, MEMBER);
    expect(res.ok).toBe(true);
    expect(h.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(h.ensureCardUserKey).not.toHaveBeenCalled();
    expect(sentKey()).toBeUndefined();
  });

  it("reads a provider that says nothing about card storage as off", async () => {
    // The mock POS (development) has no such property at all.
    h.storage = undefined;
    await startKaraokePayment(HOLD, MEMBER);
    expect(h.ensureCardUserKey).not.toHaveBeenCalled();
    expect(sentKey()).toBeUndefined();
  });

  it("uses the member's key once card storage is on", async () => {
    h.storage = true;
    await startKaraokePayment(HOLD, MEMBER);
    expect(h.ensureCardUserKey).toHaveBeenCalledWith("eda@example.com");
    expect(sentKey()).toBe("MEMBERKEY01");
  });

  it("never mints one for a guest booking, storage on or off", async () => {
    h.storage = true;
    await startKaraokePayment(
      { ...HOLD, guest: true } as unknown as Reservation,
      null,
    );
    expect(h.ensureCardUserKey).not.toHaveBeenCalled();
    expect(sentKey()).toBeUndefined();
  });
});
