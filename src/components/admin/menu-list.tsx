"use client";

import { useActionState, useState } from "react";

import {
  bulkMenuAction,
  deleteMenuItemAction,
  moveMenuItemAction,
  setMenuItemActiveAction,
  type BulkMenuActionState,
} from "@/app/admin/menu/actions";
import Link from "@/components/link";
import { actionError, actionOk } from "@/lib/admin/action-result";
import {
  MENU_PATH,
  menuItemCopyHref,
  menuItemEditHref,
  menuItemHref,
  menuTagChip,
  type MenuGroup,
  type MenuListRow,
} from "@/lib/admin/menu-panel";
import { quickLookHref } from "@/lib/admin/quick-look-core";
import type { MenuCategoryKey } from "@/lib/admin/store";

import { ActionButton, useHandPost } from "./action-form";
import { BulkActionBar, SelectAllCheckbox, useSelection } from "./bulk";
import { bulkAnswer } from "./bulk-answer";
import { formatTRY } from "./forms";
import { MoveButtons } from "./move-buttons";
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
import {
  QUICK_LOOK_ACTION_ROW,
  QuickLookActionBody,
} from "./ui/quick-look-parts";
import { EYEBROW, MONO_STYLE, ROW_CONTROL } from "./ui/styles";

interface Props {
  groups: MenuGroup[];
  categoryKeys: MenuCategoryKey[];
  categoryLabels: Record<MenuCategoryKey, string>;
  /** The list's address params (no `?gor=`): a row's quick look keeps them. */
  searchParams?: Record<string, string | string[]>;
  /** Shown instead of the groups when nothing matches. */
  emptyTitle?: string;
  emptyAction?: EmptyListAction | null;
  /**
   * ↑ / ↓ in the Sıra column: only while each category shows all its items
   * (no tab but Tümü, no search), since a move swaps with the neighbour the
   * menu has, which a filtered list may not show.
   */
  reorderable?: boolean;
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

function StatusBadge({
  it,
}: {
  it: Pick<MenuListRow, "isActive" | "soldOutAt">;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={it.isActive ? "success" : "neutral"} dot>
        {it.isActive ? "Satışta" : "Tükendi"}
      </Badge>
      {/* A branch's own "Tükendi" (its bar or till): the item is still on
          the menu, not sold there. */}
      {it.isActive
        ? (it.soldOutAt ?? []).map((branch) => (
            <Badge key={branch} tone="warning">
              {branch}: tükendi
            </Badge>
          ))
        : null}
    </span>
  );
}

/**
 * One click, no tick and no bulk bar: "Tükendi" hides the item from the menu
 * (site and app), "Satışa aç" brings it back. The answer is a toast.
 */
export function SoldOutToggle({
  item,
  row = false,
}: {
  item: Pick<MenuListRow, "id" | "name" | "isActive">;
  /** The list row's small size (ROW_CONTROL); the item's page has buttons. */
  row?: boolean;
}) {
  return (
    <ActionButton
      action={setMenuItemActiveAction}
      hidden={{ id: item.id, isActive: item.isActive ? "false" : "true" }}
      variant={row ? "bare" : item.isActive ? "ghost" : "primary"}
      className={
        row
          ? // One width for both words: the action column (and the tables
            // under each other) no longer shifts by a few pixels per row.
            `${item.isActive ? ROW_CONTROL.text : ROW_CONTROL.textStrong} min-w-[5.75rem]`
          : "whitespace-nowrap"
      }
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

/** The same toggle as a quick look's action row (ui/quick-look-parts.tsx). */
export function SoldOutToggleRow({
  item,
}: {
  item: Pick<MenuListRow, "id" | "name" | "isActive">;
}) {
  return (
    <li>
      <ActionButton
        action={setMenuItemActiveAction}
        hidden={{ id: item.id, isActive: item.isActive ? "false" : "true" }}
        variant="bare"
        wide
        className={QUICK_LOOK_ACTION_ROW}
      >
        <QuickLookActionBody
          icon={item.isActive ? "soldOut" : "show"}
          hue={item.isActive ? "rose" : "green"}
          title={item.isActive ? "Tükendi işaretle" : "Satışa aç"}
          description={
            item.isActive
              ? "Menüden, siteden ve uygulamadan gizlenir."
              : "Menüde yeniden görünür."
          }
        />
      </ActionButton>
    </li>
  );
}

/** The row's "Tükendi" stays one click beside its ⋯ menu (Görüntüle, Düzenle, Sil). */
function RowActions({ it }: { it: MenuListRow }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <SoldOutToggle item={it} row />
      <ActionMenu label={`${it.name} işlemleri`}>
        <ActionMenuLink href={menuItemHref(it.id)}>Görüntüle</ActionMenuLink>
        <ActionMenuLink href={menuItemEditHref(it.id)}>Düzenle</ActionMenuLink>
        <ActionMenuLink href={menuItemCopyHref(it.id)}>Kopyala</ActionMenuLink>
        <ActionMenuSeparator />
        <DeleteMenuItem item={it} />
      </ActionMenu>
    </span>
  );
}

/**
 * "Sil" in a ⋯ menu: a confirm dialog, then a toast. On the item's own page
 * (`thenList`) the answer is the menu list, with the toast.
 */
export function DeleteMenuItem({
  item,
  thenList = false,
}: {
  item: Pick<MenuListRow, "id" | "name">;
  thenList?: boolean;
}) {
  return (
    <ConfirmButton
      action={deleteMenuItemAction}
      hidden={thenList ? { id: item.id, then: "list" } : { id: item.id }}
      label="Sil"
      ariaLabel={`Sil: ${item.name}`}
      variant="menuDanger"
      title={`"${item.name}" silinsin mi?`}
      description="Kalem menüden ve panelden kalıcı olarak silinir. Bir süreliğine kaldırmak istiyorsan Tükendi'ye bas."
    />
  );
}

// The table fits its card beside the sidebar: at 1024 px the card is about
// 700 px wide, so Etiket and the Sıra number join it from xl (the tags ride
// under the name below that). The ↑ / ↓ are small enough to join from md
// (columnsFor), with the name's column a little narrower until xl: no
// sideways scroll at 768 or 1024, with a mouse or a finger. Every column
// but the name has a set width, so the categories' tables, one under the
// other, line their columns up (they drifted by 40 px with their content).
const COLUMNS: readonly DataTableColumn<MenuListRow>[] = [
  {
    key: "ad",
    header: "Kalem",
    className: "min-w-[9rem] xl:min-w-[12rem]",
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
    className: "w-24",
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
    className: "w-36",
    cell: (it) => <MenuTags tags={it.tags} />,
  },
  {
    key: "fiyat",
    header: "Fiyat",
    align: "right",
    className: "w-28 whitespace-nowrap",
    cell: (it) => <Price it={it} />,
  },
  {
    key: "durum",
    header: "Durum",
    className: "w-28",
    cell: (it) => <StatusBadge it={it} />,
  },
];

/**
 * A category's columns: with `reorderable` its Sıra cell is the ↑ / ↓ in
 * the category's own order (the rows as drawn), otherwise the number. The
 * ↑ / ↓ are in the table from md; the phone card draws its own.
 */
function columnsFor(
  rows: readonly MenuListRow[],
  reorderable: boolean,
): readonly DataTableColumn<MenuListRow>[] {
  if (!reorderable) return COLUMNS;
  return COLUMNS.map((c) =>
    c.key === "sira"
      ? {
          ...c,
          hideBelow: "md" as const,
          cell: (it: MenuListRow) => (
            <MoveButtons
              action={moveMenuItemAction}
              id={it.id}
              index={rows.indexOf(it)}
              count={rows.length}
              label={it.name}
            />
          ),
        }
      : c,
  );
}

export function MenuList({
  groups,
  categoryKeys,
  categoryLabels,
  searchParams = {},
  emptyTitle = "Bu süzgece uyan kalem yok.",
  emptyAction = null,
  reorderable = false,
}: Props) {
  // A row opens its quick look over the list (`?gor=`); the full page is
  // "Tam sayfa" there and "Görüntüle" in the row's ⋯.
  const lookHref = (id: string) => quickLookHref(searchParams, MENU_PATH, id);
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
                  aria-label={`Bu kategoriye ekle: ${categoryLabels[key]}`}
                >
                  Bu kategoriye ekle
                </Link>
              </div>
              <DataTable
                caption={categoryLabels[key]}
                columns={columnsFor(rows, reorderable)}
                rows={rows}
                rowKey={(it) => it.id}
                rowHref={(it) => lookHref(it.id)}
                rowLinkScroll={false}
                rowLabel={(it) => it.name}
                selection={selection}
                selectAllLabel={selectAllLabel(categoryLabels[key])}
                rowActions={(it) => <RowActions it={it} />}
                // A phone card: the name gets the width (the price beside
                // it squeezed "Çilekli Matcha Latte" to a word per line),
                // then the status and tags, then the price and the ↑ / ↓.
                mobileCard={(it) => (
                  <div className="flex flex-col gap-2">
                    <div className="min-w-0">
                      <CardLink
                        href={lookHref(it.id)}
                        scroll={false}
                        className="font-medium text-[var(--admin-text)] underline decoration-[var(--admin-border-strong)] underline-offset-4 hover:text-[var(--admin-primary)] hover:decoration-[var(--admin-primary)]"
                      >
                        {it.name}
                      </CardLink>
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
                    <span className="flex items-center justify-between gap-3 text-sm">
                      <Price it={it} row />
                      {reorderable ? (
                        <MoveButtons
                          action={moveMenuItemAction}
                          id={it.id}
                          index={rows.indexOf(it)}
                          count={rows.length}
                          label={it.name}
                        />
                      ) : null}
                    </span>
                  </div>
                )}
                empty={
                  <p className="rounded-xl border border-dashed border-[var(--admin-border)] px-4 py-6 text-sm text-[var(--admin-text-soft)]">
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
              className="min-h-11 rounded-lg border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)] focus:border-[var(--admin-primary)] focus:outline-none pointer-fine:min-h-9"
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
