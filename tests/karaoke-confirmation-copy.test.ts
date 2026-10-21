import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * A booking paid online confirmed the karaoke terms before it paid, and its
 * confirmation carries them, filled with the booking (ASK-DURABLE). A
 * booking paid at the venue confirmed nothing and gets no copy; a copy that
 * cannot be made never holds or fails the confirmation.
 */

const h = vi.hoisted(() => ({
  sendKaraokeConfirmationEmail: vi.fn(async () => true),
  sendKaraokeCancellationEmail: vi.fn(async () => true),
  karaokeDurableCopy: vi.fn(),
}));

vi.mock("@/lib/email/send", () => ({
  sendKaraokeConfirmationEmail: h.sendKaraokeConfirmationEmail,
  sendKaraokeCancellationEmail: h.sendKaraokeCancellationEmail,
  sendKaraokeLateRequestEmail: vi.fn(async () => true),
}));
vi.mock("@/lib/legal/durable-copy-load", () => ({
  karaokeDurableCopy: h.karaokeDurableCopy,
  durableCopyForMail: async (_label: string, build: () => Promise<unknown>) =>
    build(),
}));

process.env.KARAOKE_LINK_SECRET = "k".repeat(40);

const { notifyReservationStatus } = await import("@/lib/mobile/karaoke");

const COPY = {
  filename: "karaoke-sozlesme-KRK-00042.html",
  html: "<!DOCTYPE html>",
  links: [],
};

function booking(patch: Partial<KaraokeReservation> = {}): KaraokeReservation {
  return {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda Yılmaz",
    date: "2099-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 90_000,
    discountMinor: 0,
    totalMinor: 90_000,
    note: "",
    createdAt: "2026-10-21T10:00:00.000Z",
    updatedAt: "2026-10-21T10:00:00.000Z",
    paymentStatus: "paid",
    paidMinor: 90_000,
    legalConsent: {
      acceptedAt: "2026-10-21T10:00:00.000Z",
      documents: ["karaoke-odasi-rezervasyon"],
      version: "20 Ekim 2026",
      textHashes: { "karaoke-odasi-rezervasyon": "a".repeat(64) },
    },
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.karaokeDurableCopy.mockResolvedValue(COPY);
});

describe("the confirmation of a paid booking", () => {
  it("carries the copy built from the booking", async () => {
    expect(await notifyReservationStatus(booking())).toBe(true);
    expect(h.karaokeDurableCopy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "krk-00042" }),
    );
    expect(h.sendKaraokeConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        durableCopy: COPY,
        payment: { kind: "online", paidMinor: 90_000 },
      }),
    );
  });

  it("asks for nothing for a booking paid at the venue, or one with no recorded hash", async () => {
    await notifyReservationStatus(
      booking({ paymentStatus: "none", legalConsent: null }),
    );
    await notifyReservationStatus(
      booking({
        legalConsent: {
          acceptedAt: "2026-10-01T10:00:00.000Z",
          documents: ["karaoke-odasi-rezervasyon"],
          version: "1 Ekim 2026",
        },
      }),
    );
    expect(h.karaokeDurableCopy).not.toHaveBeenCalled();
    for (const call of h.sendKaraokeConfirmationEmail.mock.calls as unknown[][]) {
      expect(call[0]).toMatchObject({ durableCopy: null });
    }
  });

  it("still confirms when the copy cannot be made", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.karaokeDurableCopy.mockRejectedValue(new Error("db down"));
    expect(await notifyReservationStatus(booking())).toBe(true);
    expect(h.sendKaraokeConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ durableCopy: null }),
    );
    expect(warn.mock.calls.map((c) => c.join(" ")).join("\n")).not.toContain(
      "eda@",
    );
    warn.mockRestore();
  });

  it("is never attached to a cancellation", async () => {
    await notifyReservationStatus(booking({ status: "cancelled" }));
    expect(h.karaokeDurableCopy).not.toHaveBeenCalled();
    expect(h.sendKaraokeCancellationEmail).toHaveBeenCalledWith(
      expect.not.objectContaining({ durableCopy: expect.anything() }),
    );
  });
});
