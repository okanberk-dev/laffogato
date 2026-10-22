import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InvoiceRow } from "@/lib/invoice/invoice-core";

/**
 * The two PDF downloads of an e-Arşiv invoice (docs/EARSIV.md):
 *
 * - the member's, `/uye/hesap/siparislerim/{no}/fatura`: the access rule of
 *   `../sozlesme` (the signed-in owner through `memberOrders`), one and the
 *   same 404 for every refusal, ten downloads per member in five minutes;
 * - the panel's, `/admin/faturalar/{id}/pdf`: the session and the role
 *   checked by the route itself (Faturalar, or the order's or booking's
 *   own section).
 *
 * Both stream the PDF they got from Paraşüt; neither redirects to Paraşüt.
 */

const h = vi.hoisted(() => ({
  customer: null as null | {
    id: string;
    email: string;
    emailVerified: boolean;
  },
  orders: [] as Record<string, unknown>[],
  rows: new Map<string, InvoiceRow>(),
  session: null as null | { email: string; role: string; expiresAt: number },
  fetchInvoicePdf: vi.fn(),
  reserveLoginAttempt: vi.fn(),
}));

vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: async () => h.customer,
}));
vi.mock("@/lib/admin/store", () => ({
  customerOrdersByEmail: async (email: string) =>
    h.orders.filter((o) => o.customerEmail === email),
}));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  reserveLoginAttempt: h.reserveLoginAttempt,
}));
vi.mock("@/lib/invoice/store", () => ({
  getInvoice: async (id: string) => h.rows.get(id) ?? null,
  getInvoiceForSource: async (kind: string, sourceId: string) =>
    [...h.rows.values()].find(
      (r) => r.sourceKind === kind && r.sourceId === sourceId,
    ) ?? null,
}));
vi.mock("@/lib/invoice/pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/invoice/pdf")>()),
  fetchInvoicePdf: h.fetchInvoicePdf,
}));

const member =
  await import("@/app/uye/hesap/siparislerim/[orderNo]/fatura/route");
const admin = await import("@/app/admin/faturalar/[id]/pdf/route");

const PDF = Buffer.from("%PDF-1.7 fatura");
const OWNER = "eda@example.com";

function row(over: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv_0123456789abcdef",
    sourceKind: "order",
    sourceId: "ord-1",
    sourceLabel: "#10042",
    status: "issued",
    eDocumentId: "77",
    eDocumentType: "e_archives",
    invoiceNo: "GIB2026000000077",
    ...over,
  } as InvoiceRow;
}

const getMember = (orderNo: string) =>
  member.GET(
    new Request(
      `https://laffogato.net/uye/hesap/siparislerim/${orderNo}/fatura`,
    ),
    {
      params: Promise.resolve({ orderNo }),
    },
  );
