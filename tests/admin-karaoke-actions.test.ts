import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The karaoke panel's Server Actions (/admin/mobil/karaoke, 17 Eki 2026).
 * Each is a public POST endpoint (CLAUDE.md rule 27), so each opens its own
 * role gate: the panel is `karaoke` (Personel included) and everything that
 * sends money back also needs `refunds`, checked on the server whatever the
 * page drew. Each answers with its own whole ActionResult, which the kit's
 * dialog shows: one dialog, one action, one answer.
 */

const h = vi.hoisted(() => ({
  role: "manager" as string,
  session: true,
  required: [] as string[],
  reservation: null as Record<string, unknown> | null,
  setStatus: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  settle: vi.fn(),
  listDate: vi.fn(),
  logAudit: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async (section: string) => {
    h.required.push(section);
    return { email: "kosk@laffogato", role: h.role, expiresAt: 0 };
  }),
  getAdminSession: vi.fn(async () =>
    h.session ? { email: "kosk@laffogato", role: h.role, expiresAt: 0 } : null,
  ),
}));
vi.mock("@/lib/mobile/karaoke", () => ({
  // An evening still to come unless a test names its own day.
  getReservation: vi.fn(async () =>
    h.reservation
      ? { date: "2099-06-20", startHour: 20, hours: 2, ...h.reservation }
      : null,
  ),
  listReservationsForDate: h.listDate,
  paymentStatusOf: (r: { paymentStatus?: string }) => r.paymentStatus ?? "none",
  setReservationStatus: h.setStatus,
}));
vi.mock("@/lib/mobile/karaoke-payment", () => ({
  cancelKaraokeReservation: h.cancel,
  retryKaraokeRefund: h.retry,
  settleKaraokeRefundByHand: h.settle,
}));

const admin = await import("@/app/admin/mobil/karaoke/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const ID = "krk-00042";
const member = { id: ID, guest: false };
const guest = { id: ID, guest: true };

beforeEach(() => {
  h.role = "manager";
  h.session = true;
  h.required.length = 0;
  h.reservation = { id: ID, status: "confirmed", paymentStatus: "paid" };
  for (const fn of [h.setStatus, h.cancel, h.retry, h.settle, h.listDate]) {
    fn.mockReset();
  }
  h.logAudit.mockClear();
});

describe("role gates, on the server", () => {
  it("every action opens the karaoke panel's gate first", async () => {
    h.setStatus.mockResolvedValue({ ok: false, reason: "not_found" });
    h.cancel.mockResolvedValue({ ok: false, reason: "not_found" });
    h.retry.mockResolvedValue({ ok: false, reason: "not_found" });
    h.settle.mockResolvedValue({ ok: false, reason: "not_found" });
    const why = { reason: "PayNkolay panelinde görüldü" };
    await admin.confirmReservationAction(null, form({ id: ID }));
    await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "iade", ...why }),
    );
    await admin.retryKaraokeRefundAction(null, form({ id: ID, ...why }));
    await admin.settleKaraokeRefundAction(null, form({ id: ID, ...why }));
    expect(h.required).toEqual(["karaoke", "karaoke", "karaoke", "karaoke"]);
  });

  it("Personel confirms and cancels an unpaid booking", async () => {
    h.role = "staff";
    h.reservation = { id: ID, status: "requested", paymentStatus: "none" };
    h.setStatus.mockResolvedValue({
      ok: true,
      reservation: { ...member, date: "2026-10-17", startHour: 20 },
      notified: true,
    });
    const confirmed = await admin.confirmReservationAction(
      null,
      form({ id: ID }),
    );
    expect(confirmed.ok).toBe(true);

    h.cancel.mockResolvedValue({
      ok: true,
      reservation: member,
      refunded: false,
      notified: true,
    });
    const cancelled = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "odenmemis" }),
    );
    expect(cancelled.ok).toBe(true);
    expect(h.cancel).toHaveBeenCalledWith(ID, {
      kind: "staff",
      actor: "kosk@laffogato",
      canRefund: false,
    });
  });

  it("Personel cannot send money back, whatever the page drew", async () => {
    h.role = "staff";
    const why = { reason: "Müşteri aradı" };
    const cancel = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "iade", ...why }),
    );
    const retry = await admin.retryKaraokeRefundAction(
      null,
      form({ id: ID, ...why }),
    );
    const settle = await admin.settleKaraokeRefundAction(
      null,
      form({ id: ID, ...why }),
    );
    for (const res of [cancel, retry, settle]) {
      expect(res.ok).toBe(false);
      expect(!res.ok && res.error).toMatch(/sahip ya da yönetici/);
    }
    expect(h.cancel).not.toHaveBeenCalled();
    expect(h.retry).not.toHaveBeenCalled();
    expect(h.settle).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a karaoke reference before touching anything", async () => {
    const res = await admin.cancelReservationAction(
      null,
      form({ id: "ord-1; drop" }),
    );
    expect(res.ok).toBe(false);
    expect(h.cancel).not.toHaveBeenCalled();
  });
});

