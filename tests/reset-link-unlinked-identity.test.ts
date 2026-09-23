import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A site password reset for a member whose row was never linked to their
 * Supabase identity (AB-5b).
 *
 * `resetPasswordWithToken` mirrors the new password only to the id a row
 * carries. A row the one-time link attempt could not link carries none, so the
 * reset changed the bcrypt hash and nothing else - and the OLD password kept
 * opening the app. `linkIdentityAfterReset` closes that by finding the identity
 * by address. The admin client is mocked throughout: found, not found, no key,
 * and the cases where finding one is not enough to link it.
 */

const hasServiceRole = vi.fn();
const findSupabaseIdentityByEmail = vi.fn();
const updateSupabasePassword = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  hasServiceRole,
  findSupabaseIdentityByEmail,
  updateSupabasePassword,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/customer/coupons", () => ({ grantWelcomeCoupon: vi.fn() }));
vi.mock("@/lib/customer/consent-ledger", () => ({
  appendConsentChanges: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({
  activatePendingNewsletter: vi.fn(),
  getCustomerByEmail: vi.fn(),
  toPublicCustomer: vi.fn(),
}));
vi.mock("@/lib/db/health", () => ({
  raiseDbError: (ctx: string) => {
    throw new Error(`db failure: ${ctx}`);
  },
}));

/** The member's row as the reset left it. */
let row: Record<string, unknown> | null;
/** Rows that already name a given Supabase id (the "claimed" check). */
let claimedBy: Record<string, string[]>;
/** How many rows the conditional link write matches. */
let linkWriteMatches: number;
const updates: Array<{ patch: Record<string, unknown>; filters: [string, unknown][] }> = [];
let reads = 0;

function builder() {
  const filters: [string, unknown][] = [];
  let patch: Record<string, unknown> | null = null;
  const api: Record<string, unknown> = {};
  Object.assign(api, {
    select: () => api,
    limit: () => api,
    eq: (col: string, val: unknown) => {
      filters.push([col, val]);
      return api;
    },
    update: (p: Record<string, unknown>) => {
      patch = p;
      return api;
    },
    maybeSingle: async () => {
      reads++;
      return { data: row, error: null };
    },
    then: (resolve: (v: unknown) => void) => {
      if (patch) {
        updates.push({ patch, filters: [...filters] });
        resolve({
          data: Array.from({ length: linkWriteMatches }, () => ({ id: "cst-1" })),
          error: null,
        });
        return;
      }
      const id = filters.find(([col]) => col === "supabaseUserId")?.[1];
      const holders = typeof id === "string" ? (claimedBy[id] ?? []) : [];
      resolve({ data: holders.map((h) => ({ id: h })), error: null });
    },
  });
  return api;
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({ from: () => builder() }),
  TABLES: { customers: "customers" },
}));

const { linkIdentityAfterReset } = await import(
  "@/lib/customer/supabase-bridge"
);

