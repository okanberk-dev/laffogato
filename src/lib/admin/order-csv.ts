// Client-safe (no server-only): the order list's filtered rows as CSV, for
// "CSV indir" (app/admin/siparisler/csv/route.ts). Excel-friendly: a UTF-8
// BOM so Turkish letters open right, `;` between cells (Excel's separator
// for a Turkish locale) and CRLF line ends.

import {
  ORDER_CHANNEL_LABELS,
  ORDER_FULFILLMENT_LABELS,
  ORDER_KIND_LABELS,
  orderChannel,
  orderFulfillment,
  orderKind,
} from "./order-channel";
import { orderPaymentState, refundedMinor } from "./order-actions";
import { orderStatusLabel } from "./order-ui";
import type { AdminOrder } from "./store";

/** The most rows one export reads (a hundred pages of the list). */
export const ORDER_CSV_MAX_ROWS = 5_000;

export const ORDER_CSV_HEADER = [
  "Sipariş no",
  "Tarih",
  "Durum",
  "Ödeme",
  "Kanal",
  "Tür",
  "Teslimat",
  "Müşteri",
  "E-posta",
  "Kalemler",
  "Ara toplam",
  "İndirim",
  "Promosyon",
  "Kargo",
  "Toplam",
  "İade",
  "Net",
];

/** "1250,50": kuruş as lira with a decimal comma, no currency sign. */
function lira(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

/** The Istanbul wall clock of an ISO instant: "2026-10-17 14:05". */
export function istanbulStamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + 3 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
}

/**
 * One cell, quoted when it must be. A cell that starts with = + - @ (or a
 * tab / CR) is prefixed with ' so a spreadsheet does not run a customer's
 * name as a formula (CSV injection).
 */
export function csvCell(value: string | number): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function orderCsvRow(
  order: AdminOrder,
  collected: boolean = Boolean(order.paidAt),
): string[] {
  const refunded = refundedMinor(order);
  return [
    String(order.orderNo),
    istanbulStamp(order.createdAt),
    orderStatusLabel(order),
    orderPaymentState(order, collected).label,
    order.source === "manual" ? "Panel" : ORDER_CHANNEL_LABELS[orderChannel(order)],
    ORDER_KIND_LABELS[orderKind(order)],
    ORDER_FULFILLMENT_LABELS[orderFulfillment(order)],
    order.customerName,
    order.customerEmail,
    order.items
      .map((it) => `${it.qty}x ${it.productName}${it.detail ? ` (${it.detail})` : ""}`)
      .join(", "),
    lira(order.subtotalMinor),
    lira(order.discountMinor),
    order.promoCode ?? "",
    lira(order.shippingMinor),
    lira(order.totalMinor),
    lira(refunded),
    lira(order.totalMinor - refunded),
  ];
}

/** The whole file, BOM and header included. */
export function ordersCsv(
  orders: readonly AdminOrder[],
  collected: (order: AdminOrder) => boolean = (o) => Boolean(o.paidAt),
): string {
  const lines = [
    ORDER_CSV_HEADER,
    ...orders.map((o) => orderCsvRow(o, collected(o))),
  ].map((cells) => cells.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
