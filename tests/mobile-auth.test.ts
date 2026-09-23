import { describe, expect, it } from "vitest";

import type { Customer } from "@/lib/customer/store";

import {
  displayNameOf,
  linkableUserId,
  normalizeEmail,
  planCustomerLink,
  shouldAttemptSupabaseLink,
  type SupabaseUserLike,
} from "@/lib/customer/supabase-link-plan";
import { classifyAuthError, parseBearerToken } from "@/lib/mobile/auth-core";
import { apiError, apiJson } from "@/lib/mobile/respond";

const NOW = "2026-08-30T10:00:00.000Z";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.c2lnbmF0dXJl";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cst-1",
    passwordMirroredAt: "",
    email: "eda@example.com",
    name: "Eda Mancuso",
    phone: "+90 555 000 00 00",
    passwordHash: "$2a$10$hash",
    birthday: "",
    addresses: [],
    wishlist: [],
    notificationPrefs: {
      orderUpdates: true,
      marketing: false,
      newsletter: false,
    },
    supabaseUserId: "",
    supabaseLinkAttemptedAt: "",
    inviteCode: "",
    invitedBy: "",
    usual: null,
    emailVerified: false,
    verifyToken: "tok",
    verifyExpires: "2026-09-01T00:00:00.000Z",
    verifiedAt: "",
    resetToken: "",
    resetExpires: "",
    isActive: true,
    termsAcceptedAt: "2026-05-01T00:00:00.000Z",
    marketingConsentAt: "",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function user(overrides: Partial<SupabaseUserLike> = {}): SupabaseUserLike {
  return {
    id: "u-1",
    email: "Eda@Example.com",
    email_confirmed_at: "2026-08-30T09:00:00.000Z",
    user_metadata: { full_name: "Eda Mancuso", phone: "+90 555 111 11 11" },
    ...overrides,
  };
}

describe("parseBearerToken", () => {
  it("extracts the token from a well-formed header, scheme case-insensitive", () => {
    expect(parseBearerToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearerToken(`  bearer   ${TOKEN}  `)).toBe(TOKEN);
  });

  it("rejects a missing header, another scheme, an empty or absurd token", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
    expect(parseBearerToken(`Basic ${TOKEN}`)).toBeNull();
    expect(parseBearerToken("Bearer")).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
    expect(parseBearerToken("Bearer short")).toBeNull();
    expect(parseBearerToken(`Bearer ${"x".repeat(9000)}`)).toBeNull();
  });

  it("refuses whitespace inside the token instead of trimming it", () => {
    expect(parseBearerToken(`Bearer ${TOKEN} extra`)).toBeNull();
  });
});

describe("classifyAuthError", () => {
  it("treats a 4xx from Supabase as the caller's problem (401)", () => {
    expect(classifyAuthError({ status: 401 })).toBe("unauthorized");
    expect(classifyAuthError({ status: 403 })).toBe("unauthorized");
  });

  it("treats no status, 0 or a 5xx as an outage (503)", () => {
    expect(classifyAuthError(null)).toBe("unavailable");
    expect(classifyAuthError({})).toBe("unavailable");
    expect(classifyAuthError({ status: null })).toBe("unavailable");
    expect(classifyAuthError({ status: 0 })).toBe("unavailable");
    expect(classifyAuthError({ status: 502 })).toBe("unavailable");
  });

  it("treats throttling and timeouts as an outage, not a bad token", () => {
    // A 429 from Supabase Auth used to become a 401, and the app signed
    // every member with an uncached token out during a traffic burst.
    expect(classifyAuthError({ status: 429 })).toBe("unavailable");
    expect(classifyAuthError({ status: 408 })).toBe("unavailable");
  });
});

