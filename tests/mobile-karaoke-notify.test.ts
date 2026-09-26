import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KaraokeReservation } from "@/lib/mobile/karaoke";

/**
 * The operator's notice when the app or the web takes a karaoke booking.
 *
 * The room is held by hand - a reservation is written `requested` and a person
 * confirms it from /admin/mobil/karaoke - and until this nothing told that
 * person a request had arrived. What these cases guard is not the wording but
 * the two properties that make the notice trustworthy:
 *
 *   1. it is SENT, with the booking's own figures on it;
 *   2. it can NEVER cost a reservation. The row is already written when the
 *      mail is attempted, so a dead provider must be logged and swallowed.
 */
const sendKaraokeOperatorEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendKaraokeOperatorEmail: (...args: unknown[]) =>
    sendKaraokeOperatorEmail(...args),
}));

const { notifyOperatorOfReservation } =
  await import("@/lib/mobile/karaoke-notify");

function reservation(
  over: Partial<KaraokeReservation> = {},
): KaraokeReservation {
  return {
    id: "krk-00042",
    customerEmail: "eda@ornek.com",
    customerName: "Eda Mancuso",
    date: "2026-09-20",
    startHour: 20,
    hours: 2,
    guests: 6,
    status: "requested",
    priceMinor: 180_00,
    discountMinor: 0,
    totalMinor: 180_00,
    note: "",
    createdAt: "2026-09-15T18:00:00.000Z",
    updatedAt: "2026-09-15T18:00:00.000Z",
    ...over,
  };
}

describe("karaoke operator notice", () => {
  beforeEach(() => {
    sendKaraokeOperatorEmail.mockReset();
    sendKaraokeOperatorEmail.mockResolvedValue({ ok: true });
  });

  it("sends the booking's own figures, formatted for a person", async () => {
    await notifyOperatorOfReservation(reservation());

    expect(sendKaraokeOperatorEmail).toHaveBeenCalledTimes(1);
    expect(sendKaraokeOperatorEmail).toHaveBeenCalledWith({
      id: "krk-00042",
      source: "app",
      customerName: "Eda Mancuso",
      customerEmail: "eda@ornek.com",
      phone: "",
      // Not `new Date("2026-09-20")`: that is UTC midnight, and a formatter in
      // a negative-offset deployment would print the 19th.
      date: "20 Eylül 2026",
      time: "20:00 - 22:00",
      guests: 6,
      totalMinor: 180_00,
      note: "",
    });
  });

  it("says which surface took the booking", async () => {
    await notifyOperatorOfReservation(reservation(), "web");
    expect(sendKaraokeOperatorEmail.mock.calls[0]![0]).toMatchObject({
      source: "web",
    });
  });

  it("wraps a block that runs past midnight", async () => {
    await notifyOperatorOfReservation(reservation({ startHour: 23, hours: 2 }));
    expect(sendKaraokeOperatorEmail.mock.calls[0]![0]).toMatchObject({
      time: "23:00 - 01:00",
    });
  });

  it("carries the member's note when they left one", async () => {
    await notifyOperatorOfReservation(
      reservation({ note: "Doğum günü, pasta getireceğiz" }),
    );
    expect(sendKaraokeOperatorEmail.mock.calls[0]![0]).toMatchObject({
      note: "Doğum günü, pasta getireceğiz",
    });
  });

  it("never lets a dead provider cost the reservation", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    sendKaraokeOperatorEmail.mockResolvedValue({
      ok: false,
      error: "RESEND_API_KEY tanımlı değil.",
    });
    await expect(
      notifyOperatorOfReservation(reservation()),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();

    // And the same when the sender throws rather than answering.
    logged.mockClear();
    sendKaraokeOperatorEmail.mockRejectedValue(new Error("network"));
    await expect(
      notifyOperatorOfReservation(reservation()),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});
