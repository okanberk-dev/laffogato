import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A missing SUPABASE_SERVICE_ROLE_KEY used to be invisible.
 *
 * Every service-role job answers `skipped` without it and the site carries on,
 * which is the intended fallback - but it also means a site password reset
 * leaves the old password opening the app, and a closed account's sign-in
 * record stays in Supabase, with nothing on any screen or in any log to say
 * so. The only place to check was the Vercel dashboard. These tests pin the
 * three ways it is now visible: `hasServiceRole()`, the skip logs, and the
 * line on the settings page - and that none of them exposes the value.
 */

const updateUserById = vi.fn();
const deleteUser = vi.fn();
const createClient = vi.fn(() => ({
  auth: { admin: { updateUserById, deleteUser } },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const admin = await import("@/lib/supabase/admin");
const { IdentityKeyStatus } = await import(
  "@/app/admin/ayarlar/identity-status"
);

const ORIGINAL = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAKE_KEY = "test-service-role-key-not-a-real-one";

function setKey(value: string | undefined): void {
  if (value === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = value;
  // The admin client is a process-wide singleton; each case starts clean.
  (globalThis as { __laffogatoSupabaseAdmin?: unknown }).__laffogatoSupabaseAdmin =
    undefined;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  updateUserById.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  setKey(ORIGINAL);
});

describe("hasServiceRole", () => {
  it("is false when the variable is missing, empty or blank", () => {
    setKey(undefined);
    expect(admin.hasServiceRole()).toBe(false);
    setKey("");
    expect(admin.hasServiceRole()).toBe(false);
    setKey("   ");
    expect(admin.hasServiceRole()).toBe(false);
  });

  it("is true when a key is set, and returns only a boolean", () => {
    setKey(FAKE_KEY);
    expect(admin.hasServiceRole()).toBe(true);
    expect(typeof admin.hasServiceRole()).toBe("boolean");
  });
});

describe("updateSupabasePassword says why it skipped", () => {
  it("logs the missing key for a linked member and builds no client", async () => {
    setKey(undefined);
    await expect(admin.updateSupabasePassword("u-1", "yeni-sifre-123")).resolves.toBe(
      "skipped",
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain("[supabase] password sync skipped");
    expect(line).toContain("SUPABASE_SERVICE_ROLE_KEY is not set");
    // PII rule: neither the id nor the password reaches the log.
    expect(line).not.toContain("u-1");
    expect(line).not.toContain("yeni-sifre-123");
  });

  it("stays quiet for a member with no identity to update", async () => {
    setKey(undefined);
    await expect(admin.updateSupabasePassword("", "yeni-sifre-123")).resolves.toBe(
      "skipped",
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not log a skip when the key is there", async () => {
    setKey(FAKE_KEY);
    await expect(admin.updateSupabasePassword("u-1", "yeni-sifre-123")).resolves.toBe(
      "updated",
    );
    expect(updateUserById).toHaveBeenCalledWith("u-1", {
      password: "yeni-sifre-123",
    });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("deleteSupabaseIdentity without a key", () => {
  it("still answers skipped and builds no client", async () => {
    setKey(undefined);
    await expect(admin.deleteSupabaseIdentity("u-1")).resolves.toBe("skipped");
    expect(createClient).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("settings page: Supabase servis anahtarı", () => {
  const render = (hasKey: boolean) =>
    renderToStaticMarkup(createElement(IdentityKeyStatus, { hasKey }));

  it("says tanımlı when the key is present", () => {
    const html = render(true);
    expect(html).toContain("Supabase servis anahtarı: tanımlı");
    expect(html).not.toContain("tanımlı değil");
  });

  it("says tanımlı değil, and what that costs, when it is missing", () => {
    const html = render(false);
    expect(html).toContain("Supabase servis anahtarı: tanımlı değil");
    expect(html).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(html).toContain("eski");
  });

  it("is fed a boolean and never reads the environment itself", () => {
    const component = readFileSync(
      "src/app/admin/ayarlar/identity-status.tsx",
      "utf8",
    );
    const page = readFileSync("src/app/admin/ayarlar/page.tsx", "utf8");
    expect(component).not.toContain("process.env");
    expect(page).not.toContain("process.env");
    expect(page).toContain("hasServiceRole()");
    expect(page).toContain("<IdentityKeyStatus");
  });

  it("never renders the key value, whatever the environment holds", () => {
    setKey(FAKE_KEY);
    const html = render(admin.hasServiceRole());
    expect(html).not.toContain(FAKE_KEY);
  });
});
