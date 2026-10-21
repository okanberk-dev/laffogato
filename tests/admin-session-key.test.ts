import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { adminSessionKey } from "@/lib/admin/session-key";

/**
 * The panel's cookies are signed with a key of their own (session-key.ts).
 * The member cookie is signed with ADMIN_SESSION_SECRET itself when
 * CUSTOMER_SESSION_SECRET is unset (customer/auth.ts), and a member address
 * holding a "|" made its `email|exp|fp|sig` read as the panel's
 * `email|role|exp|fp|sig`: the member's own cookie passed the panel's
 * signature check (the proxy, the polls' "unchanged" answer) and failed only
 * at the fingerprint. Here the member cookie is minted by the member code
 * itself.
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
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/customer/store", () => ({
  getCustomerByEmail: async () => null,
  // 16 hex, as the member fingerprint is.
  getSessionFingerprint: async () => "0123456789abcdef",
}));

const SECRET = "s".repeat(48);
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.CUSTOMER_SESSION_SECRET;

const customer = await import("@/lib/customer/auth");
const auth = await import("@/lib/admin/auth");

function signed(key: string | Buffer, payload: string): string {
  const sig = createHmac("sha256", key).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

describe("the panel cookie's own key", () => {
  it("does not take a member cookie whose address lines up with the panel's fields", async () => {
    await customer.setActiveCustomerSession("owner@laffogato.net|owner");
    const member = jar.get("laffogato_customer_session")!;
    // email | role | exp | fingerprint | sig: the panel's five fields.
    expect(member.split("|")).toHaveLength(5);
    expect(auth.readSessionFromCookieValue(member)).toBeNull();
  });

  it("takes a cookie signed with the derived key, and not one signed with the secret", () => {
    const exp = Date.now() + 3_600_000;
    const payload = `sahip@laffogato.net|owner|${exp}|abcdef0123456789abcdef01`;
    expect(
      auth.readSessionFromCookieValue(signed(adminSessionKey(SECRET), payload)),
    ).toMatchObject({ email: "sahip@laffogato.net", role: "owner" });
    expect(auth.readSessionFromCookieValue(signed(SECRET, payload))).toBeNull();
  });

  it("is derived from the secret, and is not the secret", () => {
    expect(adminSessionKey(SECRET).equals(Buffer.from(SECRET))).toBe(false);
    expect(adminSessionKey(SECRET).equals(adminSessionKey(SECRET))).toBe(true);
    expect(
      adminSessionKey(SECRET).equals(adminSessionKey("t".repeat(48))),
    ).toBe(false);
  });
});
