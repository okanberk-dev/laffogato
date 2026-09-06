import Link from "next/link";
import { notFound } from "next/navigation";

import { formatTRY } from "@/components/admin/forms";
import { getOrder } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";

import { ClearCart } from "./clear-cart";

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

  const placedAt = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(order.createdAt));

  return (
    <main
      className="mx-auto min-h-screen max-w-3xl px-6 py-24"
      style={{ background: "var(--bg-warm)" }}
    >
      <ClearCart />
      {promoDropped && (
        <div
          className="mb-6 rounded-xl border px-5 py-4 text-sm"
          style={{
            borderColor: "#e1e5e0",
            background: "#f3f5f2",
            color: "#7d5f27",
          }}
        >
          Promosyon kodun sipariş anında geçerli değildi (süresi dolmuş veya
          limiti dolmuş olabilir), bu yüzden indirim uygulanmadı. Sorun olduğunu
          düşünüyorsan bizimle iletişime geç.
        </div>
      )}
      <div
        className="rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm md:p-14"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--gold)" }}
          />
          <span
            className="text-[10px] tracking-[0.24em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Sipariş alındı · {placedAt}
          </span>
        </div>

        <h1
          className="mt-5 text-5xl"
          style={{
            fontFamily: "var(--serif), 'Playfair Display', serif",
            fontStyle: "normal",
            fontWeight: 500,
            letterSpacing: "-0.018em",
            lineHeight: 1.02,
          }}
        >
          Grazie, {order.customerName.split(" ")[0]}.
          <br />
          <span
            style={{
              fontFamily: "var(--script), cursive",
              color: "var(--gold)",
            }}
          >
            See you soon.
          </span>
        </h1>

        <p className="mt-6 max-w-md text-neutral-700">
          {order.status === "paid" ? (
            <>
              Ödemen alındı ve siparişin onaylandı. Tuzla köşkünde bekleniyorsun
              - hazır olunca seni bilgilendireceğiz.
            </>
          ) : (
            <>
              Siparişini aldık; ödemen henüz tamamlanmadı (
              <em>ödeme bekleniyor</em>). Ödeme tamamlandığında siparişin işleme
              alınır.
            </>
          )}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-neutral-200 p-4">
            <div
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Sipariş No
            </div>
            <div
              className="mt-1 text-lg"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              #{order.orderNo}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 p-4">
            <div
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Kalem
            </div>
            <div
              className="mt-1 text-lg"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {order.items.length}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 p-4">
            <div
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Toplam
            </div>
            <div
              className="mt-1 text-lg"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {formatTRY(order.totalMinor)}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-200 pt-6">
          <div
            className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Özet
          </div>
          <ul className="mt-4 grid gap-2 text-sm text-neutral-800">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4">
                <span>
                  {it.productName}
                  <span className="text-neutral-400"> × {it.qty}</span>
                </span>
                <span style={{ fontFamily: "var(--mono), monospace" }}>
                  {formatTRY(it.unitPriceMinor * it.qty)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-1.5 border-t border-neutral-200 pt-4 text-sm">
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
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Ana sayfaya dön
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/#shop"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900"
          >
            Alışverişe devam et
          </Link>
        </div>

        <p
          className="mt-8 text-[10px] tracking-[0.22em] text-neutral-400 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Sanal POS entegrasyonu sonrası ödeme makbuzu e-postan üzerinden
          iletilecek.
        </p>
      </div>
    </main>
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
      className="flex items-baseline justify-between gap-4"
      style={{
        borderTop: strong ? "1px solid var(--ink-line, #e1e5e0)" : undefined,
        paddingTop: strong ? 10 : undefined,
        marginTop: strong ? 4 : undefined,
        fontWeight: strong ? 600 : 400,
        color: tone === "green" ? "#235347" : undefined,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontFamily: "var(--mono), monospace",
          fontSize: strong ? 16 : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
