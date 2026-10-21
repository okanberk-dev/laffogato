"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  bulkMenuAction,
  deleteMenuItemAction,
  setMenuItemActiveAction,
  type BulkMenuActionState,
} from "@/app/admin/menu/actions";
import { actionError, actionOk } from "@/lib/admin/action-result";
import {
  menuItemEditHref,
  menuItemHref,
  menuTagChip,
  type MenuGroup,
  type MenuListRow,
} from "@/lib/admin/menu-panel";
import type { MenuCategoryKey } from "@/lib/admin/store";

import { ActionButton, useHandPost } from "./action-form";
import { BulkActionBar, SelectAllCheckbox, useSelection } from "./bulk";
import { bulkAnswer } from "./bulk-answer";
import { formatTRY } from "./forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ActionModal,
  Badge,
  BUTTON,
  ConfirmButton,
  DataTable,
  EmptyListActionLink,
  EmptyState,
  NUMERIC_STYLE,
  useToast,
  type DataTableColumn,
  type EmptyListAction,
} from "./ui";
import { EYEBROW, MONO_STYLE } from "./ui/styles";

interface Props {
  groups: MenuGroup[];
  categoryKeys: MenuCategoryKey[];
  categoryLabels: Record<MenuCategoryKey, string>;
  /** Shown instead of the groups when nothing matches. */
  emptyTitle?: string;
  emptyAction?: EmptyListAction | null;
}

const initialBulkState: BulkMenuActionState = {};

const OP_LABEL: Record<string, string> = {
  activate: "Satışa açıldı",
  deactivate: "Gizlendi",
  delete: "Silindi",
  set_category: "Kategori değiştirildi",
};

/** The app's four tags in Turkish; a word it does not know is marked. */
export function MenuTags({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) {
    return <span className="text-xs text-[var(--admin-text-soft)]">-</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => {
        const chip = menuTagChip(t);
        return chip.known ? (
          <Badge key={t} tone={t === "nuts" ? "warning" : "neutral"}>
            {chip.label}
          </Badge>
        ) : (
          <Badge
            key={t}
            tone="neutral"
            // Dashed: a word the app never shows, dropped on the next save.
            className="normal-case outline-1 outline-[var(--admin-border-strong)] outline-dashed"
            title="Uygulama bu etiketi göstermez; kalem kaydedilince düşer."
          >
            {chip.label}
            <span className="sr-only"> (uygulamada görünmez)</span>
          </Badge>
        );
      })}
    </span>
  );
}

/**
 * A category's select-all, named after it: the page holds a table per
 * category, and a dozen bare "Tümünü seç" boxes could not be told apart.
 */
const selectAllLabel = (category: string) => `${category}: tümünü seç`;

/** M over L in the table; side by side on the phone card. */
function Price({ it, row = false }: { it: MenuListRow; row?: boolean }) {
  return (
    <span
      className={
        row
          ? "inline-flex flex-wrap items-baseline gap-x-3"
          : "inline-flex flex-col items-end"
      }
      style={NUMERIC_STYLE}
    >
      <span>
        {it.priceMinorL > 0 ? "M " : ""}
        {formatTRY(it.priceMinor)}
      </span>
      {it.priceMinorL > 0 ? (
        <span className="text-xs text-[var(--admin-text-soft)]">
          L {formatTRY(it.priceMinorL)}
        </span>
      ) : null}
    </span>
  );
}

function StatusBadge({ it }: { it: Pick<MenuListRow, "isActive"> }) {
  return (
    <Badge tone={it.isActive ? "success" : "neutral"} dot>
      {it.isActive ? "Satışta" : "Tükendi"}
    </Badge>
  );
}

/**
 * One click, no tick and no bulk bar: "Tükendi" hides the item from the menu
 * (site and app), "Satışa aç" brings it back. The answer is a toast.
 */
