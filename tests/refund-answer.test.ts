import { describe, expect, it } from "vitest";

import {
  isAlreadyReversed,
  refundAnswerForStaff,
} from "@/lib/payment/refund-answer";

/**
 * A refund the POS refuses reaches the operator in plain words, never as
 * PayNkolay's own text ("paynkolay refund reddedildi: responseCode=0 Bu
 * kayıt daha önce iptal edilmiştir..!", 17 and 22 Eki 2026 logs).
 */

const ALREADY =
  "paynkolay refund reddedildi: responseCode=0 Bu kayıt daha önce iptal edilmiştir..!";

describe("refundAnswerForStaff", () => {
  it("says an already reversed payment in words", () => {
    expect(isAlreadyReversed(ALREADY)).toBe(true);
    expect(isAlreadyReversed("... daha önce iade edilmiştir")).toBe(true);
    const text = refundAnswerForStaff(ALREADY);
    expect(text).toBe(
      "PayNkolay bu ödemenin daha önce iptal ya da iade edildiğini söylüyor; para ikinci kez gönderilmedi",
    );
  });

  it("keeps the known cases and drops the rest", () => {
    expect(
      refundAnswerForStaff(
        "paynkolay: kısmi iade desteklenmiyor (docs/PAYNKOLAY.md §3.2); işlem tutarı 1000 kuruş, istenen 500 kuruş",
      ),
    ).toMatch(/^PayNkolay kısmi iade yapamıyor/);
    expect(
      refundAnswerForStaff(
        "Bu ödemenin iadesi zaten başlatılmış; sonucu bekleniyor.",
      ),
    ).toMatch(/zaten başlatılmış/);
    expect(
      refundAnswerForStaff("Ödeme sağlayıcısı kurulamadı (PAYNKOLAY_SX yok)"),
    ).toBe("ödeme sağlayıcısına bağlanılamadı, istek gönderilmedi");
    for (const raw of [
      "paynkolay refund reddedildi: responseCode=5",
      "paynkolay cancel reddedildi: responseCode=? ",
      "socket hang up",
      "",
      undefined,
      null,
    ]) {
      expect(refundAnswerForStaff(raw)).toBe("");
    }
  });

  it("never echoes the provider's text", () => {
    for (const raw of [
      ALREADY,
      "POS ikinci iadeyi reddetti (ilk iade geçmiş olabilir): " + ALREADY,
      "paynkolay refund reddedildi: responseCode=5 Sistem hatası",
    ]) {
      const text = refundAnswerForStaff(raw);
      expect(text).not.toMatch(/responseCode|paynkolay refund|reddedildi/i);
    }
  });
});
