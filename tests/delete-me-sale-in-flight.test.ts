import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * Account closure and an order whose payment is still at the bank's 3-D
 * Secure step (27 Oct 2026, docs/API-MOBILE.md §4).
 *
 * The real `deleteMe` over the real `cancelUnpaidOrdersOfClosingAccount`,
 * with the SQL answered by a small in-memory orders table and the POS by a
 * fake. What is proved here:
 *
 *   - an order that holds the closure in any case (paid, preparing, shipped,
 *     a panel order paid on delivery) refuses it at once: the POS is not
 *     asked, nothing is cancelled, no timeline row is written;
 *   - an order younger than 45 minutes is first asked about at the POS: a
 *     sale in flight (PayNkolay's STATUS NEW), or a POS that cannot say,
 *     leaves it pending and the closure answers 409;
 *   - a young order the POS knows nothing about is cancelled with the
 *     closure's reason and the account closes - App Review's tester, who
 *     stopped on the payment page.
 *
 * The same flow against Postgres: tests/db-integration-payment-sweep.test.ts
 * and tests/db-integration-account-deletion.test.ts.
 */

const MIN = 60_000;
const EMAIL = "eda@example.com";

type OrderRow = {
  id: string;
  orderNo: number;
  customerEmail: string;
  status: string;
  channel: string;
  source: string;
  promoCode: string;
  items: unknown[];
  refunds: unknown[];
  totalMinor: number;
  subtotalMinor: number;
  createdAt: string;
};

/** The orders table, and every statement the code sent. */
const db = vi.hoisted(() => ({
  orders: [] as OrderRow[],
  statements: [] as string[],
}));

/** `"column" = $n` in a compiled WHERE clause: the value bound to it. */
function bound(
  text: string,
  params: readonly unknown[],
  column: string,
): unknown {
  const m = new RegExp(`"${column}" = \\$(\\d+)`).exec(text);
  return m ? params[Number(m[1]) - 1] : undefined;
}

const exec: Executor = async ({ text, params }) => {
  db.statements.push(text);
  // ensureSeed: every table already has rows, so nothing is seeded.
  if (/^SELECT count\(\*\)/.test(text)) {
    return { rows: [{ count: 1 }], rowCount: 1 };
  }
  const byMember = /lower\("customerEmail"\) = lower\(\$(\d+)\)/.exec(text);
  if (/^SELECT /.test(text) && / FROM "orders"/.test(text) && byMember) {
    const email = String(params[Number(byMember[1]) - 1]).toLowerCase();
    const status = bound(text, params, "status");
    const rows = db.orders.filter(
      (o) =>
        o.customerEmail.toLowerCase() === email &&
        (status === undefined || o.status === status),
    );
    return { rows: rows.map((o) => ({ ...o })), rowCount: rows.length };
  }
  if (/^UPDATE "orders" SET "status" = \$1 /.test(text)) {
    // cancelUnpaidOrder: conditional on the status it saw.
    const id = bound(text, params, "id");
    const from = /WHERE .*"status" = \$(\d+)/.exec(text);
    const expected = from ? params[Number(from[1]) - 1] : undefined;
    const row = db.orders.find((o) => o.id === id && o.status === expected);
    if (!row) return { rows: [], rowCount: 0 };
    row.status = String(params[0]);
    return { rows: [{ id: row.id }], rowCount: 1 };
  }
  // Everything else (the wallet, the stock release, the closure's own
  // writes) finds nothing and changes nothing.
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const fake = createDb(exec);
  return { ...real, getDb: () => fake };
});

/** What the fake POS says, and what it was asked. */
type InFlightAnswer = "in-flight" | "none" | "down" | "hang" | "unsure";
const pos = vi.hoisted(() => ({
  inFlight: new Map<string, InFlightAnswer>(),
  asked: [] as string[],
  /** false: a provider that has no in-flight check (the mock). */
  withCheck: true,
  /** Resolves when the in-flight check is first called. */
  checked: null as null | Promise<void>,
  onChecked: () => {},
}));

