import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * "Saati değiştir" (operator, 27 Eki 2026: "admin panelden saati
 * değiştirebilir yap, değişince de kişiye mail gitsin"): which bookings may
 * move, what the panel offers, what the action answers and records, and the
 * member's mail. The database half is
 * tests/db-integration-karaoke-reschedule.test.ts.
 */

const h = vi.hoisted(() => ({
  role: "manager" as string,
  required: [] as string[],
  reschedule: vi.fn(),
  safeAudit: vi.fn(async (_input: unknown) => true),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(async () => {}),
  safeAudit: h.safeAudit,
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async (section: string) => {
    h.required.push(section);
    return { email: "kosk@laffogato", role: h.role, expiresAt: 0 };
  }),
  getAdminSession: vi.fn(async () => ({
    email: "kosk@laffogato",
    role: h.role,
    expiresAt: 0,
  })),
}));
vi.mock("@/lib/mobile/karaoke", () => ({
  getReservation: vi.fn(),
  listReservationsForDate: vi.fn(),
  paymentStatusOf: (r: { paymentStatus?: string }) => r.paymentStatus ?? "none",
  rescheduleReservation: h.reschedule,
  setReservationStatus: vi.fn(),
}));
vi.mock("@/lib/mobile/karaoke-payment", () => ({}));

const core = await import("@/lib/mobile/karaoke-reschedule-core");
const panel = await import("@/lib/admin/karaoke-panel");
const admin = await import("@/app/admin/mobil/karaoke/actions");
const { KaraokeActions } = await import("@/components/admin/karaoke-panel");
const { renderEmail } = await import("@/lib/email/render");
const { EMAIL_TEXT } = await import("@/lib/email/text");
const { karaokeRescheduleFlags } = await import("@/lib/email/send");

// 15:00 in Tuzla on 17 Ekim; the booking is tonight 20:00 - 22:00.
const NOW = new Date("2026-10-17T12:00:00.000Z");
const TODAY = "2026-10-17";
const CTX = { today: TODAY, now: NOW, prepay: true, canRefund: true };
const ROOM = core.karaokeRoomCalendar(
  { firstHour: 12, closeHour: 24, bookingWindowDays: 30 },
  TODAY,
);

function booking(over: Partial<KaraokeReservation> = {}): KaraokeReservation {
  return {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda Yılmaz",
    date: TODAY,
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "",
    createdAt: "2026-10-16T10:00:00.000Z",
    updatedAt: "2026-10-16T10:05:00.000Z",
    paymentStatus: "paid",
    paidAt: "2026-10-16T10:05:00.000Z",
    paidMinor: 200_000,
    ...over,
  };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.role = "manager";
  h.required.length = 0;
  h.reschedule.mockReset();
  h.safeAudit.mockClear();
});

describe("which bookings may move", () => {
  it("a live booking whose evening is not over, paid online or at the köşk", () => {
    expect(core.karaokeRescheduleBlock(booking(), NOW)).toBeNull();
    expect(
      core.karaokeRescheduleBlock(
        booking({ status: "requested", paymentStatus: "none" }),
        NOW,
      ),
    ).toBeNull();
    // A row from before the payment columns reads as paid at the köşk.
    expect(
      core.karaokeRescheduleBlock(booking({ paymentStatus: undefined }), NOW),
    ).toBeNull();
    // Under way, not over: a party that came late may still move.
    expect(
      core.karaokeRescheduleBlock(
        booking({ startHour: 14 }),
        new Date("2026-10-17T11:30:00.000Z"),
      ),
    ).toBeNull();
  });

  it("never a cancelled one, an evening that is over, an unpaid hold or money on its way back", () => {
    expect(
      core.karaokeRescheduleBlock(booking({ status: "cancelled" }), NOW),
    ).toBe("cancelled");
    expect(
      core.karaokeRescheduleBlock(
        booking({ startHour: 12, hours: 2 }),
        new Date("2026-10-17T11:00:00.000Z"),
      ),
    ).toBe("ended");
    for (const money of ["pending", "refunding"] as const) {
      expect(
        core.karaokeRescheduleBlock(
          booking({ status: "requested", paymentStatus: money }),
          NOW,
        ),
      ).toBe("payment_open");
    }
  });

  it("offers every start that still ends by closing time, for the booking's own length", () => {
    expect(
      core.karaokeRescheduleStarts(2, { firstHour: 12, closeHour: 24 }),
    ).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    expect(
      core.karaokeRescheduleStarts(1, { firstHour: 20, closeHour: 22 }),
    ).toEqual([20, 21]);
  });

  it("the room's calendar runs from today to the window's last day", () => {
    expect(ROOM).toEqual({
      today: TODAY,
      lastDay: "2026-11-16",
      firstHour: 12,
      closeHour: 24,
    });
  });

  it("a booking longer than today's longest block keeps its own length", () => {
    expect(core.karaokeRescheduleRules({ maxHours: 2 }, 3).maxHours).toBe(3);
    const rules = { maxHours: 4 };
    expect(core.karaokeRescheduleRules(rules, 2)).toBe(rules);
  });
});

