import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_ENTITY } from "@/lib/legal/entity";

/**
 * The order's invoice wizard's post (createOrderInvoiceAction,
 * src/app/admin/faturalar/actions.ts): checks the session and the
 * `invoices` role itself (CLAUDE.md rule 27), checks a company's title, VKN
 * (GİB check digit; no TCKN) and tax office and the billing address before
 * anything is written, asks the order again with the typed address (a
 * refusal writes nothing), then writes the request and cuts that row now:
 * a draft rebuilt for the new buyer, else a cut. Back to the order with the
 * answer as a flash.
 */

const h = vi.hoisted(() => ({
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
  load: vi.fn(),
  request: vi.fn(),
  getInvoice: vi.fn(),
  runInvoiceRow: vi.fn(),
  safeAudit: vi.fn(async () => true),
  flash: vi.fn(async () => undefined),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/audit", () => ({ safeAudit: h.safeAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: h.flash }));
vi.mock("@/lib/invoice/run", () => ({
  runInvoices: vi.fn(),
  runInvoiceRow: h.runInvoiceRow,
}));
vi.mock("@/lib/invoice/connection", () => ({
  checkParasutConnection: vi.fn(),
}));
vi.mock("@/lib/invoice/order-request", () => ({
  loadOrderInvoiceRequest: h.load,
}));
vi.mock("@/lib/invoice/store", () => ({
  dbInvoiceStore: { tokens: {} },
  getInvoice: h.getInvoice,
  markInvoiceManual: vi.fn(),
  markInvoiceManualDone: vi.fn(),
  requestOrderInvoice: h.request,
  retryInvoice: vi.fn(),
  setInvoiceBilling: vi.fn(),
  writeCarriers: vi.fn(),
}));

const { createOrderInvoiceAction } =
  await import("@/app/admin/faturalar/actions");

const VKN = LEGAL_ENTITY.taxNo; // a valid check digit
const PLAN = {
  sourceLabel: "#10234",
  status: "due",
  route: "pickup",
  deadlineAt: "2026-10-29T09:01:00.000Z",
  amountMinor: 38_000,
};
const ROW = {
  id: "inv_0123456789abcdef",
  sourceKind: "order",
  sourceId: "ord-1",
  sourceLabel: "#10234",
  status: "due",
  invoiceNo: "",
  lastError: "",
  manualReason: "",
  eDocumentType: "",
};

function form(over: Record<string, string> = {}): FormData {
  const f = new FormData();
  const fields = {
    orderId: "ord-1",
    buyerKind: "consumer",
    buyerTitle: "",
    buyerTaxNumber: "",
    buyerTaxOffice: "",
    buyerEmail: "",
    city: "istanbul",
    district: "Tuzla",
    address: "Postane Mah. Atatürk Cad. No 28",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  for (const m of [
    h.load,
    h.request,
    h.getInvoice,
    h.runInvoiceRow,
    h.flash,
    h.redirect,
    h.safeAudit,
  ])
    m.mockClear();
  h.load.mockResolvedValue({
    order: { id: "ord-1", orderNo: 10234 },
    row: null,
    mode: "draft",
    plan: PLAN,
    refusal: null,
    lines: [],
    billing: null,
  });
  h.request.mockResolvedValue({ ok: true, row: ROW });
  h.runInvoiceRow.mockResolvedValue({
    mode: "draft",
    taken: true,
    step: "draft",
    error: null,
  });
  h.getInvoice.mockResolvedValue({ ...ROW, status: "draft" });
});

describe("the order's invoice wizard", () => {
  it("a consumer: writes the request with the typed address, cuts the row now, back to the order with the answer", async () => {
    await createOrderInvoiceAction(null, form());
    expect(h.requireRole).toHaveBeenCalledWith("invoices");
    const billing = {
      city: "İstanbul",
      district: "Tuzla",
      address: "Postane Mah. Atatürk Cad. No 28",
    };
    // The order is asked again with what was typed.
    expect(h.load).toHaveBeenCalledWith("ord-1", billing);
    expect(h.request).toHaveBeenCalledWith(
      "ord-1",
      PLAN,
      { buyer: { kind: "consumer" }, email: "", billing },
      "patron@laffogato.net",
    );
    expect(h.runInvoiceRow).toHaveBeenCalledWith(
      expect.objectContaining({ id: ROW.id, action: "cut" }),
    );
    expect(h.flash).toHaveBeenCalledWith(
      expect.stringContaining("Taslak hazır"),
      "success",
    );
    expect(h.redirect).toHaveBeenCalledWith("/admin/siparisler/ord-1");
  });

  it('a company: title, VKN and tax office ("V.D." dropped), the invoice e-mail; the audit row names the company, not the e-mail', async () => {
    await createOrderInvoiceAction(
      null,
      form({
        buyerKind: "company",
        buyerTitle: "Örnek Gıda Ticaret A.Ş.",
        buyerTaxNumber: ` ${VKN.slice(0, 5)} ${VKN.slice(5)} `,
        buyerTaxOffice: "Tuzla Vergi Dairesi",
        buyerEmail: "Muhasebe@Ornek.com.tr",
      }),
    );
    expect(h.request).toHaveBeenCalledWith(
      "ord-1",
      PLAN,
      expect.objectContaining({
        buyer: {
          kind: "company",
          title: "Örnek Gıda Ticaret A.Ş.",
          taxNumber: VKN,
          taxOffice: "Tuzla",
        },
        email: "muhasebe@ornek.com.tr",
      }),
      "patron@laffogato.net",
    );
    const audit = JSON.stringify(h.safeAudit.mock.calls);
    expect(audit).toContain(VKN);
    expect(audit).not.toContain("muhasebe@");
    expect(audit).not.toContain("Postane");
  });

  it("refuses a wrong VKN, a TCKN, a missing title or tax office and an unknown province: nothing is written", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ buyerTaxNumber: "1234567891" }, "buyerTaxNumber"],
      [{ buyerTaxNumber: "12345678901" }, "buyerTaxNumber"],
      [{ buyerTitle: "" }, "buyerTitle"],
      [{ buyerTaxOffice: "" }, "buyerTaxOffice"],
      [{ city: "Atlantis" }, "city"],
      [{ buyerEmail: "not-an-address" }, "buyerEmail"],
    ];
    for (const [over, field] of cases) {
      const r = await createOrderInvoiceAction(
        null,
        form({
          buyerKind: "company",
          buyerTitle: "Örnek Gıda Ticaret A.Ş.",
          buyerTaxNumber: VKN,
          buyerTaxOffice: "Tuzla",
          ...over,
        }),
      );
      expect(r, field).toMatchObject({
        ok: false,
        fieldErrors: { [field]: expect.any(String) },
      });
    }
    expect(h.load).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
    expect(h.runInvoiceRow).not.toHaveBeenCalled();
  });

  it("writes nothing for an order the wizard cannot invoice, and says why", async () => {
    h.load.mockResolvedValue({
      order: { id: "ord-1", orderNo: 10234 },
      row: null,
      mode: "draft",
      plan: { sourceLabel: "#10234", status: "waiting" },
      refusal: "Kargoya verilince kesilir.",
      lines: [],
      billing: null,
    });
    const r = await createOrderInvoiceAction(null, form());
    expect(r).toEqual({ ok: false, error: "Kargoya verilince kesilir." });
    expect(h.request).not.toHaveBeenCalled();
    expect(h.runInvoiceRow).not.toHaveBeenCalled();
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it("a draft already in Paraşüt is rebuilt for the new buyer, not cut again", async () => {
    h.request.mockResolvedValue({ ok: true, row: { ...ROW, status: "draft" } });
    await createOrderInvoiceAction(null, form());
    expect(h.runInvoiceRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rebuild" }),
    );
  });

  it("says an e-Fatura went to the buyer's GİB inbox", async () => {
    h.runInvoiceRow.mockResolvedValue({
      mode: "live",
      taken: true,
      step: "issued",
      error: null,
    });
    h.getInvoice.mockResolvedValue({
      ...ROW,
      status: "issued",
      invoiceNo: "LAF2026000000001",
      eDocumentType: "e_invoices",
    });
    await createOrderInvoiceAction(null, form());
    expect(h.flash).toHaveBeenCalledWith(
      expect.stringContaining("GİB kutusuna"),
      "success",
    );
  });
});
