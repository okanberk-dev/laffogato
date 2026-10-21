import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two counts the panel polls for.
 *
 * A gel-al order lands in the database with nobody touching the browser, and
 * every admin page is `force-dynamic` - rendered once, then dead. These two
 * actions are the only thing that makes an order arriving from the app
 * visible on a screen that is already open, so what matters is that they
 * answer cheaply, that they never redirect a background poll, and that a role
 * without order access gets nothing rather than a number.
 *
 * Cheaply now means: while no order has been written since the last answer,
 * without the database at all (panel-signal.ts). The answer then carries no
 * count, and the account is not read; any answer with a count is.
 */

const countOpenOrders = vi.fn();
const countOrdersAfter = vi.fn();
const getAdminSession = vi.fn();
const signed = vi.hoisted(() => ({
  value: { email: "a@b.c", role: "owner" } as null | {
    email: string;
    role: string;
  },
}));
const marker = vi.hoisted(() => ({
  read: vi.fn(async (): Promise<string | null> => null),
}));
/** The session cookie the request carries. */
const cookie = vi.hoisted(() => ({ value: "signed-token" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: cookie.value }) }),
}));
vi.mock("@/lib/admin/change-marker", () => ({
  readChangeMarker: marker.read,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  ADMIN_COOKIE_NAME: "laffogato_panel_session",
  getAdminSession,
  readSessionFromCookieValue: (v: string | undefined) =>
    v ? signed.value : null,
  requireRole: vi.fn(async () => ({ email: "a@b.c", role: "owner" })),
}));
vi.mock("@/lib/admin/store", () => ({
  bulkUpdateOrders: vi.fn(),
  countOpenOrders,
  countOrdersAfter,
  createManualOrder: vi.fn(),
  getOrderPaymentRef: vi.fn(),
  refundOrder: vi.fn(),
  setOrderInternalNote: vi.fn(),
  setOrderItemStatus: vi.fn(),
  setOrderTracking: vi.fn(),
  transitionOrder: vi.fn(),
  updateOrderDetails: vi.fn(),
}));

const { newOrderCountAction, newOrderSignalAction, openOrderSignalAction } =
  await import("@/app/admin/siparisler/actions");
const { formatSignalCursor: formatFor, parseSignalCursor } =
  await import("@/lib/admin/panel-signal-core");
const { sessionBinding } = await import("@/lib/admin/poll-binding");
/** A cursor as this request's session ("signed-token") is handed one. */
const formatSignalCursor = (marker: string, key: string) =>
  formatFor(marker, key, sessionBinding("signed-token"));

/** A marker made an hour ago (settled), as change-marker.ts makes them. */
const M = `${(Date.now() - 3600_000).toString(36)}-k3j9x0q2`;

beforeEach(() => {
  cookie.value = "signed-token";
  countOpenOrders.mockReset();
  countOpenOrders.mockResolvedValue(4);
  countOrdersAfter.mockReset();
  countOrdersAfter.mockResolvedValue(2);
  getAdminSession.mockReset();
  getAdminSession.mockResolvedValue({ email: "a@b.c", role: "owner" });
  signed.value = { email: "a@b.c", role: "owner" };
  marker.read.mockReset();
  marker.read.mockResolvedValue(M);
});

