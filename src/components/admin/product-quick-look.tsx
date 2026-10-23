import Link from "next/link";

import { MENU_TAG_LABEL } from "@/lib/admin/menu-panel";
import {
  productEditHref,
  productHref,
  productPriceEditHref,
  productShopHref,
  productStockLevel,
  productStockMovesHref,
} from "@/lib/admin/products-panel";
import {
  STOCK_REASON_LABEL,
  toStockAdjustOption,
} from "@/lib/admin/stock-moves-panel";
import { auditActorLabel } from "@/lib/admin/karaoke-panel";
import type { AdminProduct, AdminStockMove } from "@/lib/admin/store";
import { timeAgo } from "@/lib/admin/time-ago";

import { formatTRY } from "./forms";
import { ProductActiveToggleRow } from "./products-list";
import { QuickStockForm } from "./quick-stock-form";
import { Badge, BUTTON, NUMERIC_STYLE } from "./ui";
import { QuickLook } from "./ui/quick-look";
import {
  QuickLookActionLink,
  QuickLookActions,
  QuickLookActivity,
  QuickLookChips,
  QuickLookPhoto,
  QuickLookSection,
  QuickLookStates,
} from "./ui/quick-look-parts";
import { CODE_STYLE } from "./ui/styles";

/** The moves the drawer lists; the rest are a click away. */
export const QUICK_LOOK_MOVES = 5;

const STOCK_INK = {
  out: "text-[var(--admin-danger-ink)]",
  low: "text-[var(--admin-warning)]",
  ok: "text-[var(--admin-text)]",
} as const;

/** "+6", "−2": the sign always shown, a real minus. */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

/**
 * A shop product in its list's quick look (Innex's right drawer, recipe
 * §3.8): the photo, its code and badges, "Satış durumu" and "Stok durumu"
 * side by side, its variants as chips, the steps (stock, price, on/off
 * sale, the shop page, the ledger) and its last stock moves. "Düzenle" is
 * the bottom bar's one solid button; "Sil" stays in the row's ⋯ and on the
 * full page, out of a glance's reach.
 */
