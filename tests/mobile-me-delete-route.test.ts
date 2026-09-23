import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/lib/mobile/respond";

/**
 * `DELETE /me` says what happened to the Supabase sign-in identity (O28,
 * docs/API-MOBILE.md §4, additive). The member row is anonymised either way;
 * the identity - which still holds the e-mail and the name - is gone only when
 * the deployment holds a service-role key and the delete succeeded. The app
 * tells the member "kişisel bilgilerin silindi" on `deleted` alone, so the
 * route must pass the outcome through as it is and never round it up.
 */

const requireMobileCustomer = vi.fn();
const deleteMe = vi.fn();
vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/mobile/me", () => ({
  deleteMe,
  buildMe: vi.fn(),
  updateMe: vi.fn(),
}));

const { DELETE } = await import("@/app/api/mobile/v1/me/route");

function del() {
  return DELETE(
    new Request("https://laffogato.net/api/mobile/v1/me", {
      method: "DELETE",
      headers: { Authorization: "Bearer test" },
    }),
  );
}

describe("DELETE /me", () => {
  beforeEach(() => {
    requireMobileCustomer.mockReset();
    deleteMe.mockReset();
    requireMobileCustomer.mockResolvedValue({
      ok: true,
      customer: { id: "cst-1", email: "eda@ornek.com" },
    });
  });

  for (const identity of ["deleted", "skipped", "failed"] as const) {
    it(`reports identity "${identity}" exactly as the deletion went`, async () => {
      deleteMe.mockResolvedValue({ ok: true, identity });
      const res = await del();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, identity });
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });
  }

  it("keeps `ok: true` for the builds that read nothing else", async () => {
    deleteMe.mockResolvedValue({ ok: true, identity: "skipped" });
    const body = await (await del()).json();
    expect(body.ok).toBe(true);
  });

  it("is still 409 orders_in_progress while an order runs, with no identity", async () => {
    deleteMe.mockResolvedValue({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    const res = await del();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("orders_in_progress");
    expect(body).not.toHaveProperty("identity");
  });

  it("refuses a caller without a bearer and deletes nothing", async () => {
    requireMobileCustomer.mockResolvedValue({
      ok: false,
      response: apiError(401, "unauthorized", "Giriş yapman gerekiyor."),
    });
    expect((await del()).status).toBe(401);
    expect(deleteMe).not.toHaveBeenCalled();
  });
});
