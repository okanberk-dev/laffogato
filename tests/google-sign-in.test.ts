import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  GOOGLE_CONSENT_PATH,
  GOOGLE_NOTICES,
  GOOGLE_RETURN_PATH,
  GOOGLE_START_PATH,
  googleCallbackNotice,
  googleConsentHref,
  googleExchangeNotice,
  googleNeedsConsent,
  googleNotice,
  googleReturnUrl,
  googleStartHref,
  signInWithNotice,
} from "@/lib/customer/google-sign-in-core";

/**
 * Google sign-in on the website (docs/AUTH-BRIDGE.md §7, 8 Kas 2026).
 *
 * The routes are thin wrappers around Supabase and the bridge; what can go
 * wrong quietly is here: a `?next=` that leaves the site, a refusal with no
 * sentence on the sign-in page, a new member signed in without the
 * agreement's tick, a start button that the site's own CSP would block.
 */

const read = (path: string) => readFileSync(path, "utf8");

describe("addresses", () => {
  it("keeps the three paths where the routes live", () => {
    expect(GOOGLE_START_PATH).toBe("/uye/google");
    expect(GOOGLE_RETURN_PATH).toBe("/uye/google/donus");
    expect(GOOGLE_CONSENT_PATH).toBe("/uye/google/onay");
    for (const path of [
      GOOGLE_START_PATH,
      GOOGLE_RETURN_PATH,
      GOOGLE_CONSENT_PATH,
    ]) {
      const dir = `src/app${path}`;
      const file =
        path === GOOGLE_CONSENT_PATH ? `${dir}/page.tsx` : `${dir}/route.ts`;
      expect(() => read(file), file).not.toThrow();
    }
  });

  it("carries next only when it is a path on this site", () => {
    expect(googleStartHref()).toBe("/uye/google");
    expect(googleStartHref("/odeme")).toBe("/uye/google?next=%2Fodeme");
    expect(googleStartHref("//evil.example")).toBe("/uye/google");
    expect(googleStartHref("https://evil.example/")).toBe("/uye/google");
    expect(googleConsentHref("/karaoke?tarih=2026-11-09")).toBe(
      "/uye/google/onay?next=%2Fkaraoke%3Ftarih%3D2026-11-09",
    );
    expect(googleReturnUrl("https://laffogato.net/", "/odeme")).toBe(
      "https://laffogato.net/uye/google/donus?next=%2Fodeme",
    );
    expect(googleReturnUrl("https://laffogato.net", "/\\evil")).toBe(
      "https://laffogato.net/uye/google/donus",
    );
  });

  it("sends a refusal to the sign-in page with its notice and the next path", () => {
    expect(signInWithNotice("iptal")).toBe("/uye/giris?google=iptal");
    expect(signInWithNotice("hata", "/odeme")).toBe(
      "/uye/giris?google=hata&next=%2Fodeme",
    );
    expect(signInWithNotice("kapali", "//evil.example")).toBe(
      "/uye/giris?google=kapali",
    );
  });
});

