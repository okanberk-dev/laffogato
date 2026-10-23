import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InvoiceRow } from "@/lib/invoice/invoice-core";

/**
 * The Faturalar badge (invoiceAttentionSignalAction, Innex 23 Eki 2026):
 * the sidebar counts the invoices that need a person, the list's Dikkat
 * tab, only for a role with Faturalar and only while the automation is on.
 * Cheap like the other badges: while no invoice was written and the day
 * has not turned, the answer is "unchanged", without the database.
 */

const listAttentionInvoices = vi.fn();
const getAdminSession = vi.fn();
const signed = vi.hoisted(() => ({
  value: { email: "a@b.c", role: "owner" } as null | {
    email: string;
    role: string;
  },
}));
const marker = vi.hoisted(() => ({
  read: vi.fn(async (_kind: string): Promise<string | null> => null),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "signed-token" }) }),
}));
vi.mock("@/lib/admin/change-marker", () => ({
  readChangeMarker: marker.read,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({ safeAudit: vi.fn() }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  ADMIN_COOKIE_NAME: "laffogato_panel_session",
  getAdminSession,
  readSessionFromCookieValue: (v: string | undefined) =>
    v ? signed.value : null,
  requireRole: vi.fn(async () => ({ email: "a@b.c", role: "owner" })),
}));
vi.mock("@/lib/invoice/run", () => ({
  runInvoiceRow: vi.fn(),
  runInvoices: vi.fn(),
}));
vi.mock("@/lib/invoice/connection", () => ({
  checkParasutConnection: vi.fn(),
}));
vi.mock("@/lib/invoice/order-request", () => ({
  loadOrderInvoiceRequest: vi.fn(),
}));
vi.mock("@/lib/invoice/store", () => ({
  dbInvoiceStore: {},
  getInvoice: vi.fn(),
  listAttentionInvoices,
  markInvoiceManual: vi.fn(),
  markInvoiceManualDone: vi.fn(),
  requestOrderInvoice: vi.fn(),
  retryInvoice: vi.fn(),
  setInvoiceBilling: vi.fn(),
  writeCarriers: vi.fn(),
}));

const { invoiceAttentionSignalAction } =
  await import("@/app/admin/faturalar/actions");
const { formatSignalCursor } = await import("@/lib/admin/panel-signal-core");
const { sessionBinding } = await import("@/lib/admin/poll-binding");

/** Friday 23 Oct 2026, 15:00 in Tuzla. */
const NOW = new Date("2026-10-23T12:00:00.000Z");
const DAY = 86_400_000;
/** A marker made an hour ago (settled), as change-marker.ts makes them. */
const M = `${(NOW.getTime() - 3600_000).toString(36)}-k3j9x0q2`;
const cursorFor = (key: string) =>
  formatSignalCursor(M, key, sessionBinding("signed-token"));

const row = (over: Partial<InvoiceRow>): InvoiceRow =>
  ({
    id: "inv",
    status: "due",
    deadlineAt: new Date(NOW.getTime() + 5 * DAY).toISOString(),
    refundNotedAt: "",
    emailedAt: "",
    emailError: "",
    nextAttemptAt: "",
    emailAttempts: 0,
    ...over,
  }) as InvoiceRow;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("EARSIV_MODE", "draft");
  listAttentionInvoices.mockReset();
  listAttentionInvoices.mockResolvedValue([
    row({ status: "failed" }),
    row({ status: "manual" }),
    row({ status: "draft" }),
    // A day before its last day: "soon", a person's.
    row({ deadlineAt: new Date(NOW.getTime() + DAY).toISOString() }),
    // Five days to go: not yet.
    row({}),
    // Refunded after it was issued: a person's document in Paraşüt.
    row({ status: "issued", refundNotedAt: "2026-10-22T10:00:00.000Z" }),
    row({ status: "issued" }),
  ]);
  getAdminSession.mockReset();
  getAdminSession.mockResolvedValue({ email: "a@b.c", role: "owner" });
  signed.value = { email: "a@b.c", role: "owner" };
  marker.read.mockReset();
  marker.read.mockResolvedValue(M);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("invoiceAttentionSignalAction", () => {
  it("counts the Dikkat tab's invoices, keyed by the köşk's day", async () => {
    await expect(invoiceAttentionSignalAction("")).resolves.toEqual({
      count: 5,
      cursor: cursorFor("2026-10-23"),
    });
    // Its own marker: an invoice written moves it, an order does not.
    expect(marker.read).toHaveBeenCalledWith("invoices");
  });

  it("answers unchanged for today's cursor, without the database", async () => {
    await expect(
      invoiceAttentionSignalAction(cursorFor("2026-10-23")),
    ).resolves.toEqual({ unchanged: true });
    expect(listAttentionInvoices).not.toHaveBeenCalled();
    expect(getAdminSession).not.toHaveBeenCalled();
  });

  it("counts again on a new day: a deadline comes near with the clock", async () => {
    // Yesterday's cursor, the same marker: nothing written, the day turned.
    const answer = await invoiceAttentionSignalAction(cursorFor("2026-10-22"));
    expect(answer).toEqual({ count: 5, cursor: cursorFor("2026-10-23") });
    expect(listAttentionInvoices).toHaveBeenCalledTimes(1);
  });

  it("no badge while the automation is off, without asking anything", async () => {
    vi.stubEnv("EARSIV_MODE", "off");
    await expect(invoiceAttentionSignalAction("")).resolves.toEqual({
      count: null,
      cursor: "",
    });
    expect(marker.read).not.toHaveBeenCalled();
    expect(listAttentionInvoices).not.toHaveBeenCalled();
  });

  it("no badge for a role without Faturalar", async () => {
    signed.value = { email: "s@b.c", role: "staff" };
    getAdminSession.mockResolvedValue({ email: "s@b.c", role: "staff" });
    await expect(
      invoiceAttentionSignalAction(cursorFor("2026-10-23")),
    ).resolves.toEqual({ count: null, cursor: "" });
    expect(listAttentionInvoices).not.toHaveBeenCalled();
  });
});