function fakePos() {
  return {
    name: "fakepos",
    lookupPayment: async (orderId: string) => {
      pos.asked.push(`lookup:${orderId}`);
      // Nothing paid in these tests: the booking path is proved against
      // Postgres (db-integration-payment-sweep).
      return null;
    },
    ...(pos.withCheck
      ? {
          hasPaymentInFlight: async (orderId: string) => {
            pos.asked.push(`in-flight:${orderId}`);
            pos.onChecked();
            const answer = pos.inFlight.get(orderId) ?? "none";
            if (answer === "down") throw new Error("POS unreachable");
            if (answer === "hang") return new Promise<boolean>(() => {});
            // A provider that answers neither yes nor no.
            if (answer === "unsure") return undefined as unknown as boolean;
            return answer === "in-flight";
          },
        }
      : {}),
  };
}

vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => fakePos() }));

const safeAudit = vi.fn(async (_row: unknown) => true);
vi.mock("@/lib/admin/audit", () => ({ safeAudit, logAudit: vi.fn() }));

const deleteSupabaseIdentity = vi.fn(async () => "deleted");
vi.mock("@/lib/supabase/admin", () => ({ deleteSupabaseIdentity }));
vi.mock("@/lib/mobile/karaoke-payment", () => ({
  cancelKaraokeForClosedAccount: vi.fn(async () => undefined),
}));
vi.mock("@/lib/mobile/karaoke", () => ({ listMine: vi.fn(async () => []) }));
vi.mock("@/lib/customer/consent-ledger", () => ({
  appendConsentChanges: vi.fn(async () => undefined),
}));
vi.mock("@/lib/customer/deletion-request", () => ({
  getDeletionRequest: vi.fn(async () => null),
}));
vi.mock("@/lib/push/devices", () => ({
  forgetDevicesOf: vi.fn(async () => undefined),
}));
vi.mock("@/lib/customer/store", () => ({
  getCardUserKey: vi.fn(async () => ""),
  getCustomerByEmail: vi.fn(),
  updateCustomerProfile: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  usualColumnValue: () => null,
}));
vi.mock("@/lib/newsletter/store", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeNewsletterByEmail: vi.fn(),
}));

const { deleteMe } = await import("@/lib/mobile/me");
const { cancelUnpaidOrdersOfClosingAccount, ACCOUNT_CLOSED_CANCEL_REASON } =
  await import("@/lib/admin/store");

const MEMBER = {
  id: "cst-42",
  email: EMAIL,
  name: "Eda",
  notificationPrefs: {
    orderUpdates: true,
    marketing: false,
    newsletter: false,
  },
} as unknown as Parameters<typeof deleteMe>[0];

let nextNo = 20_001;
function order(
  id: string,
  status: string,
  ageMs: number,
  extra: Partial<OrderRow> = {},
): OrderRow {
  const row: OrderRow = {
    id,
    orderNo: nextNo++,
    customerEmail: EMAIL,
    status,
    channel: "app",
    source: "",
    promoCode: "",
    items: [],
    refunds: [],
    totalMinor: 24_500,
    subtotalMinor: 24_500,
    createdAt: new Date(Date.now() - ageMs).toISOString(),
    ...extra,
  };
  db.orders.push(row);
  return row;
}

function statusOf(id: string): string | undefined {
  return db.orders.find((o) => o.id === id)?.status;
}

/** Whether the closure wrote the anonymised member row. */
function memberRowWritten(): boolean {
  return db.statements.some((s) => /^UPDATE "customers" SET /.test(s));
}

function orderWrites(): string[] {
  return db.statements.filter((s) => /^UPDATE "orders" SET "status"/.test(s));
}

