"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { cx } from "@/components/laffogato/cx";
import { actionError, actionOk } from "@/lib/admin/action-result";
import type { FilterField, FilterValues } from "@/lib/admin/list-params";
import {
  defaultViewHref,
  parseSavedViews,
  removeView,
  SAVED_VIEW_NAME_MAX,
  SAVED_VIEWS_MAX,
  saveView,
  savedViewsTabKey,
  setDefaultView,
  viewQuery,
  viewRulesFor,
  viewsMenu,
} from "@/lib/admin/saved-views";

import { Field, TextInput } from "../forms";
import {
  ActionMenu,
  ActionMenuButton,
  ActionMenuSeparator,
} from "./action-menu";
import { ActionModal, type ModalAction } from "./action-modal";
import { ListSearchButton } from "./list-search-button";
import {
  readTabDefault,
  readViews,
  subscribeViews,
  writeTabDefault,
  writeViews,
} from "./saved-views-store";
import { BUTTON } from "./styles";
import { useToast } from "./toast";

// A list's saved views (admin UI v2, UI-11, design §5 #11): the
// "Görünümler" menu the FilterBar draws at the end of its chips' row. The
// rules are in lib/admin/saved-views.ts, the storage in saved-views-store.ts.
// The FilterBar loads this file as a chunk of its own (next/dynamic), only
// for a list that passes `views` and only once the page is in the browser
// (saved-views-key.ts): the server cannot read localStorage, the bar's
// markup without JavaScript stays as it was, and the panel's other pages,
// the till included, do not download it.

/**
 * A refused write: site data turned off, or no room left. Not a private
 * window: today's browsers write there too, and the view goes when the
 * window closes. Exported for tests.
 */
export const NOT_KEPT =
  "Kaydedilemedi: tarayıcı bu siteye veri yazdırmıyor (site verisi kapalı ya da yer dolu).";

export interface SavedViewsProps {
  /** useSavedViewsKey's answer (saved-views-key.ts). */
  storageKey: string;
  /** The list's path (the FilterBar's). */
  pathname: string;
  /** The address without the typed search (the FilterBar's). */
  address: Record<string, string | string[] | undefined>;
  fields: readonly FilterField[];
  /** What the list shows, the remembered search included. */
  values: FilterValues;
  pageParam: string;
  /** useTouchedSince's answer: the operator started something already. */
  touched: () => boolean;
  className?: string;
}

/**
 * Puts the focus on the menu's button (its summary). A save or a delete
 * swaps the menu's items (the view on screen is saved now, or no longer),
 * so the dialog's trigger leaves the page with the dialog, before
 * ActionModal can hand the focus back; "Varsayılan yap" is a button in a
 * menu that closes on the click. Either way the keyboard was dropped on
 * <body>. Exported for tests.
 */
export function focusMenuButton(
  root: Pick<ParentNode, "querySelector"> | null,
): void {
  root?.querySelector<HTMLElement>("summary")?.focus();
}

/**
 * The "Görünümler" menu: the saved views (each opens the list as saved,
 * without the search), and for the view on screen "Bu görünümü kaydet", or
 * "Varsayılan yap" and "Görünümü sil" when it is one of them. The default
 * view is opened when the list is opened bare, once per tab.
 */
