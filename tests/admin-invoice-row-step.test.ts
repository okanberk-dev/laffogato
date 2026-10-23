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
  rebuildInvoiceDraftAction: vi.fn(),
  retryInvoiceAction: vi.fn(),
  setInvoiceBillingAction: vi.fn(),
}));
vi.mock("@/lib/invoice/pdf", () => ({
  invoicePdfAvailable: () => h.pdf,
}));

const { InvoiceRowStep } = await import("@/components/admin/invoice-actions");

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
