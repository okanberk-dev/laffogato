import { describe, expect, it } from "vitest";

import {
  buildDeletionStaffNotice,
  deletionDayLabel,
  deletionDeadline,
  deletionMailKey,
  deletionRequestOf,
  DELETION_REASON_MAX,
  isDeletionOverdue,
  maskedAddress,
  normalizeDeletionReason,
  paidKaraokeAtRequest,
} from "@/lib/customer/deletion-request-core";
import { renderEmail } from "@/lib/email/render";
import { EMAIL_TEMPLATES } from "@/lib/email/templates.generated";
import { EMAIL_TEXT } from "@/lib/email/text";

/**
 * The rules and words of the web deletion request (18 Eki 2026): what the
 * row holds, the thirty days KVKK m.13/2 gives, the reason's cap, and what
 * the team's and the member's mails say.
 */

const AT = "2026-10-18T09:15:00.000Z";

const flat = (s: string) => s.replace(/\s+/g, " ");

describe("the request on the row", () => {
  it("reads an ISO stamp as a request and anything else as none", () => {
    expect(
      deletionRequestOf({ deletionRequestedAt: AT, deletionReason: "x" }),
    ).toEqual({ requestedAt: AT, reason: "x" });
    expect(deletionRequestOf({ deletionRequestedAt: AT })).toEqual({
      requestedAt: AT,
      reason: "",
    });
    for (const at of [null, undefined, "", "dün", 42]) {
      expect(deletionRequestOf({ deletionRequestedAt: at })).toBeNull();
    }
  });
});

describe("the reason box", () => {
  it("folds whitespace and drops control characters", () => {
    expect(normalizeDeletionReason("  Bir\n\n iki\t üç ")).toEqual({
      ok: true,
      reason: "Bir iki üç",
    });
    expect(normalizeDeletionReason("a\u0000b\u0007c")).toEqual({
      ok: true,
      reason: "abc",
    });
    expect(normalizeDeletionReason(null)).toEqual({ ok: true, reason: "" });
  });

  it("refuses past the cap, and the cap itself is fine", () => {
    expect(DELETION_REASON_MAX).toBe(500);
    expect(normalizeDeletionReason("a".repeat(500)).ok).toBe(true);
    const over = normalizeDeletionReason("a".repeat(501));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain("501");
  });
});

describe("the thirty days", () => {
  it("ends thirty days after the request, on the köşk's calendar", () => {
    expect(deletionDeadline(AT)).toBe("2026-11-17T09:15:00.000Z");
    // 01:30 in Istanbul on the 18th is still the 17th in UTC (rule 22).
    expect(deletionDayLabel("2026-10-17T22:30:00.000Z")).toBe("18 Ekim 2026");
  });

  it("is overdue only once the thirty days are past", () => {
    expect(isDeletionOverdue(AT, new Date("2026-11-17T09:14:00.000Z"))).toBe(
      false,
    );
    expect(isDeletionOverdue(AT, new Date("2026-11-17T09:16:00.000Z"))).toBe(
      true,
    );
  });
});

describe("the team's mail", () => {
  const input = {
    kind: "opened" as const,
    customerId: "cus-0042",
    name: "Eda Yılmaz",
    email: "eda.yilmaz@example.com",
    requestedAt: AT,
    hasReason: true,
  };

  it("names the member by number, first name and a masked address", () => {
    const n = buildDeletionStaffNotice(input);
    const all = JSON.stringify(n);
    expect(all).toContain("cus-0042");
    expect(all).toContain("Eda");
    expect(all).not.toContain("Yılmaz");
    expect(all).not.toContain("eda.yilmaz@example.com");
    expect(all).toContain(maskedAddress(input.email));
    expect(maskedAddress(input.email)).toBe("e***@example.com");
    expect(n.subject).toContain("son gün 17 Kasım 2026");
    // Whether a reason was written - never the words themselves.
    expect(n.rows).toContainEqual({
      label: "Gerekçe",
      value: "Yazdı, panelde",
    });
  });

  it("says a withdrawn request is not to be acted on", () => {
    const n = buildDeletionStaffNotice({ ...input, kind: "withdrawn" });
    expect(n.title).toBe("Silme talebi geri alındı");
    expect(n.footnote).toContain("Bu hesabı silme");
  });

  it("lists paid karaoke by its start and its refund, five at most", () => {
    const item = (i: number, refundPercent = 100) => ({
      id: `krk-0000${i}`,
      label: `${20 + i} Ekim 2026, 20:00 - 22:00`,
      refundPercent,
      startedSinceRequest: false,
    });
    const n = buildDeletionStaffNotice({
      ...input,
      karaoke: [item(1), item(2, 50), item(3), item(4), item(5), item(6)],
    });
    const karaoke = n.rows.filter((r) => r.label === "Ödenmiş karaoke");
    expect(karaoke[0].value).toBe("21 Ekim 2026, 20:00 - 22:00 (tam iade)");
    expect(karaoke[1].value).toBe("22 Ekim 2026, 20:00 - 22:00 (%50 iade)");
    expect(karaoke).toHaveLength(6);
    expect(karaoke[5].value).toBe("1 rezervasyon daha, panelde");
    expect(n.footnote).toContain("ilk rezervasyonun başlangıç saatinden önce");
    // A request taken back has no clock to race.
    const back = buildDeletionStaffNotice({
      ...input,
      kind: "withdrawn",
      karaoke: [item(1)],
    });
    expect(JSON.stringify(back)).not.toContain("karaoke");
  });

  it("keys each mail of one request once", () => {
    expect(deletionMailKey("cus-1", AT, "member")).toBe(
      `account-deletion-cus-1-${Date.parse(AT)}-member`,
    );
    expect(deletionMailKey("cus-1", AT, "staff-opened")).not.toBe(
      deletionMailKey("cus-1", AT, "staff-withdrawn"),
    );
  });
});

