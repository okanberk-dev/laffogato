import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The karaoke mails under a booking's own cancellation rule (P2a): the
 * confirmation prints the two sentences the booking was shown, and the
 * cancellation says the amount that actually goes back - the whole payment,
 * or a late cancel's share, owed (refunded by hand, no date promised) or
 * refunded. Since 28 Eki 2026 (operator: "karaoke için 2 saat içinde iptal
 * etmezse iade olamaz") the window is counted from the booking: the
 * default's venue window and last free moment read so, and a booking paid
 * at the venue always names a window (`karaokeVenueCancelUntil` is never
 * null for a policy in range). A booking made under the default reads as
 * tests/karaoke-prepay-admin-mail.test.ts holds.
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

  it("a booking paid online under the default: the 28 Eki pair and its last free moment", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
      cancellation: {
        rules: [time.KARAOKE_REFUND_RULE, time.KARAOKE_NO_REFUND_RULE],
        venueUntil: time.karaokeVenueCancelUntil(
          time.DEFAULT_KARAOKE_CANCEL_POLICY,
        ),
        freeUntil: "28 Ekim 2026, 16:30",
      },
    });
    const m = h.sent[0]!;
    expect(m.text).toContain(time.KARAOKE_REFUND_RULE);
    expect(m.text).toContain(time.KARAOKE_NO_REFUND_RULE);
    expect(m.text).toContain("Son ücretsiz iptal: 28 Ekim 2026, 16:30.");
    for (const part of [m.html, m.text]) {
      expect(part).not.toContain("saatten fazla varken");
      expect(part).not.toContain("saatten az kala");
    }
  });

  it("no instant given: the default's last free moment is two hours after the booking", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "online", paidMinor: 200_000 },
    });
    const m = h.sent[0]!;
    expect(m.text).toContain(
      "Son ücretsiz iptal: rezervasyonu yaptıktan 2 saat sonra.",
    );
    expect(m.text).not.toContain("rezervasyon saatinden 2 saat önce");
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

  it("the default names the window counted from the booking", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "venue" },
    });
    const m = h.sent[0]!;
    expect(m.text).toContain(
      "Planın değişirse rezervasyonu yaptıktan sonraki 2 saat içinde",
    );
    expect(m.text).not.toContain("rezervasyon saatine 2 saatten fazla varken");
    expect(m.text).not.toContain("Planın değişirse bizi ara");
    // The same words the rule's helper gives a booking under the default.
    expect(
      time.karaokeVenueCancelUntil(time.DEFAULT_KARAOKE_CANCEL_POLICY),
    ).toBe("rezervasyonu yaptıktan sonraki 2 saat içinde");
  });

  it("a venue-paid booking always names a window now: venueUntil is never null", async () => {
    // Every window is at least an hour (KARAOKE_FREE_CANCEL_HOURS_MIN), so
    // no policy in range leaves the member with only the phone.
    for (const policy of [
      { freeCancelHours: 1, lateRefundPercent: 0 },
      { freeCancelHours: 72, lateRefundPercent: 0 },
      { freeCancelHours: 2, lateRefundPercent: 100 },
    ]) {
      const venueUntil = time.karaokeVenueCancelUntil(policy);
      expect(venueUntil).not.toBeNull();
      const cancellation = {
        rules: time.karaokeCancellationRules(policy).rules,
        venueUntil,
      };
      expect(
        send.karaokeConfirmationFlags({
          payment: { kind: "venue" },
          cancellation,
        }),
      ).toMatchObject({
        KARAOKE_ODEME_MEKANDA: true,
        KARAOKE_MEKAN_ARA: false,
      });
      h.sent.length = 0;
      await send.sendKaraokeConfirmationEmail({
        ...BASE,
        payment: { kind: "venue" },
        cancellation,
      });
      const m = h.sent[0]!;
      expect(m.text).toContain(`Planın değişirse ${venueUntil}`);
      expect(m.text).not.toContain("Planın değişirse bizi ara");
    }
    expect(
      time.karaokeVenueCancelUntil({ freeCancelHours: 1, lateRefundPercent: 0 }),
    ).toBe("rezervasyonu yaptıktan sonraki 1 saat içinde");
  });

  it("a null venueUntil still says to call: the mail keeps the branch for the caller", async () => {
    // No policy in range gives one (above); `karaokeConfirmationFlags`
    // still reads it from the caller, so the branch is held here.
    const cancellation = {
      rules: [time.KARAOKE_REFUND_RULE, time.KARAOKE_NO_REFUND_RULE] as const,
      venueUntil: null,
    };
    expect(
      send.karaokeConfirmationFlags({
        payment: { kind: "venue" },
        cancellation,
      }),
    ).toMatchObject({
      KARAOKE_ODEME_MEKANDA: false,
      KARAOKE_MEKAN_ARA: true,
    });
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "venue" },
      cancellation,
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
