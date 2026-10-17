import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The panel's sign-in screen (admin audit SHE-M01, SHE-28, SHE-21, SHE-23).
 */

const signInAdmin = vi.hoisted(() => vi.fn());
const logAudit = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: () => {},
}));
vi.mock("@/lib/admin/auth", () => ({ signInAdmin }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));

const { loginAction } = await import("@/app/admin/giris/actions");
const { LoginForm } = await import("@/app/admin/giris/login-form");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  signInAdmin.mockReset();
  logAudit.mockReset();
  signInAdmin.mockResolvedValue({ ok: false, error: "E-posta veya şifre hatalı." });
});

describe("loginAction", () => {
  it("refuses an address longer than 254 characters before anything is counted or written", async () => {
    const email = `${"a".repeat(290)}@laffogato.net`;
    const res = await loginAction({}, form({ email, password: "parola" }));
    expect(res).toEqual({ error: "Geçerli bir e-posta gir." });
    // Neither the rate-limit key nor the audit row ever sees it.
    expect(signInAdmin).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses an address without @", async () => {
    const res = await loginAction(
      {},
      form({ email: "kasa.laffogato.net", password: "parola" }),
    );
    expect(res.error).toBe("Geçerli bir e-posta gir.");
    expect(signInAdmin).not.toHaveBeenCalled();
  });

  it("still checks a 254-character address", async () => {
    const email = `${"a".repeat(240)}@laffogato.net`;
    expect(email).toHaveLength(254);
    await loginAction({}, form({ email, password: "parola" }));
    expect(signInAdmin).toHaveBeenCalledWith(email, "parola");
  });
});

describe("LoginForm", () => {
  const html = renderToStaticMarkup(createElement(LoginForm, { next: "" }));

  it("posts by hand, so a refusal keeps the typed e-mail", () => {
    // A React action form renders action="javascript:…" and is reset after
    // every answer; the hand-dispatched form has no action at all.
    expect(html).toMatch(/<form[^>]*>/);
    expect(html.match(/<form[^>]*>/)![0]).not.toContain("action=");
    const src = readFileSync("src/app/admin/giris/login-form.tsx", "utf8");
    expect(src).toContain("useNoResetSubmit(formAction, pending)");
    expect(src).not.toMatch(/action=\{formAction\}/);
  });

  it("keeps the field names the action reads, and caps the address", () => {
    const input = (name: string) =>
      html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
    expect(input("next")).toContain('type="hidden"');
    expect(input("email")).toContain('type="email"');
    expect(input("email")).toContain('maxLength="254"');
    expect(input("password")).toContain('type="password"');
  });

  it("names its fields with the kit's labels", () => {
    expect(html).toMatch(/<label[^>]*>.*E-posta.*<input[^>]*name="email"/s);
    expect(html).toMatch(/<label[^>]*>.*Şifre.*<input[^>]*name="password"/s);
  });
});

describe("the sign-in page", () => {
  const page = readFileSync("src/app/admin/giris/page.tsx", "utf8");

  it("has a heading and sends a forgotten password to the owner", () => {
    expect(page).toMatch(/<h1 className="sr-only">Panele giriş<\/h1>/);
    expect(page).toContain(
      "Şifreni unuttuysan işletme sahibinden sıfırlamasını iste.",
    );
    expect(page).not.toContain("ortam değişkenlerine erişimi olan");
  });

  it("uses the panel's ink, not the 2.6:1 neutral grey", () => {
    expect(page).not.toMatch(/text-neutral-\d/);
  });
});