describe("paid karaoke on the request", () => {
  // Asked at 12:15 on 16 Ekim; read at 15:00 on 18 Ekim (Tuzla).
  const ASKED = "2026-10-16T09:15:00.000Z";
  const NOW = new Date("2026-10-18T12:00:00.000Z");
  const row = (over: Record<string, unknown>) => ({
    id: "krk-00001",
    date: "2026-10-17",
    startHour: 20,
    hours: 2,
    status: "confirmed",
    paymentStatus: "paid",
    createdAt: "2026-10-10T09:00:00.000Z",
    ...over,
  });

  it("judges a booking made after the request at the closure, not at its making", () => {
    const items = paidKaraokeAtRequest(
      [
        // Booked before the request, sung since: the closing dialog asks.
        row({ id: "krk-00001" }),
        // Booked after the request in its free window, sung since: the
        // request never covered it, the closure refunds nothing.
        row({ id: "krk-00002", createdAt: "2026-10-17T08:00:00.000Z" }),
        // Booked after the request, still to come: refunded as a closure
        // now refunds it.
        row({
          id: "krk-00003",
          date: "2026-10-25",
          createdAt: "2026-10-17T08:00:00.000Z",
        }),
      ],
      ASKED,
      NOW,
    );
    expect(
      items.map((k) => [k.id, k.refundPercent, k.startedSinceRequest]),
    ).toEqual([
      ["krk-00001", 100, true],
      ["krk-00003", 100, false],
    ]);
  });
});

describe("the member's two mails", () => {
  it("are transactional: no unsubscribe link (rule 19)", () => {
    expect(EMAIL_TEMPLATES["hesap-silme-talebi"].commercial).toBe(false);
    expect(EMAIL_TEMPLATES["hesap-silindi"].commercial).toBe(false);
  });

  it("the receipt names the day, the deadline and the way back", () => {
    const r = renderEmail("hesap-silme-talebi", {
      vars: {
        TALEP_TARIHI: "18 Ekim 2026",
        SON_GUN: "17 Kasım 2026",
        TALEP_URL: "https://laffogato.net/uye/hesap/sil",
      },
      text: EMAIL_TEXT["hesap-silme-talebi"],
    });
    expect(r.subject).toBe("L'Affogato - hesap silme talebin alındı");
    // The text twin is wrapped; read both halves as running text.
    for (const half of [r.html, r.text].map(flat)) {
      expect(half).toContain("17 Kasım 2026");
      expect(half).toContain("https://laffogato.net/uye/hesap/sil");
      expect(half).toContain("geri al");
      expect(half).toContain("saklama süresi");
    }
  });

  it("says 'silindi' only when nothing of the sign-in identity is left", () => {
    const render = (complete: boolean) =>
      renderEmail("hesap-silindi", {
        vars: {
          SONUC: complete ? "hesabın silindi" : "hesabın kapatıldı",
          SONUC_BASLIK: complete ? "Hesabın silindi" : "Hesabın kapatıldı",
          PROSEDUR_URL: "https://laffogato.net/hukuk/hesap-silme",
        },
        flags: { KIMLIK_KALDI: !complete },
        text: EMAIL_TEXT["hesap-silindi"],
      });
    const done = render(true);
    expect(done.subject).toBe("L'Affogato - hesabın silindi");
    expect(flat(done.html)).not.toContain("bu adımda silinemedi");
    expect(flat(done.text)).not.toContain("bu adımda silinemedi");
    const left = render(false);
    expect(left.subject).toBe("L'Affogato - hesabın kapatıldı");
    expect(flat(left.html)).toContain("bu adımda silinemedi");
    expect(flat(left.text)).toContain("bu adımda silinemedi");
    expect(left.html).not.toContain("Hesabın silindi");
  });
});