export function ProductQuickLook({
  product,
  categoryLabel,
  photo,
  moves,
  canAdjustStock,
  closeHref,
  selfHref,
  now,
}: {
  product: AdminProduct;
  categoryLabel: string;
  /** The first photo's served URL, or "". */
  photo: string;
  /** Its newest stock moves, newest first. */
  moves: readonly AdminStockMove[];
  /** The role may correct stock (`stock`). */
  canAdjustStock: boolean;
  closeHref: string;
  selfHref: string;
  now: Date;
}) {
  const level = productStockLevel(product);
  const variants = product.variants ?? [];
  const tags = (product.tags ?? []).map((t) => MENU_TAG_LABEL[t] ?? t);
  const discounted = product.compareAtPriceMinor > product.priceMinor;

  return (
    <QuickLook
      title={product.name}
      eyebrow={`Mağaza ürünü · ${categoryLabel}`}
      subtitle={product.tag || undefined}
      closeHref={closeHref}
      selfHref={selfHref}
      footer={
        <>
          <Link href={productHref(product.id)} className={BUTTON.ghost}>
            Tam sayfa
          </Link>
          <Link href={productEditHref(product.id)} className={BUTTON.primary}>
            Düzenle
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <QuickLookPhoto src={photo} fallback="products" />
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="mr-1 text-xs text-[var(--admin-text-soft)]"
            style={CODE_STYLE}
          >
            {product.sku || product.id}
          </span>
          <Badge tone={product.isActive ? "success" : "neutral"} dot>
            {product.isActive ? "Aktif" : "Pasif"}
          </Badge>
          {product.featured ? <Badge tone="accent">Öne çıkan</Badge> : null}
          {product.isNew ? <Badge tone="info">Yeni</Badge> : null}
        </div>
      </div>

      <QuickLookStates
        items={[
          {
            label: "Satış durumu",
            value: (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span style={NUMERIC_STYLE}>
                  {formatTRY(product.priceMinor)}
                </span>
                {discounted ? (
                  <span
                    className="text-xs font-normal text-[var(--admin-text-soft)] line-through"
                    style={NUMERIC_STYLE}
                  >
                    {formatTRY(product.compareAtPriceMinor)}
                  </span>
                ) : null}
              </span>
            ),
            hint: product.isActive
              ? "Mağazada ve uygulamada satışta."
              : "Satışta değil: mağazada görünmez.",
          },
          {
            label: "Stok durumu",
            value: (
              <span className={STOCK_INK[level]} style={NUMERIC_STYLE}>
                {level === "out"
                  ? "Tükendi"
                  : `${product.stock} adet${level === "low" ? " · düşük" : ""}`}
              </span>
            ),
            hint: `Düşük stok eşiği ${product.lowStockThreshold}${
              variants.length > 0 ? ` · ${variants.length} varyant` : ""
            }`,
          },
        ]}
      />

      {variants.length > 0 ? (
        <QuickLookSection title="Varyantlar">
          <QuickLookChips
            chips={variants.map((v) => ({
              key: v.id,
              chip: (
                <Badge
                  tone={
                    !v.isActive
                      ? "neutral"
                      : v.stock <= 0
                        ? "danger"
                        : "neutral"
                  }
                  className="normal-case"
                >
                  {v.name || "Adsız"} ·{" "}
                  <span style={NUMERIC_STYLE}>{v.stock}</span>
                  {v.isActive ? "" : " · pasif"}
                </Badge>
              ),
            }))}
          />
        </QuickLookSection>
      ) : null}

      {tags.length > 0 ? (
        <QuickLookSection title="Etiketler">
          <QuickLookChips
            chips={tags.map((t) => ({
              key: t,
              chip: (
                <Badge tone="neutral" className="normal-case">
                  {t}
                </Badge>
              ),
            }))}
          />
        </QuickLookSection>
      ) : null}

      <QuickLookSection title="İşlemler">
        <QuickLookActions>
          {canAdjustStock ? (
            <QuickStockForm product={toStockAdjustOption(product)} />
          ) : null}
          <QuickLookActionLink
            href={productPriceEditHref(product.id)}
            icon="price"
            hue="green"
            title="Fiyatı değiştir"
            description="Fiyat, eski fiyat ve indirim günleri."
          />
          <ProductActiveToggleRow
            p={{
              id: product.id,
              name: product.name,
              isActive: product.isActive,
            }}
          />
          {product.isActive && product.slug ? (
            <QuickLookActionLink
              href={productShopHref(product.slug)}
              external
              icon="external"
              hue="blue"
              title="Mağazada gör"
              description="Müşterinin gördüğü sayfa."
            />
          ) : null}
        </QuickLookActions>
      </QuickLookSection>

      <QuickLookSection
        title="Son hareketler"
        action={
          <Link
            href={productStockMovesHref(product.id)}
            className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
          >
            Tümü
            <span className="sr-only">: {product.name} stok hareketleri</span>
          </Link>
        }
      >
        <QuickLookActivity
          empty="Bu ürünün stok hareketi yok."
          events={moves.map((m) => ({
            key: m.id,
            title: (
              <>
                {STOCK_REASON_LABEL[m.reason] ?? m.reason}{" "}
                <span
                  className={
                    m.delta < 0
                      ? "text-[var(--admin-text)]"
                      : "text-[var(--admin-success)]"
                  }
                  style={NUMERIC_STYLE}
                >
                  {signed(m.delta)}
                </span>
                {m.note ? (
                  <span className="text-[var(--admin-text-soft)]">
                    {" "}
                    · {m.note}
                  </span>
                ) : null}
              </>
            ),
            meta: [timeAgo(m.createdAt, now), auditActorLabel(m.actor)]
              .filter(Boolean)
              .join(" · "),
            figure: `Stok ${m.stockAfter}`,
          }))}
        />
      </QuickLookSection>
    </QuickLook>
  );
}