describe("each action answers for itself (stale message bug)", () => {
  it("a failed Onayla never colours the next İptal", async () => {
    h.setStatus.mockResolvedValue({ ok: false, reason: "slot_taken" });
    const first = await admin.confirmReservationAction(null, form({ id: ID }));
    expect(first).toMatchObject({ ok: false });

    h.reservation = { id: ID, status: "requested", paymentStatus: "none" };
    h.cancel.mockResolvedValue({
      ok: true,
      reservation: member,
      refunded: false,
      notified: true,
    });
    // The previous answer is passed in, as useActionState does; the new one
    // is whole and its own.
    const second = await admin.cancelReservationAction(
      first,
      form({ id: ID, beklenen: "odenmemis" }),
    );
    expect(second).toEqual({
      ok: true,
      message: "Rezervasyon iptal edildi. Üyeye e-posta gönderildi.",
      tone: "success",
    });
  });
});

describe("the mail sentence is the real answer", () => {
  it("says GÖNDERİLEMEDİ, and keeps the toast up, when the mail did not leave", async () => {
    h.retry.mockResolvedValue({
      ok: true,
      reservation: member,
      refunded: true,
      notified: false,
    });
    const res = await admin.retryKaraokeRefundAction(
      null,
      form({ id: ID, reason: "İlk iade yanıtsız kaldı" }),
    );
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toMatch(
      /^İade yapıldı\. E-posta GÖNDERİLEMEDİ/,
    );
  });

  it("names the right person: a guest is a customer, not a member", async () => {
    h.settle.mockResolvedValue({
      ok: true,
      reservation: guest,
      refunded: true,
      notified: true,
    });
    const res = await admin.settleKaraokeRefundAction(
      null,
      form({ id: ID, reason: "PayNkolay panelinde 21:10 iadesi" }),
    );
    expect(res).toEqual({
      ok: true,
      message: "İade kaydedildi. Müşteriye e-posta gönderildi.",
      tone: "success",
    });
  });

  it("the confirm says what notifyReservationStatus said", async () => {
    h.reservation = { id: ID, status: "requested", paymentStatus: "paid" };
    h.setStatus.mockResolvedValue({
      ok: true,
      reservation: { ...member, date: "2026-10-17", startHour: 20 },
      notified: false,
    });
    const res = await admin.confirmReservationAction(null, form({ id: ID }));
    expect(res.ok && res.message).toContain("GÖNDERİLEMEDİ");
  });
});