describe("notices", () => {
  it("has a Turkish sentence for every code and none for anything else", () => {
    for (const [code, text] of Object.entries(GOOGLE_NOTICES)) {
      expect(googleNotice(code)).toBe(text);
      expect(text.length).toBeGreaterThan(10);
      // Project rule (CLAUDE.md): the plain hyphen only.
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
    expect(googleNotice(["iptal", "hata"])).toBe(GOOGLE_NOTICES.iptal);
    expect(googleNotice("toString")).toBeNull();
    expect(googleNotice("<script>")).toBeNull();
    expect(googleNotice(undefined)).toBeNull();
  });

  it("never tells whether an address is registered", () => {
    for (const text of Object.values(GOOGLE_NOTICES)) {
      expect(text).not.toMatch(/kayıtlı değil|üye değil|bulunamadı/i);
    }
  });

  it("reads a cancel as the member's choice and a refusal as an error", () => {
    expect(googleCallbackNotice({ error: "access_denied" })).toBe("iptal");
    expect(
      googleCallbackNotice({ errorDescription: "User cancelled the flow" }),
    ).toBe("iptal");
    expect(googleCallbackNotice({ errorCode: "otp_expired" })).toBe("sure");
    expect(googleCallbackNotice({ error: "server_error" })).toBe("hata");
    expect(googleCallbackNotice({})).toBe("hata");
  });

  it("asks for a fresh start when the code or its verifier is spent", () => {
    expect(
      googleExchangeNotice({ name: "AuthPKCECodeVerifierMissingError" }),
    ).toBe("sure");
    for (const code of [
      "flow_state_not_found",
      "flow_state_expired",
      "flow_state_already_used",
      "bad_code_verifier",
      "bad_oauth_state",
    ]) {
      expect(googleExchangeNotice({ code }), code).toBe("sure");
    }
    expect(googleExchangeNotice({ name: "AuthRetryableFetchError" })).toBe(
      "hata",
    );
    expect(
      googleExchangeNotice({ code: "unexpected_failure", status: 500 }),
    ).toBe("hata");
  });

  it("every notice the routes send is one the sign-in page can print", () => {
    const sent = new Set<string>();
    for (const file of [
      "src/app/uye/google/route.ts",
      "src/app/uye/google/donus/route.ts",
      "src/lib/customer/google-sign-in-core.ts",
    ]) {
      for (const m of read(file).matchAll(/signInWithNotice\(\s*"([a-z]+)"/g))
        sent.add(m[1]);
      for (const m of read(file).matchAll(/refuse\(\s*"([a-z]+)"/g))
        sent.add(m[1]);
      for (const m of read(file).matchAll(/return "([a-z]+)";/g))
        sent.add(m[1]);
    }
    expect(sent.size).toBeGreaterThan(3);
    for (const code of sent)
      expect(Object.keys(GOOGLE_NOTICES), code).toContain(code);
    expect(read("src/app/uye/giris/page.tsx")).toContain(
      "googleNotice(google)",
    );
  });
});

describe("the consent stop", () => {
  it("stops only a brand-new member", () => {
    const fresh = {
      termsAcceptedAt: "",
      rowExists: false,
      identityRevoked: false,
    };
    expect(googleNeedsConsent(fresh)).toBe(true);
    // Accepted in the app or on the consent page already.
    expect(
      googleNeedsConsent({
        ...fresh,
        termsAcceptedAt: "2026-11-08T10:00:00.000Z",
      }),
    ).toBe(false);
    // An existing member accepted when the account was opened.
    expect(googleNeedsConsent({ ...fresh, rowExists: true })).toBe(false);
    // A closed account is refused by the bridge, not asked to agree.
    expect(googleNeedsConsent({ ...fresh, identityRevoked: true })).toBe(false);
  });

  it("does not sign a new member in before the tick", () => {
    const route = read("src/app/uye/google/donus/route.ts");
    const consentAt = route.indexOf("googleSignInNeedsConsent(user)");
    const cookieAt = route.indexOf("setActiveCustomerSession(");
    const createAt = route.indexOf("ensureCustomerForSupabaseUser(user)");
    expect(consentAt).toBeGreaterThan(0);
    expect(consentAt).toBeLessThan(createAt);
    expect(createAt).toBeLessThan(cookieAt);
  });

  it("records the tick in the identity before the row is created", () => {
    const actions = read("src/app/uye/actions.ts");
    const body = actions.slice(
      actions.indexOf("export async function completeGoogleSignUpAction"),
    );
    const update = body.indexOf("terms_accepted_at: now");
    const create = body.search(
      /ensureCustomerForSupabaseUser\(\s*updated\.user,\s*"site-google"/,
    );
    expect(update).toBeGreaterThan(0);
    expect(create).toBeGreaterThan(update);
    // The refusal without the tick comes before anything is read.
    expect(body.indexOf("if (!acceptedTerms)")).toBeLessThan(
      body.indexOf("getUser()"),
    );
  });
});

describe("the start", () => {
  it("is a plain link, never a form (CSP form-action 'self')", () => {
    const button = read("src/components/uye/google-sign-in.tsx");
    expect(button).toContain("href={googleStartHref(next)}");
    expect(button).not.toMatch(/<form[\s>]/);
    expect(button).not.toContain('from "next/link"');
    expect(read("next.config.ts")).toContain("form-action 'self'");
  });

  it("asks Supabase for Google with PKCE and the account chooser, and checks the switch first", () => {
    const route = read("src/app/uye/google/route.ts");
    expect(route).toContain('provider: "google"');
    expect(route).toContain("skipBrowserRedirect: true");
    expect(route).toContain('prompt: "select_account"');
    expect(route).toContain("createSupabaseServerClient()");
    expect(route.indexOf("signIn.google")).toBeLessThan(
      route.indexOf("signInWithOAuth("),
    );
  });

  it("draws the door only while the panel switch is on", () => {
    for (const page of [
      "src/app/uye/giris/page.tsx",
      "src/app/uye/kayit/page.tsx",
    ]) {
      const src = read(page);
      expect(src, page).toContain("mobileApp.signIn.google");
      expect(src, page).toMatch(/googleOpen && \(/);
      expect(src, page).toContain("<GoogleSignInLink");
    }
  });

  it("tells a Google member on the password page how to get a password", () => {
    const page = read("src/app/uye/hesap/sifre/page.tsx");
    expect(page).toContain("mobileApp.signIn.google");
    expect(page).toMatch(/googleOpen && \(/);
    expect(page).toContain('href="/uye/sifremi-unuttum"');
  });

  it("counts the return against the shared sign-in budget before exchanging", () => {
    const route = read("src/app/uye/google/donus/route.ts");
    expect(route).toContain('"customer-login-ip"');
    expect(route.indexOf("reserveLoginAttempt(")).toBeLessThan(
      route.indexOf("exchangeCodeForSession("),
    );
    // A refused session leaves this browser only: the phone stays signed in.
    expect(route).toContain('signOut({ scope: "local" })');
  });
});
