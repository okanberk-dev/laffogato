import { describe, expect, it, vi } from "vitest";

/**
 * L7-21: `POST /karaoke/reservations` answers the note's 400 with an
 * additive `field: "note"`, so the app can mark the box instead of showing
 * a banner the member cannot place. `error` and `message` are unchanged.
 */
const createReservation = vi.fn();
vi.mock("@/lib/mobile/karaoke", () => ({
  createReservation,
  listMine: vi.fn(),
  toReservationJson: vi.fn(),
}));
vi.mock("@/lib/mobile/karaoke-notify", () => ({
  notifyOperatorOfReservation: vi.fn(),
}));
vi.mock("@/lib/mobile/auth", () => ({
  requireMobileCustomer: vi.fn(async () => ({
    ok: true,
    customer: { email: "eda@example.com", name: "Eda", emailVerified: true },
  })),
}));

const { POST } = await import("@/app/api/mobile/v1/karaoke/reservations/route");

function post(body: object) {
  return POST(
    new Request("https://laffogato.net/api/mobile/v1/karaoke/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /karaoke/reservations - field on a 400", () => {
  it("adds field: note next to the unchanged error and message", async () => {
    createReservation.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: "invalid_request",
      message: "Not en fazla 200 karakter.",
      field: "note",
    });
    const res = await post({ note: "x".repeat(201) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalid_request",
      message: "Not en fazla 200 karakter.",
      field: "note",
    });
  });

  it("sends no field when the refusal is not about one", async () => {
    createReservation.mockResolvedValueOnce({
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    });
    const res = await post({});
    expect(await res.json()).toEqual({
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    });
  });
});