describe("openOrderSignalAction", () => {
  it("counts the open orders for the nav badge, with a cursor for next time", async () => {
    const answer = await openOrderSignalAction("");
    expect(answer).toEqual({ count: 4, cursor: formatSignalCursor(M, "open") });
    expect(getAdminSession).toHaveBeenCalled();
  });

  it("answers unchanged for a current cursor: no account read, no count", async () => {
    const answer = await openOrderSignalAction(formatSignalCursor(M, "open"));
    expect(answer).toEqual({ unchanged: true });
    expect(getAdminSession).not.toHaveBeenCalled();
    expect(countOpenOrders).not.toHaveBeenCalled();
  });

  it("a moved, missing or unreadable marker re-reads the account and counts", async () => {
    const moved = `${(Date.now() - 600_000).toString(36)}-n3w`;
    marker.read.mockResolvedValue(moved);
    let answer = await openOrderSignalAction(formatSignalCursor(M, "open"));
    expect(answer).toEqual({
      count: 4,
      cursor: formatSignalCursor(moved, "open"),
    });
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    marker.read.mockResolvedValue(null);
    answer = await openOrderSignalAction(formatSignalCursor(M, "open"));
    expect(answer).toEqual({ count: 4, cursor: "" });
    answer = await openOrderSignalAction("junk");
    expect(answer).toEqual({ count: 4, cursor: "" });
    expect(getAdminSession).toHaveBeenCalledTimes(3);
  });

  it("a marker made moments ago is not vouched for: no cursor yet", async () => {
    marker.read.mockResolvedValue(`${Date.now().toString(36)}-fr35h`);
    await expect(openOrderSignalAction("")).resolves.toEqual({
      count: 4,
      cursor: "",
    });
  });

  it("reads the marker before the account and the count", async () => {
    await openOrderSignalAction("");
    expect(marker.read.mock.invocationCallOrder[0]).toBeLessThan(
      getAdminSession.mock.invocationCallOrder[0],
    );
    expect(marker.read.mock.invocationCallOrder[0]).toBeLessThan(
      countOpenOrders.mock.invocationCallOrder[0],
    );
  });

  it("a cursor answers unchanged only for the session it was handed to (rule 30)", async () => {
    const first = (await openOrderSignalAction("")) as { cursor: string };
    expect(first.cursor).not.toBe("");
    expect(await openOrderSignalAction(first.cursor)).toEqual({
      unchanged: true,
    });
    // Another cookie, still validly signed, whose account was deactivated
    // before the current marker was made: the account is read, no badge.
    getAdminSession.mockClear();
    countOpenOrders.mockClear();
    cookie.value = "another-signed-token";
    getAdminSession.mockResolvedValue(null);
    await expect(openOrderSignalAction(first.cursor)).resolves.toEqual({
      count: null,
      cursor: "",
    });
    expect(getAdminSession).toHaveBeenCalled();
    expect(countOpenOrders).not.toHaveBeenCalled();
  });

  it("an account write since the cursor (the marker moved) re-reads the account: deactivated, no badge", async () => {
    const first = (await openOrderSignalAction("")) as { cursor: string };
    // What a write to admin_users does (change-marker.ts carries live:access).
    marker.read.mockResolvedValue(
      `${(Date.now() - 600_000).toString(36)}-acct`,
    );
    getAdminSession.mockResolvedValue(null);
    await expect(openOrderSignalAction(first.cursor)).resolves.toEqual({
      count: null,
      cursor: "",
    });
    expect(countOpenOrders).toHaveBeenCalledTimes(1);
  });

  it("an invalid signature is no badge, without the database", async () => {
    signed.value = null;
    await expect(
      openOrderSignalAction(formatSignalCursor(M, "open")),
    ).resolves.toEqual({ count: null, cursor: "" });
    expect(marker.read).not.toHaveBeenCalled();
    expect(getAdminSession).not.toHaveBeenCalled();
  });

  it("answers no badge for a signed-out caller instead of redirecting a poll", async () => {
    getAdminSession.mockResolvedValue(null);
    await expect(openOrderSignalAction("")).resolves.toEqual({
      count: null,
      cursor: "",
    });
    expect(countOpenOrders).not.toHaveBeenCalled();
  });

  it("answers no badge for a cashier - the till role may not see the order list", async () => {
    signed.value = { email: "kasa@b.c", role: "cashier" };
    getAdminSession.mockResolvedValue({ email: "kasa@b.c", role: "cashier" });
    // Even with a current cursor: the token's role has no Siparişler.
    await expect(
      openOrderSignalAction(formatSignalCursor(M, "open")),
    ).resolves.toEqual({ count: null, cursor: "" });
    expect(countOpenOrders).not.toHaveBeenCalled();
    expect(marker.read).not.toHaveBeenCalled();
  });

  it("a demoted account gets no badge even when the token says otherwise", async () => {
    getAdminSession.mockResolvedValue({ email: "a@b.c", role: "cashier" });
    marker.read.mockResolvedValue(`${(Date.now() - 600_000).toString(36)}-n3w`);
    await expect(
      openOrderSignalAction(formatSignalCursor(M, "open")),
    ).resolves.toEqual({ count: null, cursor: "" });
  });

  it("swallows a database failure: a background poll must not break the panel", async () => {
    countOpenOrders.mockRejectedValue(new Error("ECONNREFUSED"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(openOrderSignalAction("")).resolves.toEqual({
      count: null,
      cursor: "",
    });
    err.mockRestore();
  });
});

describe("newOrderSignalAction", () => {
  it("counts above the rendered orderNo in its tab, keyed by both", async () => {
    let answer = await newOrderSignalAction(1042, "open", "");
    expect(answer).toEqual({
      count: 2,
      cursor: formatSignalCursor(M, "1042-open"),
    });
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042, [
      "pending_payment",
      "paid",
      "preparing",
      "shipped",
    ]);
    answer = await newOrderSignalAction(1042, "everything; drop table", "");
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042);
    expect(parseSignalCursor((answer as { cursor: string }).cursor)?.key).toBe(
      "1042-all",
    );
  });

  it("answers unchanged only for the same marker AND the same orderNo and tab", async () => {
    const c = formatSignalCursor(M, "1042-open");
    await expect(newOrderSignalAction(1042, "open", c)).resolves.toEqual({
      unchanged: true,
    });
    expect(countOrdersAfter).not.toHaveBeenCalled();
    // After a refresh the list asks about a higher orderNo: a full read.
    await expect(newOrderSignalAction(1050, "open", c)).resolves.toMatchObject({
      count: 2,
    });
    await expect(newOrderSignalAction(1042, "all", c)).resolves.toMatchObject({
      count: 2,
    });
  });
});

