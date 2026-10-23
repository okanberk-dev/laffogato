import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Faturalar's operator buttons (src/app/admin/faturalar/actions.ts):
 * "Faturayı kes" runs that one row (a draft in draft mode), "Faturayı
 * kesinleştir" formalises the draft the person read, "Taslağı yenile"
 * prepares it again; each answers with the row's state afterwards.
 * "Paraşüt bağlantısını sına" only reports. All check the session and the
 * `invoices` role themselves (CLAUDE.md rule 27).
 */

const h = vi.hoisted(() => ({
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
  getInvoice: vi.fn(),
  runInvoices: vi.fn(),
  runInvoiceRow: vi.fn(),
  safeAudit: vi.fn(async () => true),
  check: vi.fn(),
  markRefundHandled: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/audit", () => ({ safeAudit: h.safeAudit }));
vi.mock("@/lib/invoice/run", () => ({
  runInvoices: h.runInvoices,
  runInvoiceRow: h.runInvoiceRow,
}));
vi.mock("@/lib/invoice/connection", () => ({
  checkParasutConnection: h.check,
}));
vi.mock("@/lib/invoice/store", () => ({
  dbInvoiceStore: { tokens: {} },
  getInvoice: h.getInvoice,
  markInvoiceManual: vi.fn(),
  markInvoiceManualDone: vi.fn(),
  markInvoiceRefundHandled: h.markRefundHandled,
  retryInvoice: vi.fn(),
  setInvoiceBilling: vi.fn(),
  writeCarriers: vi.fn(),
}));

const {
  cutInvoiceNowAction,
  checkParasutConnectionAction,
  formalizeInvoiceAction,
  markInvoiceRefundHandledAction,
  rebuildInvoiceDraftAction,
} = await import("@/app/admin/faturalar/actions");

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
  salesInvoiceId: "",
  ...over,
});
const ran = (over: Record<string, unknown> = {}) => ({
  mode: "draft",
  taken: true,
  step: "draft",
  error: null,
  ...over,
});
const form = (id = ID, draft?: string) => {
  const f = new FormData();
  f.set("id", id);
  if (draft !== undefined) f.set("draft", draft);
  return f;
};
/** The draft the card showed, and the form its "Kesinleştir" posts. */
const SHOWN = "1042";
const approve = () => form(ID, SHOWN);

beforeEach(() => {
  h.getInvoice.mockReset();
  h.runInvoices.mockReset();
  h.runInvoiceRow.mockReset();
  h.check.mockReset();
  h.requireRole.mockClear();
  h.safeAudit.mockClear();
  h.markRefundHandled.mockReset();
});

describe("Faturayı kes", () => {
  it("runs this row only and, in draft mode, asks the person to check the draft", async () => {
    h.getInvoice
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "draft", amountMinor: 30_000 }));
    h.runInvoiceRow.mockResolvedValue(ran());
    const r = await cutInvoiceNowAction(null, form());
    expect(h.requireRole).toHaveBeenCalledWith("invoices");
    expect(h.runInvoiceRow).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, action: "cut" }),
    );
    expect(h.runInvoices).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      ok: true,
      message: expect.stringContaining("Faturayı kesinleştir"),
    });
  });

  it("names the invoice when live mode formalised it at once", async () => {
    h.getInvoice.mockResolvedValueOnce(row()).mockResolvedValueOnce(
      row({
        status: "issued",
        invoiceNo: "GIB2026000001",
        emailedAt: "2026-10-22T12:00:00.000Z",
      }),
    );
    h.runInvoiceRow.mockResolvedValue(ran({ mode: "live", step: "issued" }));
    const r = await cutInvoiceNowAction(null, form());
    expect(r).toMatchObject({
      ok: true,
      message: expect.stringContaining("GIB2026000001"),
    });
  });

  it("runs nothing for a row whose time has not come", async () => {
    h.getInvoice.mockResolvedValueOnce(row({ status: "waiting" }));
    const r = await cutInvoiceNowAction(null, form());
    expect(r.ok).toBe(false);
    expect(h.runInvoiceRow).not.toHaveBeenCalled();
  });

  it("says so when e-Arşiv is off", async () => {
    h.getInvoice.mockResolvedValue(row());
    h.runInvoiceRow.mockResolvedValue(ran({ mode: "off", taken: false }));
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
    h.runInvoiceRow.mockResolvedValue(ran({ step: "manual" }));
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

describe("Faturayı kesinleştir / Taslağı yenile", () => {
  it("formalises only a draft, and says the PDF went to the buyer", async () => {
    h.getInvoice
      .mockResolvedValueOnce(row({ status: "draft", salesInvoiceId: SHOWN }))
      .mockResolvedValueOnce(
        row({
          status: "issued",
          invoiceNo: "GIB2026000002",
          emailedAt: "2026-10-22T12:00:00.000Z",
        }),
      );
    h.runInvoiceRow.mockResolvedValue(ran({ step: "issued" }));
    const r = await formalizeInvoiceAction(null, approve());
    expect(h.runInvoiceRow).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, action: "formalize" }),
    );
    expect(r).toMatchObject({
      ok: true,
      message: expect.stringMatching(/GIB2026000002.*e-postayla/),
    });
  });

  it("refuses to formalise anything but a draft", async () => {
    h.getInvoice.mockResolvedValueOnce(row({ status: "due" }));
    const r = await formalizeInvoiceAction(null, form());
    expect(r.ok).toBe(false);
    expect(h.runInvoiceRow).not.toHaveBeenCalled();
  });

  it("passes on why a draft stayed a draft", async () => {
    h.getInvoice
      .mockResolvedValueOnce(row({ status: "draft", salesInvoiceId: SHOWN }))
      .mockResolvedValueOnce(
        row({
          status: "draft",
          lastError:
            "Taslak 21 Ekim 2026 tarihli; e-Arşiv bugünün tarihiyle kesilir.",
        }),
      );
    h.runInvoiceRow.mockResolvedValue(ran());
    const r = await formalizeInvoiceAction(null, approve());
    expect(r).toMatchObject({
      ok: false,
      error: expect.stringContaining("bugünün tarihiyle"),
    });
  });

  it("formalises only the draft the card showed: one made again since is refused unread", async () => {
    // "Taslağı yenile" or the order's invoice wizard in another tab made a
    // new Paraşüt draft after this card was drawn.
    for (const posted of [form(ID, SHOWN), form()]) {
      h.getInvoice.mockResolvedValueOnce(
        row({ status: "draft", salesInvoiceId: "1077" }),
      );
      const r = await formalizeInvoiceAction(null, posted);
      expect(r).toMatchObject({
        ok: false,
        error: expect.stringContaining("yeniden hazırlandı"),
      });
    }
    expect(h.runInvoiceRow).not.toHaveBeenCalled();
    // The card posts the draft it shows.
    const { readFileSync } = await import("node:fs");
    expect(
      readFileSync("src/components/admin/invoice-actions.tsx", "utf8"),
    ).toContain("hidden={{ id: row.id, draft: row.salesInvoiceId }}");
  });

  it("does not say Paraşüt is formalising when the deadline sent the row back to the queue", async () => {
    h.getInvoice
      .mockResolvedValueOnce(row({ status: "draft", salesInvoiceId: SHOWN }))
      .mockResolvedValueOnce(row({ status: "due", salesInvoiceId: SHOWN }));
    h.runInvoiceRow.mockResolvedValue(ran({ step: "pending" }));
    const r = await formalizeInvoiceAction(null, approve());
    expect(r).toMatchObject({
      ok: true,
      tone: "warning",
      message: expect.stringContaining("zamanında yanıt vermedi"),
    });
    expect(r.ok && r.message).not.toContain("resmileştiriyor");
  });

  it("rebuilds a draft", async () => {
    h.getInvoice
      .mockResolvedValueOnce(row({ status: "draft" }))
      .mockResolvedValueOnce(row({ status: "draft" }));
    h.runInvoiceRow.mockResolvedValue(ran());
    const r = await rebuildInvoiceDraftAction(null, form());
    expect(h.runInvoiceRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rebuild" }),
    );
    expect(r.ok).toBe(true);
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

describe("İade belgesini kestim (review of #231)", () => {
  const refundForm = (docNo: string) => {
    const f = form();
    f.set("docNo", docNo);
    return f;
  };

  it("asks for the return document's number, in the operator's words", async () => {
    for (const bad of ["", "ab", "GP 12", "a".repeat(41), "x<y"]) {
      const r = await markInvoiceRefundHandledAction(null, refundForm(bad));
      expect(r.ok, bad).toBe(false);
    }
    expect(h.markRefundHandled).not.toHaveBeenCalled();
    expect(
      await markInvoiceRefundHandledAction(null, refundForm("")),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        docNo: expect.stringContaining("gider pusulasının numarasını"),
      },
    });
  });

  it("records the number, by whom, and audits it", async () => {
    h.markRefundHandled.mockResolvedValueOnce({
      ok: true,
      row: row({ status: "issued", sourceKind: "order", sourceId: "ord-1" }),
    });
    const r = await markInvoiceRefundHandledAction(
      null,
      refundForm(" GP2026/0042 "),
    );
    expect(h.requireRole).toHaveBeenCalledWith("invoices");
    expect(h.markRefundHandled).toHaveBeenCalledWith(
      ID,
      "GP2026/0042",
      "patron@laffogato.net",
    );
    expect(h.safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "invoice",
        entityId: ID,
        payload: expect.objectContaining({
          event: "earsiv_refund_handled",
          docNo: "GP2026/0042",
        }),
      }),
    );
    expect(r).toMatchObject({ ok: true });
  });

  it("says why when there is nothing to close", async () => {
    h.markRefundHandled.mockResolvedValueOnce({
      ok: false,
      error: "Bu faturada belge bekleyen bir iade yok.",
    });
    expect(
      await markInvoiceRefundHandledAction(null, refundForm("GP-1")),
    ).toMatchObject({
      ok: false,
      error: "Bu faturada belge bekleyen bir iade yok.",
    });
    expect(h.safeAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ event: "earsiv_refund_handled" }),
      }),
    );
  });
});
