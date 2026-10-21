import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The karaoke mails under a booking's own cancellation rule (P2a): the
 * confirmation prints the two sentences the booking was shown, and the
 * cancellation says the amount that actually goes back - the whole payment,
 * or a late cancel's share, owed (refunded by hand, no date promised) or
 * refunded. A booking made under the default reads exactly as before
 * (tests/karaoke-prepay-admin-mail.test.ts).
 */

const h = vi.hoisted(() => ({
  sent: [] as Array<{ subject: string; html: string; text: string }>,
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
const time = await import("@/lib/mobile/karaoke-time");

const BASE = {
  to: "eda@example.com",
  name: "Eda",
  date: "30 Ekim 2026",
  time: "20:00 - 22:00",
  guests: 4,
  code: "krk-00042",
  manageUrl: "https://laffogato.net/rezervasyon?t=krk-00042.1.sig",
};

const HALF = { freeCancelHours: 24, lateRefundPercent: 50 };

beforeEach(() => {
  h.sent.length = 0;
  process.env.RESEND_API_KEY = "re_test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      h.sent.push({ subject: body.subject, html: body.html, text: body.text });
      return new Response(JSON.stringify({ id: "1" }), { status: 200 });
    }),
  );
});

describe("the confirmation prints the booking's own rule", () => {
  it("a booking made under 24 h / 50 %: its sentences, not the default", async () => {
    const rules = time.karaokeCancellationRules(HALF).rules;
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
      cancellation: { rules, venueUntil: time.karaokeVenueCancelUntil(HALF) },
    });
    const m = h.sent[0]!;
    expect(m.text).toContain(rules[0]);
    expect(m.text).toContain(rules[1]);
    expect(m.html).toContain(
      "ödediğin tutarın %50&#39;si en geç 14 gün içinde kartına iade edilir",
    );
    for (const part of [m.html, m.text]) {
      expect(part).not.toContain(time.KARAOKE_NO_REFUND_RULE);
      expect(part).not.toMatch(/\[KARAOKE_/);
    }
  });

  it("a venue-paid booking says until when it can be cancelled", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "venue" },
      cancellation: {
        rules: time.karaokeCancellationRules(HALF).rules,
        venueUntil: time.karaokeVenueCancelUntil(HALF),
      },
    });
    expect(h.sent[0]!.text).toContain(
      "Planın değişirse rezervasyon saatinden önce",
    );
  });

  it("the default reads as it always did", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "venue" },
    });
    expect(h.sent[0]!.text).toContain(
      "Planın değişirse rezervasyon saatine 2 saatten fazla varken",
    );
  });

  it("a rule no member can cancel under says to call", async () => {
    // No policy is such a rule since 0 hours means free until the start
    // (ASK-OTH-3-CFG); the mail keeps the branch for a null `venueUntil`.
    const none = { freeCancelHours: 0, lateRefundPercent: 0 };
    expect(time.karaokeVenueCancelUntil(none)).toBe(
      "rezervasyon saatinden önce",
    );
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "venue" },
      cancellation: {
        rules: time.karaokeCancellationRules(none).rules,
        venueUntil: null,
      },
    });
    const m = h.sent[0]!;
    expect(m.text).toContain("Planın değişirse bizi ara");
    expect(m.text).not.toContain("iptal edebilirsin");
    expect(m.html).toContain("Planın değişirse bizi ara");
  });
});

describe("the cancellation says the amount that goes back", () => {
  it("a late cancel's owed share: the amount, without a date", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
      refundOwedMinor: 100_000,
      refundIsShare: true,
    });
    const m = h.sent[0]!;
    for (const part of [m.html, m.text]) {
      expect(part).toMatch(/geç iptal kuralına göre[\s\S]*1\.000,00/);
      expect(part).toContain("kartına iade edilir");
      expect(part).not.toContain("iade edildi");
      expect(part).not.toContain("2.000,00");
      expect(part).not.toContain("senden ödeme alınmadı");
    }
  });

  it("the share once refunded by hand", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
      refundedMinor: 100_000,
      refundIsShare: true,
    });
    const m = h.sent[0]!;
    expect(m.text).toMatch(
      /geç iptal kuralına göre ₺1\.000,00[\s\S]*iade edildi/,
    );
    expect(m.text).not.toContain("Ödediğin");
  });

  it("the whole payment, as before", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
      refundedMinor: 200_000,
    });
    const m = h.sent[0]!;
    expect(m.text).toMatch(/Ödediğin .*2\.000,00 kartına iade edildi/);
    expect(m.text).not.toContain("geç iptal kuralına göre");
  });
});
