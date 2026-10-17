import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The 2FA screens (admin audit SHE-23, SHE-17, SHE-22): the code field had
 * no name but its placeholder ("123456"), a wrong code was never announced,
 * the copy said "authenticator", and the screens were drawn in the old
 * neutral / red palette with a synthesised italic serif.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: () => {},
}));
vi.mock("@/lib/admin/auth", () => ({
  cancelPending2FA: vi.fn(),
  complete2FA: vi.fn(),
  getAdminSession: vi.fn(),
}));

const read = (file: string) => readFileSync(file, "utf8");

const SCREENS = [
  "src/app/admin/iki-asama/page.tsx",
  "src/components/admin/twofa-verify-form.tsx",
];

describe("the 2FA challenge", () => {
  it("names the code field for a screen reader", async () => {
    const { TwoFAVerifyForm } = await import(
      "@/components/admin/twofa-verify-form"
    );
    const html = renderToStaticMarkup(
      createElement(TwoFAVerifyForm, { next: "/admin" }),
    );
    const input = html.match(/<input[^>]*name="token"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('aria-label="6 haneli doğrulama kodu"');
    expect(input).toContain('autoComplete="one-time-code"');
  });

  it("announces a wrong code", () => {
    const src = read("src/components/admin/twofa-verify-form.tsx");
    const box = src.slice(src.indexOf("{state.error && ("));
    expect(box.slice(0, 200)).toContain('role="alert"');
  });

  it.each(SCREENS)("%s speaks Turkish and uses the panel's tokens", (file) => {
    const src = read(file);
    expect(src).not.toMatch(/authenticator/i);
    expect(src).not.toMatch(/\b(?:text|bg|border)-(?:neutral|red|rose|emerald|amber)-\d/);
    expect(src).not.toContain("fontStyle: \"italic\"");
    expect(src).not.toContain("Playfair");
  });
});
