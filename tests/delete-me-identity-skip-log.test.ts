import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `DELETE /me` answers `identity: "skipped"` when it could not delete the
 * member's Supabase sign-in record. That is a supported outcome, but it used
 * to be silent: a deployment without SUPABASE_SERVICE_ROLE_KEY skips every
 * single deletion, and the e-mail and name stay in Supabase with nothing in
 * the log to say so. Now each skip is logged with its reason - and without
 * the address or the id (PII rule).
 */

const deleteSupabaseIdentity = vi.fn();
const linkedRow: { supabaseUserId: string } = { supabaseUserId: "" };

vi.mock("@/lib/supabase/admin", () => ({ deleteSupabaseIdentity }));
vi.mock("@/lib/admin/store", () => ({
  customerOrdersByEmail: vi.fn(async () => []),
  expireStalePendingOrders: vi.fn(async () => undefined),
  getMenuItem: vi.fn(),
  getSettings: vi.fn(),
}));
const appendConsentChanges = vi.fn(async () => undefined);
vi.mock("@/lib/customer/consent-ledger", () => ({ appendConsentChanges }));
vi.mock("@/lib/customer/store", () => ({
  getCustomerByEmail: vi.fn(),
  updateCustomerProfile: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  usualColumnValue: () => null,
}));
vi.mock("@/lib/newsletter/store", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeNewsletterByEmail: vi.fn(),
}));
vi.mock("@/lib/db/health", () => ({ raiseDbError: vi.fn() }));

// Every query `deleteMe` makes resolves to "no error"; the one read it does -
// which identity this row is linked to - answers from `linkedRow`.
function builder(): Record<string, unknown> {
  const api: Record<string, unknown> = {};
  const chain = () => api;
  for (const m of [
    "select",
    "update",
    "delete",
    "insert",
    "eq",
    "neq",
    "gte",
    "ilike",
    "in",
    "limit",
    "order",
  ]) {
    api[m] = chain;
  }
  api.maybeSingle = async () => ({ data: { ...linkedRow }, error: null });
  api.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null });
  return api;
}
vi.mock("@/lib/db", () => ({
  getDb: () => ({ from: () => builder() }),
  TABLES: new Proxy({}, { get: (_t, key) => String(key) }),
}));

const { deleteMe } = await import("@/lib/mobile/me");

const MEMBER = {
  id: "cst-42",
  email: "eda@example.com",
  name: "Eda",
  notificationPrefs: { orderUpdates: true, marketing: true, newsletter: false },
} as unknown as Parameters<typeof deleteMe>[0];

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  linkedRow.supabaseUserId = "";
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

function skipLines(): string[] {
  return warn.mock.calls
    .map((c: unknown[]) => String(c[0]))
    .filter((line: string) => line.startsWith("[deleteMe] identity skipped"));
}

describe("deleteMe logs a skipped identity deletion", () => {
  it("names the missing service-role key when the row was linked", async () => {
    linkedRow.supabaseUserId = "u-linked-1";
    deleteSupabaseIdentity.mockResolvedValue("skipped");

    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: true,
      identity: "skipped",
    });
    expect(deleteSupabaseIdentity).toHaveBeenCalledWith("u-linked-1");
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(
      "neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_ROLE_KEY is set",
    );
    expect(lines[0]).not.toContain("u-linked-1");
    expect(lines[0]).not.toContain("eda@example.com");
  });

  it("says the row was never linked when there was no identity to delete", async () => {
    deleteSupabaseIdentity.mockResolvedValue("skipped");
    await deleteMe(MEMBER);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("never linked");
  });

  it("logs nothing of the kind when the identity was deleted", async () => {
    linkedRow.supabaseUserId = "u-linked-1";
    deleteSupabaseIdentity.mockResolvedValue("deleted");
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: true,
      identity: "deleted",
    });
    expect(skipLines()).toHaveLength(0);
  });
});

/**
 * The panel's "Hesabı sil" runs the same deleteMe on the member's behalf. The
 * consent history must not record the ADMIN's IP and browser as the member's
 * withdrawal: like the admin customer form (`adminUpdateCustomer`), the
 * panel's act is written with no IP and no User-Agent.
 */
describe("deleteMe records the consent withdrawal by who closed the account", () => {
  const ctxOfLastCall = () => {
    const calls = appendConsentChanges.mock.calls as unknown as Array<
      [string, unknown, unknown, Record<string, unknown>]
    >;
    return calls[calls.length - 1][3];
  };

  it("reads the member's own request when the member closes it", async () => {
    deleteSupabaseIdentity.mockResolvedValue("skipped");
    await deleteMe(MEMBER);
    const ctx = ctxOfLastCall();
    expect(ctx.source).toBe("account-deletion");
    expect("ip" in ctx).toBe(false);
  });

  it("writes no IP or User-Agent when the panel closes it", async () => {
    deleteSupabaseIdentity.mockResolvedValue("skipped");
    await deleteMe(MEMBER, { by: "admin" });
    const ctx = ctxOfLastCall();
    expect(ctx.source).toBe("account-deletion");
    expect(ctx.ip).toBe("");
  });
});
