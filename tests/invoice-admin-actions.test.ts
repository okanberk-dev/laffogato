import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Faturalar's two operator buttons (src/app/admin/faturalar/actions.ts):
 * "Faturayı şimdi kes" cuts a row whose time has come at once and answers
 * with that row's state; "Paraşüt bağlantısını sına" only reports. Both
 * check the session and the `invoices` role themselves (CLAUDE.md rule 27).
 */

const h = vi.hoisted(() => ({
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
  getInvoice: vi.fn(),
  runInvoices: vi.fn(),
  safeAudit: vi.fn(async () => true),
  check: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/audit", () => ({ safeAudit: h.safeAudit }));
vi.mock("@/lib/invoice/run", () => ({ runInvoices: h.runInvoices }));
vi.mock("@/lib/invoice/connection", () => ({
  checkParasutConnection: h.check,
}));
vi.mock("@/lib/invoice/store", () => ({
  dbInvoiceStore: { tokens: {} },
  getInvoice: h.getInvoice,
  markInvoiceManual: vi.fn(),
  markInvoiceManualDone: vi.fn(),
  retryInvoice: vi.fn(),
  setInvoiceBilling: vi.fn(),
  writeCarriers: vi.fn(),
}));

const { cutInvoiceNowAction, checkParasutConnectionAction } =
  await import("@/app/admin/faturalar/actions");

const ID = "inv_0123456789abcdef";
const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  sourceKind: "karaoke",
  sourceId: "krk-00042",
  sourceLabel: "krk-00042",
  status: "due",
  invoiceNo: "",
  lastError: "",
  manualReason: "",
  ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({
  mode: "live",
  errors: [],
  processed: 1,
  ...over,
});
const form = (id = ID) => {
  const f = new FormData();
  f.set("id", id);
  return f;
};

beforeEach(() => {
  h.getInvoice.mockReset();
  h.runInvoices.mockReset();
  h.check.mockReset();
  h.requireRole.mockClear();
});

describe("Faturayı şimdi kes", () => {
  it("cuts a due row now and names the invoice", async () => {
    h.getInvoice
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(
        row({ status: "issued", invoiceNo: "GIB2026000001" }),
      );
    h.runInvoices.mockResolvedValue(summary());
    const r = await cutInvoiceNowAction(null, form());
    expect(h.requireRole).toHaveBeenCalledWith("invoices");
    expect(h.runInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "admin" }),
    );
    expect(r).toMatchObject({
      ok: true,
      message: "Fatura kesildi: GIB2026000001.",
    });
  });

  it("runs nothing for a row whose time has not come", async () => {
    h.getInvoice.mockResolvedValueOnce(row({ status: "waiting" }));
    const r = await cutInvoiceNowAction(null, form());
    expect(r.ok).toBe(false);
    expect(h.runInvoices).not.toHaveBeenCalled();
  });

  it("says so when e-Arşiv is off", async () => {
    h.getInvoice.mockResolvedValue(row());
    h.runInvoices.mockResolvedValue(summary({ mode: "off" }));
    const r = await cutInvoiceNowAction(null, form());
    expect(r).toMatchObject({
      ok: false,
      error: expect.stringContaining("kapalı"),
    });
  });

  it("hands back the reason when the row went to a person", async () => {
    h.getInvoice
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(
        row({ status: "manual", manualReason: "Cüzdanla ödendi." }),
      );
    h.runInvoices.mockResolvedValue(summary());
    const r = await cutInvoiceNowAction(null, form());
    expect(r).toMatchObject({
      ok: true,
      message: "Elle kesilecek: Cüzdanla ödendi.",
    });
  });

  it("refuses an id that is not an invoice row", async () => {
    const r = await cutInvoiceNowAction(null, form("krk-00042"));
    expect(r.ok).toBe(false);
    expect(h.getInvoice).not.toHaveBeenCalled();
  });
});

describe("Paraşüt bağlantısını sına", () => {
  it("reports success and failure in the operator's words", async () => {
    h.check.mockResolvedValueOnce({ ok: true });
    expect(
      await checkParasutConnectionAction(null, new FormData()),
    ).toMatchObject({
      ok: true,
    });
    h.check.mockResolvedValueOnce({
      ok: false,
      error:
        "Paraşüt girişi reddedildi: kullanıcı adı, şifre ya da uygulama kimliği / sırrı yanlış.",
    });
    expect(
      await checkParasutConnectionAction(null, new FormData()),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("girişi reddedildi"),
    });
    expect(h.requireRole).toHaveBeenCalledWith("invoices");
  });
});
