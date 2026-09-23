import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every bearer call used to cost a round-trip to Supabase Auth, so one client
 * polling the app's screens burned the project's shared auth quota and slowed
 * every member down. The answer is remembered for a minute, keyed on a hash of
 * the token; the `customers` row is still read on every request, so a
 * deactivated account is refused immediately.
 */

const getUser = vi.fn();
const ensureCustomerForSupabaseUser = vi.fn();

vi.mock("@/lib/supabase/anon", () => ({
  getSupabaseAnonClient: () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/customer/supabase-bridge", () => ({
  ensureCustomerForSupabaseUser,
}));

const { requireMobileCustomer, resetMobileAuthCache } =
  await import("@/lib/mobile/auth");
const { tokenExpiryMs } = await import("@/lib/mobile/auth-core");

/** A token whose payload carries `exp` at `expSeconds`. */
function tokenExpiringAt(expSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: "u-1", exp: expSeconds }),
  ).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.c2lnbmF0dXJl`;
}

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.c2lnbmF0dXJl";
const user = { id: "u-1", email: "eda@example.com" };

function req(token = TOKEN): Request {
  return new Request("https://laffogato.net/api/mobile/v1/me", {
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  resetMobileAuthCache();
  getUser.mockReset();
  ensureCustomerForSupabaseUser.mockReset();
  getUser.mockResolvedValue({ data: { user }, error: null });
  ensureCustomerForSupabaseUser.mockResolvedValue({
    ok: true,
    customer: { email: "eda@example.com" },
  });
});

describe("bearer verification", () => {
  it("asks Supabase once for a repeated token", async () => {
    await requireMobileCustomer(req());
    await requireMobileCustomer(req());
    await requireMobileCustomer(req());
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("still asks for a token it has not seen", async () => {
    await requireMobileCustomer(req());
    await requireMobileCustomer(req(`${TOKEN}x`));
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("re-reads the member on every call, so a disabled account is refused at once", async () => {
    await requireMobileCustomer(req());
    ensureCustomerForSupabaseUser.mockResolvedValue({
      ok: false,
      reason: "account_disabled",
    });
    const second = await requireMobileCustomer(req());
    expect(second.ok).toBe(false);
    expect(ensureCustomerForSupabaseUser).toHaveBeenCalledTimes(2);
    if (!second.ok) expect(second.response.status).toBe(403);
  });

  it("never caches a rejected token", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT", status: 401 },
    });
    await requireMobileCustomer(req());
    await requireMobileCustomer(req());
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});

/**
 * The cache is per instance and cannot be flushed from outside the process,
 * so it must never outlive the token it was built from: a session that has
 * been signed out and has since expired would otherwise still be replayable
 * for the rest of the minute.
 */
describe("cache lifetime is capped by the token", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads exp out of the payload", () => {
    expect(tokenExpiryMs(tokenExpiringAt(1_800_000_000))).toBe(
      1_800_000_000_000,
    );
    expect(tokenExpiryMs("not.a.jwt")).toBeNull();
    expect(tokenExpiryMs("only-one-part")).toBeNull();
  });

  it("does not serve a token past its own exp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00.000Z"));
    // 10 seconds of life left - well inside the 60-second TTL.
    const token = tokenExpiringAt(
      Math.floor(Date.parse("2026-09-05T12:00:10.000Z") / 1000),
    );
    await requireMobileCustomer(req(token));
    vi.setSystemTime(new Date("2026-09-05T12:00:20.000Z"));
    await requireMobileCustomer(req(token));
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("still caches within the token's life", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00.000Z"));
    const token = tokenExpiringAt(
      Math.floor(Date.parse("2026-09-05T13:00:00.000Z") / 1000),
    );
    await requireMobileCustomer(req(token));
    vi.setSystemTime(new Date("2026-09-05T12:00:20.000Z"));
    await requireMobileCustomer(req(token));
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});
