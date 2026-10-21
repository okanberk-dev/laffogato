import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two member mails of karaoke prepayment as they are actually rendered
 * (16 Eki 2026): the confirmation carries the receipt, the exact two-hour
 * wording and the booking's own page; the cancellation says what went back.
 * The panel's actions are tests/admin-karaoke-actions.test.ts.
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

const send = await import("@/lib/email/send");
const { KARAOKE_NO_REFUND_RULE, KARAOKE_REFUND_RULE } =
  await import("@/lib/mobile/karaoke-time");

beforeEach(() => {
  h.role = "manager";
  h.required.length = 0;
  for (const fn of [h.setStatus, h.cancel, h.retry, h.settle]) fn.mockReset();
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
