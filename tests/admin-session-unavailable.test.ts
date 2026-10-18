import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { allRows, fakeDb, seedRows } from "./_stubs/admin-users-db";

/**
 * A database stumble used to sign every panel user out: the account lookup
 * swallowed the error and answered "no account", so the layout rendered the
 * signed-out shell, requireRole redirected to /admin/giris and a panel
 * action threw the operator onto the login page, form and all (admin audit
 * SHE-11). Now the lookup's failure is its own error, and only the env
 * break-glass account's session stands while the panel rows are unreadable
 * (`has2FA` is stubbed here; the real one needs the database to sign in).
 */

const jar = new Map<string, string>();
const db = vi.hoisted(() => ({
  selects: 0,
  failFrom: Infinity,
  has2FA: false,
}));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
);

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (arg: string | { name: string; value: string }, value?: string) => {
      if (typeof arg === "string") jar.set(arg, String(value));
      else jar.set(arg.name, arg.value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
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
  has2FA: async () => db.has2FA,
  verifyToken: async () => db.has2FA,
}));
// The users stub, with a switch: from the `failFrom`-th read on, every read
// answers the way the client reports a host that never answered.
vi.mock("@/lib/db", () => {
  const real = fakeDb();
  return {
    ...real,
    getDb: () => {
      const inner = real.getDb().from();
      return {
        from: () => ({
          ...inner,
          select: () => {
            db.selects += 1;
            if (db.selects < db.failFrom) return inner.select();
            const down = {
              eq: () => down,
              maybeSingle: () => down,
              limit: () => down,
              then: (ok: (v: unknown) => unknown) =>
                Promise.resolve({
                  data: null,
                  error: { code: "", message: "connect ECONNREFUSED" },
                  status: 0,
                }).then(ok),
            };
            return down;
          },
        }),
      };
    },
  };
});

const auth = await import("@/lib/admin/auth");
const { createAdminUser } = await import("@/lib/admin/users");

const ENV_OWNER = { email: "sahip@laffogato.net", password: "envParolasi" };
const MANAGER = {
  email: "mudur@laffogato.net",
  name: "Mira",
  role: "manager",
  password: "mudurParolasi1",
  createdBy: "sahip@laffogato.net",
};

function databaseGoesDown() {
  db.failFrom = db.selects + 1;
}

async function signedIn(email: string, password: string): Promise<string> {
  const res = await auth.signInAdmin(email, password);
  expect(res.ok).toBe(true);
  return jar.get(auth.ADMIN_COOKIE_NAME)!;
}

beforeEach(() => {
  jar.clear();
  seedRows([]);
  db.selects = 0;
  db.failFrom = Infinity;
  db.has2FA = false;
  redirect.mockClear();
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  process.env.ADMIN_USERS = JSON.stringify([{ ...ENV_OWNER, role: "owner" }]);
});

