// The order page's body (Filament's infolist): Kalemler, Tutar, Ödeme,
// Teslimat, Müşteri, İadeler, Zaman çizelgesi, İç not, Mesafeli satış
// onayı, and the print-only receipt. Server-safe: the interactive pieces
// (item status, note, customer editor) are client islands.

import { resendMailAction } from "@/app/admin/siparisler/actions";
import {
  orderFulfillment,
  orderTable,
  ORDER_FULFILLMENT_LABELS,
} from "@/lib/admin/order-channel";
import {
  REFUND_DESTINATION_LABELS,
  isManualProvider,
  refundedMinor,
  type OrderActionMap,
} from "@/lib/admin/order-actions";
import type { OrderDetailsRules } from "@/lib/admin/order-details";
import {
  noticeKindLabel,
  type OrderTimelineItem,
} from "@/lib/admin/order-timeline";
import type {
  AdminOrder,
  AdminSettings,
  OrderLegalConsent,
  OrderNoticeRow,
  OrderPaymentRow,
} from "@/lib/admin/store";
import {
  RESENT_STATUS,
  isResendKind,
  isResendableKind,
} from "@/lib/email/notice-kinds";
import {
  kdvRateLabel,
  orderKdvBreakdown,
  type KdvBreakdown,
} from "@/lib/utils/kdv";

import { formatDateTime, formatTRY } from "./forms";
import {
  ItemStatusSelect,
  OrderNoteForm,
  type OrderMoneyView,
} from "./order-actions-ui";
import { OrderCustomerEditor } from "./order-customer-editor";
import {
  Badge,
  ConfirmButton,
  EmptyState,
  KeyValueGrid,
  Section,
  Timeline,
} from "./ui";
import { MONO_STYLE } from "./ui/styles";

interface Props {
  order: AdminOrder;
  settings: AdminSettings;
  money: OrderMoneyView;
  actions: OrderActionMap;
  payments: OrderPaymentRow[];
  timeline: OrderTimelineItem[];
  /** The order's customer mails (`order_notice_emails`). */
  notices: OrderNoticeRow[];
  /** `/admin/musteriler/<email>` when the role may open it. */
  customerHref: string | null;
  /** What the role may change on the customer card (`orderDetailsRules`). */
  detailsRules: OrderDetailsRules;
  /**
   * The consent's IP address and browser string are shown (owner and
   * manager, `customers`); otherwise they read "Kayıtlı" (karar D3).
   */
  canSeeEvidence: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  paynkolay: "PayNkolay (kart)",
  wallet: "Uygulama cüzdanı",
  mock: "Test sağlayıcısı",
  free: "Ücretsiz (₺0)",
};

const PAYMENT_STATUS: Record<
  string,
  { label: string; tone: "success" | "danger" | "neutral" }
> = {
  succeeded: { label: "Tahsil edildi", tone: "success" },
  refunded: { label: "İade", tone: "danger" },
  failed: { label: "Başarısız", tone: "neutral" },
};

function providerLabel(provider: string): string {
  if (isManualProvider(provider)) {
    return `Elle (${provider.slice("manual:".length)})`;
  }
  return PROVIDER_LABELS[provider] ?? provider;
}

/** A provider reference with its middle hidden: enough to find it at the POS. */
export function maskRef(ref: string): string {
  const r = ref.trim();
  if (r.length <= 8) return r;
  return `${r.slice(0, 4)}…${r.slice(-4)}`;
}

const ITEM_TONE = {
  pending: "warning",
  ready: "success",
  cancelled: "neutral",
} as const;
const ITEM_LABEL = {
  pending: "Bekliyor",
  ready: "Hazır",
  cancelled: "İptal",
} as const;

