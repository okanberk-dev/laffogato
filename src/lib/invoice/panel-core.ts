// Client-safe, no I/O: how the panel shows an e-Arşiv invoice row (the
// Faturalar list, the invoice card on an order or a booking, the
// dashboard's alerts). docs/EARSIV.md "Panel".

import type { AdminTone } from "@/lib/admin/tone";

import {
  deadlineState,
  INVOICE_ROUTE_LABELS,
  INVOICE_STATUS_LABELS,
  MAX_EMAIL_ATTEMPTS,
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
  if (row.status === "issued" && !row.emailedAt && row.emailError) {
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
  for (const r of rows) {
    const d = deadlineState(r, now);
    if (d === "late") late += 1;
    else if (d === "soon") soon += 1;
    if (r.status === "manual") manual += 1;
    if (r.status === "failed") failed += 1;
    if (r.refundNotedAt && r.status === "issued") refund += 1;
    if (mailGivenUp(r)) mail += 1;
  }
  if (late) {
    tone = "danger";
    parts.push(`${late} faturanın 7 günlük süresi geçti`);
  }
  if (soon) parts.push(`${soon} faturanın süresi 2 gün içinde doluyor`);
  if (manual) parts.push(`${manual} fatura elle kesilecek`);
  if (failed) parts.push(`${failed} fatura hata verdi (yeniden denenecek)`);
  if (refund)
    parts.push(
      `${refund} faturalı siparişte iade (iade faturası / gider pusulası)`,
    );
  if (mail) parts.push(`${mail} faturanın e-postası gitmedi`);
  return parts.length ? { tone, parts } : null;
}
