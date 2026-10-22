import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The member's "Sipariş durumu" switch (/uye/hesap/bildirimler) says what it
 * governs: the app's order-stage phone notifications and the gel-al "hazır"
 * fallback e-mail (src/lib/push/order-push.ts, docs/API-MOBILE.md §23). The
 * order, payment and shipping e-mails are transactional and no sender reads
 * the switch for them; the old caption ("Sipariş alındı, kargoya verildi,
 * teslim edildi e-postaları.") promised the switch would stop them.
 */
const form = readFileSync(
  join(process.cwd(), "src/app/uye/hesap/bildirimler/notifications-form.tsx"),
  "utf8",
);

describe("member order-status switch caption", () => {
  it("is named as the app and the legal texts name it", () => {
    expect(form).toContain('label="Sipariş durumu"');
    expect(form).not.toContain("Sipariş güncellemeleri");
  });

  it("names the phone and the ready e-mail, and keeps the transactional mail out of it", () => {
    expect(form).toMatch(
      /telefonlara hazırlanıyor, hazır, yolda ve iptal bildirimleri gelir/,
    );
    expect(form).toMatch(
      /gel-al siparişin hazır olduğunda telefonuna ulaşamazsak e-postayla haber veririz/,
    );
    expect(form).toMatch(
      /Sipariş, ödeme ve kargo e-postaları bu ayardan bağımsız, her zaman gelir/,
    );
    expect(form).not.toContain("teslim edildi e-postaları");
  });
});