describe("respond helpers", () => {
  it("apiError emits the contract's { error, message } body with the status", async () => {
    const res = apiError(401, "unauthorized", "Giriş yapman gerekiyor.", {
      "WWW-Authenticate": "Bearer",
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await res.json()).toEqual({
      error: "unauthorized",
      message: "Giriş yapman gerekiyor.",
    });
  });

  it("apiJson defaults to 200 and passes headers through", async () => {
    const res = apiJson(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("normalizeEmail / displayNameOf", () => {
  it("lower-cases invariantly and trims", () => {
    expect(normalizeEmail("  INFO@Laffogato.NET ")).toBe("info@laffogato.net");
    expect(normalizeEmail(null)).toBe("");
  });

  it("reads full_name first, then name, capped at 100 chars", () => {
    expect(displayNameOf(user())).toBe("Eda Mancuso");
    expect(displayNameOf(user({ user_metadata: { name: " Selin " } }))).toBe(
      "Selin",
    );
    expect(
      displayNameOf(user({ user_metadata: { full_name: "x".repeat(150) } })),
    ).toHaveLength(100);
    expect(displayNameOf(user({ user_metadata: null }))).toBe("");
  });
});

describe("planCustomerLink", () => {
  it("creates a password-less, verified row for a confirmed user with no row", () => {
    const plan = planCustomerLink(null, user(), NOW, "cst-new");
    expect(plan.action).toBe("create");
    if (plan.action !== "create") return;
    expect(plan.grantWelcome).toBe(true);
    expect(plan.row).toMatchObject({
      id: "cst-new",
      email: "eda@example.com",
      name: "Eda Mancuso",
      phone: "+90 555 111 11 11",
      passwordHash: "",
      emailVerified: true,
      verifiedAt: NOW,
      supabaseUserId: "u-1",
      supabaseLinkAttemptedAt: NOW,
      isActive: true,
      // No consent in the metadata, so none is recorded — the row must not
      // claim an agreement the member never gave.
      termsAcceptedAt: "",
      marketingConsentAt: "",
      createdAt: NOW,
    });
    expect("usual" in plan.row).toBe(false);
  });

  it("records the consent the app sent, and only that", () => {
    const plan = planCustomerLink(
      null,
      user({
        user_metadata: {
          full_name: "Eda Mancuso",
          terms_accepted_at: "2026-09-02T10:15:00.000Z",
          marketing_consent_at: "2026-09-02T10:15:00.000Z",
        },
      }),
      NOW,
      "cst-new",
    );
    expect(plan.action).toBe("create");
    if (plan.action !== "create") return;
    expect(plan.row.termsAcceptedAt).toBe("2026-09-02T10:15:00.000Z");
    expect(plan.row.marketingConsentAt).toBe("2026-09-02T10:15:00.000Z");
    // An opt-in is a preference too, so the notification switch follows it.
    expect(plan.row.notificationPrefs.marketing).toBe(true);
  });

  it("leaves marketing off, and its stamp empty, when the box was not ticked", () => {
    const plan = planCustomerLink(
      null,
      user({
        user_metadata: {
          terms_accepted_at: "2026-09-02T10:15:00.000Z",
          marketing_consent_at: "",
        },
      }),
      NOW,
      "cst-new",
    );
    if (plan.action !== "create") throw new Error("expected create");
    expect(plan.row.marketingConsentAt).toBe("");
    expect(plan.row.notificationPrefs.marketing).toBe(false);
  });

  it("ignores a consent stamp that is not a real instant", () => {
    const plan = planCustomerLink(
      null,
      user({ user_metadata: { terms_accepted_at: "evet, kabul ediyorum" } }),
      NOW,
      "cst-new",
    );
    if (plan.action !== "create") throw new Error("expected create");
    expect(plan.row.termsAcceptedAt).toBe("");
  });

  it("creates an unverified row (no welcome coupon) when the address is unconfirmed", () => {
    const plan = planCustomerLink(
      null,
      user({ email_confirmed_at: null }),
      NOW,
    );
    expect(plan.action).toBe("create");
    if (plan.action !== "create") return;
    expect(plan.grantWelcome).toBe(false);
    expect(plan.row.emailVerified).toBe(false);
    expect(plan.row.verifiedAt).toBe("");
  });

  it("lets an unconfirmed newcomer back into the row they created, verifying nothing", () => {
    // The row `create` wrote a request ago carries this identity's id.
    // Refusing it answered 403 email_unconfirmed from the second request on.
    const plan = planCustomerLink(
      customer({ supabaseUserId: "u-1", emailVerified: false }),
      user({ email_confirmed_at: null }),
      NOW,
    );
    expect(plan).toEqual({ action: "none" });
  });

  it("still keeps an unconfirmed identity out of another member's row", () => {
    expect(
      planCustomerLink(
        customer({ supabaseUserId: "u-other", emailVerified: true }),
        user({ email_confirmed_at: null }),
        NOW,
      ),
    ).toEqual({ action: "unconfirmed" });
    expect(
      planCustomerLink(
        customer({ supabaseUserId: "", emailVerified: true }),
        user({ email_confirmed_at: null }),
        NOW,
      ),
    ).toEqual({ action: "unconfirmed" });
  });

  it("refuses a deactivated member without writing anything", () => {
    expect(
      planCustomerLink(customer({ isActive: false }), user(), NOW),
    ).toEqual({ action: "disabled" });
  });

  it("refuses the identity of a closed account instead of re-creating it", () => {
    // DELETE /me frees the e-mail, so the address matches nothing and this
    // used to fall into the `create` branch: whoever still knew the password
    // got a brand-new membership AND a second welcome coupon.
    expect(planCustomerLink(null, user(), NOW, "cst-new", true)).toEqual({
      action: "disabled",
    });
  });

  it("links an existing legacy row: records the id, promotes verification, fills blanks only", () => {
    const plan = planCustomerLink(
      customer({ name: "", phone: "" }),
      user(),
      NOW,
    );
    expect(plan.action).toBe("update");
    if (plan.action !== "update") return;
    expect(plan.grantWelcome).toBe(true);
    expect(plan.patch).toEqual({
      supabaseUserId: "u-1",
      supabaseLinkAttemptedAt: NOW,
      emailVerified: true,
      verifiedAt: NOW,
      verifyToken: "",
      verifyExpires: "",
      name: "Eda Mancuso",
      phone: "+90 555 111 11 11",
      updatedAt: NOW,
    });
  });

  it("never overwrites a name or phone the member typed on the site", () => {
    const plan = planCustomerLink(
      customer({ supabaseUserId: "u-1", emailVerified: true }),
      user({ user_metadata: { full_name: "Someone Else" } }),
      NOW,
    );
    expect(plan).toEqual({ action: "none" });
  });

  it("keeps the site's own verifiedAt when the site verified first", () => {
    const plan = planCustomerLink(
      customer({ verifiedAt: "2026-06-01T00:00:00.000Z" }),
      user(),
      NOW,
    );
    expect(plan.action).toBe("update");
    if (plan.action !== "update") return;
    expect(plan.patch.verifiedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("does not grant a welcome coupon twice for an already verified member", () => {
    const plan = planCustomerLink(
      customer({ emailVerified: true, verifiedAt: "2026-06-01T00:00:00.000Z" }),
      user(),
      NOW,
    );
    expect(plan.action).toBe("update");
    if (plan.action !== "update") return;
    expect(plan.grantWelcome).toBe(false);
    expect(plan.patch.emailVerified).toBeUndefined();
  });
});

describe("shouldAttemptSupabaseLink", () => {
  it("is true only for a never-linked, never-attempted legacy row", () => {
    expect(shouldAttemptSupabaseLink(customer())).toBe(true);
    expect(shouldAttemptSupabaseLink(customer({ supabaseUserId: "u-1" }))).toBe(
      false,
    );
    expect(
      shouldAttemptSupabaseLink(customer({ supabaseLinkAttemptedAt: NOW })),
    ).toBe(false);
  });
});

describe("linkableUserId", () => {
  it("returns the id only when Supabase reports at least one identity", () => {
    expect(linkableUserId({ id: "u-1", identities: [{}] })).toBe("u-1");
  });

  it("returns '' for the obfuscated user Supabase returns for an existing address", () => {
    expect(linkableUserId({ id: "u-fake", identities: [] })).toBe("");
    expect(linkableUserId({ id: "u-fake", identities: null })).toBe("");
    expect(linkableUserId({ id: "u-fake" })).toBe("");
    expect(linkableUserId(null)).toBe("");
    expect(linkableUserId({ id: "", identities: [{}] })).toBe("");
  });
});