const UNLINKED = {
  id: "cst-1",
  email: "eda@example.com",
  name: "Eda",
  passwordHash: "$2a$10$hash",
  supabaseUserId: "",
  supabaseLinkAttemptedAt: "2026-09-10T08:00:00.000Z",
  passwordMirroredAt: "",
  emailVerified: true,
  isActive: true,
};

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  row = { ...UNLINKED };
  claimedBy = {};
  linkWriteMatches = 1;
  updates.length = 0;
  reads = 0;
  hasServiceRole.mockReturnValue(true);
  findSupabaseIdentityByEmail.mockResolvedValue({
    status: "found",
    id: "u-eda",
    confirmed: true,
  });
  updateSupabasePassword.mockResolvedValue("updated");
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("linkIdentityAfterReset", () => {
  it("found: links the identity, writes the new password there and stamps the mirror", async () => {
    await expect(
      linkIdentityAfterReset("Eda@Example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "linked", password: "updated" });

    expect(findSupabaseIdentityByEmail).toHaveBeenCalledWith("eda@example.com");
    expect(updateSupabasePassword).toHaveBeenCalledWith("u-eda", "yeni-sifre-123");
    expect(updates).toHaveLength(1);
    const [{ patch, filters }] = updates;
    expect(patch.supabaseUserId).toBe("u-eda");
    expect(typeof patch.passwordMirroredAt).toBe("string");
    expect(patch.passwordMirroredAt).not.toBe("");
    // The first attempt's stamp is kept, not rewritten.
    expect(patch.supabaseLinkAttemptedAt).toBe(UNLINKED.supabaseLinkAttemptedAt);
    // Conditioned on the row still being unlinked, so a concurrent link wins.
    expect(filters).toContainEqual(["id", "cst-1"]);
    expect(filters).toContainEqual(["supabaseUserId", ""]);
    // The password is not part of anything written to this database.
    expect(JSON.stringify(patch)).not.toContain("yeni-sifre-123");
  });

  it("found, but the password write failed: links without claiming the mirror", async () => {
    updateSupabasePassword.mockResolvedValue("failed");
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "linked", password: "failed" });
    expect(updates[0]?.patch.supabaseUserId).toBe("u-eda");
    // Empty keeps the site's sign-in on its cautious branch: this row's
    // password may be newer than Supabase's.
    expect(updates[0]?.patch.passwordMirroredAt).toBe("");
  });

  it("not found: leaves the row exactly as the reset left it", async () => {
    findSupabaseIdentityByEmail.mockResolvedValue({ status: "none" });
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "none" });
    expect(updateSupabasePassword).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("no key: reads nothing, looks nothing up, writes nothing", async () => {
    hasServiceRole.mockReturnValue(false);
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "skipped" });
    expect(reads).toBe(0);
    expect(findSupabaseIdentityByEmail).not.toHaveBeenCalled();
    expect(updateSupabasePassword).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("does nothing for a row that is already linked - the reset mirrored to it", async () => {
    row = { ...UNLINKED, supabaseUserId: "u-eda" };
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "already_linked" });
    expect(findSupabaseIdentityByEmail).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("does nothing for a closed or missing row", async () => {
    row = { ...UNLINKED, isActive: false };
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "no_row" });
    row = null;
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "no_row" });
    expect(findSupabaseIdentityByEmail).not.toHaveBeenCalled();
  });

  it("does not link an unconfirmed identity, nor touch its password", async () => {
    // Linking it would make Supabase's "not confirmed" refusal final for the
    // site sign-in (supabaseHoldsLatestPassword) and lock the member out.
    findSupabaseIdentityByEmail.mockResolvedValue({
      status: "found",
      id: "u-eda",
      confirmed: false,
    });
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "unconfirmed" });
    expect(updateSupabasePassword).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("does not move an identity another row already names (a closed account's)", async () => {
    claimedBy["u-eda"] = ["cst-closed"];
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "claimed" });
    expect(updateSupabasePassword).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("reports a lookup that could not answer, and an ambiguous one, without writing", async () => {
    findSupabaseIdentityByEmail.mockResolvedValue({ status: "failed" });
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "lookup_failed" });
    findSupabaseIdentityByEmail.mockResolvedValue({ status: "ambiguous" });
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "ambiguous" });
    expect(updateSupabasePassword).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("stands aside when the row was linked between the read and the write", async () => {
    linkWriteMatches = 0;
    await expect(
      linkIdentityAfterReset("eda@example.com", "yeni-sifre-123"),
    ).resolves.toEqual({ outcome: "raced", password: "updated" });
  });

  it("never logs the address or the id", async () => {
    findSupabaseIdentityByEmail.mockResolvedValue({
      status: "found",
      id: "u-eda",
      confirmed: false,
    });
    await linkIdentityAfterReset("eda@example.com", "yeni-sifre-123");
    claimedBy["u-eda"] = ["cst-closed"];
    findSupabaseIdentityByEmail.mockResolvedValue({
      status: "found",
      id: "u-eda",
      confirmed: true,
    });
    await linkIdentityAfterReset("eda@example.com", "yeni-sifre-123");
    expect(warn).toHaveBeenCalled();
    for (const call of warn.mock.calls) {
      const line = call.map(String).join(" ");
      expect(line).not.toContain("eda@example.com");
      expect(line).not.toContain("u-eda");
    }
  });
});
