import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The panel side of karaoke prepayment, and the two member mails as they are
 * actually rendered (16 Eki 2026):
 * - an unpaid booking is never confirmed by hand, and the panel says why;
 * - cancelling sends the money back only for someone allowed to move money;
 * - the confirmation carries the receipt, the exact two-hour wording and the
 *   booking's own page; the cancellation says what went back.
 */

const h = vi.hoisted(() => ({
  role: "manager" as string,
  setStatus: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  settle: vi.fn(),
  required: [] as string[],
  sent: [] as Array<{ subject: string; html: string; text: string }>,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async (section: string) => {
    h.required.push(section);
    return { email: "yonetici@kosk", role: h.role, expiresAt: 0 };
  }),
}));
vi.mock("@/lib/mobile/karaoke", () => ({ setReservationStatus: h.setStatus }));
vi.mock("@/lib/mobile/karaoke-payment", () => ({
  cancelKaraokeReservation: h.cancel,
  retryKaraokeRefund: h.retry,
  settleKaraokeRefundByHand: h.settle,
}));
vi.mock("@/lib/admin/store", () => ({
  getSettings: async () => ({
    email: "kosk@example.com",
    karaokeNotifyEmail: "",
    emailFrom: "",
    emailReplyTo: "",
  }),
}));

const admin = await import("@/app/admin/mobil/karaoke/actions");
const send = await import("@/lib/email/send");
const { KARAOKE_NO_REFUND_RULE, KARAOKE_REFUND_RULE } =
  await import("@/lib/mobile/karaoke-time");

const form = (id: string) => {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
};

beforeEach(() => {
  h.role = "manager";
  h.required.length = 0;
  for (const fn of [h.setStatus, h.cancel, h.retry, h.settle]) fn.mockReset();
});

describe("panel actions", () => {
  it("Onayla on an unpaid booking is refused with the reason", async () => {
    h.setStatus.mockResolvedValue({ ok: false, reason: "payment_open" });
    const state = await admin.confirmReservationAction({}, form("krk-00042"));
    expect(state.error).toMatch(/ödemesi alınmadı/);
    expect(h.required).toEqual(["mobileApp"]);
  });

  it("refuses an id that is not a karaoke reference before touching anything", async () => {
    const state = await admin.cancelReservationAction({}, form("ord-1; drop"));
    expect(state.error).toBeTruthy();
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it("cancels as staff, with the refund right taken from the role", async () => {
    h.cancel.mockResolvedValue({
      ok: true,
      reservation: {},
      refunded: true,
      notified: true,
    });
    const state = await admin.cancelReservationAction({}, form("krk-00042"));
    expect(h.cancel).toHaveBeenCalledWith("krk-00042", {
      kind: "staff",
      actor: "yonetici@kosk",
      canRefund: true,
    });
    expect(state.message).toMatch(/iade edildi/);
    h.role = "staff";
    await admin.cancelReservationAction({}, form("krk-00042"));
    expect(h.cancel.mock.calls[1]![1]).toMatchObject({ canRefund: false });
  });

  it("says plainly when the refund needs someone else", async () => {
    h.cancel.mockResolvedValue({ ok: false, reason: "refund_forbidden" });
    expect(
      (await admin.cancelReservationAction({}, form("krk-00042"))).error,
    ).toMatch(/İade yetkisi/);
  });

  it("retrying or settling a refund needs the refunds permission", async () => {
    h.retry.mockResolvedValue({ ok: true, reservation: {}, refunded: true });
    h.settle.mockResolvedValue({ ok: true, reservation: {}, refunded: true });
    await admin.retryKaraokeRefundAction({}, form("krk-00042"));
    await admin.settleKaraokeRefundAction({}, form("krk-00042"));
    expect(h.required).toEqual(["refunds", "refunds"]);
  });
});

describe("the member's mails, rendered", () => {
  beforeEach(() => {
    h.sent.length = 0;
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        h.sent.push({
          subject: body.subject,
          html: body.html,
          text: body.text,
        });
        return new Response(JSON.stringify({ id: "1" }), { status: 200 });
      }),
    );
  });

  const BASE = {
    to: "eda@example.com",
    name: "Eda",
    date: "30 Ekim 2026",
    time: "20:00 - 22:00",
    guests: 4,
    code: "krk-00042",
    manageUrl: "https://laffogato.net/rezervasyon?t=krk-00042.1.sig",
  };

  it("a paid booking's confirmation is its receipt, with the exact rule and its page", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
    });
    const m = h.sent[0]!;
    for (const part of [m.html, m.text]) {
      expect(part).toContain(KARAOKE_REFUND_RULE);
      expect(part).toContain(KARAOKE_NO_REFUND_RULE);
      expect(part).toContain("cayma hakkı yoktur");
      expect(part).toMatch(/2\.000,00/);
    }
    expect(m.html).toContain(
      'href="https://laffogato.net/rezervasyon?t=krk-00042.1.sig"',
    );
    expect(m.text).toContain(
      "https://laffogato.net/rezervasyon?t=krk-00042.1.sig",
    );
    expect(m.html).not.toContain("uygulamadan iptal");
  });

  it("a cancellation says what went back to the card", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
      refundedMinor: 200_000,
    });
    const m = h.sent[0]!;
    expect(m.text).toMatch(/2\.000,00[\s\S]*iade edildi/);
    expect(m.text).not.toContain("senden ödeme alınmadı");
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      payment: { kind: "venue" },
    });
    expect(h.sent[1]!.text).toContain("senden ödeme alınmadı");
  });
});
