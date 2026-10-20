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
  savedViewsStorageKey,
  setDefaultView,
  viewQuery,
  viewsMenu,
  type ViewRules,
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
  pageAccountKey,
  readViews,
  subscribeViews,
  writeViews,
} from "./saved-views-store";
import { BUTTON } from "./styles";
import { useToast } from "./toast";

// A list's saved views (admin UI v2, UI-11, design §5 #11): the
// "Görünümler" menu the FilterBar draws at the end of its chips' row. The
// rules are in lib/admin/saved-views.ts, the storage in saved-views-store.ts.
// Nothing here exists before the page is in the browser: the server cannot
// read localStorage, and the bar's markup without JavaScript stays as it was.

const noSubscribe = () => () => {};

const NOT_KEPT =
  "Kaydedilemedi: bu tarayıcı site verisi tutmuyor (gizli pencere ya da kapalı site verisi).";

/**
 * Where this list's views live for the signed-in account, once the page is
 * in the browser; null before (the server's render and hydration), without
 * `listKey`, and without an account key. The FilterBar draws the menu, and
 * the row it sits in, only when this is set.
 */
export function useSavedViewsKey(listKey: string | undefined): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => (listKey ? savedViewsStorageKey(pageAccountKey(), listKey) : null),
    () => null,
  );
}

export interface SavedViewsProps {
  /** useSavedViewsKey's answer. */
  storageKey: string;
  /** The list's path (the FilterBar's). */
  pathname: string;
  /** The address without the typed search (the FilterBar's). */
  address: Record<string, string | string[] | undefined>;
  fields: readonly FilterField[];
  /** What the list shows, the remembered search included. */
  values: FilterValues;
  pageParam: string;
  className?: string;
}

/**
 * The "Görünümler" menu: the saved views (each opens the list as saved,
 * without the search), and for the view on screen "Bu görünümü kaydet", or
 * "Varsayılan yap" and "Görünümü sil" when it is one of them. The default
 * view is opened once per visit, when the list is opened bare.
 */
export function SavedViews({
  storageKey,
  pathname,
  address,
  fields,
  values,
  pageParam,
  className,
}: SavedViewsProps) {
  const router = useRouter();
  const toast = useToast();
  const raw = useSyncExternalStore(
    subscribeViews,
    () => readViews(storageKey),
    () => "",
  );
  const rules: ViewRules = {
    searchNames: fields.flatMap((f) => (f.type === "search" ? [f.name] : [])),
    pageParam,
  };
  const state = parseSavedViews(raw, rules);
  const current = viewQuery(address, rules);
  const menu = viewsMenu(state, pathname, current);
  const { here } = menu;
  const searchActive = fields.some(
    (f) => f.type === "search" && Boolean(values[f.name]),
  );

  // The default, once per visit: this runs when the bar mounts, and the
  // bar stays mounted while the list's own links ("Tümü", "Sıfırla", a
  // chip's ×) change the address, so those still reach the bare list.
  const asked = useRef(false);
  const target = defaultViewHref(state, pathname, address, searchActive);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (target) router.replace(target, { scroll: false });
  }, [router, target]);

  // Every write starts from what is stored now: another tab may have
  // saved since this one drew its menu.
  const stored = () => parseSavedViews(readViews(storageKey), rules);

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
    <ActionMenu label={menu.label} showLabel className={className}>
      {menu.entries.length > 0 ? (
        <>
          <p className="px-3 pt-1.5 pb-1 text-xs text-[var(--admin-text-soft)]">
            Kayıtlı görünümler
          </p>
          {menu.entries.map((entry) => (
            // A post, as "Sıfırla": the view replaces the search too.
            <ListSearchButton
              key={entry.href}
              href={entry.href}
              intent="reset"
              className={BUTTON.menu}
              ariaLabel={entry.ariaLabel}
            >
              <span className="min-w-0 flex-1 break-words">{entry.name}</span>
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
  );
}