describe("money moves only behind a reason", () => {
  it("a refund retry without a reason is refused and the POS is not asked", async () => {
    const res = await admin.retryKaraokeRefundAction(null, form({ id: ID }));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.fieldErrors?.reason).toMatch(/nedenini yaz/);
    expect(h.retry).not.toHaveBeenCalled();
  });

  it("the reason goes with the retry and the settle, into their audit rows", async () => {
    h.retry.mockResolvedValue({
      ok: false,
      reason: "unknown",
      message: "zaman aşımı",
    });
    h.settle.mockResolvedValue({ ok: false, reason: "raced" });
    await admin.retryKaraokeRefundAction(
      null,
      form({ id: ID, reason: "  İlk iade yanıtsız  " }),
    );
    expect(h.retry).toHaveBeenCalledWith(ID, "kosk@laffogato", undefined, {
      reason: "İlk iade yanıtsız",
    });
    const settled = await admin.settleKaraokeRefundAction(
      null,
      form({ id: ID, reason: "Panelde görüldü" }),
    );
    // A lost race recorded nothing, and the sentence must not say otherwise.
    expect(!settled.ok && settled.error).toMatch(/iade kaydedilmedi/);
    expect(!settled.ok && settled.error).not.toMatch(/kaydedildi\./);
  });

  it("the refund cancel needs a reason; an unpaid one does not", async () => {
    const res = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "iade" }),
    );
    expect(!res.ok && res.fieldErrors?.reason).toBeTruthy();
    expect(h.cancel).not.toHaveBeenCalled();

    h.cancel.mockResolvedValue({
      ok: true,
      reservation: member,
      refunded: true,
      notified: true,
    });
    const ok = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "iade", neden: "ariza", reason: "Oda arızalı" }),
    );
    expect(ok.ok && ok.message).toMatch(/karta iade edildi/);
    expect(h.cancel).toHaveBeenCalledWith(ID, {
      kind: "staff",
      actor: "kosk@laffogato",
      canRefund: true,
      reason: "Oda arızalı",
      cause: "ariza",
    });
  });

  it("an over-long reason is refused with its own message", async () => {
    const res = await admin.retryKaraokeRefundAction(
      null,
      form({ id: ID, reason: "x".repeat(501) }),
    );
    expect(!res.ok && res.fieldErrors?.reason).toMatch(/500/);
  });
});

describe("an unpaid cancel never turns into a refund nobody confirmed", () => {
  it("stops when the booking was paid while the dialog was open", async () => {
    h.reservation = { id: ID, status: "requested", paymentStatus: "paid" };
    const res = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "odenmemis" }),
    );
    expect(!res.ok && res.error).toMatch(/ödemesi bu arada geldi/);
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it("tells Personel who can cancel it, not to use a refund they cannot reach", async () => {
    h.role = "staff";
    h.reservation = { id: ID, status: "requested", paymentStatus: "paid" };
    const res = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "odenmemis" }),
    );
    expect(!res.ok && res.error).toMatch(/sahip ya da yönetici/);
    expect(!res.ok && res.error).not.toMatch(/İptal et ve iade et/);
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it("stops when the POS says the hold was paid after all", async () => {
    h.reservation = { id: ID, status: "requested", paymentStatus: "pending" };
    h.cancel.mockResolvedValue({ ok: false, reason: "refund_forbidden" });
    const res = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "odenmemis" }),
    );
    expect(h.cancel.mock.calls[0]![1]).toMatchObject({ canRefund: false });
    expect(!res.ok && res.error).toMatch(/ödemesi bu arada geldi/);
  });
});

describe("Onayla on a booking whose money is not in", () => {
  it("an old pay-at-the-venue request: explains, and points at cancelling", async () => {
    h.reservation = { id: ID, status: "requested", paymentStatus: "none" };
    h.setStatus.mockResolvedValue({ ok: false, reason: "payment_open" });
    const res = await admin.confirmReservationAction(null, form({ id: ID }));
    expect(!res.ok && res.error).toMatch(/ön ödeme açılmadan önce/);
    expect(!res.ok && res.error).toMatch(/iptal et/);
    expect(!res.ok && res.error).not.toMatch(/kendiliğinden/);
  });

  it("a paid request whose refund started meanwhile is not called unpaid", async () => {
    h.reservation = { id: ID, status: "requested", paymentStatus: "refunding" };
    h.setStatus.mockResolvedValue({ ok: false, reason: "payment_open" });
    const res = await admin.confirmReservationAction(null, form({ id: ID }));
    expect(!res.ok && res.error).toMatch(/iadesi bu arada başladı/);
    expect(!res.ok && res.error).not.toMatch(/ödemesi alınmadı/);
  });

  it("an unpaid hold: the payment confirms it, nobody else", async () => {
    h.reservation = { id: ID, status: "requested", paymentStatus: "pending" };
    h.setStatus.mockResolvedValue({ ok: false, reason: "payment_open" });
    const res = await admin.confirmReservationAction(null, form({ id: ID }));
    expect(!res.ok && res.error).toMatch(/kendiliğinden onaylanır/);
  });
});

