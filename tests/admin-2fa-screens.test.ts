import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The 2FA screens (admin audit SHE-23, SHE-26, SHE-09, SHE-10, SHE-17,
 * SHE-22, SHE-25): the code field had no name but its placeholder
 * ("123456"), a wrong code was never announced, turning 2FA off said
 * nothing and its refusals rode in the URL, "Vazgeç" showed a new QR, the
 * success link sent a cashier to a page that bounced them, the page gave
 * advice that could not be followed, and the copy said "authenticator".
 */

class Redirect extends Error {
  constructor(readonly to: string) {
    super("NEXT_REDIRECT");
  }
}

const session = vi.hoisted(() => ({
  current: { email: "kasa@laffogato.net", role: "cashier" } as {
    email: string;
    role: string;
  } | null,
}));
const flashes = vi.hoisted(() => [] as Array<[string, string | undefined]>);
const verifyToken = vi.hoisted(() => vi.fn());
const verifyAndEnable = vi.hoisted(() => vi.fn());
const has2FA = vi.hoisted(() => vi.fn());
const disable2FA = vi.hoisted(() => vi.fn());
const cancelEnrollment = vi.hoisted(() => vi.fn());
const reserveLoginAttempt = vi.hoisted(() => vi.fn());
const safeAudit = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Redirect) throw err;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const complete2FA = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/auth", () => ({
  cancelPending2FA: vi.fn(),
  complete2FA,
  getAdminSession: async () => session.current,
}));
vi.mock("@/lib/admin/flash", () => ({
  setAdminFlash: async (message: string, tone?: string) => {
    flashes.push([message, tone]);
  },
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "1.2.3.4",
  clearLoginLimit: vi.fn(),
  reserveLoginAttempt,
}));
vi.mock("@/lib/admin/twofa", () => ({
  cancelEnrollment,
  disable2FA,
  has2FA,
  verifyAndEnable,
  verifyToken,
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit, logAudit: safeAudit }));

const actions = await import("@/app/admin/2fa-kurulum/actions");

const read = (file: string) => readFileSync(file, "utf8");

async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    if (err instanceof Redirect) return err.to;
    throw err;
  }
  return "(no redirect)";
}

function code(token: string): FormData {
  const fd = new FormData();
  fd.set("token", token);
  return fd;
}

beforeEach(() => {
  session.current = { email: "kasa@laffogato.net", role: "cashier" };
  flashes.length = 0;
  for (const m of [
    verifyToken,
    verifyAndEnable,
    disable2FA,
    cancelEnrollment,
    reserveLoginAttempt,
    safeAudit,
    has2FA,
  ]) {
    m.mockReset();
  }
  has2FA.mockResolvedValue(false);
  reserveLoginAttempt.mockResolvedValue({
    blocked: false,
    remaining: 4,
    retryAfterSeconds: 0,
  });
});

describe("turning 2FA off", () => {
  it("says so and leaves for the page the role lands on", async () => {
    verifyToken.mockResolvedValue(true);
    const to = await redirectOf(() => actions.disable2FAAction(code("123456")));
    expect(disable2FA).toHaveBeenCalledWith("kasa@laffogato.net");
    // A cashier has no dashboard: /admin would bounce them.
    expect(to).toBe("/admin/kasa");
    expect(flashes).toEqual([["İki adımlı doğrulama kapatıldı.", "warning"]]);
  });

  it("answers a wrong code with a flash, not a ?hata= that survives a reload", async () => {
    verifyToken.mockResolvedValue(false);
    const to = await redirectOf(() => actions.disable2FAAction(code("000000")));
    expect(to).toBe("/admin/2fa-kurulum");
    expect(flashes[0]?.[1]).toBe("danger");
    expect(flashes[0]?.[0]).toMatch(/Doğrulama uygulamandaki/);
    expect(disable2FA).not.toHaveBeenCalled();
  });

  it("answers a locked budget the same way", async () => {
    reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    const to = await redirectOf(() => actions.disable2FAAction(code("123456")));
    expect(to).toBe("/admin/2fa-kurulum");
    expect(flashes[0]).toEqual([
      "Çok fazla hatalı kod. Bir süre sonra tekrar dene.",
      "danger",
    ]);
    expect(verifyToken).not.toHaveBeenCalled();
  });
});

describe("the 2FA step of signing in", () => {
  it("lands a cashier on the till, not on the dashboard that bounces them", async () => {
    const { verify2FAAction } = await import("@/app/admin/iki-asama/actions");
    complete2FA.mockResolvedValue({ ok: true, role: "cashier" });
    const fd = code("123456");
    fd.set("next", "");
    expect(await redirectOf(() => verify2FAAction({}, fd))).toBe("/admin/kasa");
  });

  it("returns to the page the session expired on, query included", async () => {
    const { verify2FAAction } = await import("@/app/admin/iki-asama/actions");
    complete2FA.mockResolvedValue({ ok: true, role: "owner" });
    const fd = code("123456");
    fd.set("next", "/admin/siparisler?durum=acik");
    expect(await redirectOf(() => verify2FAAction({}, fd))).toBe(
      "/admin/siparisler?durum=acik",
    );
    fd.set("next", "//evil.example");
    expect(await redirectOf(() => verify2FAAction({}, fd))).toBe("/admin");
  });
});

