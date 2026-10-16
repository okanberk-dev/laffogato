import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * These read the source rather than run it: every function below writes to
 * Postgres on its first statement, and nothing in this suite has a database.
 * What they pin is the ORDER of the steps, which is exactly what each of the
 * bugs they cover got wrong.
 */
const orders = readFileSync("src/lib/mobile/orders.ts", "utf8");
const store = readFileSync("src/lib/admin/store.ts", "utf8");
const donus = readFileSync("src/app/odeme/donus/route.ts", "utf8");
const customers = readFileSync("src/lib/customer/store.ts", "utf8");

const migrations = readdirSync("db/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`db/migrations/${f}`, "utf8"))
  .join("\n");

function createAppOrderBody(): string {
  const from = orders.indexOf("export async function createAppOrder");
  const to = orders.indexOf("export async function listAppOrders");
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return orders.slice(from, to);
}

describe("POST /orders - what happens before anything is persisted", () => {
  const body = createAppOrderBody();

  it("asks for the payment provider before writing the order", () => {
    // Unconfigured, getPaymentProvider() throws. It used to be reached only
    // inside createAppPaymentSession - after the row was written and
    // "siparişin alındı" had been mailed - so checkout answered 500 and left
    // a ghost pending order behind.
    expect(body.indexOf("getPaymentProvider()")).toBeGreaterThan(-1);
    expect(body.indexOf("getPaymentProvider()")).toBeLessThan(
      body.indexOf("await placeAppOrder("),
    );
    expect(body).toContain("payment_unavailable");
  });

  it("replays a retried checkout attempt instead of placing a second order", () => {
    expect(body.indexOf("findAppOrderByClientId")).toBeLessThan(
      body.indexOf("await placeAppOrder("),
    );
    expect(body).toContain("replayAppOrder(existing, customer)");
    expect(body).toContain("clientOrderId: body.clientOrderId");
  });

  it("sweeps the member's expired checkouts before counting them", () => {
    // The sweep used to run inside placeAppOrder, i.e. after this count, and
    // there is no scheduler: three abandoned checkouts locked the member out
    // until some other customer's order happened to sweep their rows.
    expect(body.indexOf("expireStalePendingOrders()")).toBeLessThan(
      body.indexOf("MAX_OPEN_ORDERS"),
    );
    expect(body).toContain("PENDING_ORDER_TTL_MINUTES");
  });

  it("reads a page of recent orders for that count, not the whole history", () => {
    expect(body).toContain(
      "customerOrdersByEmail(customer.email, RECENT_ORDER_SCAN)",
    );
    expect(orders).toContain(
      "customerOrdersByEmail(customer.email, ORDER_LIST_LIMIT)",
    );
  });
});

describe("a reopened checkout carries the buyer's IP", () => {
  it("passes the caller's IP to the POS, not an empty string", () => {
    const from = orders.indexOf("async function replayAppOrder");
    const to = orders.indexOf("export async function createAppOrder");
    expect(from).toBeGreaterThan(-1);
    const replay = orders.slice(from, to);
    expect(replay).toContain("createAppPaymentSession(order, customer, await clientIp())");
    expect(replay).not.toContain('createAppPaymentSession(order, customer, "")');
  });
});

describe("idempotency key storage", () => {
  it("is unique per member and exempts the empty default", () => {
    expect(migrations).toContain(
      "add column if not exists \"clientOrderId\" text not null default ''",
    );
    expect(migrations).toContain(
      'on public.orders (lower("customerEmail"), "clientOrderId")',
    );
    expect(migrations).toContain("where \"clientOrderId\" <> ''");
  });
});

describe("a payment that cannot be applied to its order", () => {
  const body = store.slice(
    store.indexOf("export async function applyPaymentSucceeded"),
    store.indexOf("export async function recordProviderRefund"),
  );

  it("books an amount mismatch and answers ok, instead of a retry storm", () => {
    expect(body).toContain(
      'noteUnreconciledPayment(order, input, "amount_mismatch")',
    );
    expect(body).toContain('return { ok: true, reconcile: "amount_mismatch" }');
    expect(body).not.toContain(
      'return { ok: false, error: "amount_mismatch" }',
    );
  });

  it("books a confirmation for an order the sweep already cancelled", () => {
    expect(body).toContain('unreconciled = "order_not_open"');
  });

  it("does not mail 'ödemen alındı' for an order that is cancelled", () => {
    // Only a confirmation that moved the order to paid mails, once
    // (order_notice_emails claim); a cancelled, repeated or second charge
    // never advances it.
    expect(body).toMatch(
      /if \(advanced\) \{\s+await notifyOrderPaid\(\{ \.\.\.order, status: "paid", paidAt \}\);/,
    );
    expect(body).not.toContain("sendOrderPaidEmail(");
  });

  it("writes the unapplied payment to the audit log, not only to stderr", () => {
    const note = store.slice(
      store.indexOf("async function noteUnreconciledPayment"),
      store.indexOf("export async function applyPaymentSucceeded"),
    );
    expect(note).toContain("logAudit");
    expect(note).toContain('event: "payment_unreconciled"');
  });
});

describe("settling an order by hand", () => {
  const body = store.slice(
    store.indexOf("export async function transitionOrder"),
    store.indexOf("async function awardLoyalty"),
  );

  it("stamps and timestamps a mark_paid the way the webhook does", () => {
    // "Ödendi olarak işaretle" wrote the status column and nothing else,
    // while the app told the member their order had earned a stamp.
    expect(body).toContain('existing.status === "pending_payment"');
    expect(body).toContain('map.to === "paid" || map.to === "preparing"');
    expect(body).toContain("if (settles) patch.paidAt = paidAt;");
    expect(body).toContain("awardLoyalty(");
  });

  it("dates the stage it just reached, once", () => {
    // Every later stage has its own column now; the app's timeline and its
    // notification inbox used to date all of them from `paidAt`.
    expect(body).toContain("STAGE_INSTANT_COLUMN[map.to]");
    // Only when still empty - re-reaching a stage keeps the first instant.
    expect(body).toContain(
      "if (stageColumn && !existing[stageColumn]) patch[stageColumn] = paidAt;",
    );
  });
});

describe("order placement compensates what it claimed", () => {
  it("gives the stock back when the row never lands", () => {
    // Without an orders row the stale-checkout sweep has nothing to find, so
    // the units stayed off the shelf forever.
    // Every path that claims stock compensates it: the web checkout, the app
    // order and (since 23 Sept) the admin's manual order.
    for (const [fn, next] of [
      [
        "export async function placeOrder(",
        "export async function createManualOrder",
      ],
      [
        "export async function createManualOrder",
        "export interface AppCafeLineInput",
      ],
      ["export async function placeAppOrder", "// ── Payment application"],
    ]) {
      const body = store.slice(store.indexOf(fn), store.indexOf(next));
      expect(body, fn).toContain("await releaseClaimedStock(resolved);");
    }
  });

  it("gives the coupon or promo use back when the insert fails", () => {
    const insert = store.slice(
      store.indexOf("async function insertOrderRow"),
      store.indexOf("How long an unpaid order may hold its stock"),
    );
    expect(insert).toContain("releaseCustomerCoupon(promoCode");
    expect(insert).toContain("releasePromoUsage(promoCode)");
    expect(insert).toContain("throw err;");
  });
});

describe("the parcel shop's open/closed switch", () => {
  it("does not close app cafe ordering with it", () => {
    const body = store.slice(
      store.indexOf("export async function placeAppOrder"),
      store.indexOf("// ── Payment application"),
    );
    expect(body).toContain('if (kind === "shop" && !settings.isShopOpen)');
    expect(body).not.toContain("if (!settings.isShopOpen) {");
  });
});

describe("/odeme/donus", () => {
  it("no longer treats app=1 as proof of anything", () => {
    // ?orderId=…&app=1 encoded paid/unpaid into the deep link for any
    // guessable id, with no authentication at all.
    expect(donus).not.toContain('app === "1"');
    expect(donus).toContain("issuedForApp || (ownedOnWeb");
  });

  it("degrades instead of 500ing when the POS is unconfigured", () => {
    expect(donus).toContain("function safeProvider()");
    expect(donus).toContain("const provider = safeProvider();");
    expect(donus).not.toContain("const provider = getPaymentProvider();");
  });

  it("reads the row rather than asserting success for a webhook-only POS", () => {
    expect(donus).not.toContain('appRedirect(orderId, "success")');
  });
});

describe("wishlist toggle", () => {
  it("is one locked statement in the database, not a read-modify-write", () => {
    expect(customers).toContain('rpc("toggle_wishlist"');
    expect(customers).not.toContain("current.concat(productId).slice(0, 200)");
    expect(migrations).toContain(
      "create or replace function public.toggle_wishlist",
    );
    expect(migrations).toContain("for update");
  });

  it("refuses an id that names no product, but never refuses a removal", () => {
    expect(migrations).toContain(
      "select 1 from public.products where id = p_product_id",
    );
    expect(customers).toContain('case "not_found":');
  });
});
