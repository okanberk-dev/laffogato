import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, seedRows } from "./_stubs/admin-users-db";

/**
 * Where a panel login is allowed to come from.
 *
 * Admin accounts used to live only in ADMIN_USERS, so hiring a cashier meant
 * editing an environment variable and redeploying. They now live in the
 * database and the env record stays as the break-glass path — these assert the
 * precedence between the two, and that the old plain-text env comparison still
 * works so nobody is locked out by the deploy that introduces the table.
 */

const jar = new Map<string, string>();

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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "1.2.3.4",
  checkLoginLimit: async () => ({
    blocked: false,
    remaining: 5,
    retryAfterSeconds: 0,
  }),
  recordLoginFailure: async () => ({
    blocked: false,
    remaining: 4,
    retryAfterSeconds: 0,
  }),
  clearLoginLimit: async () => {},
}));
vi.mock("@/lib/admin/twofa", () => ({
  has2FA: async () => false,
  verifyToken: async () => false,
}));
vi.mock("@/lib/db", () => fakeDb());

const { signInAdmin } = await import("@/lib/admin/auth");
const { createAdminUser, updateAdminUser } = await import("@/lib/admin/users");

const ENV_OWNER = { email: "sahip@laffogato.net", password: "envParolasi" };

beforeEach(() => {
  jar.clear();
  seedRows([]);
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  process.env.ADMIN_USERS = JSON.stringify([{ ...ENV_OWNER, role: "owner" }]);
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
});

describe("env accounts", () => {
  it("still sign in with a plain-text password", async () => {
    const res = await signInAdmin(ENV_OWNER.email, ENV_OWNER.password);
    expect(res).toMatchObject({ ok: true, role: "owner" });
  });

  it("report a missing configuration only when nothing is configured", async () => {
    delete process.env.ADMIN_USERS;
    const res = await signInAdmin("kimse@laffogato.net", "parola");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("yapılandırılmamış");
  });
});

describe("database accounts", () => {
  it("win over the env record for the same address", async () => {
    await createAdminUser({
      email: ENV_OWNER.email,
      name: "Sahip",
      role: "manager",
      password: "veritabaniParolasi",
      createdBy: "kurulum",
    });

    // The env password no longer opens this account…
    const stale = await signInAdmin(ENV_OWNER.email, ENV_OWNER.password);
    expect(stale.ok).toBe(false);

    // …and the role the panel gave it is the one the session carries.
    const fresh = await signInAdmin(ENV_OWNER.email, "veritabaniParolasi");
    expect(fresh).toMatchObject({ ok: true, role: "manager" });
  });

  it("carry the cashier role through to the redirect decision", async () => {
    await createAdminUser({
      email: "kasiyer@laffogato.net",
      name: "Eda",
      role: "cashier",
      password: "kasaParolasi1",
      createdBy: "sahip@laffogato.net",
    });
    const res = await signInAdmin("Kasiyer@laffogato.net", "kasaParolasi1");
    expect(res).toMatchObject({ ok: true, role: "cashier" });
  });

  it("sign in even when the env variable is empty", async () => {
    delete process.env.ADMIN_USERS;
    await createAdminUser({
      email: "kasiyer@laffogato.net",
      name: "Eda",
      role: "cashier",
      password: "kasaParolasi1",
      createdBy: "sahip@laffogato.net",
    });
    const res = await signInAdmin("kasiyer@laffogato.net", "kasaParolasi1");
    expect(res).toMatchObject({ ok: true, role: "cashier" });
  });

  it("fall back to the env record when deactivated — env is the way back in", async () => {
    await createAdminUser({
      email: ENV_OWNER.email,
      name: "Sahip",
      role: "owner",
      password: "veritabaniParolasi",
      createdBy: "kurulum",
    });
    await createAdminUser({
      email: "ikinci@laffogato.net",
      name: "İkinci",
      role: "owner",
      password: "veritabaniParolasi",
      createdBy: "kurulum",
    });
    await updateAdminUser(ENV_OWNER.email, { isActive: false });

    const res = await signInAdmin(ENV_OWNER.email, ENV_OWNER.password);
    expect(res).toMatchObject({ ok: true, role: "owner" });
  });

  it("reject a wrong password without touching the env fallback", async () => {
    await createAdminUser({
      email: ENV_OWNER.email,
      name: "Sahip",
      role: "owner",
      password: "veritabaniParolasi",
      createdBy: "kurulum",
    });
    const res = await signInAdmin(ENV_OWNER.email, "tamamen-yanlis");
    expect(res.ok).toBe(false);
  });
});
