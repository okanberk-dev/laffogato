import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `deleteMe` hands the karaoke book the member's web deletion request
 * (ASK-Y3-4 (d)): the panel reads the stamp before the closure blanks it,
 * and the two-hour rule is then judged at the request. The app's
 * `DELETE /me` answers an open web request too (hesap-silme §8): deleteMe
 * reads it itself, and since nobody is asked whether a room was used, an
 * evening whose start came since the request goes to a person. Without a
 * request the app's deletion is judged at its own instant, as before.
 */

// The member row's open web request, as `getDeletionRequest` reads it.
let customerRow: Record<string, unknown> | null = null;

const cancelKaraokeForClosedAccount = vi.fn(async () => undefined);
vi.mock("@/lib/mobile/karaoke-payment", () => ({
  cancelKaraokeForClosedAccount,
}));
vi.mock("@/lib/mobile/karaoke", () => ({ listMine: vi.fn(async () => []) }));
vi.mock("@/lib/supabase/admin", () => ({
  deleteSupabaseIdentity: vi.fn(async () => "deleted"),
}));
vi.mock("@/lib/admin/store", () => ({
  customerOrdersByEmail: vi.fn(async () => []),
  expireStalePendingOrders: vi.fn(async () => undefined),
  getMenuItem: vi.fn(),
  getSettings: vi.fn(),
}));
vi.mock("@/lib/customer/consent-ledger", () => ({
  appendConsentChanges: vi.fn(async () => undefined),
}));
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

// Every query resolves to "no error" with nothing in it.
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
  api.maybeSingle = async () => ({ data: customerRow, error: null });
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
  email: "Eda@Example.com",
  name: "Eda",
  notificationPrefs: {
    orderUpdates: true,
    marketing: false,
    newsletter: false,
  },
} as unknown as Parameters<typeof deleteMe>[0];

beforeEach(() => {
  customerRow = null;
  cancelKaraokeForClosedAccount.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("deleteMe and the karaoke window", () => {
  it("passes the request's instant and the rooms recorded as used", async () => {
    await deleteMe(MEMBER, {
      by: "admin",
      deletionRequestedAt: "2026-10-27T17:00:00.000Z",
      karaokeRoomUsed: ["krk-00042"],
    });
    expect(cancelKaraokeForClosedAccount).toHaveBeenCalledTimes(1);
    const [email, now, opts] = cancelKaraokeForClosedAccount.mock
      .calls[0] as unknown as [string, Date, Record<string, unknown>];
    expect(email).toBe("eda@example.com");
    expect(now).toBeInstanceOf(Date);
    expect(opts).toEqual({
      windowAt: new Date("2026-10-27T17:00:00.000Z"),
      roomUsed: ["krk-00042"],
    });
  });

  it("passes no window for the app's own deletion without a web request", async () => {
    await deleteMe(MEMBER);
    const opts = (
      cancelKaraokeForClosedAccount.mock.calls[0] as unknown as unknown[]
    )[2];
    expect(opts).toEqual({ roomUsed: [] });
  });

  it("judges the app's own deletion at the member's open web request", async () => {
    customerRow = {
      deletionRequestedAt: "2026-10-27T17:00:00.000Z",
      deletionReason: "",
    };
    await deleteMe(MEMBER);
    const opts = (
      cancelKaraokeForClosedAccount.mock.calls[0] as unknown as unknown[]
    )[2];
    // Nobody closing it in the app can say whether a room was used.
    expect(opts).toEqual({
      windowAt: new Date("2026-10-27T17:00:00.000Z"),
      roomUsed: [],
      roomUseUnknown: true,
    });
  });

  it("does not read the request again for the panel, which passes its own", async () => {
    customerRow = {
      deletionRequestedAt: "2026-10-27T17:00:00.000Z",
      deletionReason: "",
    };
    // The Yönetim card: no request read or passed, the closure judged now.
    await deleteMe(MEMBER, { by: "admin" });
    const opts = (
      cancelKaraokeForClosedAccount.mock.calls[0] as unknown as unknown[]
    )[2];
    expect(opts).toEqual({ roomUsed: [] });
  });

  it("passes no window for a stamp that does not parse", async () => {
    await deleteMe(MEMBER, { by: "admin", deletionRequestedAt: "dün" });
    const opts = (
      cancelKaraokeForClosedAccount.mock.calls[0] as unknown as unknown[]
    )[2];
    expect(opts).toEqual({ roomUsed: [] });
  });
});
