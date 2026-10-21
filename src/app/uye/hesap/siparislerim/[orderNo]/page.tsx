import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import type { OrderLegalConsent } from "@/lib/admin/store";
import { requireCustomer } from "@/lib/customer/auth";
import { memberOrders } from "@/lib/customer/member-orders";
import { orderDurableCopyAvailable } from "@/lib/legal/durable-copy-load";
import { LEGAL_ENTITY } from "@/lib/legal/entity";

import {
  STATUS_LABEL,
  STATUS_TIMELINE,
  formatDate,
  formatTRY,
  statusReached,
} from "../../shared";

/** Contracts that govern every order, linked from the order's own page. */
const ORDER_DOCS = [
  { slug: "on-bilgilendirme-formu", label: "Ön Bilgilendirme Formu" },
  { slug: "mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
  { slug: "iade-ve-cayma", label: "İptal, İade ve Cayma Hakkı" },
  { slug: "teslimat-ve-kargo", label: "Teslimat ve Kargo Koşulları" },
  { slug: "garanti-ve-ayipli-mal", label: "Garanti ve Ayıplı Mal" },
];

/**
 * Over the download of the confirmed text (ASK-DURABLE, sen). It promises
 * no attachment: the mail goes without the file when the file cannot be
 * built in time (src/lib/legal/durable-copy-time.ts).
 */
const COPY_NOTE =
  "Siparişini verirken onayladığın belgelerin o günkü metni. Sipariş onayı e-postanın ekinde de gönderilir; ekte yoksa buradan indirebilirsin.";

/**
 * In place of the download when the file cannot be built: an order from
 * before 21 Ekim 2026 (no text recorded), or a text that is not stored. The
 * same route as İşlem Rehberi §8 (src/lib/legal/content.ts).
 */
const COPY_REQUEST = `Onayladığın belgelerin sipariş günündeki metnini istersen sipariş numaranla ${LEGAL_ENTITY.email} adresine yaz, sana e-postayla gönderelim.`;

export const metadata = { title: "Sipariş detayı · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const customer = await requireCustomer();
  const orders = await memberOrders(customer);
  const order = orders.find((o) => String(o.orderNo) === orderNo);
  if (!order) notFound();

  const isCancelled =
    order.status === "cancelled" || order.status === "refunded";
  // Only an https page is linked: the URL comes from the carrier's webhook,
  // and a javascript: or plain-http value is not something to hand a member.
  const trackingHref = /^https:\/\//i.test(order.trackingUrl?.trim() ?? "")
    ? order.trackingUrl!.trim()
    : null;

  // Consent evidence exists only for orders placed after the checkout
  // confirmation shipped; older orders simply show the document links.
  const raw = order.legalConsent;
  const consent =
    raw && "acceptedAt" in raw && raw.acceptedAt
      ? (raw as OrderLegalConsent)
      : null;
  // The confirmed text itself, as a file (ASK-DURABLE): linked only when
  // the route can build it - every confirmed document's hash recorded and
  // its text stored (or still the one shown). A link to a 404 was what the
  // member got for an order whose text was not there. The route checks the
  // owner again (./sozlesme/route.ts); a failing read shows the request
  // sentence, not an error page.
  const copyHref =
    consent &&
    (await orderDurableCopyAvailable(order).catch((err: unknown) => {
      console.warn(
        `[durable-copy] order ${order.orderNo}: availability unknown (${err instanceof Error ? err.message.slice(0, 120) : "error"})`,
      );
      return false;
    }))
      ? `/uye/hesap/siparislerim/${order.orderNo}/sozlesme`
      : null;

  return (
    <AccountShell customer={customer} active="siparislerim">
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/uye/hesap/siparislerim"
          className="eyebrow"
          style={{ display: "inline-block" }}
        >
          ← Siparişlerim
        </Link>
      </div>

      <AccountCard
        title={`Sipariş #${order.orderNo}`}
        hint={formatDate(order.createdAt)}
        action={
          <span className="status-chip" data-tone={order.status}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        }
      >
        {!isCancelled ? (
          <ol className="account-timeline" style={{ marginBottom: 24 }}>
            {STATUS_TIMELINE.map((step) => {
              const done = statusReached(order.status, step.status);
              return (
                <li
                  key={step.status}
                  className="account-timeline-item"
                  data-done={done ? "true" : undefined}
                >
                  <span className="account-timeline-dot" />
                  <div>
                    <div className="account-timeline-label">{step.label}</div>
                    <div className="account-timeline-hint">
                      {done ? "Tamamlandı" : "Bekliyor"}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div
            className="account-msg"
            data-tone="error"
            style={{ marginBottom: 18 }}
          >
            Bu sipariş {STATUS_LABEL[order.status]?.toLowerCase()} durumunda.
          </div>
        )}

        <h3
          style={{
            fontFamily: "var(--serif-display)",
            fontSize: 18,
            marginBottom: 10,
          }}
        >
          Kalemler
        </h3>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
          {order.items.map((it, idx) => (
            <li
              key={`${it.productName}-${idx}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--ink-line)",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{ fontFamily: "var(--serif-display)", fontSize: 15 }}
                >
                  {it.productName}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-mute)",
                    marginTop: 2,
                  }}
                >
                  {it.qty} × {formatTRY(it.unitPriceMinor)}
                </div>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                {formatTRY(it.qty * it.unitPriceMinor)}
              </div>
            </li>
          ))}
        </ul>

        <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
          <Row label="Ara toplam" value={formatTRY(order.subtotalMinor)} />
          {order.discountMinor > 0 && (
            <Row
              label={`İndirim${order.promoCode ? ` (${order.promoCode})` : ""}`}
              value={`- ${formatTRY(order.discountMinor)}`}
            />
          )}
          {order.shippingMinor > 0 && (
            <Row label="Kargo" value={formatTRY(order.shippingMinor)} />
          )}
          <Row label="Toplam" value={formatTRY(order.totalMinor)} strong />
        </div>
      </AccountCard>

      <AccountCard title="Teslimat bilgileri">
        <div style={{ display: "grid", gap: 14, fontSize: 14 }}>
          <DetailRow k="Alıcı" v={order.customerName || "-"} />
          <DetailRow k="E-posta" v={order.customerEmail} />
          {order.customerPhone && (
            <DetailRow k="Telefon" v={order.customerPhone} />
          )}
          {order.shippingAddress && (
            <DetailRow k="Adres" v={order.shippingAddress} multiline />
          )}
          {order.trackingNumber && (
            <DetailRow
              k="Kargo takip"
              v={`${order.carrier ? `${order.carrier} · ` : ""}${order.trackingNumber}`}
            />
          )}
          {/* The carrier's own tracking page (Geliver writes it). The number
              alone left the member to find the carrier's site and paste it. */}
          {trackingHref && (
            <div>
              <a
                href={trackingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                Kargoyu takip et
                <span className="arrow out" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          )}
        </div>
      </AccountCard>

      <AccountCard title="Sözleşmeler ve onay kaydı">
        {consent ? (
          <div style={{ display: "grid", gap: 14, fontSize: 14 }}>
            <DetailRow k="Onay tarihi" v={formatDate(consent.acceptedAt)} />
            <DetailRow k="Belge sürümü" v={consent.version} />
          </div>
        ) : null}
        {copyHref ? (
          <div style={{ margin: "16px 0 0" }}>
            <p
              style={{
                margin: "0 0 10px",
                color: "var(--ink-soft)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {COPY_NOTE}
            </p>
            {/* A file, not a page: a plain link, never prefetched. */}
            <a href={copyHref} download className="btn btn-outline btn-sm">
              Belgeleri indir
            </a>
          </div>
        ) : consent ? (
          <p
            style={{
              margin: "16px 0 0",
              color: "var(--ink-soft)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {COPY_REQUEST}
          </p>
        ) : null}
        <p
          style={{
            margin: consent ? "16px 0 12px" : "0 0 12px",
            color: "var(--ink-soft)",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {consent
            ? "Siparişini verirken onayladığın belgeler. Bağlantılar belgelerin güncel metnini açar."
            : "Siparişlerine uygulanan sözleşme ve politikalar:"}
        </p>
        <ul
          style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.9 }}
        >
          {ORDER_DOCS.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/hukuk/${d.slug}`}
                style={{
                  color: "var(--gold-deep)",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </AccountCard>

      <AccountCard title="Yardım gerekiyor mu?">
        <p
          style={{
            margin: 0,
            color: "var(--ink-soft)",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Siparişinde değişiklik veya iade için bizimle iletişime geç -{" "}
          <a
            href="mailto:info@nextgenlab.com.tr"
            style={{
              color: "var(--gold-deep)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            info@nextgenlab.com.tr
          </a>
          . Ekibimiz 24 saat içinde döner.
        </p>
      </AccountCard>
    </AccountShell>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        borderTop: strong ? "1px solid var(--ink-line)" : undefined,
        paddingTop: strong ? 12 : undefined,
        marginTop: strong ? 6 : undefined,
        fontFamily: "var(--mono)",
        fontSize: strong ? 15 : 13,
        fontWeight: strong ? 600 : 400,
      }}
    >
      <span style={{ color: strong ? "var(--ink)" : "var(--ink-soft)" }}>
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

function DetailRow({
  k,
  v,
  multiline,
}: {
  k: string;
  v: string;
  multiline?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 16,
        alignItems: multiline ? "flex-start" : "center",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-mute)",
        }}
      >
        {k}
      </span>
      <span
        style={{
          lineHeight: 1.55,
          whiteSpace: multiline ? "pre-line" : undefined,
        }}
      >
        {v}
      </span>
    </div>
  );
}