describe("newOrderCountAction", () => {
  it("counts strictly above the highest orderNo the page has rendered", async () => {
    await expect(newOrderCountAction(1042)).resolves.toBe(2);
    expect(countOrdersAfter).toHaveBeenCalledWith(1042);
  });

  it("counts only open orders for the Açık tab, anything else as before", async () => {
    // The tab shows open orders only: a newer order already completed or
    // swept must not raise a banner "Listeyi yenile" cannot answer.
    await expect(newOrderCountAction(1042, "open")).resolves.toBe(2);
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042, [
      "pending_payment",
      "paid",
      "preparing",
      "shipped",
    ]);
    await newOrderCountAction(1042, "everything; drop table");
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042);
  });

  it("counts only shop orders when the list asks for its beep beside the panel alert", async () => {
    // The panel-wide alert rings for cafe orders; the list beeps for the rest.
    await expect(newOrderCountAction(1042, "open", "shop")).resolves.toBe(2);
    expect(countOrdersAfter).toHaveBeenLastCalledWith(
      1042,
      ["pending_payment", "paid", "preparing", "shipped"],
      "shop",
    );
    await newOrderCountAction(1042, "all", "shop");
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042, undefined, "shop");
    // Any other kind is "every kind", as before.
    await newOrderCountAction(1042, "open", "cafe'; --");
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042, [
      "pending_payment",
      "paid",
      "preparing",
      "shipped",
    ]);
  });

  it("is gated like the badge", async () => {
    getAdminSession.mockResolvedValue(null);
    await expect(newOrderCountAction(1042)).resolves.toBeNull();
    expect(countOrdersAfter).not.toHaveBeenCalled();
  });

  it("swallows a database failure", async () => {
    countOrdersAfter.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(newOrderCountAction(1042)).resolves.toBeNull();
  });
});
