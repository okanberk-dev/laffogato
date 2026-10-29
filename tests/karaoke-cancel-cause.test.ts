import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Why the köşk cancels a paid karaoke booking (ASK-OTH-3 (c), ASK-Y3-4 (c),
 * 19 Eki 2026) as the guest reads it: a business reason opens the mail with
 * the reason and an apology (the MSY m.16/4 written notice), a guest's
 * request taken by phone or e-mail opens with "İsteğin üzerine", an hour
 * given to another guest says so, and the member's own cancel keeps its old
 * words. A late request the rule refunds nothing for gets its own mail: the
 * booking stands. The staff's typed note is never an input of any of them.
 * Also the panel's two small rules: the 24-hour call hint and what an
 * evening that is over leaves to invoice (ASK-KAR-KDV).
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
const cause = await import("@/lib/mobile/karaoke-cancel-cause");
const panel = await import("@/lib/admin/karaoke-panel");

const BASE = {
  to: "eda@example.com",
  name: "Eda",
  date: "30 Ekim 2026",
  time: "20:00 - 22:00",
  guests: 4,
  code: "krk-00042",
  manageUrl: "https://laffogato.net/rezervasyon?t=krk-00042.1.sig",
  payment: { kind: "online" as const, paidMinor: 200_000 },
  cancellation: {
    rules: [time.KARAOKE_REFUND_RULE, time.KARAOKE_NO_REFUND_RULE] as const,
    venueUntil: null,
  },
};

/** The text half with its line breaks folded, and the HTML with tags gone. */
function both(m: { html: string; text: string }): string[] {
  const html = m.html
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
  return [html, m.text.replace(/\s+/g, " ")];
}

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