describe("the panel's button", () => {
  it("is offered on a live booking, off with the reason on an unpaid hold, absent otherwise", () => {
    expect(panel.karaokeActionPlan(booking(), CTX).reschedule).toEqual({});
    expect(
      panel.karaokeActionPlan(
        booking({ status: "requested", paymentStatus: "pending" }),
        CTX,
      ).reschedule,
    ).toEqual({
      disabledReason: core.KARAOKE_RESCHEDULE_REFUSAL.payment_open,
    });
    expect(
      panel.karaokeActionPlan(booking({ status: "cancelled" }), CTX).reschedule,
    ).toBeNull();
    expect(
      panel.karaokeActionPlan(booking({ startHour: 12, hours: 2 }), {
        ...CTX,
        now: new Date("2026-10-17T11:00:00.000Z"),
      }).reschedule,
    ).toBeNull();
  });

  it("Personel gets it too: no money moves", () => {
    expect(
      panel.karaokeActionPlan(booking(), { ...CTX, canRefund: false })
        .reschedule,
    ).toEqual({});
  });

  it("is drawn on the page with the room's calendar, and not without it", () => {
    const view = panel.karaokeRowView(booking(), CTX);
    const withRoom = renderToStaticMarkup(
      createElement(KaraokeActions, { view, layout: "page", room: ROOM }),
    );
    expect(withRoom).toContain("Saati değiştir");
    const without = renderToStaticMarkup(
      createElement(KaraokeActions, { view, layout: "page" }),
    );
    expect(without).not.toContain("Saati değiştir");
  });

  it("the history says what moved where, and when the mail did not leave", () => {
    const [item] = panel
      .karaokeHistory(booking(), [
        {
          id: "aud-1",
          entityId: "krk-00042",
          actor: "kosk@laffogato",
          action: "update",
          createdAt: "2026-10-17T12:00:00.000Z",
          payload: {
            event: "rescheduled",
            fromDate: "2026-10-17",
            fromStartHour: 20,
            toDate: "2026-10-18",
            toStartHour: 21,
            hours: 2,
            notified: false,
          },
        },
      ])
      .filter((i) => i.id === "aud-1");
    expect(item?.title).toBe("Tarih / saat değiştirildi");
    expect(item?.tone).toBe("info");
    expect(item?.description).toBe(
      "17 Ekim 2026, 20:00 - 22:00 → 18 Ekim 2026, 21:00 - 23:00 · Müşteriye e-posta gönderilemedi",
    );
  });

  it("a move is not taken for a released hold", () => {
    const rows = [
      {
        entityId: "krk-00042",
        action: "update",
        payload: { event: "rescheduled", fromDate: TODAY },
      },
    ];
    expect(panel.staffReleasedIds(rows).size).toBe(0);
    expect(panel.unverifiedReleaseIds(rows).size).toBe(0);
  });
});

