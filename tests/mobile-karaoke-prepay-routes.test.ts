import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The mobile karaoke contract after online prepayment (docs/API-MOBILE.md §7,
 * 16 Eki 2026). Additive only: an old build that sends no `prepay` keeps
 * working while the panel has prepayment off, and is told to update (426
 * `app_update_required`) while it is on - never silently taken as an unpaid
 * request nobody will confirm.
 */

const h = vi.hoisted(() => ({
  prepay: true,
  bookKaraoke: vi.fn(),
  reopen: vi.fn(),
  cancel: vi.fn(),
  customer: {
    id: "cus-1",
    email: "eda@example.com",
    name: "Eda",
    phone: "",
    emailVerified: true,
  },
}));

vi.mock("@/lib/mobile/karaoke-payment", () => ({
  bookKaraoke: h.bookKaraoke,
  reopenKaraokePayment: h.reopen,
  cancelKaraokeReservation: h.cancel,
}));
vi.mock("@/lib/admin/store", () => ({
  getSettings: async () => ({ karaokePrepay: h.prepay }),
}));
vi.mock("@/lib/admin/rate-limit", () => ({ clientIp: async () => "10.0.0.1" }));
vi.mock("@/lib/legal/store", () => ({
  karaokeConsentVersion: async () => "16 Ekim 2026",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "lafmobil/2.0" }),
}));
vi.mock("@/lib/mobile/auth", () => ({
  requireMobileCustomer: vi.fn(async () => ({
    ok: true,
    customer: h.customer,
  })),
}));

const { POST } = await import("@/app/api/mobile/v1/karaoke/reservations/route");
const { POST: PAY } =
  await import("@/app/api/mobile/v1/karaoke/reservations/[id]/payment/route");
const { POST: CANCEL } =
  await import("@/app/api/mobile/v1/karaoke/reservations/[id]/cancel/route");
const { KARAOKE_NO_REFUND_RULE } = await import("@/lib/mobile/karaoke-time");

const ROW = {
  id: "krk-00042",
  customerEmail: "eda@example.com",
  customerName: "Eda",
  date: "2026-10-30",
  startHour: 20,
  hours: 2,
  guests: 4,
  status: "requested" as const,
  priceMinor: 200_000,
  discountMinor: 0,
  totalMinor: 200_000,
  note: "",
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  paymentStatus: "pending" as const,
  paymentDueAt: "2026-10-16T10:30:00.000Z",
  contactEmail: "eda@example.com",
  contactPhone: "+905321234567",
};
const PAYMENT = {
  provider: "paynkolay",
  redirectUrl: "https://laffogato.net/odeme/paynkolay?d=a&s=b",
  expiresAt: "2026-10-16T10:20:00.000Z",
};

function req(url: string, body?: object) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }) as never;
}
const book = (body: object) =>
  POST(req("https://laffogato.net/api/mobile/v1/karaoke/reservations", body));
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  h.prepay = true;
  h.bookKaraoke.mockReset();
  h.reopen.mockReset();
  h.cancel.mockReset();
});

const SLOT = { date: "2026-10-30", startHour: 20, hours: 2, guests: 4 };

describe("POST /karaoke/reservations", () => {
  it("an old build (no prepay) is told to update while prepayment is on - nothing is booked", async () => {
    const res = await book(SLOT);
    expect(res.status).toBe(426);
    expect(await res.json()).toMatchObject({ error: "app_update_required" });
    expect(h.bookKaraoke).not.toHaveBeenCalled();
  });

  it("an old build keeps the request flow while prepayment is off", async () => {
    h.prepay = false;
    h.bookKaraoke.mockResolvedValue({
      ok: true,
      reservation: { ...ROW, paymentStatus: "none", paymentDueAt: "" },
      payment: null,
    });
    const res = await book(SLOT);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment).toBeNull();
    expect(body.reservation.paymentStatus).toBe("none");
    expect(h.bookKaraoke.mock.calls[0]![2]).toMatchObject({ prepay: false });
  });

  it("a new build must send legalConsent: true with prepay", async () => {
    const res = await book({ ...SLOT, prepay: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "invalid_request",
      field: "legalConsent",
    });
    expect(h.bookKaraoke).not.toHaveBeenCalled();
  });

  it("books the hold, records the consent, and returns the payment page", async () => {
    h.bookKaraoke.mockResolvedValue({
      ok: true,
      reservation: ROW,
      payment: PAYMENT,
    });
    const res = await book({ ...SLOT, prepay: true, legalConsent: true });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment).toEqual(PAYMENT);
    expect(body.reservation).toMatchObject({
      id: "krk-00042",
      status: "requested",
      paymentStatus: "pending",
      paymentDueAt: "2026-10-16T10:30:00.000Z",
    });
    // The allow-list holds: no contact, no note, no consent record.
    expect(body.reservation).not.toHaveProperty("contactPhone");
    expect(body.reservation).not.toHaveProperty("legalConsent");
    expect(h.bookKaraoke.mock.calls[0]![2]).toMatchObject({
      channel: "app",
      prepay: true,
      legalConsent: {
        documents: ["karaoke-odasi-rezervasyon"],
        surface: "app",
        userAgent: "lafmobil/2.0",
        ip: "10.0.0.1",
      },
    });
  });

  it("a 429 carries Retry-After", async () => {
    h.bookKaraoke.mockResolvedValue({
      ok: false,
      status: 429,
      error: "rate_limited",
      message: "Ödenmemiş çok sayıda rezervasyon denemen oldu.",
      retryAfterSeconds: 3600,
    });
    const res = await book({ ...SLOT, prepay: true, legalConsent: true });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
  });
});