describe("a panel account while the database is away", () => {
  it("is not signed out: the session check throws its own error", async () => {
    await createAdminUser(MANAGER);
    const cookie = await signedIn(MANAGER.email, MANAGER.password);
    databaseGoesDown();
    const err = await auth.sessionFromToken(cookie).catch((e: unknown) => e);
    expect(auth.isAdminSessionUnavailable(err)).toBe(true);
    expect(err).toMatchObject({ code: auth.ADMIN_SESSION_UNAVAILABLE });
    // The cookie is still there for when the database answers again.
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBe(cookie);
  });

  it("propagates through getAdminSession and requireRole instead of a login redirect", async () => {
    await createAdminUser(MANAGER);
    await signedIn(MANAGER.email, MANAGER.password);
    databaseGoesDown();
    await expect(auth.getAdminSession()).rejects.toSatisfy(
      auth.isAdminSessionUnavailable,
    );
    await expect(auth.requireRole("orders")).rejects.toSatisfy(
      auth.isAdminSessionUnavailable,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("comes back as the same session once the database answers", async () => {
    await createAdminUser(MANAGER);
    const cookie = await signedIn(MANAGER.email, MANAGER.password);
    databaseGoesDown();
    await auth.sessionFromToken(cookie).catch(() => null);
    db.failFrom = Infinity;
    expect(await auth.sessionFromToken(cookie)).toMatchObject({
      email: MANAGER.email,
      role: "manager",
    });
  });

  it("is still signed out when the database says the account is gone", async () => {
    await createAdminUser(MANAGER);
    const cookie = await signedIn(MANAGER.email, MANAGER.password);
    seedRows([]);
    expect(await auth.sessionFromToken(cookie)).toBeNull();
  });

  it("answers a sign-in whose account cannot be read back, without a session", async () => {
    await createAdminUser(MANAGER);
    // The password check reads the row; the session issue reads it again.
    db.failFrom = db.selects + 2;
    const res = await auth.signInAdmin(MANAGER.email, MANAGER.password);
    expect(res).toMatchObject({ ok: false, unavailable: true });
    expect(res.error).toMatch(/tamamlanamadı/);
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBeUndefined();
  });
});

describe("the env break-glass account while the database is away", () => {
  it("signs in past an unreadable panel row and keeps its session", async () => {
    databaseGoesDown();
    const cookie = await signedIn(ENV_OWNER.email, ENV_OWNER.password);
    expect(await auth.sessionFromToken(cookie)).toMatchObject({
      email: ENV_OWNER.email,
      role: "owner",
    });
  });

  it("cannot vouch for a session issued to a panel row at the same address", async () => {
    await createAdminUser({
      ...MANAGER,
      email: ENV_OWNER.email,
      role: "owner",
    });
    const cookie = await signedIn(ENV_OWNER.email, MANAGER.password);
    databaseGoesDown();
    const err = await auth.sessionFromToken(cookie).catch((e: unknown) => e);
    // Not null (signed out) and not the env owner: unavailable.
    expect(auth.isAdminSessionUnavailable(err)).toBe(true);
  });
});

describe("a panel password at an env address", () => {
  it("gets no env session when the row goes unreadable mid-login", async () => {
    // The panel made this address a manager; env still lists it as owner.
    await createAdminUser({ ...MANAGER, email: ENV_OWNER.email });
    db.failFrom = db.selects + 2;
    const res = await auth.signInAdmin(ENV_OWNER.email, MANAGER.password);
    expect(res).toMatchObject({ ok: false, unavailable: true });
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBeUndefined();
  });

  it("gets no owner session from the 2FA step either", async () => {
    await createAdminUser({ ...MANAGER, email: ENV_OWNER.email });
    db.has2FA = true;
    const step = await auth.signInAdmin(ENV_OWNER.email, MANAGER.password);
    expect(step).toMatchObject({ ok: true, needs2FA: true, role: "manager" });
    databaseGoesDown();
    const res = await auth.complete2FA("123456");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/tamamlanamadı/);
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBeUndefined();
  });

  it("gets no env session from the 2FA step when the roles agree", async () => {
    // Same role on both records: the role check alone let this through, and
    // the cookie, issued on the env password, outlived the panel row's
    // deactivation (found in review).
    await createAdminUser({
      ...MANAGER,
      email: ENV_OWNER.email,
      role: "owner",
    });
    db.has2FA = true;
    const step = await auth.signInAdmin(ENV_OWNER.email, MANAGER.password);
    expect(step).toMatchObject({ ok: true, needs2FA: true, role: "owner" });
    databaseGoesDown();
    const res = await auth.complete2FA("123456");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/tamamlanamadı/);
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBeUndefined();
  });

  it("gets no env session when the panel row is deactivated between the steps", async () => {
    await createAdminUser({
      ...MANAGER,
      email: ENV_OWNER.email,
      role: "owner",
    });
    db.has2FA = true;
    await auth.signInAdmin(ENV_OWNER.email, MANAGER.password);
    seedRows(allRows().map((r) => ({ ...r, isActive: false })));
    const res = await auth.complete2FA("123456");
    expect(res).toMatchObject({ ok: false });
    expect(res.error).toMatch(/Yeniden giriş yap/);
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBeUndefined();
  });
});

describe("the env account's 2FA step while the panel rows are unreadable", () => {
  it("still completes: the env password is what the password step checked", async () => {
    db.has2FA = true;
    const step = await auth.signInAdmin(ENV_OWNER.email, ENV_OWNER.password);
    expect(step).toMatchObject({ ok: true, needs2FA: true, role: "owner" });
    databaseGoesDown();
    const res = await auth.complete2FA("123456");
    expect(res).toEqual({ ok: true, role: "owner" });
    const cookie = jar.get(auth.ADMIN_COOKIE_NAME)!;
    expect(await auth.sessionFromToken(cookie)).toMatchObject({
      email: ENV_OWNER.email,
      role: "owner",
    });
  });

  it("refuses a pending cookie without the credential source (issued before it)", async () => {
    const expiresAt = Date.now() + 60_000;
    const payload = `pending|${ENV_OWNER.email}|owner|${expiresAt}`;
    const sig = createHmac("sha256", "test-secret")
      .update(payload)
      .digest("hex");
    jar.set("laffogato_admin_pending_2fa", `${payload}|${sig}`);
    expect(await auth.getPendingSession()).toBeNull();
    const res = await auth.complete2FA("123456");
    expect(res).toMatchObject({ ok: false });
    expect(jar.get(auth.ADMIN_COOKIE_NAME)).toBeUndefined();
  });
});

describe("isAdminSessionUnavailable", () => {
  it("knows the error by its brand or its code, and nothing else", () => {
    expect(
      auth.isAdminSessionUnavailable(
        new auth.AdminSessionUnavailableError(new Error("x")),
      ),
    ).toBe(true);
    expect(
      auth.isAdminSessionUnavailable({ code: "ADMIN_SESSION_UNAVAILABLE" }),
    ).toBe(true);
    expect(auth.isAdminSessionUnavailable(new Error("db down"))).toBe(false);
    expect(auth.isAdminSessionUnavailable(null)).toBe(false);
  });
});