describe("rescheduleReservationAction", () => {
  const moved = booking({ date: "2026-10-18", startHour: 21 });

  it("opens the karaoke panel's gate, and Personel may use it", async () => {
    h.role = "staff";
    h.reschedule.mockResolvedValue({
      ok: true,
      reservation: moved,
      previous: { date: TODAY, startHour: 20 },
      notified: true,
    });
    const res = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "2026-10-18", saat: "21" }),
    );
    expect(h.required).toEqual(["karaoke"]);
    expect(res.ok).toBe(true);
    expect(h.reschedule).toHaveBeenCalledWith("krk-00042", {
      date: "2026-10-18",
      startHour: 21,
    });
  });

  it("says the new evening and that the member was mailed, and records the move", async () => {
    h.reschedule.mockResolvedValue({
      ok: true,
      reservation: moved,
      previous: { date: TODAY, startHour: 20 },
      notified: true,
    });
    const res = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "2026-10-18", saat: "21" }),
    );
    expect(res).toEqual({
      ok: true,
      tone: "success",
      message:
        "Rezervasyonun saati değiştirildi: 18 Ekim 2026, 21:00 - 23:00. Üyeye e-posta gönderildi.",
    });
    expect(h.safeAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "karaoke_reservation",
      entityId: "krk-00042",
      payload: {
        event: "rescheduled",
        fromDate: TODAY,
        fromStartHour: 20,
        toDate: "2026-10-18",
        toStartHour: 21,
        hours: 2,
        notified: true,
      },
    });
  });

  it("a mail that did not leave turns the answer into a warning", async () => {
    h.reschedule.mockResolvedValue({
      ok: true,
      reservation: { ...moved, guest: true },
      previous: { date: TODAY, startHour: 20 },
      notified: false,
    });
    const res = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "2026-10-18", saat: "21" }),
    );
    expect(res).toMatchObject({
      ok: true,
      tone: "warning",
      message: expect.stringContaining("GÖNDERİLEMEDİ"),
    });
  });

  it("refuses a missing day or hour before asking anything", async () => {
    const noDay = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "18.10.2026", saat: "21" }),
    );
    expect(noDay).toMatchObject({
      ok: false,
      fieldErrors: { tarih: expect.any(String) },
    });
    const noHour = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "2026-10-18", saat: "" }),
    );
    expect(noHour).toMatchObject({
      fieldErrors: { saat: "Başlangıç saatini seç." },
    });
    const noId = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-x", tarih: "2026-10-18", saat: "21" }),
    );
    expect(noId.ok).toBe(false);
    expect(h.reschedule).not.toHaveBeenCalled();
  });

  it("puts the server's refusal under its field, and writes no audit row", async () => {
    h.reschedule.mockResolvedValue({
      ok: false,
      reason: "invalid",
      message: "En fazla 30 gün sonrasına rezervasyon yapılabilir.",
      field: "tarih",
    });
    const invalid = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "2027-10-18", saat: "21" }),
    );
    expect(invalid).toMatchObject({
      fieldErrors: {
        tarih: "En fazla 30 gün sonrasına rezervasyon yapılabilir.",
      },
    });

    h.reschedule.mockResolvedValue({ ok: false, reason: "slot_taken" });
    const taken = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "2026-10-18", saat: "21" }),
    );
    expect(taken).toMatchObject({
      fieldErrors: { saat: expect.stringMatching(/başka bir rezervasyonda/) },
    });

    h.reschedule.mockResolvedValue({ ok: false, reason: "payment_open" });
    const open = await admin.rescheduleReservationAction(
      null,
      form({ id: "krk-00042", tarih: "2026-10-18", saat: "21" }),
    );
    expect(open).toEqual({
      ok: false,
      error: core.KARAOKE_RESCHEDULE_REFUSAL.payment_open,
    });
    expect(h.safeAudit).not.toHaveBeenCalled();
  });
});

