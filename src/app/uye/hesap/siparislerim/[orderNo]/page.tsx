import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { customerOrdersByEmail } from "@/lib/admin/store";
import { requireCustomer } from "@/lib/customer/auth";

import {
  STATUS_LABEL,
  STATUS_TIMELINE,
  formatDate,
  formatTRY,
  statusReached,
} from "../../shared";

export const metadata = { title: "Sipariş detayı · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const customer = await requireCustomer();
  const orders = await customerOrdersByEmail(customer.email);
  const order = orders.find((o) => String(o.orderNo) === orderNo);
  if (!order) notFound();

  const isCancelled =
    order.status === "cancelled" || order.status === "refunded";

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
          <DetailRow k="Alıcı" v={order.customerName || "—"} />
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
        </div>
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
          Siparişinde değişiklik veya iade için bizimle iletişime geç —{" "}
          <a
            href="mailto:hello@laffogato.com.tr"
            style={{
              color: "var(--gold-deep)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            hello@laffogato.com.tr
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
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
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
