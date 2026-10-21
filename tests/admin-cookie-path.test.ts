import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, seedRows } from "./_stubs/admin-users-db";

/**
 * The admin cookies are written for the panel's path only (docs/AUDIT.md
 * §13): a request to a site page, its route handlers or its Server Actions
 * never carries an admin session. Sign-in and sign-out also expire the
 * whole-origin cookies of before, which ride with their POST.
 */

interface Write {
  name: string;
  value: string;
  path?: string;
  httpOnly?: boolean;
  sameSite?: string;
  maxAge?: number;
  expires?: Date;
}

const writes: Write[] = [];
const jar = new Map<string, string>();
const flags = vi.hoisted(() => ({ has2FA: false }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    // As Next's ResponseCookies: name and value, or one options object.
    set: (
      arg: string | Write,
      value?: string,
      options?: Omit<Write, "name" | "value">,
    ) => {
      const w: Write =
        typeof arg === "string"
          ? { name: arg, value: String(value), ...options }
          : arg;
      writes.push({ ...w, path: w.path ?? "/" });
      jar.set(w.name, w.value);
    },
    delete: (arg: string | { name: string; path?: string }) => {
      const w = typeof arg === "string" ? { name: arg } : arg;
      writes.push({
        name: w.name,
        value: "",
        path: w.path ?? "/",
        expires: new Date(0),
      });
      jar.delete(w.name);
    },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "1.2.3.4",
  reserveLoginAttempt: async () => ({
    blocked: false,
    remaining: 4,
    retryAfterSeconds: 0,
  }),
  clearLoginLimit: async () => {},
}));
vi.mock("@/lib/admin/twofa", () => ({
  has2FA: async () => flags.has2FA,
  verifyToken: async () => flags.has2FA,
}));
vi.mock("@/lib/db", () => fakeDb());

const auth = await import("@/lib/admin/auth");
const {
  ADMIN_PENDING_COOKIE,
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_PENDING_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
} = await import("@/lib/admin/session-cookie");

const OWNER = { email: "sahip@laffogato.net", password: "envParolasi" };

beforeEach(() => {
  writes.length = 0;
  jar.clear();
  seedRows([]);
  flags.has2FA = false;
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  process.env.ADMIN_USERS = JSON.stringify([{ ...OWNER, role: "owner" }]);
});

const lastWrite = (name: string) =>
  [...writes].reverse().find((w) => w.name === name);
const expired = (w: Write | undefined) =>
  !!w && w.value === "" && (w.expires?.getTime() === 0 || w.maxAge === 0);

describe("the admin cookies", () => {
  it("are the panel's names, not the old whole-origin ones", () => {
    expect(auth.ADMIN_COOKIE_NAME).toBe(ADMIN_SESSION_COOKIE);
    expect(ADMIN_SESSION_COOKIE).not.toBe(LEGACY_ADMIN_SESSION_COOKIE);
    expect(ADMIN_PENDING_COOKIE).not.toBe(LEGACY_ADMIN_PENDING_COOKIE);
  });

  it("put the session on /admin only, httpOnly and SameSite=Lax", async () => {
    const res = await auth.signInAdmin(OWNER.email, OWNER.password);
    expect(res.ok).toBe(true);
    const w = lastWrite(ADMIN_SESSION_COOKIE)!;
    expect(w.path).toBe("/admin");
    expect(w.httpOnly).toBe(true);
    expect(w.sameSite).toBe("lax");
    expect(w.maxAge).toBe(7 * 24 * 60 * 60);
    // Nothing the panel writes is for the whole origin, except the expiry
    // of the old cookies.
    for (const x of writes.filter((x) => x.path === "/")) {
      expect([
        LEGACY_ADMIN_SESSION_COOKIE,
        LEGACY_ADMIN_PENDING_COOKIE,
      ]).toContain(x.name);
      expect(expired(x)).toBe(true);
    }
  });

  it("put the pending 2FA cookie on /admin too, and clear it there", async () => {
    flags.has2FA = true;
    const step = await auth.signInAdmin(OWNER.email, OWNER.password);
    expect(step).toMatchObject({ ok: true, needs2FA: true });
    expect(lastWrite(ADMIN_PENDING_COOKIE)).toMatchObject({
      path: "/admin",
      httpOnly: true,
      maxAge: 5 * 60,
    });
    const done = await auth.complete2FA("123456");
    expect(done.ok).toBe(true);
    expect(lastWrite(ADMIN_SESSION_COOKIE)?.path).toBe("/admin");
    const cleared = lastWrite(ADMIN_PENDING_COOKIE);
    expect(expired(cleared)).toBe(true);
    expect(cleared?.path).toBe("/admin");
  });

  it("expire the old whole-origin cookies on sign-in", async () => {
    jar.set(LEGACY_ADMIN_SESSION_COOKIE, "old");
    await auth.signInAdmin(OWNER.email, OWNER.password);
    for (const name of [
      LEGACY_ADMIN_SESSION_COOKIE,
      LEGACY_ADMIN_PENDING_COOKIE,
    ]) {
      const w = lastWrite(name);
      expect(expired(w), name).toBe(true);
      expect(w?.path, name).toBe("/");
    }
  });

  it("sign out at /admin and take the old cookie with them", async () => {
    await auth.signInAdmin(OWNER.email, OWNER.password);
    writes.length = 0;
    await auth.signOutAdmin();
    const session = lastWrite(ADMIN_SESSION_COOKIE);
    expect(expired(session)).toBe(true);
    // A delete at another path leaves the cookie in the browser.
    expect(session?.path).toBe("/admin");
    const old = lastWrite(LEGACY_ADMIN_SESSION_COOKIE);
    expect(expired(old)).toBe(true);
    expect(old?.path).toBe("/");
  });

  it("cancel a pending 2FA step at both paths", async () => {
    await auth.cancelPending2FA();
    expect(lastWrite(ADMIN_PENDING_COOKIE)).toMatchObject({ path: "/admin" });
    expect(lastWrite(LEGACY_ADMIN_PENDING_COOKIE)).toMatchObject({ path: "/" });
  });
});