describe("setting 2FA up", () => {
  it("Vazgeç drops the draft and leaves instead of drawing a new QR", async () => {
    const to = await redirectOf(() => actions.cancelEnrollAction());
    expect(cancelEnrollment).toHaveBeenCalledWith("kasa@laffogato.net");
    expect(to).toBe("/admin/kasa");
    expect(flashes[0]?.[1]).toBe("info");
  });

  it("a good code switches it on and lands where the role works, with a toast", async () => {
    session.current = { email: "sahip@laffogato.net", role: "owner" };
    verifyAndEnable.mockResolvedValue(true);
    const to = await redirectOf(() =>
      actions.verifyEnrollAction({}, code("123456")),
    );
    expect(to).toBe("/admin");
    expect(flashes[0]?.[0]).toMatch(/^İki adımlı doğrulama açıldı/);
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "2fa_enable", entity: "2fa" }),
    );
  });

  it("a refused code says the QR may need scanning again", async () => {
    verifyAndEnable.mockResolvedValue(false);
    const res = await actions.verifyEnrollAction({}, code("123456"));
    expect(res.error).toMatch(/QR kodu yeniden tarat/);
    expect(res.error).not.toMatch(/Saatin senkron/);
  });

  it("counts every code against the sign-in step's two budgets", async () => {
    verifyAndEnable.mockResolvedValue(false);
    await actions.verifyEnrollAction({}, code("123456"));
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "admin-2fa",
      "1.2.3.4",
      "kasa@laffogato.net",
    );
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "admin-2fa-account",
      "*",
      "kasa@laffogato.net",
    );
  });

  it("stops guessing once a budget is spent, before any code is checked", async () => {
    reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    const res = await actions.verifyEnrollAction({}, code("123456"));
    expect(res.error).toMatch(/Çok fazla hatalı kod/);
    expect(verifyAndEnable).not.toHaveBeenCalled();
  });

  it("checks no code against a secret that is already on", async () => {
    has2FA.mockResolvedValue(true);
    const res = await actions.verifyEnrollAction({}, code("123456"));
    expect(res.error).toMatch(/zaten açık/);
    expect(verifyAndEnable).not.toHaveBeenCalled();
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });
});

describe("the screens", () => {
  it("name the code field and announce a wrong code", async () => {
    const { TwoFAVerifyForm } =
      await import("@/components/admin/twofa-verify-form");
    const { TwoFAEnrollForm } =
      await import("@/components/admin/twofa-enroll-form");
    for (const html of [
      renderToStaticMarkup(createElement(TwoFAVerifyForm, { next: "/admin" })),
      renderToStaticMarkup(createElement(TwoFAEnrollForm)),
    ]) {
      const input = html.match(/<input[^>]*name="token"[^>]*>/)?.[0] ?? "";
      expect(input).toContain('aria-label="6 haneli doğrulama kodu"');
      expect(input).toContain('autoComplete="one-time-code"');
    }
    for (const file of [
      "src/components/admin/twofa-verify-form.tsx",
      "src/components/admin/twofa-enroll-form.tsx",
    ]) {
      const src = read(file);
      const box = src.slice(src.indexOf("{state.error && ("));
      expect(box.slice(0, 200), file).toContain('role="alert"');
    }
  });

  it("send nobody to /admin, which bounces a cashier", () => {
    expect(read("src/components/admin/twofa-enroll-form.tsx")).not.toContain(
      'href="/admin"',
    );
  });

  it("give advice that can be followed", () => {
    const page = read("src/app/admin/2fa-kurulum/page.tsx");
    expect(page).not.toContain("Telefonunu kaybedersen önce bu sekmeden");
    expect(page).toContain("Kullanıcılar sayfasında");
    // Refusals are flashes now; the page no longer reads them off the URL.
    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("hata");
  });

  it.each([
    "src/app/admin/iki-asama/page.tsx",
    "src/app/admin/2fa-kurulum/page.tsx",
    "src/components/admin/twofa-verify-form.tsx",
    "src/components/admin/twofa-enroll-form.tsx",
  ])("%s speaks Turkish and uses the panel's tokens", (file) => {
    const src = read(file);
    // The app is named; the generic word is not.
    expect(src).not.toMatch(/(?<!Google )authenticator/i);
    expect(src).not.toMatch(
      /\b(?:text|bg|border)-(?:neutral|red|rose|emerald|amber)-\d/,
    );
    expect(src).not.toContain("rounded-full");
    expect(src).not.toContain('fontStyle: "italic"');
    expect(src).not.toContain("Playfair");
  });
});
