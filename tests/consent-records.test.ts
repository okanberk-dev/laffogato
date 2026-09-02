import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const newsletterStore = readFileSync("src/lib/newsletter/store.ts", "utf8");
const newsletterAction = readFileSync("src/app/newsletter/actions.ts", "utf8");
const footerForm = readFileSync(
  "src/components/laffogato/newsletter-form.tsx",
  "utf8",
);
const emailSend = readFileSync("src/lib/email/send.ts", "utf8");
const customerStore = readFileSync("src/lib/customer/store.ts", "utf8");

describe("commercial e-mail consent (6563)", () => {
  it("refuses to subscribe without a consent record", () => {
    expect(newsletterStore).toContain("if (!consent?.at)");
    expect(newsletterStore).toContain("consentAt");
    expect(newsletterStore).toContain("consentIp");
    // The exact wording consented to is stored, not just the fact of consent.
    expect(newsletterStore).toContain("NEWSLETTER_CONSENT_TEXT");
  });

  it("asks for consent in the footer form, unchecked", () => {
    expect(footerForm).toContain('name="consent"');
    expect(footerForm).not.toContain("defaultChecked");
    expect(footerForm).not.toContain("checked={true}");
    expect(newsletterAction).toContain('formData.get("consent") !== "on"');
  });

  it("offers a one-click way out that needs no login", () => {
    expect(newsletterStore).toContain("unsubscribeByToken");
    // The token is spent on use.
    expect(newsletterStore).toContain('unsubToken: ""');
    expect(emailSend).toContain("List-Unsubscribe");
    expect(emailSend).toContain("One-Click");
  });
});

describe("password reset", () => {
  it("exists at all — four published documents promise it", () => {
    expect(customerStore).toContain("createPasswordResetToken");
    expect(customerStore).toContain("resetPasswordWithToken");
  });

  it("does not reveal whether an address has an account", () => {
    const action = readFileSync("src/app/uye/actions.ts", "utf8");
    const fn = action.slice(
      action.indexOf("requestPasswordResetAction"),
      action.indexOf("export type ResetPasswordState"),
    );
    // One message, whatever the outcome.
    expect(fn).toContain("SAME_ANSWER");
    expect(fn).not.toMatch(/Kayıt bulunamadı|hesap yok/);
  });

  it("spends the token in the same write that sets the password", () => {
    const fn = customerStore.slice(
      customerStore.indexOf("export async function resetPasswordWithToken"),
    );
    const write = fn.slice(0, fn.indexOf("return { ok: true"));
    expect(write).toContain('resetToken: ""');
    // Conditioned on the token still being there, so two requests racing the
    // same link cannot both succeed.
    expect(write).toContain('.eq("resetToken", clean)');
  });
});
