// Client-safe, no I/O: how the panel shows an e-Arşiv invoice row (the
// Faturalar list, the invoice card on an order or a booking, the
// dashboard's alerts). docs/EARSIV.md "Panel".

import type { AdminTone } from "@/lib/admin/tone";

import { LEGAL_TAX_RATES } from "@/lib/utils/kdv";

import {
  buyerOf,
  CONSUMER_TAX_NUMBER,
  deadlineState,
  INVOICE_ROUTE_LABELS,
  INVOICE_STATUS_LABELS,
  invoiceMarker,
  karaokeInvoiceLines,
  MAX_EMAIL_ATTEMPTS,
  orderInvoiceLines,
  type InvoiceBooking,
  type InvoiceLine,
  type InvoiceOrder,
  type InvoiceRow,
  type InvoiceStatus,
} from "./invoice-core";

export const INVOICES_PATH = "/admin/faturalar";
export const INVOICE_TAB_PARAM = "durum";

export type InvoiceTab = "dikkat" | "bekleyen" | "kesilen" | "yok";

export const INVOICE_TABS: ReadonlyArray<{
  value: InvoiceTab | null;
  label: string;
}> = [
  { value: null, label: "Tümü" },
  { value: "dikkat", label: "Dikkat" },
  { value: "bekleyen", label: "Bekleyen" },
  { value: "kesilen", label: "Kesilen" },
  { value: "yok", label: "Fatura yok" },
];

export function parseInvoiceTab(value: unknown): InvoiceTab | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "dikkat" || v === "bekleyen" || v === "kesilen" || v === "yok"
    ? v
    : null;
}

/** Whether the mail of an issued invoice was given up on. */
export function mailGivenUp(
  row: Pick<
    InvoiceRow,
    "status" | "emailedAt" | "emailError" | "nextAttemptAt" | "emailAttempts"
  >,
): boolean {
  return (
    row.status === "issued" &&
    !row.emailedAt &&
    Boolean(row.emailError) &&
    (!row.nextAttemptAt || row.emailAttempts >= MAX_EMAIL_ATTEMPTS)
  );
}

/** What needs a person: the dashboard's and the list's "Dikkat". */
export function needsAttention(row: InvoiceRow, now: Date): boolean {
  if (row.status === "manual" || row.status === "failed") return true;
  // A draft waits for a person to read and formalise it.
  if (row.status === "draft") return true;
  if (row.refundNotedAt) return true;
  if (mailGivenUp(row)) return true;
  const d = deadlineState(row, now);
  return d === "late" || d === "soon";
}

export function invoiceTab(row: InvoiceRow, now: Date): InvoiceTab[] {
  const tabs: InvoiceTab[] = [];
  if (needsAttention(row, now)) tabs.push("dikkat");
  if (
    [
      "waiting",
      "due",
      "working",
      "formalizing",
      "draft",
      "failed",
      "manual",
    ].includes(row.status)
  ) {
    tabs.push("bekleyen");
  }
  if (row.status === "issued" || row.status === "manual_done")
    tabs.push("kesilen");
  if (row.status === "skipped") tabs.push("yok");
  return tabs;
}

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, AdminTone> = {
  waiting: "neutral",
  due: "info",
  working: "info",
  draft: "accent",
  formalizing: "info",
  issued: "success",
  failed: "warning",
  manual: "danger",
  manual_done: "success",
  skipped: "neutral",
};

export function invoiceStatusLabel(row: Pick<InvoiceRow, "status">): string {
  return INVOICE_STATUS_LABELS[row.status] ?? row.status;
}

export function invoiceRouteLabel(
  row: Pick<InvoiceRow, "route" | "sourceKind">,
): string {
  if (row.route) return INVOICE_ROUTE_LABELS[row.route];
  return row.sourceKind === "karaoke" ? "Karaoke" : "Sipariş";
}

/** The legal deadline as a badge: text and tone; null when there is none to show. */
export function deadlineBadge(
  row: Pick<InvoiceRow, "status" | "deadlineAt">,
  now: Date,
): { label: string; tone: AdminTone } | null {
  const state = deadlineState(row, now);
  if (state === "none" || state === "done") return null;
  const at = Date.parse(row.deadlineAt);
  const hours = Math.round((at - now.getTime()) / 3_600_000);
  if (state === "late") {
    const days = Math.max(1, Math.ceil(-hours / 24));
    return { label: `Süre geçti (${days} gün)`, tone: "danger" };
  }
  if (state === "soon") {
    return {
      label:
        hours < 24
          ? `Son ${Math.max(0, hours)} saat`
          : `Son ${Math.ceil(hours / 24)} gün`,
      tone: "warning",
    };
  }
  return { label: `${Math.ceil(hours / 24)} gün var`, tone: "neutral" };
}

/** Where the row's order or booking lives in the panel. */
export function invoiceSourceHref(
  row: Pick<InvoiceRow, "sourceKind" | "sourceId">,
): string {
  return row.sourceKind === "order"
    ? `/admin/siparisler/${encodeURIComponent(row.sourceId)}`
    : `/admin/mobil/karaoke/${encodeURIComponent(row.sourceId)}`;
}

/** The PDF route of an issued invoice (checks the session and role itself). */
export function invoicePdfHref(row: Pick<InvoiceRow, "id">): string {
  return `${INVOICES_PATH}/${encodeURIComponent(row.id)}/pdf`;
}