const getAdmin = (id: string) =>
  admin.GET(new Request(`https://laffogato.net/admin/faturalar/${id}/pdf`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.customer = { id: "cus-1", email: OWNER, emailVerified: true };
  h.orders = [
    {
      id: "ord-1",
      orderNo: 10042,
      status: "paid",
      paidAt: "2026-10-22T10:00:00.000Z",
      refunds: [],
      customerEmail: OWNER,
    },
    {
      id: "ord-2",
      orderNo: 10043,
      status: "paid",
      paidAt: "2026-10-22T10:00:00.000Z",
      refunds: [],
      customerEmail: "other@example.com",
    },
  ];
  h.rows = new Map([
    ["inv_0123456789abcdef", row()],
    [
      "inv_fedcba9876543210",
      row({
        id: "inv_fedcba9876543210",
        sourceId: "ord-2",
        sourceLabel: "#10043",
      }),
    ],
    [
      "inv_aaaaaaaaaaaaaaaa",
      row({
        id: "inv_aaaaaaaaaaaaaaaa",
        sourceKind: "karaoke",
        sourceId: "krk-00042",
        sourceLabel: "krk-00042",
      }),
    ],
  ]);
  h.session = { email: "a@laffogato.net", role: "owner", expiresAt: 0 };
  h.fetchInvoicePdf.mockResolvedValue(PDF);
  h.reserveLoginAttempt.mockResolvedValue({
    blocked: false,
    retryAfterSeconds: 0,
    remaining: 9,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function expectPdf(res: Response) {
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/pdf");
  expect(res.headers.get("content-disposition")).toBe(
    'attachment; filename="L-Affogato-e-Arsiv-GIB2026000000077.pdf"',
  );
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("location")).toBeNull();
  expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(PDF.toString());
}

describe("the member's invoice", () => {
  it("streams the owner's issued invoice", async () => {
    await expectPdf(await getMember("10042"));
    expect(h.fetchInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({ eDocumentId: "77" }),
    );
    expect(h.reserveLoginAttempt).toHaveBeenCalledWith(
      "invoice-download",
      "",
      "cus-1",
    );
  });

  it("answers one and the same 404 for every refusal", async () => {
    const answers: Response[] = [];
    answers.push(await getMember("abc"));
    answers.push(await getMember("10043")); // another member's order
    answers.push(await getMember("99999")); // unknown
    h.rows.set(
      "inv_0123456789abcdef",
      row({ status: "draft", eDocumentId: "" }),
    );
    answers.push(await getMember("10042")); // not issued
    h.rows.delete("inv_0123456789abcdef");
    answers.push(await getMember("10042")); // no invoice row
    h.customer = { id: "cus-1", email: OWNER, emailVerified: false };
    answers.push(await getMember("10042")); // unverified address
    h.customer = null;
    answers.push(await getMember("10042")); // signed out
    for (const res of answers) {
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Bulunamadı.");
    }
    expect(h.fetchInvoicePdf).not.toHaveBeenCalled();
  });

  it("limits a member's downloads and fails as a 503, never a 500", async () => {
    h.reserveLoginAttempt.mockResolvedValueOnce({
      blocked: true,
      retryAfterSeconds: 120,
      remaining: 0,
    });
    const limited = await getMember("10042");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("120");
    h.fetchInvoicePdf.mockRejectedValueOnce(
      new Error("Paraşüt down eda@example.com"),
    );
    const down = await getMember("10042");
    expect(down.status).toBe(503);
    expect(
      JSON.stringify(
        (console.error as unknown as { mock: { calls: unknown[] } }).mock.calls,
      ),
    ).not.toContain(OWNER);
  });
});

describe("the panel's invoice PDF", () => {
  it("asks for a session, then the role: Faturalar's, or the order's / booking's own", async () => {
    h.session = null;
    expect((await getAdmin("inv_0123456789abcdef")).status).toBe(401);
    h.session = { email: "k@laffogato.net", role: "cashier", expiresAt: 0 };
    expect((await getAdmin("inv_0123456789abcdef")).status).toBe(403);
    // Personel packs the parcel: the order's own section lets it in.
    h.session = { email: "p@laffogato.net", role: "staff", expiresAt: 0 };
    await expectPdf(await getAdmin("inv_0123456789abcdef"));
    // And the karaoke shift reaches a booking's.
    expect((await getAdmin("inv_aaaaaaaaaaaaaaaa")).status).toBe(200);
    h.session = { email: "m@laffogato.net", role: "manager", expiresAt: 0 };
    await expectPdf(await getAdmin("inv_0123456789abcdef"));
  });

  it("refuses a malformed id, an unknown one and one without an e-document", async () => {
    expect((await getAdmin("../etc")).status).toBe(404);
    expect((await getAdmin("inv_0000000000000000")).status).toBe(404);
    h.rows.set(
      "inv_0123456789abcdef",
      row({ status: "manual", eDocumentId: "" }),
    );
    expect((await getAdmin("inv_0123456789abcdef")).status).toBe(404);
    expect(h.fetchInvoicePdf).not.toHaveBeenCalled();
  });

  it("says 503 when Paraşüt has no PDF yet or fails", async () => {
    h.fetchInvoicePdf.mockResolvedValueOnce(null);
    expect((await getAdmin("inv_0123456789abcdef")).status).toBe(503);
    h.fetchInvoicePdf.mockRejectedValueOnce(new Error("x"));
    expect((await getAdmin("inv_0123456789abcdef")).status).toBe(503);
  });
});