describe("POST /karaoke/reservations/{id}/payment", () => {
  const pay = (id: string) =>
    PAY(
      req(
        `https://laffogato.net/api/mobile/v1/karaoke/reservations/${id}/payment`,
      ),
      params(id),
    );

  it("reopens the member's own hold", async () => {
    h.reopen.mockResolvedValue({
      ok: true,
      reservation: ROW,
      payment: PAYMENT,
    });
    const res = await pay("krk-00042");
    expect(res.status).toBe(200);
    expect((await res.json()).payment).toEqual(PAYMENT);
    expect(h.reopen.mock.calls[0]![0]).toEqual({
      kind: "member",
      customer: h.customer,
    });
  });

  it("a stranger's booking and a malformed id are 404", async () => {
    h.reopen.mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await pay("krk-00042")).status).toBe(404);
    expect((await pay("ord-0001")).status).toBe(404);
  });

  it("nothing to pay is 409 not_payable; too many reopens 429", async () => {
    h.reopen.mockResolvedValueOnce({
      ok: false,
      reason: "not_payable",
      reservation: ROW,
    });
    expect((await pay("krk-00042")).status).toBe(409);
    h.reopen.mockResolvedValueOnce({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 60,
    });
    const limited = await pay("krk-00042");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });

  it("a last attempt the POS cannot vouch for is 503 payment_unavailable, without 'not charged'", async () => {
    h.reopen.mockResolvedValueOnce({
      ok: false,
      reason: "payment_unknown",
      reservation: ROW,
    });
    const res = await pay("krk-00042");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("payment_unavailable");
    expect(body.message).toMatch(/doğrulayamıyoruz/);
    // The earlier attempt is exactly what could not be read.
    expect(body.message).not.toContain("para çekilmedi");
  });
});

describe("POST /karaoke/reservations/{id}/cancel", () => {
  const cancel = (id: string) =>
    CANCEL(
      req(
        `https://laffogato.net/api/mobile/v1/karaoke/reservations/${id}/cancel`,
      ),
      params(id),
    );

  it("cancels as the member - the library checks ownership, the 2-hour rule and the POS", async () => {
    h.cancel.mockResolvedValue({
      ok: true,
      reservation: { ...ROW, status: "cancelled", paymentStatus: "refunded" },
      refunded: true,
      notified: true,
    });
    const res = await cancel("krk-00042");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      refunded: true,
      reservation: { status: "cancelled", paymentStatus: "refunded" },
    });
    expect(h.cancel.mock.calls[0]![1]).toEqual({
      kind: "member",
      email: "eda@example.com",
      emailVerified: true,
    });
  });

  it("a late cancel is 409 too_late and says no refund, verbatim", async () => {
    h.cancel.mockResolvedValue({
      ok: false,
      reason: "too_late",
      reservation: ROW,
    });
    const res = await cancel("krk-00042");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("too_late");
    expect(body.message).toContain(KARAOKE_NO_REFUND_RULE);
  });

  it("maps every other refusal to its own code", async () => {
    const cases: Array<[string, number, string]> = [
      ["not_found", 404, "not_found"],
      ["payment_unknown", 503, "payment_unknown"],
      ["refund_refused", 502, "refund_failed"],
      ["refund_unknown", 409, "refund_pending"],
      ["not_cancellable", 409, "not_cancellable"],
      ["raced", 409, "not_cancellable"],
    ];
    for (const [reason, status, code] of cases) {
      h.cancel.mockResolvedValueOnce({ ok: false, reason });
      const res = await cancel("krk-00042");
      expect([reason, res.status]).toEqual([reason, status]);
      expect((await res.json()).error).toBe(code);
    }
  });
});