/** The sentence under a row: why it waits, why a person cuts it, what failed. */
export function invoiceNoteText(row: InvoiceRow): string {
  if (row.refundNotedAt) {
    return "Faturalı siparişte iade: iade faturası / gider pusulası gerekir.";
  }
  if (row.status === "failed") return row.lastError || "Son deneme başarısız.";
  if (row.status === "draft") {
    return row.lastError || "Taslak hazır: kontrol et, sonra kesinleştir.";
  }
  if (
    row.status === "issued" &&
    !row.emailedAt &&
    row.emailError &&
    !isEInvoice(row)
  ) {
    return `PDF e-postası gitmedi: ${row.emailError}`;
  }
  if (row.status === "manual_done") {
    return row.actor ? `Elle kesildi (${row.actor}).` : "Elle kesildi.";
  }
  return row.manualReason;
}

/**
 * The dashboard's e-Arşiv line (Genel bakış): what is past or within two
 * days of its legal deadline, what a person has to cut, refunds after an
 * invoice, and a configuration that keeps the automation from running.
 * Null when there is nothing to say.
 */
export function invoiceDashboardAlert(
  rows: readonly InvoiceRow[],
  now: Date,
  config: { mode: string; errors: readonly string[] },
): { tone: AdminTone; parts: string[] } | null {
  const parts: string[] = [];
  let tone: AdminTone = "warning";
  if (config.mode !== "off" && config.errors.length > 0) {
    tone = "danger";
    parts.push(`ayar hatası: ${config.errors[0]}`);
  }
  let late = 0;
  let soon = 0;
  let manual = 0;
  let failed = 0;
  let refund = 0;
  let mail = 0;
  let drafts = 0;
  for (const r of rows) {
    const d = deadlineState(r, now);
    if (d === "late") late += 1;
    else if (d === "soon") soon += 1;
    if (r.status === "manual") manual += 1;
    if (r.status === "failed") failed += 1;
    if (r.refundNotedAt && r.status === "issued") refund += 1;
    if (mailGivenUp(r)) mail += 1;
    if (r.status === "draft") drafts += 1;
  }
  if (late) {
    tone = "danger";
    parts.push(`${late} faturanın 7 günlük süresi geçti`);
  }
  if (soon) parts.push(`${soon} faturanın süresi 2 gün içinde doluyor`);
  if (drafts) parts.push(`${drafts} taslak kesinleştirmeni bekliyor`);
  if (manual) parts.push(`${manual} fatura elle kesilecek`);
  if (failed) parts.push(`${failed} fatura hata verdi (yeniden denenecek)`);
  if (refund)
    parts.push(
      `${refund} faturalı siparişte iade (iade faturası / gider pusulası)`,
    );
  if (mail) parts.push(`${mail} faturanın e-postası gitmedi`);
  return parts.length ? { tone, parts } : null;
}

/**
 * A draft's lines as the site sent them to Paraşüt, rebuilt from the order
 * or the booking with the same functions (the order's lines do not change
 * once paid; a refund takes the draft away). Paraşüt's own copy, edits
 * included, is in Paraşüt. Null when the lines cannot be built.
 */
export function invoiceDraftLines(
  row: Pick<InvoiceRow, "amountMinor" | "kdvRows">,
  source: { order: InvoiceOrder } | { booking: InvoiceBooking },
): InvoiceLine[] | null {
  if ("order" in source) return orderInvoiceLines(source.order);
  if (row.amountMinor <= 0) return null;
  return karaokeInvoiceLines(
    source.booking,
    row.amountMinor,
    row.kdvRows[0]?.ratePct ?? LEGAL_TAX_RATES.karaoke,
  );
}

/** Where to find a draft in Paraşüt: Satışlar > Faturalar, by this text. */
export function invoiceDraftMarker(
  row: Pick<InvoiceRow, "sourceKind" | "sourceLabel" | "sourceId">,
): string {
  return invoiceMarker(row.sourceKind, row.sourceLabel || row.sourceId);
}

/** Whether the invoice went out as an e-Fatura (to the buyer's GİB inbox). */
export function isEInvoice(row: Pick<InvoiceRow, "eDocumentType">): boolean {
  return row.eDocumentType === "e_invoices";
}

/** The card's and the list's name for the document. */
export function invoiceKindLabel(
  row: Pick<InvoiceRow, "eDocumentType" | "eDocumentId" | "buyerKind"> | null,
): string {
  if (row && isEInvoice(row)) return "e-Fatura";
  if (row?.eDocumentId || row?.buyerKind !== "company") return "e-Arşiv fatura";
  return "Fatura (kurumsal)";
}

/** Who the invoice is cut to, in one line. */
export function invoiceBuyerLines(
  row: Pick<
    InvoiceRow,
    "buyerKind" | "buyerTitle" | "buyerTaxNumber" | "buyerTaxOffice"
  >,
  consumerName: string,
): { name: string; tax: string } {
  const buyer = buyerOf(row);
  if (buyer.kind === "company") {
    return {
      name: buyer.title,
      tax: `VKN ${buyer.taxNumber} · ${buyer.taxOffice} V.D.`,
    };
  }
  return {
    name: consumerName || "-",
    tax: `TCKN ${CONSUMER_TAX_NUMBER} (nihai tüketici)`,
  };
}

/** The order's invoice wizard ("Fatura oluştur"). */
export function invoiceWizardHref(orderId: string): string {
  return `/admin/siparisler/${encodeURIComponent(orderId)}/fatura`;
}

/**
 * Whether the wizard may still set the buyer: nothing formalised, nothing
 * under way, not cut by hand. Whether the order is billable at all is the
 * wizard page's question (invoiceWizardRefusal).
 */
export function invoiceWizardOpen(
  row: Pick<
    InvoiceRow,
    "status" | "eDocumentId" | "jobId" | "formalizePosts"
  > | null,
): boolean {
  if (!row) return true;
  return (
    !row.eDocumentId &&
    !row.jobId &&
    row.formalizePosts === 0 &&
    !["issued", "manual_done", "working", "formalizing"].includes(row.status)
  );
}