describe("an evening that is over (karar D7)", () => {
  const past = { date: "2026-10-10", startHour: 20, hours: 2 };

  it("Onayla is refused on the server too, before any status change or mail", async () => {
    h.reservation = {
      id: ID,
      status: "requested",
      paymentStatus: "paid",
      ...past,
    };
    const res = await admin.confirmReservationAction(null, form({ id: ID }));
    expect(!res.ok && res.error).toMatch(/saati geçti/);
    expect(h.setStatus).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("an unknown booking is not found, not 'over'", async () => {
    h.reservation = null;
    const res = await admin.confirmReservationAction(null, form({ id: ID }));
    expect(!res.ok && res.error).toMatch(/bulunamadı/);
    expect(h.setStatus).not.toHaveBeenCalled();
  });

  it("a written-off pay-at-the-venue evening says no mail went", async () => {
    h.reservation = {
      id: ID,
      status: "confirmed",
      paymentStatus: "none",
      ...past,
    };
    h.cancel.mockResolvedValue({
      ok: true,
      reservation: member,
      refunded: false,
      notified: true,
      silent: true,
    });
    const res = await admin.cancelReservationAction(
      null,
      form({ id: ID, beklenen: "odenmemis" }),
    );
    expect(res).toEqual({
      ok: true,
      message:
        "Rezervasyon iptal edildi. Saati geçtiği için müşteriye e-posta gönderilmedi.",
      tone: "success",
    });
  });
});

describe("the nav badge count", () => {
  it("counts today's bookings that still stand", async () => {
    h.listDate.mockResolvedValue([
      { status: "confirmed" },
      { status: "requested" },
      { status: "cancelled" },
    ]);
    expect(await admin.karaokeTodayCountAction()).toBe(2);
  });

  it("answers null, without reading, for a role without the panel or no session", async () => {
    h.role = "cashier";
    expect(await admin.karaokeTodayCountAction()).toBeNull();
    h.role = "staff";
    h.session = false;
    expect(await admin.karaokeTodayCountAction()).toBeNull();
    expect(h.listDate).not.toHaveBeenCalled();
  });

  it("never throws: a failed read draws no badge", async () => {
    h.listDate.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await admin.karaokeTodayCountAction()).toBeNull();
    spy.mockRestore();
  });
});

describe("a paid booking's cancel names its reason (ASK-OTH-3 (c), ASK-Y3-4 (c))", () => {
  const paidForm = (extra: Record<string, string>) =>
    form({ id: ID, beklenen: "iade", reason: "Kayıt notu", ...extra });
  const NOW = Date.parse("2026-10-30T12:00:30.000Z"); // 15:00:30 in Tuzla

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    h.reservation = {
      id: ID,
      status: "confirmed",
      paymentStatus: "paid",
      date: "2026-10-30",
      startHour: 20,
      createdAt: "2026-10-20T09:00:40.000Z",
    };
    h.cancel.mockResolvedValue({
      ok: true,
      reservation: member,
      refunded: true,
      notified: true,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses a cancel without a code, or with one off the list, before any money moves", async () => {
    for (const extra of [{}, { neden: "canim-istedi" }] as Array<
      Record<string, string>
    >) {
      const res = await admin.cancelReservationAction(null, paidForm(extra));
      expect(!res.ok && res.fieldErrors?.neden).toBe(
        "İptal nedenini listeden seç.",
      );
    }
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it.each(["ariza", "kapanis", "mucbir", "diger", "yeniden"])(
    "%s goes through as a full refund with its code",
    async (code) => {
      await admin.cancelReservationAction(null, paidForm({ neden: code }));
      expect(h.cancel).toHaveBeenCalledWith(ID, {
        kind: "staff",
        actor: "kosk@laffogato",
        canRefund: true,
        reason: "Kayıt notu",
        cause: code,
      });
    },
  );

  it("a guest's request needs its channel", async () => {
    const res = await admin.cancelReservationAction(
      null,
      paidForm({ neden: "misafir" }),
    );
    expect(!res.ok && res.fieldErrors?.kanal).toMatch(/Telefon ya da e-posta/);
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it("takes the request's instant on the köşk's clock, and now when left empty", async () => {
    await admin.cancelReservationAction(
      null,
      paidForm({
        neden: "misafir",
        kanal: "telefon",
        istekAni: "2026-10-30T14:05",
      }),
    );
    expect(h.cancel).toHaveBeenLastCalledWith(ID, {
      kind: "staff",
      actor: "kosk@laffogato",
      canRefund: true,
      reason: "Kayıt notu",
      cause: "misafir",
      channel: "telefon",
      requestedAt: new Date("2026-10-30T11:05:00.000Z"),
      fullRefund: false,
    });
    await admin.cancelReservationAction(
      null,
      paidForm({
        neden: "misafir",
        kanal: "e-posta",
        istekAni: "",
        tamIade: "on",
      }),
    );
    expect(h.cancel).toHaveBeenLastCalledWith(
      ID,
      expect.objectContaining({
        channel: "e-posta",
        requestedAt: new Date(NOW),
        fullRefund: true,
      }),
    );
  });

  it("refuses an instant ahead of now or before the booking was made", async () => {
    const ahead = await admin.cancelReservationAction(
      null,
      paidForm({
        neden: "misafir",
        kanal: "telefon",
        istekAni: "2026-10-30T15:01",
      }),
    );
    expect(!ahead.ok && ahead.fieldErrors?.istekAni).toBe(
      "İstek anı ileri bir saat olamaz.",
    );
    const before = await admin.cancelReservationAction(
      null,
      paidForm({
        neden: "misafir",
        kanal: "telefon",
        istekAni: "2026-10-20T11:59",
      }),
    );
    expect(!before.ok && before.fieldErrors?.istekAni).toBe(
      "İstek anı rezervasyonun yapıldığı andan önce olamaz.",
    );
    const junk = await admin.cancelReservationAction(
      null,
      paidForm({ neden: "misafir", kanal: "telefon", istekAni: "dün akşam" }),
    );
    expect(!junk.ok && junk.fieldErrors?.istekAni).toBeTruthy();
    expect(h.cancel).not.toHaveBeenCalled();
    // The current minute and the minute of booking are both fine.
    for (const istekAni of ["2026-10-30T15:00", "2026-10-20T12:00"]) {
      const ok = await admin.cancelReservationAction(
        null,
        paidForm({ neden: "misafir", kanal: "telefon", istekAni }),
      );
      expect(ok.ok).toBe(true);
    }
  });

  it("a late request that leaves the booking standing says so", async () => {
    h.cancel.mockResolvedValue({
      ok: true,
      reservation: member,
      refunded: false,
      notified: true,
      kept: true,
    });
    const res = await admin.cancelReservationAction(
      null,
      paidForm({ neden: "misafir", kanal: "telefon" }),
    );
    expect(res.ok && res.message).toMatch(
      /^İstek kaydedildi\..*rezervasyon iptal edilmedi, misafirin adına duruyor\. Üyeye e-posta gönderildi\.$/,
    );
  });

  it("under 24 hours a business cancel says to call, when a phone is on the booking", async () => {
    h.reservation = { ...h.reservation!, contactPhone: "+905321234567" };
    const res = await admin.cancelReservationAction(
      null,
      paidForm({ neden: "ariza" }),
    );
    expect(res.ok && res.message).toMatch(
      /Rezervasyona 24 saatten az kaldı: misafiri ara\.$/,
    );
    // A guest's own request needs no call.
    const asked = await admin.cancelReservationAction(
      null,
      paidForm({ neden: "misafir", kanal: "telefon" }),
    );
    expect(asked.ok && asked.message).not.toMatch(/misafiri ara/);
    // No phone (an app booking): nothing to call.
    h.reservation = { ...h.reservation!, contactPhone: "" };
    const app = await admin.cancelReservationAction(
      null,
      paidForm({ neden: "kapanis" }),
    );
    expect(app.ok && app.message).not.toMatch(/misafiri ara/);
  });
});
