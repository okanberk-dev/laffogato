"use client";

import { useActionState, useState } from "react";

import {
  bulkProductsAction,
  deleteProductAction,
  setProductActiveAction,
  type BulkActionState,
} from "@/app/admin/urunler/actions";
import { actionError, actionOk } from "@/lib/admin/action-result";
import type { SortState } from "@/lib/admin/list-params";
import {
  productEditHref,
  productHref,
  productShopHref,
  productStockLevel,
  productStockMovesHref,
  type ProductListRow,
} from "@/lib/admin/products-panel";
import { quickLookHref } from "@/lib/admin/quick-look-core";

import { ActionButton, useHandPost } from "./action-form";
import { BulkActionBar, useSelection } from "./bulk";
import { bulkAnswer } from "./bulk-answer";
import { formatDateTime, formatTRY } from "./forms";
import {
  QUICK_LOOK_ACTION_ROW,
  QuickLookActionBody,
} from "./ui/quick-look-parts";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ActionModal,
  Badge,
  BUTTON,
  CardLink,
  ConfirmButton,
  DataTable,
  type DataTableColumn,
  type EmptyListAction,
  EmptyListActionLink,
  EmptyState,
  NUMERIC_STYLE,
  useToast,
} from "./ui";

interface Props {
  rows: ProductListRow[];
  categories: ReadonlyArray<{ slug: string; label: string }>;
  sort: SortState;
  searchParams: Record<string, string | string[] | undefined>;
  pathname: string;
  /** Shown when there are no rows. */
  emptyTitle?: string;
  /** The way out of an empty list ("Filtreleri temizle", "+ Yeni ürün"). */
  emptyAction?: EmptyListAction | null;
}

const initialBulkState: BulkActionState = {};

const OP_LABEL: Record<string, string> = {
  activate: "Aktif yapıldı",
  deactivate: "Pasif yapıldı",
  delete: "Silindi",
  set_category: "Kategori değiştirildi",
};

const STOCK_INK = {
  out: "text-[var(--admin-danger-ink)]",
  low: "text-[var(--admin-warning)]",
  ok: "text-[var(--admin-text)]",
} as const;

/** 40×40 product thumbnail: the first photo (served URL), or a placeholder. */
function ProductThumb({ src }: { src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[var(--admin-border)]"
      />
    );
  }
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--admin-surface-2)] text-[var(--admin-text-mute)] ring-1 ring-[var(--admin-border)]"
      aria-hidden="true"
      title="Görsel yok"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m21 15-5-5L6 19" />
      </svg>
    </span>
  );
}

