import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `DELETE /me` and an order that was never paid (App Review 5.1.1(v), 27 Oct
 * 2026; docs/API-MOBILE.md §4).
 *
 * The review note tells the tester they may stop on the payment page. The
 * tester then deletes the account and got 409 `orders_in_progress`, because
 * the unpaid order was younger than the 45-minute sweep. Now `deleteMe`
 * cancels the member's own unpaid checkouts first - whatever their age, each
 * asked about at the POS (rule 29, `cancelUnpaidOrdersOfClosingAccount`) -
 * and only then counts. A paid order still holds the closure; so does an
 * unpaid one the cancel could not close (the POS could not be asked, a panel
 * order paid on delivery): it is not known to be unpaid.
 */

type Row = { id: string; status: string; customerEmail: string };

/** The member's orders as `customerOrdersByEmail` reads them. */
const book = vi.hoisted(() => ({
  rows: [] as Row[],
  /** What the closure's cancel does to each pending row. */
  cancel: "cancels" as "cancels" | "keeps" | "throws",
  calls: [] as string[],
}));

const cancelUnpaidOrdersOfClosingAccount = vi.fn(async (email: string) => {
  book.calls.push(`cancel:${email}`);
  if (book.cancel === "throws") throw new Error("db down");
  if (book.cancel === "keeps") return 0;
  let n = 0;
  for (const row of book.rows) {
    if (row.status === "pending_payment") {
      row.status = "cancelled";
      n += 1;
    }
  }
  return n;
});
const customerOrdersByEmail = vi.fn(async (email: string) => {
  book.calls.push(`read:${email}`);
  return book.rows.map((r) => ({ ...r }));
});
const expireStalePendingOrders = vi.fn(async () => 0);
const deleteSupabaseIdentity = vi.fn(async () => "deleted");

vi.mock("@/lib/supabase/admin", () => ({ deleteSupabaseIdentity }));
vi.mock("@/lib/admin/store", () => ({
  cancelUnpaidOrdersOfClosingAccount,
  customerOrdersByEmail,
  expireStalePendingOrders,
  getMenuItem: vi.fn(),
  getSettings: vi.fn(),
}));
vi.mock("@/lib/mobile/karaoke-payment", () => ({
  cancelKaraokeForClosedAccount: vi.fn(async () => undefined),
}));
vi.mock("@/lib/mobile/karaoke", () => ({ listMine: vi.fn(async () => []) }));
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

/** The rest of the closure: every write answers "no error". */
const writes = vi.hoisted(() => ({ customerRowUpdated: 0 }));
function builder(table: string): Record<string, unknown> {
  const api: Record<string, unknown> = {};
  const chain = () => api;
  for (const m of [
    "select",
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
  api.update = () => {
    if (table === "customers") writes.customerRowUpdated += 1;
    return api;
  };
  api.maybeSingle = async () => ({ data: null, error: null });
  api.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null });
  return api;
}
vi.mock("@/lib/db", () => ({
  getDb: () => ({ from: (table: string) => builder(table) }),
  TABLES: new Proxy({}, { get: (_t, key) => String(key) }),
}));

const { deleteMe } = await import("@/lib/mobile/me");

const MEMBER = {
  id: "cst-42",
  email: "eda@example.com",
  name: "Eda",
  notificationPrefs: {
    orderUpdates: true,
    marketing: false,
    newsletter: false,
  },
} as unknown as Parameters<typeof deleteMe>[0];

function order(id: string, status: string): Row {
  return { id, status, customerEmail: "eda@example.com" };
}

beforeEach(() => {
  vi.clearAllMocks();
  book.rows = [];
  book.cancel = "cancels";
  book.calls = [];
  writes.customerRowUpdated = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteMe with an unpaid order", () => {
  it("cancels a fresh pending_payment order and closes the account", async () => {
    // Placed a minute ago: the 45-minute sweep would not touch it.
    book.rows = [order("ord-0101", "pending_payment")];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: true,
      identity: "deleted",
    });
    expect(cancelUnpaidOrdersOfClosingAccount).toHaveBeenCalledWith(
      "eda@example.com",
    );
    expect(book.rows[0].status).toBe("cancelled");
    expect(writes.customerRowUpdated).toBeGreaterThan(0);
  });

  it("cancels before it counts, never after", async () => {
    book.rows = [order("ord-0101", "pending_payment")];
    await deleteMe(MEMBER);
    expect(book.calls[0]).toBe("cancel:eda@example.com");
    expect(book.calls[1]).toBe("read:eda@example.com");
  });

  it("no longer runs the shop-wide sweep for it", async () => {
    // The member's own cancel replaces it: same POS check, any age, and the
    // closure does not wait on other people's checkouts.
    await deleteMe(MEMBER);
    expect(expireStalePendingOrders).not.toHaveBeenCalled();
  });

  it("closes an account whose only other orders are finished", async () => {
    book.rows = [
      order("ord-0101", "pending_payment"),
      order("ord-0099", "completed"),
      order("ord-0098", "cancelled"),
      order("ord-0097", "refunded"),
    ];
    const res = await deleteMe(MEMBER);
    expect(res.ok).toBe(true);
  });
});

describe("deleteMe still refuses while an order is really running", () => {
  for (const status of ["paid", "preparing", "shipped"] as const) {
    it(`409 orders_in_progress for a ${status} order`, async () => {
      book.rows = [order("ord-0200", status)];
      await expect(deleteMe(MEMBER)).resolves.toEqual({
        ok: false,
        error: "orders_in_progress",
        count: 1,
      });
      expect(writes.customerRowUpdated).toBe(0);
      expect(deleteSupabaseIdentity).not.toHaveBeenCalled();
    });
  }

  it("counts only the running orders when an unpaid one sits beside them", async () => {
    book.rows = [
      order("ord-0201", "pending_payment"),
      order("ord-0200", "preparing"),
    ];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    // The unpaid one was cancelled all the same.
    expect(book.rows[0].status).toBe("cancelled");
  });

  it("refuses when the cancel could not close the order (POS not asked)", async () => {
    // Rule 29: not knowing is never "not paid". The order stays pending and
    // the closure waits rather than anonymising a buyer who may have paid.
    book.cancel = "keeps";
    book.rows = [order("ord-0101", "pending_payment")];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect(writes.customerRowUpdated).toBe(0);
  });

  it("refuses, and does not throw, when the cancel itself failed", async () => {
    book.cancel = "throws";
    book.rows = [order("ord-0101", "pending_payment")];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect(writes.customerRowUpdated).toBe(0);
  });
});
