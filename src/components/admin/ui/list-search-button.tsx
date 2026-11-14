"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { listSearchAction } from "@/app/admin/liste-arama/actions";
import Link from "@/components/link";
import {
  LIST_SEARCH_FIELDS,
  listSearchFor,
  type ListSearchIntent,
  type ListSearchTerms,
} from "@/lib/admin/list-search-core";

/** Any URL base will do: only the path and the query of `href` are read. */
const BASE = "http://panel.invalid";

/** The form's hidden fields for a list address and what to do there. */
export function listSearchHiddenFields(
  href: string,
  {
    intent = "apply",
    terms = {},
    clear,
  }: {
    intent?: ListSearchIntent;
    terms?: ListSearchTerms;
    clear?: string;
  } = {},
): Array<[string, string]> {
  const url = new URL(href, BASE);
  const list = listSearchFor(url.pathname);
  const boxes = new Set(list.params.map((p) => p.name));
  const out: Array<[string, string]> = [
    [LIST_SEARCH_FIELDS.path, url.pathname],
    [LIST_SEARCH_FIELDS.intent, intent],
  ];
  if (clear) out.push([LIST_SEARCH_FIELDS.clear, clear]);
  // The address part; a search box in it would be the very leak this
  // replaces, so it is dropped rather than carried.
  for (const [key, value] of url.searchParams) {
    if (!boxes.has(key)) out.push([key, value]);
  }
  for (const [key, value] of Object.entries(terms)) {
    if (boxes.has(key) && value) out.push([key, value]);
  }
  return out;
}

function Submit({
  className,
  ariaLabel,
  children,
}: {
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      aria-label={ariaLabel}
      aria-disabled={pending || undefined}
      onClick={(e) => {
        // One post at a time: a second click while the list loads is dropped.
        if (pending) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/**
 * A link to a list that carries a search, as a button: "Siparişleri" from a
 * customer, an audit record's "Geçmişi", an empty list's "Filtreleri
 * temizle". The text travels in the post's body to listSearchAction, which
 * keeps it in the list's cookie and redirects to `href`; a link with the
 * text in `?q=` put a customer's e-mail into the address, the history and
 * the request log. Works without JavaScript (a plain POST, then a 303).
 *
 * @example
 * <ListSearchButton href="/admin/siparisler" terms={{ q: email }} className={BUTTON.ghost}>Tümünü gör</ListSearchButton>
 * <ListSearchButton href="/admin/siparisler?durum=paid" intent="reset" className={BUTTON.ghost}>Filtreleri temizle</ListSearchButton>
 */
export function ListSearchButton({
  href,
  terms,
  intent,
  clear,
  className,
  ariaLabel,
  children,
}: {
  /** The list and its address params (tab, dropdowns); never the text. */
  href: string;
  /** The search to open the list with (`apply`). */
  terms?: ListSearchTerms;
  /** Default `apply`; `reset` forgets the search, `clear` one box of it. */
  intent?: ListSearchIntent;
  /** With `clear`: which box. */
  clear?: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const fields = listSearchHiddenFields(href, { intent, terms, clear });
  return (
    // `contents`: the button sits in its row (a menu, a chip, a toolbar)
    // as if there were no form around it.
    <form action={listSearchAction} className="contents">
      {fields.map(([name, value], i) => (
        <input key={`${name}-${i}`} type="hidden" name={name} value={value} />
      ))}
      <Submit className={className} ariaLabel={ariaLabel}>
        {children}
      </Submit>
    </form>
  );
}

/** An empty list's way out ("Filtreleri temizle", "+ Yeni ürün"). */
export interface EmptyListAction {
  href: string;
  label: string;
  /**
   * The list's search goes as well: the text is not in `href`, so a plain
   * link would land on a list still filtered by it, as empty as before.
   */
  clearsSearch?: boolean;
}

/** EmptyListAction drawn: a link, or a ListSearchButton that resets. */
export function EmptyListActionLink({
  action,
  className,
}: {
  action: EmptyListAction;
  className?: string;
}) {
  if (action.clearsSearch) {
    return (
      <ListSearchButton href={action.href} intent="reset" className={className}>
        {action.label}
      </ListSearchButton>
    );
  }
  return (
    <Link href={action.href} className={className}>
      {action.label}
    </Link>
  );
}
