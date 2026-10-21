import { describe, expect, it, vi } from "vitest";

/**
 * What the env break-glass account can do while the database is away
 * (admin audit SHE-11). Its open session stands (admin-session-unavailable);
 * a NEW sign-in does not. Nothing can be counted then (the attempt budget
 * lives in the database), so no password is compared at all: the answer is
 * "unavailable" for a right and a wrong one alike. It used to compare the
 * env passwords with no budget and refuse only at the 2FA read after a right
 * one. The docs said "env hesabı girer"; this pins what really happens.
 */

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    set: (arg: string | { name: string; value: string }, value?: string) => {
      if (typeof arg === "string") jar.set(arg, String(value));
      else jar.set(arg.name, arg.value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
// Every query answers the way the client reports a host that never answered.
vi.mock("@/lib/db", () => {
  const down: Record<string, unknown> = {};
  for (const method of [
    "from",
    "select",
    "eq",
    "neq",
    "lt",
    "in",
    "order",
    "limit",
    "maybeSingle",
    "single",
    "insert",
    "update",
    "upsert",
    "delete",
    "rpc",
  ]) {
    down[method] = () => down;
  }
  down.then = (ok: (v: unknown) => unknown) =>
    Promise.resolve({
      data: null,
      error: { code: "", message: "connect ECONNREFUSED" },
      status: 0,
    }).then(ok);
  return {
    getDb: () => down,
    TABLES: new Proxy({}, { get: (_t, key) => String(key) }),
  };
});

describe("a fresh env sign-in with the database down", () => {
  it("is refused before any password is compared, with no session cookie", async () => {
    process.env.ADMIN_SESSION_SECRET = "test-secret";
    process.env.ADMIN_USERS = JSON.stringify([
      { email: "sahip@laffogato.net", password: "envParolasi", role: "owner" },
    ]);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const auth = await import("@/lib/admin/auth");
    const right = await auth.signInAdmin("sahip@laffogato.net", "envParolasi");
    expect(right).toMatchObject({ ok: false, unavailable: true });
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBeUndefined();
    // A wrong password is answered the same: an uncounted guess says nothing.
    const wrong = await auth.signInAdmin("sahip@laffogato.net", "yanlis");
    expect(wrong).toEqual(right);
    quiet.mockRestore();
    warn.mockRestore();
  });
});