export function SavedViews({
  storageKey,
  pathname,
  address,
  fields,
  values,
  pageParam,
  touched,
  className,
}: SavedViewsProps) {
  const router = useRouter();
  const toast = useToast();
  // The same read on the server's side: this menu is never drawn there (the
  // bar loads it with ssr: false, once the page is in the browser), and
  // readViews says "" where there is no storage. A node test draws it
  // with a stored list this way.
  const read = () => readViews(storageKey);
  const raw = useSyncExternalStore(subscribeViews, read, read);
  const rules = viewRulesFor(fields, pageParam);
  const state = parseSavedViews(raw, rules);
  const current = viewQuery(address, rules);
  const menu = viewsMenu(state, pathname, current);
  const { here } = menu;
  const searchActive = fields.some(
    (f) => f.type === "search" && Boolean(values[f.name]),
  );

  // The default, asked once per mount: the bar stays mounted while the
  // list's own links ("Tümü", "Sıfırla", a chip's ×) change the address,
  // so those reach the bare list. Back mounts the list anew (Next's back
  // cache holds one page), so the tab notes the default it opened and does
  // not open it again; and a press, key or post since the bar came up
  // means a navigation of the operator's own is under way.
  const asked = useRef(false);
  const tabKey = savedViewsTabKey(storageKey);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const target = defaultViewHref(state, pathname, address, searchActive, {
      appliedInTab: readTabDefault(tabKey) || null,
      touched: touched(),
    });
    if (!target || !state.defaultQuery) return;
    // Not noted, not opened: a tab that cannot remember would reopen it on
    // every Back.
    if (!writeTabDefault(tabKey, state.defaultQuery)) return;
    router.replace(target, { scroll: false });
  }, [router, state, pathname, address, searchActive, tabKey, touched]);

  // Every write starts from what is stored now: another tab may have
  // saved since this one drew its menu.
  const stored = () => parseSavedViews(readViews(storageKey), rules);

  // Around the menu, for focusMenuButton (`contents`: the menu stays the
  // row's own item).
  const menuRoot = useRef<HTMLDivElement>(null);
  const refocus = () => focusMenuButton(menuRoot.current);

  const save: ModalAction = async (_prev, formData) => {
    const result = saveView(stored(), formData.get("name"), current);
    if (!result.ok) return actionError(result.error);
    if (!writeViews(storageKey, result.state)) return actionError(NOT_KEPT);
    return actionOk(`"${result.name}" kaydedildi.`);
  };

  const remove: ModalAction = async () => {
    if (!here) return actionError("Bu görünüm artık kayıtlı değil.");
    if (!writeViews(storageKey, removeView(stored(), here.query))) {
      return actionError(NOT_KEPT);
    }
    return actionOk(`"${here.name}" silindi.`);
  };

  const toggleDefault = () => {
    if (!here) return;
    refocus();
    const next = menu.hereIsDefault ? null : here.query;
    if (!writeViews(storageKey, setDefaultView(stored(), next))) {
      toast.show({ tone: "danger", message: NOT_KEPT });
      return;
    }
    toast.show({
      message: next
        ? `Liste bundan sonra "${here.name}" ile açılır.`
        : "Liste bundan sonra süzgeçsiz açılır.",
    });
  };

  return (
    <div ref={menuRoot} className="contents">
      <ActionMenu label={menu.label} showLabel className={className}>
        {menu.entries.length > 0 ? (
          <>
            <p className="px-3 pt-1.5 pb-1 text-xs text-[var(--admin-text-soft)]">
              Kayıtlı görünümler
            </p>
            {/* Eight views are taller than the room under or over the
              button on a laptop: the list scrolls inside the menu (a
              scroll there does not close it, a page scroll does). */}
            <div className="-mx-1.5 flex max-h-[min(15rem,35dvh)] flex-col gap-0.5 overflow-y-auto px-1.5 py-1">
              {menu.entries.map((entry) => (
                // A post, as "Sıfırla": the view replaces the search too.
                <ListSearchButton
                  key={entry.href}
                  href={entry.href}
                  intent="reset"
                  className={BUTTON.menu}
                  ariaLabel={entry.ariaLabel}
                >
                  <span className="min-w-0 flex-1 break-words">
                    {entry.name}
                  </span>
                  {entry.isDefault ? (
                    <span className="shrink-0 text-xs text-[var(--admin-text-soft)]">
                      Varsayılan
                    </span>
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={cx(
                      "w-4 shrink-0 text-center text-[var(--admin-primary)]",
                      !entry.open && "invisible",
                    )}
                  >
                    ✓
                  </span>
                </ListSearchButton>
              ))}
            </div>
            <ActionMenuSeparator />
          </>
        ) : null}
        {here ? (
          <>
            <ActionMenuButton onClick={toggleDefault}>
              {menu.hereIsDefault ? "Varsayılandan çıkar" : "Varsayılan yap"}
            </ActionMenuButton>
            <ActionModal
              action={remove}
              title="Görünümü sil"
              description={`"${here.name}" bu tarayıcıdan silinir. Listedeki kayıtlar değişmez.`}
              trigger="Görünümü sil"
              triggerVariant="menuDanger"
              tone="danger"
              submitLabel="Sil"
              size="sm"
              announce={false}
              onSuccess={refocus}
            />
          </>
        ) : menu.save === "save" ? (
          <ActionModal
            action={save}
            title="Görünümü kaydet"
            description="Sekme, süzgeçler ve sıralama bu tarayıcıda, senin hesabına kaydedilir. Arama metni, tarihler ve sayfa kaydedilmez."
            trigger="Bu görünümü kaydet"
            triggerVariant="menu"
            submitLabel="Kaydet"
            size="sm"
            announce={false}
            onSuccess={refocus}
          >
            <Field label="Görünümün adı">
              <TextInput
                name="name"
                required
                maxLength={SAVED_VIEW_NAME_MAX}
                autoComplete="off"
                placeholder="Örn. Masa siparişleri"
              />
            </Field>
          </ActionModal>
        ) : (
          <ActionMenuButton
            disabledReason={
              menu.save === "full"
                ? `En fazla ${SAVED_VIEWS_MAX} görünüm. Yenisi için birini sil.`
                : "Önce bir sekme, süzgeç ya da sıralama seç."
            }
          >
            Bu görünümü kaydet
          </ActionMenuButton>
        )}
      </ActionMenu>
    </div>
  );
}