export function SoldOutToggle({
  item,
}: {
  item: Pick<MenuListRow, "id" | "name" | "isActive">;
}) {
  return (
    <ActionButton
      action={setMenuItemActiveAction}
      hidden={{ id: item.id, isActive: item.isActive ? "false" : "true" }}
      variant={item.isActive ? "ghost" : "primary"}
      className="whitespace-nowrap"
      ariaLabel={`${item.isActive ? "Tükendi" : "Satışa aç"}: ${item.name}`}
      title={
        item.isActive
          ? "Menüden gizle: tükendi ya da satışta değil"
          : "Menüde yeniden göster"
      }
    >
      {item.isActive ? "Tükendi" : "Satışa aç"}
    </ActionButton>
  );
}

/** The row's "Tükendi" stays one click beside its ⋯ menu (Görüntüle, Düzenle, Sil). */
function RowActions({ it }: { it: MenuListRow }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <SoldOutToggle item={it} />
      <ActionMenu label={`${it.name} işlemleri`}>
        <ActionMenuLink href={menuItemHref(it.id)}>Görüntüle</ActionMenuLink>
        <ActionMenuLink href={menuItemEditHref(it.id)}>Düzenle</ActionMenuLink>
        <ActionMenuSeparator />
        <ConfirmButton
          action={deleteMenuItemAction}
          hidden={{ id: it.id }}
          label="Sil"
          ariaLabel={`Sil: ${it.name}`}
          variant="menuDanger"
          title={`"${it.name}" silinsin mi?`}
          description="Kalem menüden ve panelden kalıcı olarak silinir. Bir süreliğine kaldırmak istiyorsan Tükendi'ye bas."
        />
      </ActionMenu>
    </span>
  );
}

// The table fits its card beside the sidebar: at 1024 px the card is about
// 720 px wide, so Sıra and Etiket join it from xl (the tags ride under the
// name below that) and the item's name keeps its width.
const COLUMNS: DataTableColumn<MenuListRow>[] = [
  {
    key: "ad",
    header: "Kalem",
    className: "min-w-[12rem]",
    cell: (it) => (
      <span className="block min-w-0">
        <span className="block">{it.name}</span>
        {it.desc ? (
          <span className="line-clamp-1 block max-w-md text-xs font-normal text-[var(--admin-text-soft)]">
            {it.desc}
          </span>
        ) : null}
        {it.tags.length > 0 ? (
          <span className="mt-1 block xl:hidden">
            <MenuTags tags={it.tags} />
          </span>
        ) : null}
      </span>
    ),
  },
  {
    key: "sira",
    header: "Sıra",
    align: "right",
    hideBelow: "xl",
    cell: (it) => (
      <span className="text-[var(--admin-text-soft)]" style={NUMERIC_STYLE}>
        {String(it.sortOrder).padStart(2, "0")}
      </span>
    ),
  },
  {
    key: "etiket",
    header: "Etiket",
    hideBelow: "xl",
    cell: (it) => <MenuTags tags={it.tags} />,
  },
  {
    key: "fiyat",
    header: "Fiyat",
    align: "right",
    className: "whitespace-nowrap",
    cell: (it) => <Price it={it} />,
  },
  {
    key: "durum",
    header: "Durum",
    cell: (it) => <StatusBadge it={it} />,
  },
];

