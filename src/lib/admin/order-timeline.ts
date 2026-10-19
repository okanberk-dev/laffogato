// Client-safe (no server-only): the order page's "Zaman çizelgesi", built
// from what the order already records - its stage timestamps, its refund
// ledger, its customer mails and its audit rows - into one list the kit's
// <Timeline> sorts and prints on the Istanbul clock.

import {
  CANCEL_NOTICE_KIND,
  PAID_NOTICE_KIND,
  RESENT_STATUS,
  baseNoticeKind,
  isResendKind,
} from "@/lib/email/notice-kinds";
import { formatTRYMinor } from "@/lib/utils/commerce";

import { orderFulfillment, shippedStatusLabel } from "./order-channel";
import {
  MANUAL_PAYMENT_LABELS,
  ORDER_ATTENTION_TEXT,
  REFUND_DESTINATION_LABELS,
  isManualPaymentMethod,
  type OrderAttention,
  type RefundDestination,
} from "./order-actions";
import { ORDER_STATUS_LABELS, isOrderStatus } from "./order-ui";
import type { AdminOrder } from "./store";
import type { AdminTone } from "./tone";

/** The kit's TimelineItem shape (components/admin/ui/detail.tsx). */
export interface OrderTimelineItem {
  id: string;
  at: string;
  title: string;
  description?: string;
  actor?: string;
  tone?: AdminTone;
}

export interface TimelineAuditRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TimelineNoticeRow {
  kind: string;
  status: string;
  error: string;
  createdAt: string;
  sentAt: string;
}

const ITEM_STATUS: Record<string, string> = {
  pending: "Bekliyor",
  ready: "Hazır",
  cancelled: "İptal",
};

/** "'Ödemen alındı' e-postası", from an `order_notice_emails` kind. */
export function noticeKindLabel(kind: string): string {
  const base = baseNoticeKind(kind);
  let label = "E-posta";
  if (base === PAID_NOTICE_KIND) label = '"Ödemen alındı" e-postası';
  else if (base === CANCEL_NOTICE_KIND) label = "İptal e-postası";
  else if (base === "staff-new") label = 'Ekibe "yeni sipariş" e-postası';
  else if (base.startsWith("shipped:")) label = "Kargo e-postası";
  else if (base.startsWith("refund:")) label = "İade e-postası";
  return isResendKind(kind) ? `${label} (yeniden)` : label;
}

