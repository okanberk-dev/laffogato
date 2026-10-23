import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InvoiceRow } from "@/lib/invoice/invoice-core";

/**
 * Faturalar's row (Innex: the button follows the row's state, recipe
 * §3.4; 23 Eki 2026): beside the ⋯ menu, the one step the row asks for.
 * A draft is read before it is formalised, so its step opens the source's
 * Fatura tab, never the formalise dialog from a row whose lines are not
 * on screen.
 */

const h = vi.hoisted(() => ({ pdf: true }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/app/admin/faturalar/actions", () => ({
  cutInvoiceNowAction: vi.fn(),
  formalizeInvoiceAction: vi.fn(),
  markInvoiceManualAction: vi.fn(),
  markInvoiceManualDoneAction: vi.fn(),
  markInvoiceRefundHandledAction: vi.fn(),
  rebuildInvoiceDraftAction: vi.fn(),
  retryInvoiceAction: vi.fn(),
  setInvoiceBillingAction: vi.fn(),
}));
vi.mock("@/lib/invoice/pdf", () => ({
  invoicePdfAvailable: () => h.pdf,
}));

const { InvoiceActions, InvoiceRowStep } =
  await import("@/components/admin/invoice-actions");
const { needsAttention, refundOpen } = await import("@/lib/invoice/panel-core");

const row = (over: Partial<InvoiceRow>): InvoiceRow =>
  ({
    id: "inv_0123456789abcdef",
    sourceKind: "order",
    sourceId: "ord-10042",
    sourceLabel: "#10042",
    status: "due",
    eDocumentId: "",
    salesInvoiceId: "",
    emailedAt: "",
    ...over,
  }) as InvoiceRow;

const step = (over: Partial<InvoiceRow>) =>
  renderToStaticMarkup(createElement(InvoiceRowStep, { row: row(over) }));

beforeEach(() => {
  h.pdf = true;
});

describe("the invoice row's one step", () => {
  it("a draft opens its source's Fatura tab, where its lines are read", () => {
    const html = step({ status: "draft", salesInvoiceId: "1042" });
    expect(html).toContain('href="/admin/siparisler/ord-10042?sekme=fatura"');
    expect(html).toContain(">Taslağı gör<");
    expect(html).not.toContain("Kesinleştir");
    // A booking's draft opens the booking's tab.
    expect(
      step({ status: "draft", sourceKind: "karaoke", sourceId: "krk-00042" }),
    ).toContain('href="/admin/mobil/karaoke/krk-00042?sekme=fatura"');
  });

  it("a due one is cut, a failed one tried again, a manual one recorded", () => {
    expect(step({ status: "due" })).toContain(">Faturayı kes<");
    expect(step({ status: "failed" })).toContain(">Yeniden dene<");
    const manual = step({ status: "manual" });
    expect(manual).toContain(">Kestim<");
    expect(manual).toContain('aria-label="Elle kestim: #10042"');
    expect(manual).toContain('aria-haspopup="dialog"');
  });

  it("an issued one is its PDF, while Paraşüt can be read", () => {
    const issued = { status: "issued" as const, eDocumentId: "77" };
    expect(step(issued)).toMatch(
      /<a href="\/admin\/faturalar\/inv_0123456789abcdef\/pdf" download=""[^>]*>PDF<\/a>/,
    );
    h.pdf = false;
    expect(step(issued)).toBe("");
  });

  it("nothing for a row that waits on no one", () => {
    for (const status of ["waiting", "working", "skipped"] as const) {
      expect(step({ status }), status).toBe("");
    }
  });

  it("filled where a person is the next step, outlined for a download", () => {
    expect(step({ status: "failed" })).toContain("bg-[var(--admin-primary)]");
    expect(step({ status: "issued", eDocumentId: "77" })).not.toContain(
      "bg-[var(--admin-primary)]",
    );
  });
});

describe("review of #231", () => {
  const NOTED = "2026-10-22T10:00:00.000Z";
  const issued = { status: "issued" as const, eDocumentId: "77" };

  it("the PDF step's name starts with the word on it (WCAG 2.5.3)", () => {
    expect(step(issued)).toContain('aria-label="PDF indir: #10042"');
  });

  it("a refund after issue waits for its return document, then closes", () => {
    const open = { ...issued, refundNotedAt: NOTED, refundHandledAt: "" };
    expect(refundOpen(open)).toBe(true);
    const html = step(open);
    expect(html).toContain(">Belgeyi kestim<");
    expect(html).toContain('aria-label="İade belgesini kestim: #10042"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain(">PDF<");
    // Handled after it was noted: closed, the PDF again; a row from
    // before the stamp existed (no field) stays open.
    const handled = { ...open, refundHandledAt: "2026-10-22T11:00:00.000Z" };
    expect(refundOpen(handled)).toBe(false);
    expect(step(handled)).toContain(">PDF<");
    expect(refundOpen({ refundNotedAt: NOTED })).toBe(true);
    // Noted again by a later refund: open again.
    expect(
      refundOpen({ ...handled, refundNotedAt: "2026-10-23T09:00:00.000Z" }),
    ).toBe(true);
    const now = new Date("2026-10-23T12:00:00.000Z");
    expect(needsAttention(row(open), now)).toBe(true);
    expect(needsAttention(row(handled), now)).toBe(false);
  });

  it("the list's ⋯ never formalises a draft: it opens the draft's lines", () => {
    const draft = row({ status: "draft", salesInvoiceId: "1042" });
    const source = { kind: "order" as const, id: "ord-10042", label: "#10042" };
    const menu = renderToStaticMarkup(
      createElement(InvoiceActions, { row: draft, source, menu: true }),
    );
    expect(menu).toContain('href="/admin/siparisler/ord-10042?sekme=fatura"');
    expect(menu).toContain(">Taslağı gör ve kesinleştir<");
    expect(menu).not.toContain(">Faturayı kesinleştir<");
    // The card, where the lines are on screen, still formalises.
    const card = renderToStaticMarkup(
      createElement(InvoiceActions, { row: draft, source }),
    );
    expect(card).toContain(">Faturayı kesinleştir<");
  });
});