describe("the cancellation mail names why the köşk cancelled", () => {
  it.each([
    ["ariza", "odada teknik bir arıza oldu"],
    ["kapanis", "köşkü geçici olarak kapatmak zorunda kaldık"],
    ["mucbir", "elimizde olmayan bir sebep (mücbir sebep) çıktı"],
    ["diger", "işletmemizden kaynaklanan bir sebeple saatini karşılayamıyoruz"],
  ] as const)(
    "%s: the reason, an apology and the whole refund",
    async (code, why) => {
      await send.sendKaraokeCancellationEmail({
        ...BASE,
        refundedMinor: 200_000,
        refundIsShare: false,
        cancelCause: code,
      });
      for (const part of both(h.sent[0]!)) {
        expect(part).toContain(
          `Rezervasyonunu biz iptal etmek zorunda kaldık: ${why}. Özür dileriz.`,
        );
        expect(part).toContain(
          "Ödediğin ₺2.000,00 tutarın tamamını kartına iade ettik; yansıması bankana göre birkaç iş günü sürebilir.",
        );
        expect(part).not.toContain("Oda serbest bırakıldı");
        expect(part).not.toContain("İsteğin üzerine");
        expect(part).not.toMatch(/\[KARAOKE_/);
      }
    },
  );

  it("a guest's request inside the window: 'İsteğin üzerine' and the whole refund", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      refundedMinor: 200_000,
      refundIsShare: false,
      cancelCause: "misafir",
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain(
        "İsteğin üzerine karaoke rezervasyonunu iptal ettik.",
      );
      expect(part).toContain(
        "Ödediğin ₺2.000,00 tutarın tamamını kartına iade ettik",
      );
      expect(part).not.toContain("zorunda kaldık");
    }
  });

  it("the hour given to another guest says so", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      refundedMinor: 200_000,
      refundIsShare: false,
      cancelCause: "yeniden",
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain(
        "Rezervasyon saatini başka bir misafire verdiğimiz için ödediğin ₺2.000,00 tutarın tamamını kartına iade ettik; yansıması bankana göre birkaç iş günü sürebilir.",
      );
      expect(part).not.toContain("zorunda kaldık");
      expect(part).not.toContain("İsteğin üzerine");
    }
  });

  it("the member's own cancel keeps today's words", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      refundedMinor: 200_000,
      refundIsShare: false,
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain("Oda serbest bırakıldı.");
      expect(part).toContain("Ödediğin ₺2.000,00 kartına iade edildi");
      expect(part).not.toContain("iade ettik");
    }
  });

  it("prints exactly one opening and at most one money line, whatever the mix", () => {
    const OPENINGS = [
      "KARAOKE_IPTAL_GENEL",
      "KARAOKE_ISLETME",
      "KARAOKE_ISTEK",
      "KARAOKE_YENIDEN",
    ];
    const MONEY = [
      "KARAOKE_IADE",
      "KARAOKE_TAM_IADE",
      "KARAOKE_KISMI_IADE_EDILDI",
      "KARAOKE_KISMI_SATIS_IADE_EDILDI",
      "KARAOKE_SATIS_IADE",
      "KARAOKE_SATIS_IADE_EDILDI",
      "KARAOKE_KISMI_IADE",
      "KARAOKE_SATISA_ACILDI",
      "KARAOKE_ODEMESIZ",
    ];
    const money = [
      {},
      { refundedMinor: 200_000, refundIsShare: false },
      { refundedMinor: 100_000, refundIsShare: true },
      { refundOwedMinor: 100_000, refundIsShare: true },
      { releasedForResale: true },
      { refundedMinor: 100_000, refundIsShare: true, refundIsResaleOnly: true },
      {
        refundedMinor: 100_000,
        refundIsShare: true,
        refundIncludesResale: true,
      },
      { refundedMinor: 50_000, refundIsShare: true, refundIsResaleTopUp: true },
    ];
    for (const c of [undefined, ...cause.KARAOKE_CANCEL_CAUSES]) {
      for (const m of money) {
        for (const payment of [
          { kind: "online" as const, paidMinor: 200_000 },
          { kind: "venue" as const },
        ]) {
          const f = send.karaokeCancellationFlags({
            ...m,
            payment,
            cancelCause: c,
          });
          expect(OPENINGS.filter((k) => f[k])).toHaveLength(1);
          expect(MONEY.filter((k) => f[k]).length).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("a late request the rule refunds nothing for", () => {
  it("says the booking stands, with the booking's own late sentence", async () => {
    await send.sendKaraokeLateRequestEmail({ ...BASE });
    const m = h.sent[0]!;
    expect(m.subject).toBe("L'Affogato - Karaoke iptal isteğini aldık");
    for (const part of both(m)) {
      expect(part).toContain(
        `İptal isteğini aldık. ${time.KARAOKE_NO_REFUND_RULE} Bu yüzden rezervasyonun senin adına duruyor; gelemeyeceksen rezervasyon kodunu bir başkasına verebilirsin, odayı o kullanır. Kodunu kimseye vermeyeceksen bu e-postayı yanıtlayarak bize yaz; odayı o saat için başka bir misafire verirsek ödediğin tutarın tamamını kartına iade ederiz.`,
      );
      expect(part).not.toMatch(/\[KARAOKE_/);
      // Nothing was cancelled: no cancellation words.
      expect(part).not.toContain("iptal edildi");
    }
  });
});

describe("the confirmation names the last free moment (karaoke terms §7)", () => {
  it("prints the instant it is given", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      cancellation: { ...BASE.cancellation, freeUntil: "30 Ekim 2026, 18:00" },
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain("Son ücretsiz iptal: 30 Ekim 2026, 18:00.");
    }
  });
});

describe("the 24-hour call hint (karaoke terms §8)", () => {
  const R = {
    date: "2026-10-30",
    startHour: 20,
    contactPhone: "+905321234567",
  };
  const START = Date.parse("2026-10-30T17:00:00.000Z");
  const HOUR = 60 * 60_000;

  it("only under 24 hours before the start, and only with a phone", () => {
    expect(cause.needsCallHint(R, new Date(START - 23 * HOUR))).toBe(true);
    expect(cause.needsCallHint(R, new Date(START - 24 * HOUR))).toBe(false);
    expect(cause.needsCallHint(R, new Date(START - 30 * HOUR))).toBe(false);
    // The evening began: there is nobody left to warn before it.
    expect(cause.needsCallHint(R, new Date(START + HOUR))).toBe(false);
    // An app member's booking carries no phone.
    expect(
      cause.needsCallHint({ ...R, contactPhone: " " }, new Date(START - HOUR)),
    ).toBe(false);
    expect(
      cause.needsCallHint(
        { date: R.date, startHour: R.startHour },
        new Date(START - HOUR),
      ),
    ).toBe(false);
  });

  it("the staff note never has a field in the guest's mail", () => {
    const vars = Object.keys(
      send.karaokeCancellationFlags({ cancelCause: "ariza" }),
    );
    expect(vars.join(" ")).not.toMatch(/NOT|REASON/);
    expect(Object.values(cause.KARAOKE_CAUSE_MAIL)).toHaveLength(4);
  });
});

describe("what an evening that is over leaves to invoice (ASK-KAR-KDV)", () => {
  const OVER = new Date("2026-10-31T00:00:00.000Z"); // 03:00 in Tuzla
  const BEFORE = new Date("2026-10-30T12:00:00.000Z");
  const paid = {
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    status: "confirmed" as const,
    paymentStatus: "paid" as const,
    paidMinor: 200_000,
    totalMinor: 200_000,
  };

  it("nothing while the evening is still to come", () => {
    expect(panel.karaokeBillableMinor(paid, BEFORE)).toBeNull();
  });

  it("the whole payment for an evening sung (or not turned up to)", () => {
    expect(panel.karaokeBillableMinor(paid, OVER)).toBe(200_000);
  });

  it("the payment less what went back, and 0 for a full refund", () => {
    expect(
      panel.karaokeBillableMinor(
        {
          ...paid,
          status: "cancelled",
          paymentStatus: "refunded",
          refundMinor: 50_000,
        },
        OVER,
      ),
    ).toBe(150_000);
    expect(
      panel.karaokeBillableMinor(
        { ...paid, status: "cancelled", paymentStatus: "refunding" },
        OVER,
      ),
    ).toBe(0);
    expect(
      panel.karaokeBillableMinor(
        { ...paid, status: "cancelled", paymentStatus: "refunded" },
        OVER,
      ),
    ).toBe(0);
  });

  it("nothing for a hold nobody paid", () => {
    expect(
      panel.karaokeBillableMinor(
        { ...paid, status: "cancelled", paymentStatus: "expired" },
        OVER,
      ),
    ).toBeNull();
  });
});

describe("the dialog's İstek anı (a page left open does not date the call)", () => {
  // 15:00 Istanbul on the server when the page was drawn.
  const DRAWN = Date.parse("2026-10-30T12:00:00.000Z");
  const HOUR = 60 * 60_000;

  it("is now when the dialog opens, not when the page was drawn", () => {
    expect(cause.karaokeRequestDefault(DRAWN, DRAWN, DRAWN + 4 * HOUR)).toBe(
      "2026-10-30T19:00",
    );
    expect(cause.karaokeRequestDefault(DRAWN, DRAWN, DRAWN)).toBe(
      "2026-10-30T15:00",
    );
  });

  it("a wrong clock on the staff's machine does not move it", () => {
    const skewed = DRAWN - 2 * HOUR;
    expect(
      cause.karaokeRequestDefault(DRAWN, skewed, skewed + 4 * HOUR + 30_000),
    ).toBe("2026-10-30T19:00");
    // A clock that went back never dates the call before the draw.
    expect(cause.karaokeRequestDefault(DRAWN, skewed, skewed - HOUR)).toBe(
      "2026-10-30T15:00",
    );
  });

  it("the field is filled when the dialog opens, from that helper", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL(
        "../src/components/admin/karaoke-cancel-dialog.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(src).toMatch(
      /useState\(\(\) =>\s*karaokeRequestDefault\(p\.serverNow, p\.clientAtDraw, Date\.now\(\)\)/,
    );
    expect(src).toContain("defaultValue={requestNow}");
    expect(src).not.toMatch(/defaultValue=\{p\.now\}/);
  });
});