function statusLabel(
  value: unknown,
  order: Pick<AdminOrder, "fulfillment">,
): string {
  if (value === "shipped") return shippedStatusLabel(orderFulfillment(order));
  return isOrderStatus(value)
    ? ORDER_STATUS_LABELS[value]
    : String(value ?? "");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function auditItem(
  row: TimelineAuditRow,
  order: Pick<AdminOrder, "fulfillment">,
): OrderTimelineItem | null {
  const p = row.payload ?? {};
  const base = { id: `aud-${row.id}`, at: row.createdAt, actor: row.actor };
  if (row.entity === "order_item") {
    const index = Number(String(row.entityId).split("#")[1] ?? "-1");
    return {
      ...base,
      title: `${index + 1}. kalem: ${ITEM_STATUS[text(p.status)] ?? text(p.status)}`,
    };
  }
  switch (row.action) {
    case "create":
      return { ...base, title: "Panelden girildi" };
    case "transition": {
      const parts = [
        text(p.reason),
        p.bulk ? "toplu işlem" : "",
        isManualPaymentMethod(p.method) ? MANUAL_PAYMENT_LABELS[p.method] : "",
        p.method === "pos" ? "POS'ta görüldü" : "",
        p.restock === false ? "stoğa alınmadı" : "",
      ].filter(Boolean);
      return {
        ...base,
        title: `Durum: ${statusLabel(p.to, order)}`,
        tone: p.to === "cancelled" ? "danger" : "primary",
        ...(parts.length ? { description: parts.join(" · ") } : {}),
      };
    }
    case "refund": {
      const dest = text(p.destination) as RefundDestination;
      const amount = Number(p.amountMinor ?? 0);
      return {
        ...base,
        title: `İade ${formatTRYMinor(amount)}${REFUND_DESTINATION_LABELS[dest] ? ` · ${REFUND_DESTINATION_LABELS[dest]}` : ""}`,
        tone: "danger",
        ...(text(p.reason) ? { description: text(p.reason) } : {}),
      };
    }
    case "note":
      return { ...base, title: "İç not güncellendi" };
    case "update": {
      const event = text(p.event);
      if (event === "payment_unreconciled") {
        const why = ORDER_ATTENTION_TEXT[text(p.reason) as OrderAttention];
        return {
          ...base,
          title: why?.title ?? "Eşleşmeyen ödeme",
          tone: "danger",
          description: `Beklenen ${formatTRYMinor(Number(p.expectedMinor ?? 0))}, tahsil edilen ${formatTRYMinor(Number(p.collectedMinor ?? 0))}`,
        };
      }
      if (event === "attention_cleared") {
        return {
          ...base,
          title: "Dikkat işareti kaldırıldı",
          ...(text(p.note) ? { description: text(p.note) } : {}),
        };
      }
      if (event === "stock_released") {
        return {
          ...base,
          title: `Stok geri alındı (${Number(p.units ?? 0)} ürün)`,
        };
      }
      if (event === "kdv_rate_corrected") {
        // 20261018220000_cafe_food_rate_10.sql moved these lines' stamp;
        // the row keeps the rate they were sold (and maybe invoiced) at.
        const lines = Array.isArray(p.lines)
          ? (p.lines as Array<Record<string, unknown>>)
          : [];
        const named = lines
          .map(
            (l) => `${Number(l.index ?? 0) + 1}. kalem ${text(l.productName)}`,
          )
          .join(", ");
        const from = Number(p.from ?? 0);
        return {
          ...base,
          title: `KDV oranı %${from}'den %${Number(p.to ?? 0)}'a düzeltildi (${Number(p.count ?? lines.length)} kalem)`,
          tone: "warning",
          description: `Satıştaki oran %${from}${named ? `: ${named}` : ""}. %${from} ile fatura kesildiyse mali müşavire ilet.`,
        };
      }
      if (event === "mail_resent") {
        return {
          ...base,
          title: `${noticeKindLabel(text(p.kind))} yeniden gönderildi`,
        };
      }
      if (p.tracking) return { ...base, title: "Kargo bilgisi kaydedildi" };
      if (p.fields === "customer_delivery") {
        return { ...base, title: "Müşteri ve teslimat bilgisi düzenlendi" };
      }
      return { ...base, title: "Sipariş düzenlendi" };
    }
    default:
      return null;
  }
}

/**
 * The order's history, every source merged. A stage timestamp is shown
 * only when no audit row already says who moved the order there, so a
 * staff move reads once, with its name.
 */
export function orderTimeline(
  order: Pick<
    AdminOrder,
    | "createdAt"
    | "paidAt"
    | "preparingAt"
    | "shippedAt"
    | "completedAt"
    | "refunds"
    | "fulfillment"
    | "source"
  >,
  audits: readonly TimelineAuditRow[],
  notices: readonly TimelineNoticeRow[],
): OrderTimelineItem[] {
  const out: OrderTimelineItem[] = [];
  const reached = new Set(
    audits
      .filter((a) => a.action === "transition")
      .map((a) => String(a.payload?.to ?? "")),
  );
  if (order.createdAt) {
    out.push({
      id: "stage-created",
      at: order.createdAt,
      title:
        order.source === "manual"
          ? "Sipariş oluşturuldu (panel)"
          : "Sipariş verildi",
    });
  }
  const stages: Array<[string | undefined, string, string]> = [
    [order.paidAt, "paid", "Ödendi"],
    [order.preparingAt, "preparing", "Hazırlanıyor"],
    [order.shippedAt, "shipped", shippedStatusLabel(orderFulfillment(order))],
    [order.completedAt, "completed", "Tamamlandı"],
  ];
  for (const [at, status, title] of stages) {
    if (at && !reached.has(status)) {
      out.push({ id: `stage-${status}`, at, title, tone: "primary" });
    }
  }
  // Refunds the panel issued carry an audit row; the provider's webhook
  // refunds do not, and the ledger is where they show.
  const auditedRefunds = audits.some((a) => a.action === "refund");
  for (const r of order.refunds ?? []) {
    if (auditedRefunds && !r.reason.startsWith("Sağlayıcı iadesi")) continue;
    out.push({
      id: `refund-${r.id}`,
      at: r.createdAt,
      title: `İade ${formatTRYMinor(r.amountMinor)}`,
      description: r.reason,
      tone: "danger",
    });
  }
  for (const n of notices) {
    // A failed mail whose copy went out later: it still never went itself.
    const resent = n.status === RESENT_STATUS;
    const failed = n.status === "failed" || resent;
    const sending = n.status === "sending";
    out.push({
      id: `mail-${n.kind}`,
      at: n.sentAt || n.createdAt,
      title: `${noticeKindLabel(n.kind)} ${failed ? "gönderilemedi" : sending ? "gönderiliyor" : "gönderildi"}`,
      tone: resent
        ? "warning"
        : failed
          ? "danger"
          : sending
            ? "warning"
            : "success",
      ...(resent
        ? { description: "Yeniden gönderildi." }
        : failed && n.error
          ? { description: n.error.slice(0, 200) }
          : {}),
    });
  }
  for (const a of audits) {
    const item = auditItem(a, order);
    if (item) out.push(item);
  }
  return out.filter((i) => Boolean(i.at));
}
