// Client-safe (no server-only): Olay kaydı's filtered rows as CSV, for its
// "CSV indir" (app/admin/olay-kaydi/csv/route.ts, admin audit SYS-09). The
// same file as the order list's (order-csv.ts): a UTF-8 BOM so Turkish
// letters open right in Excel, `;` between cells, CRLF line ends, and every
// cell through csvCell, so a payload value that starts with = + - @ is not
// run as a formula.

import type { AdminAuditLog } from "./audit";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  auditPayloadEntries,
} from "./audit-view";
import { csvCell } from "./order-csv";

/** The most rows one export reads (a hundred pages of the log). */
export const AUDIT_CSV_MAX_ROWS = 5_000;

export const AUDIT_CSV_HEADER = [
  "Olay no",
  "Zaman",
  "Kim",
  "İşlem",
  "Kayıt türü",
  "Kayıt no",
  "Ayrıntı",
  "Ham kayıt",
];

/** "2026-10-17 14:05:09": the Istanbul wall clock to the second. */
export function auditCsvStamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/**
 * One event. The actor and the record id stay exactly as written (an
 * investigation searches for them); the payload comes twice: as the
 * panel's Turkish lines, unclipped, and as the stored JSON.
 */
export function auditCsvRow(row: AdminAuditLog): string[] {
  return [
    row.id,
    auditCsvStamp(row.createdAt),
    row.actor,
    AUDIT_ACTION_LABELS[row.action] ?? row.action,
    AUDIT_ENTITY_LABELS[row.entity] ?? row.entity,
    row.entityId,
    auditPayloadEntries(row.payload, row, { clip: false })
      .map((e) => `${e.label}: ${e.value}`)
      .join(" · "),
    JSON.stringify(row.payload ?? {}),
  ];
}

/** The whole file, BOM and header included. */
export function auditCsv(rows: readonly AdminAuditLog[]): string {
  const lines = [AUDIT_CSV_HEADER, ...rows.map(auditCsvRow)].map((cells) =>
    cells.map(csvCell).join(";"),
  );
  return `﻿${lines.join("\r\n")}\r\n`;
}