function ItemsSection({
  order,
  actions,
}: {
  order: AdminOrder;
  actions: OrderActionMap;
}) {
  const editable = actions.item_status;
  return (
    <Section title="Kalemler" flush>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr
              className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
              style={MONO_STYLE}
            >
              <th scope="col" className="px-4 py-2 font-normal sm:px-6">
                Ürün
              </th>
              <th scope="col" className="px-2 py-2 text-right font-normal">
                Adet
              </th>
              <th scope="col" className="px-2 py-2 text-right font-normal">
                Birim
              </th>
              <th scope="col" className="px-2 py-2 text-right font-normal">
                Toplam
              </th>
              <th scope="col" className="px-4 py-2 font-normal sm:px-6">
                Durum
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr
                key={i}
                className="border-b border-[var(--admin-border)] align-top last:border-b-0"
              >
                <td className="px-4 py-3 sm:px-6">
                  <div
                    className={
                      it.status === "cancelled"
                        ? "text-[var(--admin-text-soft)] line-through"
                        : "text-[var(--admin-text)]"
                    }
                  >
                    {it.productName}
                  </div>
                  {/* The barista needs the cafe details (size, milk, shots) here too. */}
                  {it.detail ? (
                    <div className="text-xs text-[var(--admin-text-soft)]">
                      {it.detail}
                    </div>
                  ) : null}
                  {it.restockedQty ? (
                    <div className="text-xs text-[var(--admin-text-soft)]">
                      {it.restockedQty} adet stoğa döndü
                    </div>
                  ) : null}
                  {typeof it.taxRatePct === "number" ? (
                    <div className="text-xs text-[var(--admin-text-soft)]">
                      KDV {kdvRateLabel(it.taxRatePct)} dahil
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-right" style={MONO_STYLE}>
                  × {it.qty}
                </td>
                <td className="px-2 py-3 text-right" style={MONO_STYLE}>
                  {formatTRY(it.unitPriceMinor)}
                </td>
                <td className="px-2 py-3 text-right" style={MONO_STYLE}>
                  {formatTRY(it.unitPriceMinor * it.qty)}
                </td>
                <td className="px-4 py-3 sm:px-6">
                  {editable ? (
                    <ItemStatusSelect
                      orderId={order.id}
                      index={i}
                      status={it.status}
                      productName={it.productName}
                      disabledReason={
                        editable.enabled ? undefined : editable.reason
                      }
                    />
                  ) : (
                    <Badge tone={ITEM_TONE[it.status] ?? "neutral"}>
                      {ITEM_LABEL[it.status] ?? it.status}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/**
 * The KDV inside the total, one row per rate, as it was at the sale (each
 * line keeps the rate it was sold at). Informational: the total above is
 * what was charged, and refunds are not taken off here.
 */
function KdvTable({ kdv }: { kdv: KdvBreakdown | null }) {
  if (!kdv) {
    return (
      <p className="mt-4 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-text-soft)]">
        KDV dökümü yok: bu sipariş, satırlara KDV oranı yazılmadan önce verildi.
      </p>
    );
  }
  if (kdv.rows.length === 0) return null;
  return (
    <div
      data-kdv-breakdown
      className="mt-4 overflow-x-auto border-t border-[var(--admin-border)] pt-3"
    >
      {/* No forced width: four short columns fit a 375 px phone (309 px in
          the card), and pl-2 keeps the amounts apart. */}
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-left text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
            style={MONO_STYLE}
          >
            <th scope="col" className="py-1 font-normal">
              KDV
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-normal">
              Matrah
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-normal">
              KDV tutarı
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-normal">
              KDV dahil
            </th>
          </tr>
        </thead>
        <tbody>
          {kdv.rows.map((r) => (
            <tr key={r.ratePct}>
              <td className="py-1">{kdvRateLabel(r.ratePct)}</td>
              <td className="py-1 pl-2 text-right" style={MONO_STYLE}>
                {formatTRY(r.netMinor)}
              </td>
              <td className="py-1 pl-2 text-right" style={MONO_STYLE}>
                {formatTRY(r.taxMinor)}
              </td>
              <td className="py-1 pl-2 text-right" style={MONO_STYLE}>
                {formatTRY(r.grossMinor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[var(--admin-text-soft)]">
        Fiyatlara dahil. İndirim ve kargo ya da kurye ücreti satırlara
        tutarlarıyla orantılı dağıtıldı; iadeler düşülmedi.
      </p>
    </div>
  );
}

function TotalsSection({ order }: { order: AdminOrder }) {
  const refunded = refundedMinor(order);
  return (
    <Section title="Tutar">
      <KeyValueGrid
        columns={3}
        items={[
          {
            label: "Ara toplam",
            value: formatTRY(order.subtotalMinor),
            mono: true,
          },
          order.discountMinor > 0 && {
            label: order.promoCode ? `İndirim · ${order.promoCode}` : "İndirim",
            value: `-${formatTRY(order.discountMinor)}`,
            mono: true,
          },
          {
            label: "Kargo",
            value:
              order.shippingMinor > 0 ? formatTRY(order.shippingMinor) : "Yok",
            mono: true,
          },
          { label: "Toplam", value: formatTRY(order.totalMinor), mono: true },
          refunded > 0 && {
            label: "İade edilen",
            value: `-${formatTRY(refunded)}`,
            mono: true,
          },
          refunded > 0 && {
            label: "Net",
            value: formatTRY(order.totalMinor - refunded),
            mono: true,
          },
        ]}
      />
      <KdvTable kdv={orderKdvBreakdown(order)} />
    </Section>
  );
}

function PaymentSection({
  order,
  money,
  payments,
}: {
  order: AdminOrder;
  money: OrderMoneyView;
  payments: OrderPaymentRow[];
}) {
  return (
    <Section title="Ödeme" id="odeme">
      <KeyValueGrid
        items={[
          {
            label: "Ödendi",
            value: order.paidAt
              ? formatDateTime(order.paidAt)
              : money.collected
                ? "Tahsil edildi (sipariş ödenmiş sayılmadı)"
                : "Hayır",
          },
          money.collectedMinor !== null && {
            label: "Tahsil edilen",
            value: formatTRY(money.collectedMinor),
            mono: true,
            hint:
              money.collectedMinor !== order.totalMinor
                ? "Sipariş tutarından farklı"
                : undefined,
          },
          money.collected && {
            label: "İade nereye gider",
            value: REFUND_DESTINATION_LABELS[money.destination],
          },
        ]}
      />
      <h3 className="mt-5 mb-2 text-sm font-medium text-[var(--admin-text)]">
        Ödeme kayıtları
      </h3>
      {payments.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Bu siparişte ödeme kaydı yok.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)] text-sm">
          {payments.map((p, i) => {
            const st = PAYMENT_STATUS[p.status] ?? {
              label: p.status,
              tone: "neutral" as const,
            };
            return (
              <li
                key={`${p.providerRef}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[var(--admin-text)]">
                    {providerLabel(p.provider)}
                  </div>
                  <div
                    className="text-xs text-[var(--admin-text-soft)]"
                    style={MONO_STYLE}
                  >
                    {maskRef(p.providerRef)} · {formatDateTime(p.createdAt)}
                    {p.trxDate ? ` · POS günü ${p.trxDate}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span style={MONO_STYLE}>{formatTRY(p.amountMinor)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function DeliverySection({ order }: { order: AdminOrder }) {
  const fulfillment = orderFulfillment(order);
  const table = orderTable(order);
  return (
    <Section title="Teslimat">
      <KeyValueGrid
        columns={1}
        items={[
          { label: "Teslimat", value: ORDER_FULFILLMENT_LABELS[fulfillment] },
          table && { label: "Masa", value: table.name || table.code },
          order.scheduledFor
            ? {
                label: "Planlanan saat",
                value: formatDateTime(order.scheduledFor),
              }
            : null,
          order.deliveryNote
            ? {
                label: fulfillment === "delivery" ? "Kurye notu" : "Not",
                value: order.deliveryNote,
              }
            : null,
          fulfillment === "shipping" && {
            label: "Kargo",
            value:
              order.carrier || (order.trackingNumber ? "Belirtilmedi" : ""),
          },
          fulfillment === "shipping" && {
            label: "Takip numarası",
            value: order.trackingNumber ?? "",
            mono: true,
          },
          order.shipmentStatus
            ? {
                label: "Kargo firmasının durumu",
                value: order.shipmentStatus,
                hint: order.shipmentUpdatedAt
                  ? formatDateTime(order.shipmentUpdatedAt)
                  : undefined,
              }
            : null,
          order.trackingUrl
            ? {
                label: "Takip sayfası",
                value: (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--admin-primary)] underline underline-offset-4"
                  >
                    Kargo firmasında aç
                  </a>
                ),
              }
            : null,
          order.shippedAt
            ? { label: "Yola çıktı", value: formatDateTime(order.shippedAt) }
            : null,
        ]}
      />
    </Section>
  );
}

const MAIL_STATUS: Record<
  string,
  { label: string; tone: "success" | "danger" | "warning" }
> = {
  sent: { label: "Gönderildi", tone: "success" },
  failed: { label: "Gönderilemedi", tone: "danger" },
  sending: { label: "Gönderiliyor", tone: "warning" },
  [RESENT_STATUS]: { label: "Yeniden gönderildi", tone: "success" },
};

/**
 * The order's customer mails, as `order_notice_emails` records them: a
 * failed one keeps its row and the provider's reason, and "Yeniden gönder"
 * sends the same mail again after a confirm.
 */
function MailsSection({
  order,
  notices,
  canResend,
}: {
  order: AdminOrder;
  notices: OrderNoticeRow[];
  canResend: boolean;
}) {
  return (
    <Section title="E-postalar">
      {notices.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Bu sipariş için e-posta kaydı yok.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)] text-sm">
          {notices.map((n) => {
            const st = MAIL_STATUS[n.status] ?? {
              label: n.status,
              tone: "warning" as const,
            };
            return (
              <li
                key={n.kind}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[var(--admin-text)]">
                    {noticeKindLabel(n.kind)}
                  </div>
                  <div className="text-xs text-[var(--admin-text-soft)]">
                    {formatDateTime(n.sentAt || n.createdAt)}
                    {n.status === "failed" && n.error ? ` · ${n.error}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {canResend &&
                  n.status !== "sending" &&
                  isResendableKind(n.kind) &&
                  !isResendKind(n.kind) ? (
                    <ConfirmButton
                      action={resendMailAction}
                      hidden={{ id: order.id, kind: n.kind }}
                      label="Yeniden gönder"
                      title="E-posta yeniden gönderilsin mi?"
                      description="Müşteriye aynı e-posta bir kez daha gider."
                      tone="default"
                      variant="ghost"
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function RefundsSection({ order }: { order: AdminOrder }) {
  if (order.refunds.length === 0) return null;
  return (
    <Section title="İadeler">
      <ul className="divide-y divide-[var(--admin-border)] text-sm">
        {order.refunds.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap justify-between gap-2 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-[var(--admin-text)]">{r.reason}</div>
              <div
                className="text-xs text-[var(--admin-text-soft)]"
                style={MONO_STYLE}
              >
                {formatDateTime(r.createdAt)}
                {r.destination
                  ? ` · ${REFUND_DESTINATION_LABELS[r.destination]}`
                  : ""}
              </div>
            </div>
            <span className="text-[var(--admin-danger-ink)]" style={MONO_STYLE}>
              -{formatTRY(r.amountMinor)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** What a role without the customer view sees for the consent's IP and browser. */
const EVIDENCE_HIDDEN = "Kayıtlı";

/**
 * Distance-selling consent evidence, verbatim.
 *
 * Mesafeli Sözleşmeler Yönetmeliği requires proof that the buyer confirmed the
 * ön bilgilendirme formu and the mesafeli satış sözleşmesi before ordering; an
 * acquiring bank asks for exactly this record when a chargeback is disputed.
 * Orders placed before the consent box shipped - and admin-entered manual
 * orders - carry no record, which the section says out loud rather than hiding.
 */
function ConsentSection({
  consent,
  canSeeEvidence,
}: {
  consent: AdminOrder["legalConsent"];
  canSeeEvidence: boolean;
}) {
  const accepted =
    consent && "acceptedAt" in consent && consent.acceptedAt
      ? (consent as OrderLegalConsent)
      : null;
  return (
    <Section title="Mesafeli satış onayı">
      {!accepted ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Bu siparişte onay kaydı yok: onay kutusundan önce verilmiş ya da
          panelden girilmiş bir sipariş.
        </p>
      ) : (
        <KeyValueGrid
          columns={1}
          items={[
            {
              label: "Onay zamanı",
              value: formatDateTime(accepted.acceptedAt),
              mono: true,
            },
            {
              label: "Onaylanan belgeler",
              value: (
                <span className="flex flex-col">
                  {accepted.documents.map((slug) => (
                    <a
                      key={slug}
                      href={`/hukuk/${slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-[var(--admin-primary)]"
                    >
                      /hukuk/{slug}
                    </a>
                  ))}
                </span>
              ),
            },
            { label: "Belge sürümü", value: accepted.version },
            // Personal data the shift does not need: the record is kept as
            // it is (it is the chargeback evidence), only the screen says
            // "Kayıtlı" to a role without the customer view (ORD-29).
            accepted.ip
              ? canSeeEvidence
                ? { label: "IP adresi", value: accepted.ip, mono: true }
                : { label: "IP adresi", value: EVIDENCE_HIDDEN }
              : null,
            accepted.userAgent
              ? {
                  label: "Tarayıcı",
                  value: canSeeEvidence ? (
                    <span className="text-xs break-all">
                      {accepted.userAgent}
                    </span>
                  ) : (
                    EVIDENCE_HIDDEN
                  ),
                }
              : null,
          ]}
        />
      )}
    </Section>
  );
}

export function OrderDetail({
  order,
  settings,
  money,
  actions,
  payments,
  timeline,
  notices,
  customerHref,
  detailsRules,
  canSeeEvidence,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] print:hidden">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          <ItemsSection order={order} actions={actions} />
          <TotalsSection order={order} />
          <PaymentSection order={order} money={money} payments={payments} />
          <RefundsSection order={order} />
          <MailsSection
            order={order}
            notices={notices}
            canResend={actions.resend_mail?.enabled === true}
          />
          <Section title="Zaman çizelgesi">
            {timeline.length > 0 ? (
              <Timeline items={timeline} />
            ) : (
              <EmptyState title="Kayıt yok." />
            )}
          </Section>
        </div>

        <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          <OrderCustomerEditor
            orderId={order.id}
            customerName={order.customerName}
            customerEmail={order.customerEmail}
            customerPhone={order.customerPhone}
            shippingAddress={order.shippingAddress}
            customerHref={customerHref}
            rules={detailsRules}
          />
          <DeliverySection order={order} />
          <Section title="İç not">
            <OrderNoteForm orderId={order.id} initial={order.internalNote} />
          </Section>
          <ConsentSection
            consent={order.legalConsent}
            canSeeEvidence={canSeeEvidence}
          />
        </aside>
      </div>

      {/* Print-only receipt - hidden in normal flow, revealed by @media print */}
      <PrintableReceipt order={order} settings={settings} />
    </>
  );
}

export function PrintableReceipt({
  order,
  settings,
}: {
  order: AdminOrder;
  settings: AdminSettings;
}) {
  const refunded = refundedMinor(order);
  const table = orderTable(order);
  const kdv = orderKdvBreakdown(order);
  return (
    <section
      data-print-receipt
      className="hidden print:absolute print:inset-0 print:block print:bg-white print:p-10 print:text-black"
    >
      <header className="mb-6 border-b border-neutral-300 pb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-medium italic">{settings.name}</div>
            <div className="text-xs text-neutral-600">{settings.tagline}</div>
          </div>
          <div className="text-right">
            <div className="text-xs tracking-[0.22em] text-neutral-500 uppercase">
              Sipariş Fişi
            </div>
            <div className="font-mono text-lg">#{order.orderNo}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-neutral-600">
          {settings.address} · {settings.phone}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-xs tracking-[0.22em] text-neutral-500 uppercase">
            Müşteri
          </div>
          <div className="mt-1 font-medium">{order.customerName}</div>
          <div className="text-neutral-700">{order.customerEmail}</div>
          {order.customerPhone && (
            <div className="text-neutral-700">{order.customerPhone}</div>
          )}
        </div>
        <div>
          <div className="text-xs tracking-[0.22em] text-neutral-500 uppercase">
            Teslimat
          </div>
          <address className="mt-1 whitespace-pre-line text-neutral-700 not-italic">
            {/* A table order has no address: the fiş says which table. */}
            {table
              ? `Masa: ${table.name || table.code}`
              : order.shippingAddress || "-"}
          </address>
        </div>
      </div>

      <div className="mt-6 text-xs text-neutral-500">
        Sipariş tarihi: {formatDateTime(order.createdAt)}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs tracking-[0.18em] text-neutral-600 uppercase">
            <th className="py-2">Ürün</th>
            <th className="text-right">Adet</th>
            <th className="text-right">Birim</th>
            <th className="text-right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-2">
                <span
                  className={
                    it.status === "cancelled" ? "line-through" : undefined
                  }
                >
                  {it.productName}
                </span>
                {it.detail ? (
                  <div className="text-xs text-neutral-600">{it.detail}</div>
                ) : null}
                {it.status === "cancelled" ? (
                  <div className="text-xs text-neutral-600">İptal</div>
                ) : null}
              </td>
              <td className="text-right font-mono">× {it.qty}</td>
              <td className="text-right font-mono">
                {formatTRY(it.unitPriceMinor)}
              </td>
              <td className="text-right font-mono">
                {formatTRY(it.unitPriceMinor * it.qty)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="font-mono text-sm">
          <tr>
            <td colSpan={3} className="pt-3 text-right text-neutral-600">
              Ara toplam
            </td>
            <td className="pt-3 text-right">
              {formatTRY(order.subtotalMinor)}
            </td>
          </tr>
          {/* Without this row a receipt with a promo code did not add up. */}
          {order.discountMinor > 0 && (
            <tr data-receipt-discount>
              <td colSpan={3} className="text-right text-neutral-600">
                İndirim{order.promoCode ? ` (${order.promoCode})` : ""}
              </td>
              <td className="text-right">-{formatTRY(order.discountMinor)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="text-right text-neutral-600">
              Kargo
            </td>
            <td className="text-right">
              {order.shippingMinor > 0 ? formatTRY(order.shippingMinor) : "-"}
            </td>
          </tr>
          <tr className="border-t border-neutral-400 text-base">
            <td colSpan={3} className="pt-2 text-right font-semibold">
              Toplam
            </td>
            <td className="pt-2 text-right font-semibold">
              {formatTRY(order.totalMinor)}
            </td>
          </tr>
          {/* The KDV inside the total, per rate (each line keeps the rate it
              was sold at). No row on an order from before rates were kept. */}
          {kdv?.rows.map((r) => (
            <tr key={`kdv-${r.ratePct}`} data-receipt-kdv>
              <td colSpan={3} className="text-right text-neutral-600">
                İçindeki KDV {kdvRateLabel(r.ratePct)} (matrah{" "}
                {formatTRY(r.netMinor)})
              </td>
              <td className="text-right">{formatTRY(r.taxMinor)}</td>
            </tr>
          ))}
          {refunded > 0 && (
            <tr>
              <td colSpan={3} className="text-right text-neutral-600">
                İade edilen
              </td>
              <td className="text-right">-{formatTRY(refunded)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <footer className="mt-10 border-t border-neutral-300 pt-4 text-center text-xs text-neutral-500">
        Teşekkür ederiz - buon appetito! · {settings.name}
      </footer>
    </section>
  );
}
