import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BusyDots } from "@/components/laffogato/busy-dots";

/**
 * A busy button keeps its fill and shows the three-dot wait mark beside its
 * words; it is not faded to the 45 % of a switched-off control.
 */

const read = (p: string) => readFileSync(p, "utf8");

const BUSY_FORMS = [
  "src/app/odeme/checkout.tsx",
  "src/components/laffogato/karaoke-booking.tsx",
  "src/app/uye/giris/login-form.tsx",
  "src/app/uye/hesap/adreslerim/address-form.tsx",
  "src/app/uye/hesap/bildirimler/notifications-form.tsx",
  "src/app/uye/hesap/profile-form.tsx",
  "src/app/uye/hesap/sifre/password-form.tsx",
  "src/app/uye/hesap/sil/delete-account-form.tsx",
  "src/app/uye/kayit/register-form.tsx",
  "src/app/uye/sifre-sifirla/reset-form.tsx",
  "src/app/uye/sifremi-unuttum/forgot-form.tsx",
  "src/components/customer/verify-notice.tsx",
  "src/components/laffogato/newsletter-form.tsx",
];

describe("the wait mark", () => {
  it("is three decorative dots: the words say what is happening", () => {
    const html = renderToStaticMarkup(createElement(BusyDots));
    expect(html).toBe(
      '<span class="lf-dots" aria-hidden="true"><i></i><i></i><i></i></span>',
    );
  });

  it("is classes only, so /odeme's nonce CSP has nothing to refuse", () => {
    expect(read("src/components/laffogato/busy-dots.tsx")).not.toMatch(
      /style=|<script/,
    );
  });

  it("keeps a busy button's fill, and the MIT attribution of the dots", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(
      /\.btn\[aria-busy="true"\]:disabled \{[^}]*opacity: 1;/,
    );
    expect(css).toContain("MIT, (c) 2023 Uiverse.io");
  });

  it.each(BUSY_FORMS)("%s marks its busy button", (file) => {
    const src = read(file);
    expect(src).toContain("aria-busy={");
    expect(src).toContain("<BusyDots />");
    expect(src).not.toMatch(/opacity: pending/);
  });

  it("the promo button no longer says only an ellipsis", () => {
    const src = read("src/app/odeme/checkout.tsx");
    expect(src).not.toContain('promoPending ? "…"');
    expect(src).toContain("Kod kontrol ediliyor");
    // Alone in the pill (the words are sr-only), the dots drop the spacing
    // they keep beside a label, or they sit off centre.
    expect(read("src/app/globals.css")).toMatch(
      /\.checkout-promo button \.lf-dots \{\s*margin-inline-end: 0;/,
    );
  });
});
