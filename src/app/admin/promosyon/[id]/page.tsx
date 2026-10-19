import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { formatDateTime, formatTRY } from "@/components/admin/forms";
import {
  Badge,
  BUTTON,
  DataTable,
  EmptyState,
  KeyValueGrid,
  NUMERIC_STYLE,
  OrderStatusBadge,
  Section,
  type KeyValueItem,
} from "@/components/admin/ui";
import { MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import {
  PROMO_STATE_LABELS,
  PROMO_STATE_TONES,
  PROMOS_PATH,
  promoEditHref,
  promoState,
} from "@/lib/admin/promo-list";
import {
  listPromoOrders,
  PROMO_ORDERS_LIMIT,
  type PromoOrderRow,
  type PromoOrders,
} from "@/lib/admin/promo-usage";
import { canAccess } from "@/lib/admin/roles";
import { getPromo, type AdminPromo } from "@/lib/admin/store";

import { PromoActiveToggle } from "../promo-actions-ui";

export const metadata = { title: "Admin · Promosyon kodu" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATE_HINT: Record<ReturnType<typeof promoState>, string> = {
  aktif: "Sepette kabul edilir.",
  pasif: "Elle durduruldu: sepette kabul edilmez.",
  "suresi-dolmus": "Son geçerlilik geçti: sepette kabul edilmez.",
  "limit-doldu": "Kullanım limiti doldu: sepette kabul edilmez.",
};

function discount(p: AdminPromo): string {
  return p.kind === "pct" ? `%${p.value}` : `${formatTRY(p.value)} indirim`;
}

function usage(p: AdminPromo): string {
  if (p.usageLimit <= 0) return `${p.usageCount} (sınırsız)`;
  const left = Math.max(0, p.usageLimit - p.usageCount);
  return `${p.usageCount} / ${p.usageLimit} · ${left} kaldı`;
}

/** The orders, or why they are not shown; a failed read does not take the page. */
async function readOrders(
  code: string,
): Promise<PromoOrders | { error: true }> {
  try {
    return await listPromoOrders(code);
  } catch (err) {
    console.error("[admin/promosyon] kodun siparişleri okunamadı", err);
    return { error: true };
  }
}

/**
 * One promo code (Filament's view page): where it stands at the cart and
 * why, its numbers, and the orders it went into (admin audit PEO-24, D37).
 * "Sil" stays in the list's ⋯ menu.
 */
export default async function PromoViewPage({ params }: PageProps) {
  const session = await requireRole("promos");
  const { id } = await params;
  const promo = await getPromo(id);
  if (!promo) notFound();
  const state = promoState(promo);
  // The orders carry customers; the list is for a role that may open them.
  const showOrders = canAccess("orders", session.role);
  const orders = showOrders ? await readOrders(promo.code) : null;

  const details: KeyValueItem[] = [
    { label: "İndirim", value: discount(promo), mono: true },
    {
      label: "Min. sepet",
      value:
        promo.minSubtotalMinor > 0 ? formatTRY(promo.minSubtotalMinor) : "Yok",
    },
    { label: "Kullanım", value: usage(promo) },
    {
      label: "Son geçerlilik",
      value: promo.expiresAt ? formatDateTime(promo.expiresAt) : "Süresiz",
      hint: "İstanbul saatiyle.",
    },
    {
      label: "Eklendi",
      value: promo.createdAt && formatDateTime(promo.createdAt),
    },
    {
      label: "Son değişiklik",
      value: promo.updatedAt && formatDateTime(promo.updatedAt),
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href={PROMOS_PATH}>Promosyon kodları</BackLink>

      <header className="mb-6 flex flex-col gap-3">
        <div
          className="text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
          style={MONO_STYLE}
        >
          Pazarlama · Promosyon
        </div>
        <h1
          className="text-2xl font-semibold tracking-tight break-all text-[var(--admin-text)] sm:text-3xl"
          style={NUMERIC_STYLE}
        >
          {promo.code}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-text-soft)]">
          <Badge tone={PROMO_STATE_TONES[state]} dot>
            {PROMO_STATE_LABELS[state]}
          </Badge>
          {STATE_HINT[state]}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={promoEditHref(promo.id)} className={BUTTON.primary}>
            Düzenle
          </Link>
          <PromoActiveToggle promo={promo} />
        </div>
      </header>

      <div className="grid gap-6">
        <Section title="Kod">
          <KeyValueGrid items={details} columns={3} />
        </Section>

        {orders ? (
          <Section
            title="Bu kodla verilen siparişler"
            description={ordersDescription(orders, promo.usageCount)}
          >
            <PromoOrdersTable orders={orders} usageCount={promo.usageCount} />
          </Section>
        ) : null}
      </div>
    </main>
  );
}

/**
 * Every use is taken by an order carrying the code (finalizeOrder), and a
 * cancelled order keeps the code while giving its use back, so the orders
 * found are never fewer than the uses. Fewer means the code was renamed
 * after it was used (updatePromo allows it): the older orders keep the old
 * name. Saying "not used yet" beside "Kullanım 12" was the page lying.
 */
const RENAMED_NOTE =
  "Kullanım sayısından az: kodun adı sonradan değiştiyse önceki siparişler eski adıyla kayıtlı.";

function ordersDescription(
  orders: PromoOrders | { error: true },
  usageCount: number,
): string | undefined {
  if ("error" in orders) return undefined;
  const found =
    orders.total > orders.rows.length
      ? `${orders.total} siparişin en yeni ${PROMO_ORDERS_LIMIT} tanesi.`
      : `${orders.total} sipariş.`;
  return orders.total < usageCount ? `${found} ${RENAMED_NOTE}` : found;
}

function PromoOrdersTable({
  orders,
  usageCount,
}: {
  orders: PromoOrders | { error: true };
  usageCount: number;
}) {
  if ("error" in orders) {
    return (
      <p role="alert" className="text-sm text-[var(--admin-danger-ink)]">
        Siparişler şu an okunamadı. Sayfayı yenilemeyi dene.
      </p>
    );
  }
  return (
    <DataTable<PromoOrderRow>
      caption="Bu kodla verilen siparişler"
      rows={orders.rows}
      rowKey={(o) => o.id}
      rowHref={(o) => `/admin/siparisler/${encodeURIComponent(o.id)}`}
      empty={
        usageCount > 0 ? (
          <EmptyState
            title="Bu adı taşıyan sipariş yok."
            description="Kod sonradan yeniden adlandırıldıysa önceki siparişler eski adıyla kayıtlı."
          />
        ) : (
          <EmptyState
            title="Bu kod henüz bir siparişte kullanılmadı."
            description="Kullanım sayısı sepette kodun alındığı her siparişte artar."
          />
        )
      }
      columns={[
        {
          key: "no",
          header: "Sipariş",
          cell: (o) => <span style={NUMERIC_STYLE}>#{o.orderNo}</span>,
        },
        {
          key: "tarih",
          header: "Tarih",
          cell: (o) => (
            <span className="text-xs whitespace-nowrap">
              {o.createdAt ? formatDateTime(o.createdAt) : "-"}
            </span>
          ),
        },
        {
          key: "durum",
          header: "Durum",
          cell: (o) => <OrderStatusBadge order={o} />,
        },
        {
          key: "indirim",
          header: "İndirim",
          align: "right",
          cell: (o) => (
            <span style={NUMERIC_STYLE}>{formatTRY(o.discountMinor)}</span>
          ),
        },
        {
          key: "tutar",
          header: "Tutar",
          align: "right",
          cell: (o) => (
            <span style={NUMERIC_STYLE}>{formatTRY(o.totalMinor)}</span>
          ),
        },
      ]}
    />
  );
}