beforeEach(() => {
  db.orders.length = 0;
  db.statements.length = 0;
  pos.inFlight.clear();
  pos.asked.length = 0;
  pos.withCheck = true;
  pos.checked = new Promise<void>((resolve) => {
    pos.onChecked = resolve;
  });
  safeAudit.mockClear();
  deleteSupabaseIdentity.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("cancelUnpaidOrdersOfClosingAccount and a sale at the bank's 3-D Secure step", () => {
  it("leaves a young order whose sale is in flight pending: no cancel, no timeline row", async () => {
    order("ord-3ds", "pending_payment", 2 * MIN);
    pos.inFlight.set("ord-3ds", "in-flight");

    await expect(cancelUnpaidOrdersOfClosingAccount(EMAIL)).resolves.toBe(0);
    expect(statusOf("ord-3ds")).toBe("pending_payment");
    expect(orderWrites()).toEqual([]);
    expect(safeAudit).not.toHaveBeenCalled();
    // Asked first; with a sale in flight there is nothing for the lookup to
    // find, and nothing is cancelled.
    expect(pos.asked).toEqual(["in-flight:ord-3ds"]);
  });

  it("cancels a young order the POS knows nothing about, with the closure's reason", async () => {
    order("ord-none", "pending_payment", 2 * MIN);

    await expect(cancelUnpaidOrdersOfClosingAccount(EMAIL)).resolves.toBe(1);
    expect(statusOf("ord-none")).toBe("cancelled");
    // The in-flight check first, then the lookup (rule 29), then the cancel.
    expect(pos.asked).toEqual(["in-flight:ord-none", "lookup:ord-none"]);
    expect(safeAudit).toHaveBeenCalledTimes(1);
    expect(safeAudit.mock.calls[0][0]).toMatchObject({
      actor: "system",
      action: "transition",
      entity: "order",
      entityId: "ord-none",
      payload: {
        from: "pending_payment",
        to: "cancelled",
        reason: ACCOUNT_CLOSED_CANCEL_REASON,
      },
    });
  });

  it("leaves it pending when the POS cannot be asked", async () => {
    order("ord-down", "pending_payment", 2 * MIN);
    pos.inFlight.set("ord-down", "down");

    await expect(cancelUnpaidOrdersOfClosingAccount(EMAIL)).resolves.toBe(0);
    expect(statusOf("ord-down")).toBe("pending_payment");
    expect(safeAudit).not.toHaveBeenCalled();
    expect(pos.asked).toEqual(["in-flight:ord-down"]);
  });

  it("leaves it pending when the POS does not answer in time", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    order("ord-slow", "pending_payment", 2 * MIN);
    pos.inFlight.set("ord-slow", "hang");

    const cancelled = cancelUnpaidOrdersOfClosingAccount(EMAIL);
    await pos.checked;
    // POS_LOOKUP_TIMEOUT_MS, the lookup's own deadline.
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(cancelled).resolves.toBe(0);
    expect(statusOf("ord-slow")).toBe("pending_payment");
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("lets the cancel go ahead only on a clear no", async () => {
    order("ord-unsure", "pending_payment", 2 * MIN);
    pos.inFlight.set("ord-unsure", "unsure");

    await expect(cancelUnpaidOrdersOfClosingAccount(EMAIL)).resolves.toBe(0);
    expect(statusOf("ord-unsure")).toBe("pending_payment");
  });

  it("does not ask about an order older than 45 minutes: the lookup decides, as before", async () => {
    // Past the window the 45-minute sweep cancels it too; a 3-D Secure step
    // does not last that long.
    order("ord-old", "pending_payment", 50 * MIN);
    pos.inFlight.set("ord-old", "in-flight");

    await expect(cancelUnpaidOrdersOfClosingAccount(EMAIL)).resolves.toBe(1);
    expect(statusOf("ord-old")).toBe("cancelled");
    expect(pos.asked).toEqual(["lookup:ord-old"]);
  });

  it("a provider without the check cancels a young order as before", async () => {
    pos.withCheck = false;
    order("ord-mock", "pending_payment", 2 * MIN);

    await expect(cancelUnpaidOrdersOfClosingAccount(EMAIL)).resolves.toBe(1);
    expect(statusOf("ord-mock")).toBe("cancelled");
    expect(pos.asked).toEqual(["lookup:ord-mock"]);
  });

  it("decides each order on its own", async () => {
    order("ord-a", "pending_payment", 2 * MIN);
    order("ord-b", "pending_payment", 3 * MIN);
    pos.inFlight.set("ord-a", "in-flight");

    await expect(cancelUnpaidOrdersOfClosingAccount(EMAIL)).resolves.toBe(1);
    expect(statusOf("ord-a")).toBe("pending_payment");
    expect(statusOf("ord-b")).toBe("cancelled");
  });
});

describe("deleteMe over the real store", () => {
  it("closes the account of App Review's tester: the young unpaid order is cancelled", async () => {
    // Stopped on the payment page a few minutes ago; the POS has no record.
    order("ord-review", "pending_payment", 3 * MIN);

    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: true,
      identity: "deleted",
    });
    expect(statusOf("ord-review")).toBe("cancelled");
    expect(safeAudit).toHaveBeenCalledTimes(1);
    expect(memberRowWritten()).toBe(true);
  });

  it("answers 409 while a young order's sale is at the 3-D Secure step, and keeps everything", async () => {
    order("ord-3ds", "pending_payment", 3 * MIN);
    pos.inFlight.set("ord-3ds", "in-flight");

    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect(statusOf("ord-3ds")).toBe("pending_payment");
    expect(safeAudit).not.toHaveBeenCalled();
    expect(memberRowWritten()).toBe(false);
    expect(deleteSupabaseIdentity).not.toHaveBeenCalled();
  });

  it("answers 409 when the POS cannot say whether a sale is in flight", async () => {
    order("ord-down", "pending_payment", 3 * MIN);
    pos.inFlight.set("ord-down", "down");

    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect(statusOf("ord-down")).toBe("pending_payment");
    expect(memberRowWritten()).toBe(false);
  });

  for (const status of ["paid", "preparing", "shipped"] as const) {
    it(`refuses at once on a ${status} order: the POS is not asked, nothing is cancelled`, async () => {
      order("ord-unpaid", "pending_payment", 3 * MIN);
      order("ord-running", status, 20 * MIN);

      await expect(deleteMe(MEMBER)).resolves.toEqual({
        ok: false,
        error: "orders_in_progress",
        // Every order in progress, the unpaid one included.
        count: 2,
      });
      expect(statusOf("ord-unpaid")).toBe("pending_payment");
      expect(pos.asked).toEqual([]);
      expect(orderWrites()).toEqual([]);
      expect(safeAudit).not.toHaveBeenCalled();
      expect(memberRowWritten()).toBe(false);
    });
  }

  it("refuses at once on a panel order paid on delivery", async () => {
    order("ord-cod", "pending_payment", 30 * MIN, { source: "manual" });
    order("ord-unpaid", "pending_payment", 3 * MIN);

    await expect(deleteMe(MEMBER)).resolves.toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 2,
    });
    expect(statusOf("ord-unpaid")).toBe("pending_payment");
    expect(pos.asked).toEqual([]);
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("a finished panel order does not hold the closure", async () => {
    order("ord-cod-done", "completed", 3 * 24 * 60 * MIN, { source: "manual" });
    order("ord-unpaid", "pending_payment", 3 * MIN);

    await expect(deleteMe(MEMBER)).resolves.toMatchObject({ ok: true });
    expect(statusOf("ord-unpaid")).toBe("cancelled");
  });
});

describe("the timeline's reason", () => {
  it("says the unpaid order was cancelled on a deletion request, not that the account closed", () => {
    // The closure counts again after the cancel and can still be refused.
    expect(ACCOUNT_CLOSED_CANCEL_REASON).toBe(
      "Hesap silme isteğiyle ödenmemiş sipariş iptal edildi",
    );
    expect(ACCOUNT_CLOSED_CANCEL_REASON).not.toMatch(/kapat/i);
  });
});
