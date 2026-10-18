import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EMAIL_TEMPLATES } from "@/lib/email/templates.generated";
import { EMAIL_TEXT } from "@/lib/email/text";

/**
 * The payment mail and the member's order page link the documents the
 * customer confirmed. Those links open /hukuk/<slug>, the CURRENT text, so
 * they are not a durable medium for the confirmed version (MSY m.4/1-c: the
 * consumer must be able to keep the information unchanged). Until the
 * versioned copy ships (legal-versions-durable-copy), the two places say
 * what the links are instead of calling them "kalıcı veri saklayıcısı".
 * The version the customer confirmed stays on the order (legalConsent).
 */

const PAGE = "src/app/uye/hesap/siparislerim/[orderNo]/page.tsx";

describe("confirmed documents are not called a durable medium", () => {
  it("the payment mail says the links open the current text", () => {
    const html = EMAIL_TEMPLATES["odeme-onaylandi"].html;
    const text = EMAIL_TEXT["odeme-onaylandi"];
    for (const body of [html, text]) {
      expect(body).not.toMatch(/kalıcı veri saklayıcısı/);
    }
    expect(html).toContain(
      "Sipariş sırasında onayladığınız belgeler (bağlantılar belgelerin güncel metnini açar):",
    );
    expect(text.replace(/\s+/g, " ")).toContain(
      "Sipariş sırasında onayladığınız belgeler (bağlantılar belgelerin güncel metnini açar):",
    );
  });

  it("the member's order page says the same in the customer's voice", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/kalıcı veri saklayıcısı/);
    expect(src).toContain(
      "Siparişini verirken onayladığın belgeler. Bağlantılar belgelerin güncel metnini açar.",
    );
  });

  it("no other mail calls a link a durable medium", () => {
    for (const [name, t] of Object.entries(EMAIL_TEMPLATES)) {
      expect(t.html, name).not.toMatch(/kalıcı veri saklayıcısı/);
    }
    for (const [name, body] of Object.entries(EMAIL_TEXT)) {
      expect(body, name).not.toMatch(/kalıcı veri saklayıcısı/);
    }
  });
});
