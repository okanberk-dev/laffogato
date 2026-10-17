import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `deleteSupabaseIdentity` runs LAST in an account closure (`deleteMe`), after
 * the member row, the orders and the barista grant are already anonymised.
 * supabase-js puts no time limit on `auth.admin.deleteUser`, so a Supabase
 * that accepted the connection and never answered held the whole closure
 * until the platform killed the function: the panel's "Hesabı sil" then
 * wrote no audit row and showed a crash for an account that WAS closed, and
 * the app's DELETE /me answered 504 for one. A bounded wait answers `failed`,
 * which every caller already reports honestly.
 */

const deleteUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { admin: { deleteUser } } })),
}));

const { deleteSupabaseIdentity, IDENTITY_DELETE_TIMEOUT_MS } =
  await import("@/lib/supabase/admin");

const ORIGINAL = process.env.SUPABASE_SERVICE_ROLE_KEY;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-not-real";
  (globalThis as { __laffogatoSupabaseAdmin?: unknown }).__laffogatoSupabaseAdmin =
    undefined;
  deleteUser.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  errorSpy.mockRestore();
  (globalThis as { __laffogatoSupabaseAdmin?: unknown }).__laffogatoSupabaseAdmin =
    undefined;
  if (ORIGINAL === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL;
});

describe("deleteSupabaseIdentity", () => {
  it("gives up on a Supabase that never answers, and says failed", async () => {
    vi.useFakeTimers();
    deleteUser.mockImplementation(() => new Promise(() => {}));
    const outcome = deleteSupabaseIdentity("u-0001");
    await vi.advanceTimersByTimeAsync(IDENTITY_DELETE_TIMEOUT_MS);
    await expect(outcome).resolves.toBe("failed");
    expect(String(errorSpy.mock.calls[0]?.[0])).toMatch(/timed out/);
  });

  it("leaves room for the rest of the closure inside DELETE /me's 15 s", () => {
    expect(IDENTITY_DELETE_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  it("still reports a prompt answer either way", async () => {
    deleteUser.mockResolvedValueOnce({ error: null });
    await expect(deleteSupabaseIdentity("u-0001")).resolves.toBe("deleted");
    deleteUser.mockResolvedValueOnce({ error: { message: "User not found" } });
    await expect(deleteSupabaseIdentity("u-0001")).resolves.toBe("failed");
    deleteUser.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));
    await expect(deleteSupabaseIdentity("u-0001")).resolves.toBe("failed");
  });

  it("does nothing without an id or without the key", async () => {
    await expect(deleteSupabaseIdentity("  ")).resolves.toBe("skipped");
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(deleteSupabaseIdentity("u-0001")).resolves.toBe("skipped");
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
