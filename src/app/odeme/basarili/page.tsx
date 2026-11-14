import { notFound } from "next/navigation";

import { formatTRY } from "@/components/admin/forms";
import { PaymentsArt } from "@/components/laffogato/payments-art";
import { PixelConversion } from "@/components/laffogato/pixel-events";
import Link from "@/components/link";
import { getOrder } from "@/lib/admin/store";
import { orderConversion } from "@/lib/consent/meta-pixel";
import { getActiveCustomer } from "@/lib/customer/auth";
import { memberMaySeeOrder } from "@/lib/customer/member-order-visibility";

import { ClearCart } from "./clear-cart";
import { cx } from "@/components/laffogato/cx";

export const metadata = { title: "Siparişin Alındı" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ref?: string; promo?: string }>;
}

export default async function OrderSuccessPage({ searchParams }: PageProps) {
  const { ref, promo } = await searchParams;
  if (!ref) notFound();
  const promoDropped = promo === "dropped";

  const order = await getOrder(ref);
  if (!order) notFound();

  // Order ids are sequential (`ord-0001`, `ord-0002`, …), so the reference in
  // the URL is guessable. Without this check anyone could walk the ids and read
  // another customer's name, address, phone and basket. Orders can only be
  // placed by a verified member, so the viewer must be that member.
  const customer = await getActiveCustomer();
  if (
    !customer ||
    customer.email.toLowerCase() !== order.customerEmail.toLowerCase()
  ) {
    notFound();
  }

  // The köşk's clock (rule 22): the server is UTC, so without the zone an
  // order placed at 21:40 in Tuzla read "18:40" on its own receipt.
  const placedAt = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(order.createdAt));

  const paid = order.status === "paid";
  // The profile lists paid orders only (memberMaySeeOrder): an order whose
  // payment is still being confirmed gets no link to a page that is not
  // there yet.
  const listed = memberMaySeeOrder(order);

  // The Meta Pixel's Purchase, once and only for a visitor who consented, and
  // only for an order whose payment is confirmed (`listed` leaves out
  // "pending_payment": that page says the bank is still being asked).
  const conversion = listed ? orderConversion(order) : null;

  return (
    <div className="order-done">
      <ClearCart />
      {conversion && conversion.events.length > 0 ? (
        <PixelConversion {...conversion} />
      ) : null}
      <div className="order-done-card">
        <div className="order-done-head">
          <PaymentsArt className="order-done-art" done={paid} />
          <span
            className={cx("order-done-badge", !paid && "is-pending")}
            aria-hidden="true"
          >
            {paid ? (
              <svg viewBox="0 0 24 24">
                <path d="M5 12.5l4.2 4.2L19 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4.5l3 1.8" />
              </svg>
            )}
          </span>
          <p className="order-done-kicker">
            {paid ? "Sipariş onaylandı" : "Sipariş alındı"} · {placedAt}
          </p>
          <h1 className="order-done-title">
            Grazie, {order.customerName.split(" ")[0]}.{" "}
            <span className="script">See you soon</span>
          </h1>
          {/* Unpaid here is not "not paid": /odeme/donus also lands here
              when the bank's answer could not be confirmed, and the card
              may have been charged (rule 29). */}
          <p className="order-done-lede">
            {paid
              ? "Ödemen alındı. Siparişin hazır olunca haber veririz."
              : "Siparişini aldık; ödemeni bankayla teyit ediyoruz."}
          </p>
        </div>

        {promoDropped && (
          <p role="status" className="auth-alert order-done-notice">
            İndirim kodun sipariş anında geçerli değildi, bu yüzden uygulanmadı.
          </p>
        )}

        {/* The number only: the items and the total are in the summary
            below, once. */}
        <dl className="order-done-facts">
          <div>
            <dt>Sipariş no</dt>
            <dd>#{order.orderNo}</dd>
          </div>
        </dl>

        <section className="order-done-summary" aria-labelledby="order-sum">
          <h2 id="order-sum" className="order-done-sub">
            Özet
          </h2>
          <ul className="order-done-lines">
            {order.items.map((it, i) => (
              <li key={i}>
                <span>
                  {it.productName}
                  <span className="order-done-qty"> × {it.qty}</span>
                </span>
                <span className="order-done-amount">
                  {formatTRY(it.unitPriceMinor * it.qty)}
                </span>
              </li>
            ))}
          </ul>
          <div className="order-done-totals">
            <SummaryRow
              label="Ara toplam"
              value={formatTRY(order.subtotalMinor)}
            />
            {order.discountMinor > 0 && (
              <SummaryRow
                label={`İndirim${order.promoCode ? ` · ${order.promoCode}` : ""}`}
                value={`−${formatTRY(order.discountMinor)}`}
                tone="green"
              />
            )}
            <SummaryRow
              label="Kargo"
              value={
                order.shippingMinor > 0
                  ? formatTRY(order.shippingMinor)
                  : "Ücretsiz"
              }
            />
            <SummaryRow
              label="Toplam"
              value={formatTRY(order.totalMinor)}
              strong
            />
          </div>
        </section>

        <div className="order-done-actions">
          {/* The order's own page, not the home page: it is where the status,
              the cargo link and the receipt live from here on. */}
          {listed ? (
            <Link
              href={`/uye/hesap/siparislerim/${order.orderNo}`}
              className="btn btn-primary"
            >
              Siparişi takip et
              <span className="arrow" aria-hidden>
                →
              </span>
            </Link>
          ) : null}
          <Link href="/magaza" className="btn btn-ghost">
            Alışverişe devam et
          </Link>
        </div>

        {/* "Siparişi takip et" above already leads to the listed order; the
            note is only for an order that is not listed yet. */}
        {listed ? null : (
          <p className="order-done-foot">
            Ödemen onaylanınca sipariş siparişlerinde görünür ve onay e-postası
            gelir.
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "green";
}) {
  return (
    <div
      className={cx(
        "order-done-row",
        strong && "is-total",
        tone === "green" && "is-green",
      )}
    >
      <span>{label}</span>
      <span className="order-done-amount">{value}</span>
    </div>
  );
}
