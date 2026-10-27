import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `DELETE /me` and an order that was never paid (App Review 5.1.1(v), 27 Oct
 * 2026; docs/API-MOBILE.md §4).
 *
 * The review note tells the tester they may stop on the payment page. The
 * tester then deletes the account and got 409 `orders_in_progress`, because
 * the unpaid order was younger than the 45-minute sweep. Now `deleteMe`:
 *
 *   1. reads the member's orders and refuses at once, with nothing cancelled,
 *      when one holds the closure whatever its payment state (paid,
 *      preparing, shipped, a panel order paid on delivery);
 *   2. otherwise cancels the member's own unpaid checkouts - whatever their
 *      age, each asked about at the POS (rule 29,
 *      `cancelUnpaidOrdersOfClosingAccount`);
 *   3. counts again. An unpaid order the cancel could not close (the POS
 *      could not be asked, a sale still at the bank's 3-D Secure step) or
 *      found paid holds the closure: it is not known to be unpaid.
 *
 * The store is a stand-in here; the real one runs under deleteMe in
 * tests/delete-me-sale-in-flight.test.ts.
 */

type Row = {
  id: string;
  status: string;
  customerEmail: string;
  source?: string;
};

/** The member's orders as `customerOrdersByEmail` reads them. */
const book = vi.hoisted(() => ({
  rows: [] as Row[],
  /** What the closure's cancel does to each pending row. */
  cancel: "cancels" as "cancels" | "keeps" | "books" | "throws",
  calls: [] as string[],
}));

const cancelUnpaidOrdersOfClosingAccount = vi.fn(async (email: string) => {
  book.calls.push(`cancel:${email}`);
  if (book.cancel === "throws") throw new Error("db down");
  if (book.cancel === "keeps") return 0;
  let n = 0;
  for (const row of book.rows) {
    // Like the store: a panel order paid on delivery is never cancelled.
    if (row.status === "pending_payment" && row.source !== "manual") {
      // "books": the POS reports the payment, the order is paid, not cancelled.
      row.status = book.cancel === "books" ? "paid" : "cancelled";
      if (book.cancel === "cancels") n += 1;
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

const { deleteMe, holdsClosure } = await import("@/lib/mobile/me");

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

function order(id: string, status: string, source = ""): Row {
  return { id, status, customerEmail: "eda@example.com", source };
}

const READ = "read:eda@example.com";
const CANCEL = "cancel:eda@example.com";

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

  it("reads the orders, then cancels, then counts again", async () => {
    book.rows = [order("ord-0101", "pending_payment")];
    await deleteMe(MEMBER);
    expect(book.calls).toEqual([READ, CANCEL, READ]);
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
      // A panel order is held only while it waits for its money.
      order("ord-0096", "completed", "manual"),
    ];
    const res = await deleteMe(MEMBER);
    expect(res.ok).toBe(true);
  });
});

describe("deleteMe refuses at once, before cancelling anything", () => {
  for (const status of ["paid", "preparing", "shipped"] as const) {
    it(`409 for a ${status} order, the unpaid one beside it left as it was`, async () => {
      book.rows = [
        order("ord-0201", "pending_payment"),
        order("ord-0200", status),
      ];
      await expect(deleteMe(MEMBER)).resolves.toEqual({
        ok: false,
        error: "orders_in_progress",
        // The same count as ever: every order in progress, unpaid included.
        count: 2,
      });
      // Read once; the cancel (and the timeline row it writes) never ran.
      expect(book.calls).toEqual([READ]);
      expect(cancelUnpaidOrdersOfClosingAccount).not.toHaveBeenCalled();
      expect(book.rows[0].status).toBe("pending_payment");
      expect(writes.customerRowUpdated).toBe(0);
      expect(deleteSupabaseIdentity).not.toHaveBeenCalled();
    });
  }

  it("409 for a running order alone, counted alone", async () => {
    book.rows = [
      order("ord-0200", "preparing"),
      order("ord-0199", "completed"),
    ];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect(cancelUnpaidOrdersOfClosingAccount).not.toHaveBeenCalled();
  });

  it("409 for a panel order paid on delivery, which the closure never cancels", async () => {
    book.rows = [
      order("ord-0301", "pending_payment", "manual"),
      order("ord-0302", "pending_payment"),
    ];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 2,
    });
    expect(book.calls).toEqual([READ]);
    expect(book.rows.map((r) => r.status)).toEqual([
      "pending_payment",
      "pending_payment",
    ]);
    expect(writes.customerRowUpdated).toBe(0);
  });

  it("an unreadable order list throws before anything is touched", async () => {
    customerOrdersByEmail.mockRejectedValueOnce(new Error("db down"));
    book.rows = [order("ord-0101", "pending_payment")];
    await expect(deleteMe(MEMBER)).rejects.toThrow("db down");
    expect(cancelUnpaidOrdersOfClosingAccount).not.toHaveBeenCalled();
    expect(writes.customerRowUpdated).toBe(0);
  });
});

describe("deleteMe refuses after the cancel when an order is still in progress", () => {
  it("refuses when the cancel could not close the order (POS not asked, sale at 3-D Secure)", async () => {
    // Rule 29: not knowing is never "not paid". The order stays pending and
    // the closure waits rather than anonymising a buyer who may be paying.
    book.cancel = "keeps";
    book.rows = [order("ord-0101", "pending_payment")];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect(book.calls).toEqual([READ, CANCEL, READ]);
    expect(writes.customerRowUpdated).toBe(0);
  });

  it("refuses when the POS reported the unpaid order paid", async () => {
    book.cancel = "books";
    book.rows = [order("ord-0101", "pending_payment")];
    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect(book.rows[0].status).toBe("paid");
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

describe("holdsClosure", () => {
  it("is the running orders and a panel order waiting for its money", () => {
    const cases: Array<[string, string, boolean]> = [
      ["paid", "", true],
      ["preparing", "", true],
      ["shipped", "", true],
      ["pending_payment", "manual", true],
      ["pending_payment", "", false],
      ["completed", "", false],
      ["completed", "manual", false],
      ["cancelled", "", false],
      ["refunded", "", false],
    ];
    for (const [status, source, holds] of cases) {
      expect(
        holdsClosure({ status, source } as Parameters<typeof holdsClosure>[0]),
        `${status}/${source || "-"}`,
      ).toBe(holds);
    }
  });
});