function Price({ p }: { p: ProductListRow }) {
  return (
    <span className="inline-flex flex-col items-end" style={NUMERIC_STYLE}>
      <span>{formatTRY(p.priceMinor)}</span>
      {p.compareAtPriceMinor > p.priceMinor ? (
        <span className="text-xs text-[var(--admin-text-soft)] line-through">
          {formatTRY(p.compareAtPriceMinor)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The total, and under it each variant's own stock (admin audit CAT-14:
 * the list showed the total alone, so a sold-out 1 kg bag hid behind a
 * healthy total). An inactive variant is marked; its stock is not in the
 * total.
 */
function Stock({ p, wide = false }: { p: ProductListRow; wide?: boolean }) {
  const level = productStockLevel(p);
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className={STOCK_INK[level]} style={NUMERIC_STYLE}>
        {p.stock}
        {p.variants.length > 0 ? (
          <span className="sr-only"> toplam</span>
        ) : null}
      </span>
      {p.variants.length > 0 ? (
        <span
          className={`flex flex-col items-end gap-0.5 text-right text-xs text-[var(--admin-text-soft)] ${wide ? "" : "max-w-[10rem] xl:max-w-none"}`}
        >
          {p.variants.map((v) => (
            <span key={v.id} className="xl:whitespace-nowrap">
              {v.name || "Adsız"}:{" "}
              <span
                className={
                  v.stock <= 0 ? "text-[var(--admin-danger-ink)]" : undefined
                }
                style={NUMERIC_STYLE}
              >
                {v.stock}
              </span>
              {v.isActive ? "" : " · pasif"}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function StatusBadges({
  p,
  wide = false,
}: {
  p: ProductListRow;
  wide?: boolean;
}) {
  const level = productStockLevel(p);
  return (
    <span className={`flex flex-wrap gap-1 ${wide ? "" : "max-w-[11rem]"}`}>
      <Badge tone={p.isActive ? "success" : "neutral"} dot>
        {p.isActive ? "Aktif" : "Pasif"}
      </Badge>
      {p.featured ? <Badge tone="accent">Öne çıkan</Badge> : null}
      {p.isNew ? <Badge tone="info">Yeni</Badge> : null}
      {level === "out" ? <Badge tone="danger">Stokta yok</Badge> : null}
      {level === "low" ? <Badge tone="warning">Düşük stok</Badge> : null}
    </span>
  );
}

/** The label and the variant count; the SKU too where its column is hidden. */
function Subline({ p, sku = false }: { p: ProductListRow; sku?: boolean }) {
  const parts = [
    p.tag,
    p.variants.length > 0 ? `${p.variants.length} varyant` : "",
  ].filter(Boolean);
  return (
    <>
      {parts.length > 0 ? (
        <span className="block text-xs font-normal text-[var(--admin-text-soft)]">
          {parts.join(" · ")}
        </span>
      ) : null}
      {sku && p.sku ? (
        <span
          className="block text-xs font-normal text-[var(--admin-text-soft)] xl:hidden"
          style={NUMERIC_STYLE}
        >
          {p.sku}
        </span>
      ) : null}
    </>
  );
}

/** The row's ⋯ menu: view, edit, the shop page, its stock moves, Aktif / Pasif, Sil. */
export function ProductRowMenu({ p }: { p: ProductListRow }) {
  return (
    <ActionMenu label={`${p.name} işlemleri`}>
      <ActionMenuLink href={productHref(p.id)}>Görüntüle</ActionMenuLink>
      <ActionMenuLink href={productEditHref(p.id)}>Düzenle</ActionMenuLink>
      {p.isActive ? (
        // The shop's page, in a new tab: the list stays where it was.
        <a
          href={productShopHref(p.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className={BUTTON.menu}
        >
          Mağazada gör
        </a>
      ) : null}
      <ActionMenuLink href={productStockMovesHref(p.id)}>
        Stok hareketleri
      </ActionMenuLink>
      <ActionMenuSeparator />
      <ProductActiveToggle p={p} variant="menu" />
      <DeleteProduct p={p} variant="menuDanger" />
    </ActionMenu>
  );
}

/** One click, no dialog: reversible, and the state asked for is posted. */
export function ProductActiveToggle({
  p,
  variant = "ghost",
}: {
  p: Pick<ProductListRow, "id" | "name" | "isActive">;
  variant?: "ghost" | "menu";
}) {
  const label = p.isActive ? "Pasif yap" : "Aktif yap";
  return (
    <ActionButton
      action={setProductActiveAction}
      hidden={{ id: p.id, isActive: p.isActive ? "false" : "true" }}
      variant={variant}
      ariaLabel={`${label}: ${p.name}`}
      title={
        p.isActive
          ? "Mağazadan ve uygulamadan kaldır; ürün silinmez"
          : "Mağazada yeniden göster"
      }
    >
      {label}
    </ActionButton>
  );
}

/** The same toggle as a quick look's action row (ui/quick-look-parts.tsx). */
export function ProductActiveToggleRow({
  p,
}: {
  p: Pick<ProductListRow, "id" | "name" | "isActive">;
}) {
  return (
    <li>
      <ActionButton
        action={setProductActiveAction}
        hidden={{ id: p.id, isActive: p.isActive ? "false" : "true" }}
        variant="bare"
        wide
        className={QUICK_LOOK_ACTION_ROW}
      >
        <QuickLookActionBody
          icon={p.isActive ? "hide" : "show"}
          hue={p.isActive ? "rose" : "green"}
          title={p.isActive ? "Pasif yap" : "Aktif yap"}
          description={
            p.isActive
              ? "Mağazadan ve uygulamadan kalkar; silinmez."
              : "Mağazada ve uygulamada yeniden görünür."
          }
        />
      </ActionButton>
    </li>
  );
}

/**
 * "Sil": a confirm dialog, then a toast. On the product's own page
 * (`thenList`) the answer is the list, with the toast.
 */
export function DeleteProduct({
  p,
  variant,
  thenList = false,
}: {
  p: Pick<ProductListRow, "id" | "name">;
  variant?: "danger" | "menuDanger";
  thenList?: boolean;
}) {
  return (
    <ConfirmButton
      action={deleteProductAction}
      hidden={thenList ? { id: p.id, then: "list" } : { id: p.id }}
      label="Sil"
      ariaLabel={`Sil: ${p.name}`}
      variant={variant}
      title={`"${p.name}" silinsin mi?`}
      description="Ürün mağazadan ve panelden kalıcı olarak silinir; geçmiş siparişlerdeki satırlar kalır. Yalnız satıştan kaldırmak istiyorsan Pasif yap."
    />
  );
}

export function ProductsList({
  rows,
  categories,
  sort,
  searchParams,
  pathname,
  emptyTitle = "Bu süzgece uyan ürün yok.",
  emptyAction = null,
}: Props) {
  const toast = useToast();
  // The last bulk answer that succeeded: each new one clears the selection
  // once (bulk.tsx useSelection), so the bar closes after a bulk action.
  const [state, setState] = useState<{ ok?: unknown }>({});
  const selection = useSelection({ resetOn: state.ok });
  // The one-click bulk buttons post by hand: a refusal keeps the chosen
  // category, a second click while the first is out is dropped, and a throw
  // answers in place (CAT-17).
  const [, formAction, pending] = useActionState(
    bulkAnswer<BulkActionState>(bulkProductsAction, {
      tell: (message, tone) => toast.show({ message, tone }),
      describe: (ok) =>
        `${OP_LABEL[ok.op] ?? ok.op}: ${ok.updated} ürün güncellendi.`,
      onOk: (ok) => setState({ ok }),
    }),
    initialBulkState,
  );
  const post = useHandPost(formAction, pending);
  const idsCsv = selection.ids.join(",");
  const count = selection.count;

  // The table fits its card beside the sidebar: at 1024 px the card is
  // 720 px wide, so SKU and Kategori join it from xl (the SKU rides under
  // the name below that), "Güncellendi" from 2xl, and the cells are a
  // little tighter below 2xl. The "⋯" column is pinned for whatever still
  // scrolls (ui/data-table.tsx).
  const TIGHT = "max-2xl:px-3";
  const columns: DataTableColumn<ProductListRow>[] = [
    {
      key: "ad",
      header: "Ürün",
      sortable: true,
      className: `min-w-[13rem] ${TIGHT}`,
      cell: (p) => (
        <span className="flex items-center gap-3">
          <ProductThumb src={p.thumb} />
          <span className="min-w-0">
            <span className="block">{p.name}</span>
            <Subline p={p} sku />
          </span>
        </span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      hideBelow: "xl",
      className: `whitespace-nowrap ${TIGHT}`,
      cell: (p) => (
        <span
          className="text-xs text-[var(--admin-text-soft)]"
          style={NUMERIC_STYLE}
        >
          {p.sku || "-"}
        </span>
      ),
    },
    {
      key: "kategori",
      header: "Kategori",
      hideBelow: "xl",
      className: TIGHT,
      cell: (p) =>
        categories.find((c) => c.slug === p.cat)?.label ?? (
          <span className="text-[var(--admin-text-soft)]">{p.cat}</span>
        ),
    },
    {
      key: "fiyat",
      header: "Fiyat",
      sortable: true,
      align: "right",
      className: `whitespace-nowrap ${TIGHT}`,
      cell: (p) => <Price p={p} />,
    },
    {
      key: "stok",
      header: "Stok",
      sortable: true,
      align: "right",
      className: TIGHT,
      cell: (p) => <Stock p={p} />,
    },
    {
      key: "durum",
      header: "Durum",
      className: TIGHT,
      cell: (p) => <StatusBadges p={p} />,
    },
    {
      key: "guncel",
      header: "Güncellendi",
      sortable: true,
      firstDir: "desc",
      // From 2xl only (DataTable's hideBelow stops at xl), and kept off
      // the phone card.
      hideBelow: "md",
      className: "hidden 2xl:table-cell",
      cell: (p) => (
        <span className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
          {formatDateTime(p.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        caption="Ürünler"
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        // A row opens its quick look over the list (`?gor=`); the full page
        // is "Tam sayfa" there and "Görüntüle" in the row's ⋯.
        rowHref={(p) => quickLookHref(searchParams, pathname, p.id)}
        rowLinkScroll={false}
        rowLabel={(p) => p.name}
        selection={selection}
        rowActions={(p) => <ProductRowMenu p={p} />}
        // A phone card: the name gets the width (the price sat beside it
        // and broke "Hediye Kutusu 5" over two lines), then the badges,
        // then price and stock side by side.
        mobileCard={(p) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <ProductThumb src={p.thumb} />
              <div className="min-w-0 flex-1">
                <CardLink
                  href={quickLookHref(searchParams, pathname, p.id)}
                  scroll={false}
                  className="font-medium text-[var(--admin-text)] underline decoration-[var(--admin-border-strong)] underline-offset-4 hover:text-[var(--admin-primary)] hover:decoration-[var(--admin-primary)]"
                >
                  {p.name}
                </CardLink>
                <span className="block text-xs text-[var(--admin-text-soft)]">
                  {[
                    categories.find((c) => c.slug === p.cat)?.label ?? p.cat,
                    p.variants.length > 0 ? `${p.variants.length} varyant` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {p.sku ? (
                  <span
                    className="block text-xs text-[var(--admin-text-soft)]"
                    style={NUMERIC_STYLE}
                  >
                    {p.sku}
                  </span>
                ) : null}
              </div>
            </div>
            <StatusBadges p={p} wide />
            <div className="flex items-start justify-between gap-3 text-sm">
              <Price p={p} />
              <span className="inline-flex items-start gap-1.5 text-xs text-[var(--admin-text-soft)]">
                Stok <Stock p={p} wide />
              </span>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            title={emptyTitle}
            action={
              emptyAction ? (
                <EmptyListActionLink
                  action={emptyAction}
                  className={BUTTON.ghost}
                />
              ) : null
            }
          />
        }
        sort={sort}
        searchParams={searchParams}
        pathname={pathname}
      />

      <BulkActionBar selection={selection} pending={pending}>
        {/* `contents`: the buttons wrap with the "Sil" beside them, the
            category picker on the last row (a phone bar was four rows). */}
        <form
          action={post.action}
          onSubmit={post.onSubmit}
          className="contents"
        >
          <input type="hidden" name="ids" value={idsCsv} />
          <button
            type="submit"
            name="op"
            value="activate"
            disabled={pending}
            className={BUTTON.ghost}
          >
            Aktif yap
          </button>
          <button
            type="submit"
            name="op"
            value="deactivate"
            disabled={pending}
            className={BUTTON.ghost}
          >
            Pasif yap
          </button>
          <span className="order-last flex items-center gap-2">
            <select
              name="value"
              defaultValue=""
              aria-label="Taşınacak kategori"
              className="min-h-11 rounded-lg border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)] focus:border-[var(--admin-primary)] focus:outline-none pointer-fine:min-h-9"
            >
              <option value="" disabled>
                Kategoriye taşı…
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              name="op"
              value="set_category"
              disabled={pending}
              className={BUTTON.primary}
            >
              Taşı
            </button>
          </span>
        </form>
        <ActionModal
          action={async (_prev, formData) => {
            const next = await bulkProductsAction({}, formData);
            if (next.ok) {
              return actionOk(`Silindi: ${next.ok.updated} ürün.`);
            }
            return actionError(next.error ?? "Silinemedi.");
          }}
          title={`${count} ürün silinsin mi?`}
          description="Seçili ürünler mağazadan ve panelden kalıcı olarak silinir; geçmiş siparişlerdeki satırlar kalır. Yalnız satıştan kaldırmak istiyorsan Pasif yap."
          trigger="Sil"
          triggerVariant="danger"
          tone="danger"
          submitLabel="Sil"
          confirmPhrase={String(count)}
          confirmLabel={`Onaylamak için ${count} yaz`}
          hidden={{ ids: idsCsv, op: "delete" }}
          onSuccess={(result) => setState({ ok: result })}
          size="sm"
        />
      </BulkActionBar>
    </>
  );
}
