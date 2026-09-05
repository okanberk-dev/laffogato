import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { allRows, fakeDb, seedRows } from "./_stubs/admin-users-db";

vi.mock("@/lib/db", () => fakeDb());

const {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  resolveAdminUser,
  setAdminPassword,
  updateAdminUser,
  verifyAdminPassword,
} = await import("@/lib/admin/users");

const OWNER = {
  email: "sahip@laffogato.net",
  name: "Sahip",
  role: "owner",
  password: "cokGizliParola1",
  createdBy: "sahip@laffogato.net",
};

beforeEach(() => {
  seedRows([]);
});

describe("createAdminUser", () => {
  it("stores a bcrypt hash, never the password", async () => {
    const res = await createAdminUser(OWNER);
    expect(res.ok).toBe(true);
    const row = allRows()[0];
    expect(row.passwordHash).not.toBe(OWNER.password);
    expect(await bcrypt.compare(OWNER.password, String(row.passwordHash))).toBe(
      true,
    );
  });

  it("never hands the hash back to the caller", async () => {
    const res = await createAdminUser(OWNER);
    if (!res.ok) throw new Error("beklenmedik hata");
    expect("passwordHash" in res.value).toBe(false);
  });

  it("lowercases the address and refuses a duplicate", async () => {
    await createAdminUser({ ...OWNER, email: "Sahip@Laffogato.NET" });
    expect(allRows()[0].email).toBe("sahip@laffogato.net");
    const again = await createAdminUser(OWNER);
    expect(again).toMatchObject({ ok: false, error: "exists" });
  });

  it("refuses a password shorter than ten characters", async () => {
    const res = await createAdminUser({ ...OWNER, password: "123456789" });
    expect(res).toMatchObject({ ok: false, error: "weak_password" });
    expect(allRows()).toHaveLength(0);
  });

  it("refuses a role that is not in the matrix", async () => {
    const res = await createAdminUser({ ...OWNER, role: "superuser" });
    expect(res).toMatchObject({ ok: false, error: "invalid_role" });
  });
});

describe("last owner", () => {
  beforeEach(async () => {
    seedRows([]);
    await createAdminUser(OWNER);
    await createAdminUser({
      ...OWNER,
      email: "kasiyer@laffogato.net",
      name: "Eda",
      role: "cashier",
    });
  });

  it("cannot be deactivated", async () => {
    const res = await updateAdminUser(OWNER.email, { isActive: false });
    expect(res).toMatchObject({ ok: false, error: "last_owner" });
    expect(allRows()[0].isActive).toBe(true);
  });

  it("cannot be demoted", async () => {
    const res = await updateAdminUser(OWNER.email, { role: "manager" });
    expect(res).toMatchObject({ ok: false, error: "last_owner" });
    expect(allRows()[0].role).toBe("owner");
  });

  it("cannot be deleted", async () => {
    const res = await deleteAdminUser(OWNER.email);
    expect(res).toMatchObject({ ok: false, error: "last_owner" });
    expect(allRows()).toHaveLength(2);
  });

  it("may step down once a second owner is active", async () => {
    await createAdminUser({
      ...OWNER,
      email: "ikinci@laffogato.net",
      name: "İkinci",
    });
    const res = await updateAdminUser(OWNER.email, { role: "manager" });
    expect(res.ok).toBe(true);
  });

  it("does not block a change that leaves the account an active owner", async () => {
    const res = await updateAdminUser(OWNER.email, { name: "Yeni ad" });
    expect(res.ok).toBe(true);
    expect(allRows()[0].name).toBe("Yeni ad");
  });
});

describe("resolveAdminUser", () => {
  beforeEach(async () => {
    seedRows([]);
    await createAdminUser(OWNER);
    await createAdminUser({
      ...OWNER,
      email: "kasiyer@laffogato.net",
      name: "Eda",
      role: "cashier",
    });
  });

  it("returns the row with the role the panel gave it", async () => {
    const row = await resolveAdminUser("Kasiyer@laffogato.net");
    expect(row?.role).toBe("cashier");
    expect(await verifyAdminPassword(row!, OWNER.password)).toBe(true);
    expect(await verifyAdminPassword(row!, "yanlis-parola")).toBe(false);
  });

  it("hides a deactivated account from the login path", async () => {
    await updateAdminUser("kasiyer@laffogato.net", { isActive: false });
    expect(await resolveAdminUser("kasiyer@laffogato.net")).toBeNull();
  });
});

describe("setAdminPassword", () => {
  it("replaces the hash and leaves the old password invalid", async () => {
    seedRows([]);
    await createAdminUser(OWNER);
    const res = await setAdminPassword(OWNER.email, "yeniParolaUzun1");
    expect(res.ok).toBe(true);
    const row = await resolveAdminUser(OWNER.email);
    expect(await verifyAdminPassword(row!, "yeniParolaUzun1")).toBe(true);
    expect(await verifyAdminPassword(row!, OWNER.password)).toBe(false);
  });

  it("refuses a short password and keeps the old one working", async () => {
    seedRows([]);
    await createAdminUser(OWNER);
    const res = await setAdminPassword(OWNER.email, "kisa");
    expect(res).toMatchObject({ ok: false, error: "weak_password" });
    const row = await resolveAdminUser(OWNER.email);
    expect(await verifyAdminPassword(row!, OWNER.password)).toBe(true);
  });
});

describe("listAdminUsers", () => {
  it("lists accounts without their hashes", async () => {
    seedRows([]);
    await createAdminUser(OWNER);
    const list = await listAdminUsers();
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("$2");
  });
});
