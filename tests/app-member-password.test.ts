import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A member who signed up in the app has no password on this site.
 *
 * Their row is created with `passwordHash: ""` (docs/AUTH-BRIDGE.md §3), and
 * the change-password form compared what they typed against that empty hash -
 * always false. So the form answered "Mevcut şifre hatalı" whatever they
 * entered, forever, and the app has no change-password screen either: the only
 * way to change a password they DID know was to claim they had forgotten it.
 */

const rows: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];
const signInWithPassword = vi.fn();
const updateSupabasePassword = vi.fn();

vi.mock("@/lib/supabase/anon", () => ({
  getSupabaseAnonClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ updateSupabasePassword }));
vi.mock("@/lib/customer/coupons", () => ({
  grantWelcomeCoupon: vi.fn(),
  birthdayMonth: () => 0,
}));

// A single-table stand-in: enough of the query builder for this one path.
function builder() {
  const api: Record<string, unknown> = {};
  const chain = () => api;
  Object.assign(api, {
    select: chain,
    eq: chain,
    order: chain,
    limit: chain,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    update: (patch: Record<string, unknown>) => {
      updates.push(patch);
      return api;
    },
    insert: chain,
    upsert: chain,
    then: undefined,
  });
  // `await sb.from(...).update(...).eq(...)` resolves the chain itself.
  (api as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: [{ id: "cst-1" }], error: null });
  return api;
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({ from: () => builder() }),
  TABLES: { customers: "customers" },
}));
vi.mock("@/lib/db/health", () => ({ raiseDbError: vi.fn() }));

const { changeCustomerPassword } = await import("@/lib/customer/store");

const APP_MEMBER = {
  id: "cst-1",
  email: "eda@example.com",
  name: "Eda",
  passwordHash: "",
  supabaseUserId: "u-1",
  supabaseLinkAttemptedAt: "",
  passwordMirroredAt: "",
  isActive: true,
  addresses: [],
  wishlist: [],
};

beforeEach(() => {
  rows.length = 0;
  updates.length = 0;
  signInWithPassword.mockReset();
  updateSupabasePassword.mockReset();
  updateSupabasePassword.mockResolvedValue("updated");
  rows.push({ ...APP_MEMBER });
});

describe("changeCustomerPassword for a member born in the app", () => {
  it("accepts the password Supabase accepts, and writes both copies", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });

    const result = await changeCustomerPassword(
      "eda@example.com",
      "eski-sifre",
      "yeni-sifre-123",
    );

    expect(result).toEqual({ ok: true });
    expect(updateSupabasePassword).toHaveBeenCalledWith("u-1", "yeni-sifre-123");
    // The site gains a hash of its own, so the next sign-in has two copies to
    // agree on rather than one.
    expect(updates.some((u) => typeof u.passwordHash === "string" && u.passwordHash)).toBe(true);
  });

  it("refuses a password Supabase refuses", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await changeCustomerPassword(
      "eda@example.com",
      "yanlis",
      "yeni-sifre-123",
    );
    expect(result).toEqual({ ok: false, error: "Mevcut şifre hatalı." });
    expect(updateSupabasePassword).not.toHaveBeenCalled();
  });

  it("refuses when Supabase answers with somebody else's user", async () => {
    // Defence in depth: the address is the lookup key on both sides, but the
    // row's own id is what ties this answer to this member.
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u-SOMEONE-ELSE" } },
      error: null,
    });
    const result = await changeCustomerPassword(
      "eda@example.com",
      "sifre",
      "yeni-sifre-123",
    );
    expect(result.ok).toBe(false);
  });

  it("does not ask Supabase at all for a row that has its own hash", async () => {
    rows[0] = { ...APP_MEMBER, passwordHash: "$2a$10$notarealhashatall" };
    await changeCustomerPassword("eda@example.com", "x", "yeni-sifre-123");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("does not ask Supabase for an unlinked row - there is nothing to ask about", async () => {
    rows[0] = { ...APP_MEMBER, supabaseUserId: "" };
    const result = await changeCustomerPassword(
      "eda@example.com",
      "sifre",
      "yeni-sifre-123",
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});