describe("the member's mail", () => {
  const vars = {
    AD: "Eda",
    KARAOKE_TARIH: "18 Ekim 2026",
    KARAOKE_SAAT: "21:00 - 23:00",
    KARAOKE_KISI: "4 kişi",
    KARAOKE_KOD: "KRK-00042",
    KARAOKE_TUTAR: "2.000,00 ₺",
    KARAOKE_LINK: "https://laffogato.net/rezervasyon?t=abc",
    KARAOKE_IADE_KURALI: "Tam iade kuralı.",
    KARAOKE_GEC_KURALI: "Geç iptal kuralı.",
    // The last free moment as the move recounted it (`karaokeMovedDeadline`).
    KARAOKE_SON_IPTAL: "16 Ekim 2026, 15:00",
    KARAOKE_TELAFI_KOD: "KRK-00041",
    KARAOKE_ESKI_TARIH: "17 Ekim 2026",
    KARAOKE_ESKI_SAAT: "20:00 - 22:00",
    TELEFON: "0216 000 00 00",
    TELEFON_TEL: "+902160000000",
    KOSK_ADRES: "Tuzla",
    KOSK_SAAT: "08:00 - 24:00",
  };
  const render = (flags: Record<string, boolean>) =>
    renderEmail("karaoke-saat-degisikligi", {
      vars,
      flags,
      text: EMAIL_TEXT["karaoke-saat-degisikligi"],
    });

  it("prints exactly one payment line", () => {
    expect(
      karaokeRescheduleFlags({ payment: { kind: "online", paidMinor: 1 } }),
    ).toEqual({
      KARAOKE_ODENDI: true,
      KARAOKE_TELAFI_SAATI: false,
      KARAOKE_ODEME_MEKANDA: false,
    });
    expect(karaokeRescheduleFlags({ payment: { kind: "venue" } })).toEqual({
      KARAOKE_ODENDI: false,
      KARAOKE_TELAFI_SAATI: false,
      KARAOKE_ODEME_MEKANDA: true,
    });
    expect(
      karaokeRescheduleFlags({
        payment: { kind: "venue" },
        makeGoodHourFor: "krk-00041",
      }),
    ).toEqual({
      KARAOKE_ODENDI: false,
      KARAOKE_TELAFI_SAATI: true,
      KARAOKE_ODEME_MEKANDA: false,
    });
  });

  it("says the new evening beside the old one, with the booking's page", () => {
    const paid = render(
      karaokeRescheduleFlags({ payment: { kind: "online", paidMinor: 1 } }),
    );
    expect(paid.subject).toBe(
      "L'Affogato - Karaoke rezervasyonunun saati değişti",
    );
    for (const part of [paid.html, paid.text]) {
      expect(part).toContain("18 Ekim 2026");
      expect(part).toContain("21:00 - 23:00");
      expect(part).toContain("17 Ekim 2026");
      expect(part).toContain("20:00 - 22:00");
      expect(part).toContain("KRK-00042");
      expect(part).toContain("2.000,00 ₺");
      expect(part).toContain("Tam iade kuralı.");
      expect(part).not.toContain("köşkte yaparsın");
    }
    expect(paid.html).toContain(
      'href="https://laffogato.net/rezervasyon?t=abc"',
    );
    expect(paid.html).not.toContain("[KARAOKE_");
    expect(paid.text).not.toContain("[KARAOKE_");
    // Transactional: never a way out of a list.
    expect(paid.html).not.toMatch(/abonelik|cikis\?token/i);

    const venue = render(
      karaokeRescheduleFlags({ payment: { kind: "venue" } }),
    );
    for (const part of [venue.html, venue.text]) {
      expect(part).toContain("köşkte yaparsın");
      expect(part).not.toContain("2.000,00 ₺");
      expect(part).not.toContain("telafi");
    }
  });

  it("names the recounted last free moment, and never says the window follows the new hour", () => {
    // Since 28 Eki 2026 the window runs from the booking: moving the evening
    // does not carry it along with the start, so the mail names the moment.
    const paid = render(
      karaokeRescheduleFlags({ payment: { kind: "online", paidMinor: 1 } }),
    );
    expect(paid.html).toContain(
      "İptal kuralın değişmedi: Tam iade kuralı. Geç iptal kuralı. Son ücretsiz iptal: 16 Ekim 2026, 15:00.",
    );
    expect(paid.text).toContain(
      "İptal kuralın değişmedi:\nTam iade kuralı.\nGeç iptal kuralı.\nSon ücretsiz iptal: 16 Ekim 2026, 15:00.",
    );
    for (const part of [paid.html, paid.text]) {
      expect(part).not.toContain("yeni saate göre");
    }
    // Paid at the köşk, or a free hour: no refund rule, so no moment.
    for (const flags of [
      karaokeRescheduleFlags({ payment: { kind: "venue" } }),
      karaokeRescheduleFlags({
        payment: { kind: "venue" },
        makeGoodHourFor: "krk-00041",
      }),
    ]) {
      const other = render(flags);
      for (const part of [other.html, other.text]) {
        expect(part).not.toContain("Son ücretsiz iptal");
        expect(part).not.toContain("İptal kuralın değişmedi");
      }
    }
  });

  it("the panel's dialog says the moment is recounted by the booking's own rule and printed in the mail", () => {
    const src = readFileSync(
      "src/components/admin/karaoke-reschedule-dialog.tsx",
      "utf8",
    );
    expect(src).toContain(
      "ücretsiz iptalin son anı rezervasyonun yapıldığı kuralla yeniden hesaplanır",
    );
    expect(src).toContain("ve e-postada yazar.");
    expect(src).not.toContain("iptal süreleri yeni saate göre işler");
  });
});