export function MenuList({
  groups,
  categoryKeys,
  categoryLabels,
  emptyTitle = "Bu süzgece uyan kalem yok.",
  emptyAction = null,
}: Props) {
  const toast = useToast();
  // The last bulk answer that succeeded: each new one clears the selection
  // once (bulk.tsx useSelection), so the bar closes after a bulk action.
  const [state, setState] = useState<{ ok?: unknown }>({});
  const selection = useSelection({ resetOn: state.ok });
  // Posted by hand, and a throw answers in place (admin audit CAT-17).
  const [, formAction, pending] = useActionState(
    bulkAnswer<BulkMenuActionState>(bulkMenuAction, {
      tell: (message, tone) => toast.show({ message, tone }),
      describe: (ok) =>
        `${OP_LABEL[ok.op] ?? ok.op}: ${ok.updated} kalem güncellendi.`,
      onOk: (ok) => setState({ ok }),
    }),
    initialBulkState,
  );
  const post = useHandPost(formAction, pending);
  const idsCsv = selection.ids.join(",");
  const count = selection.count;

  return (
    <>
      {groups.length === 0 ? (
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
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ key, rows }) => (
            <section key={key} aria-labelledby={`menu-cat-${key}`}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-end gap-3">
                  {/* The phone cards have no table head: the category's
                      select-all sits beside its heading there. */}
                  {rows.length > 0 ? (
                    <span className="mb-0.5 md:hidden">
                      <SelectAllCheckbox
                        ids={rows.map((it) => it.id)}
                        selection={selection}
                        label={selectAllLabel(categoryLabels[key])}
                      />
                    </span>
                  ) : null}
                  <div>
                    <div className={EYEBROW} style={MONO_STYLE}>
                      {rows.length} kalem
                    </div>
                    <h2
                      id={`menu-cat-${key}`}
                      className="text-xl font-semibold text-[var(--admin-text)]"
                    >
                      {categoryLabels[key]}
                    </h2>
                  </div>
                </div>
                <Link
                  href={`/admin/menu/yeni?cat=${key}`}
                  className={BUTTON.link}
                >
                  + Bu kategoriye ekle
                </Link>
              </div>
              <DataTable
                caption={categoryLabels[key]}
                columns={COLUMNS}
                rows={rows}
                rowKey={(it) => it.id}
                rowHref={(it) => menuItemHref(it.id)}
                rowLabel={(it) => it.name}
                selection={selection}
                selectAllLabel={selectAllLabel(categoryLabels[key])}
                rowActions={(it) => <RowActions it={it} />}
                // A phone card: the name gets the width (the price beside
                // it squeezed "Çilekli Matcha Latte" to a word per line),
                // then the status and tags, then the price.
                mobileCard={(it) => (
                  <div className="flex flex-col gap-2">
                    <div className="min-w-0">
                      <Link
                        href={menuItemHref(it.id)}
                        className="font-medium text-[var(--admin-text)] underline decoration-[var(--admin-border-strong)] underline-offset-4 hover:text-[var(--admin-primary)] hover:decoration-[var(--admin-primary)]"
                      >
                        {it.name}
                      </Link>
                      {it.desc ? (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--admin-text-soft)]">
                          {it.desc}
                        </span>
                      ) : null}
                    </div>
                    <span className="flex flex-wrap items-center gap-1">
                      <StatusBadge it={it} />
                      {it.tags.length > 0 ? <MenuTags tags={it.tags} /> : null}
                    </span>
                    <span className="text-sm">
                      <Price it={it} row />
                    </span>
                  </div>
                )}
                empty={
                  <p className="rounded-2xl border border-dashed border-[var(--admin-border)] px-4 py-6 text-sm text-[var(--admin-text-soft)]">
                    Bu kategoride kalem yok.
                  </p>
                }
              />
            </section>
          ))}
        </div>
      )}

      <BulkActionBar selection={selection} pending={pending}>
        {/* `contents`: the buttons wrap with the "Sil" beside them, the
            category picker on the last row. */}
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
            Satışa aç
          </button>
          <button
            type="submit"
            name="op"
            value="deactivate"
            disabled={pending}
            className={BUTTON.ghost}
          >
            Gizle
          </button>
          <span className="order-last flex items-center gap-2">
            <select
              name="value"
              defaultValue=""
              aria-label="Taşınacak kategori"
              className="min-h-[44px] rounded-xl border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)] focus:border-[var(--admin-primary)] focus:outline-none"
            >
              <option value="" disabled>
                Kategoriye taşı…
              </option>
              {categoryKeys.map((k) => (
                <option key={k} value={k}>
                  {categoryLabels[k]}
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
            const next = await bulkMenuAction({}, formData);
            if (next.ok) return actionOk(`Silindi: ${next.ok.updated} kalem.`);
            return actionError(next.error ?? "Silinemedi.");
          }}
          title={`${count} kalem silinsin mi?`}
          description="Seçili kalemler menüden ve panelden kalıcı olarak silinir. Bir süreliğine kaldırmak istiyorsan Gizle'ye bas."
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
