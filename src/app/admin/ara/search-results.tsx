"use client";

import { startTransition, useEffect, useRef } from "react";

import {
  AdminSearchField,
  subscribeHandOff,
  takeHandedOffSearch,
  useAdminSearch,
} from "@/components/admin/admin-search";
import { useNoResetSubmit } from "@/components/admin/action-form";
import { formatDateTime, formatTRY } from "@/components/admin/forms";
import { EmptyState, Section } from "@/components/admin/ui/detail";
import { NUMERIC_STYLE } from "@/components/admin/ui/styles";
import Link from "@/components/link";
import {
  SEARCH_LIMIT,
  SEARCH_MIN_LENGTH,
  type SearchGroup,
} from "@/lib/admin/search-core";

function ResultGroup({ group }: { group: SearchGroup }) {
  const more = group.more ? (
    <Link
      href={group.listHref}
      className="inline-flex min-h-8 items-center text-sm text-[var(--admin-primary)] underline-offset-4 hover:underline"
    >
      İlk {SEARCH_LIMIT} sonuç · listeye git
    </Link>
  ) : null;
  return (
    <Section title={group.label} actions={more} flush>
      {group.hits.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[var(--admin-text-soft)] sm:px-6">
          Sonuç yok.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {group.hits.map((hit) => (
            <li key={hit.href}>
              <Link
                href={hit.href}
                className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 hover:bg-[var(--admin-surface-2)] sm:px-6 pointer-fine:min-h-9"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--admin-text)]">
                    {hit.title}
                  </span>
                  {hit.meta.length > 0 && (
                    <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                      {hit.meta.join(" · ")}
                    </span>
                  )}
                </span>
                <span className="text-right text-xs text-[var(--admin-text-soft)]">
                  {hit.amountMinor !== undefined && (
                    <span
                      className="block text-sm text-[var(--admin-text)]"
                      style={NUMERIC_STYLE}
                    >
                      {formatTRY(hit.amountMinor)}
                    </span>
                  )}
                  {hit.at && (
                    <span className="block">{formatDateTime(hit.at)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * The results page's box and answer (P2b, decision D36). The answer is the
 * search action's state: from this box (posted by hand, so the text stays
 * in it), from the top bar's box (handed over in memory), or, without
 * JavaScript, from the post the server drew this page for. The address
 * stays /admin/ara throughout.
 */
export function AdminSearchResults() {
  const [state, formAction, pending] = useAdminSearch();
  const onSubmit = useNoResetSubmit(formAction, pending);
  const inputRef = useRef<HTMLInputElement>(null);

  // The top bar's text: taken once when the page opens, and at once while
  // it is open.
  useEffect(() => {
    const run = () => {
      const text = takeHandedOffSearch();
      if (text === null) return;
      if (inputRef.current) inputRef.current.value = text;
      const formData = new FormData();
      formData.set("q", text);
      startTransition(() => formAction(formData));
    };
    run();
    return subscribeHandOff(run);
  }, [formAction]);

  const shown = state.groups?.reduce((n, g) => n + g.hits.length, 0) ?? 0;
  // One short line for a screen reader, not the whole answer read out.
  const status = pending
    ? "Aranıyor…"
    : state.tooShort
      ? `En az ${SEARCH_MIN_LENGTH} karakter yaz.`
      : state.groups
        ? shown > 0
          ? `${shown} sonuç gösteriliyor.`
          : "Sonuç yok."
        : "";
  const statusVisible = pending || state.tooShort;

  return (
    <>
      <AdminSearchField
        id="admin-search-page"
        formAction={formAction}
        onSubmit={onSubmit}
        defaultValue={state.text}
        inputRef={inputRef}
        large
        autoFocus={!state.text}
        className="mb-6 flex"
      />

      <p
        role="status"
        className={
          statusVisible ? "text-sm text-[var(--admin-text-soft)]" : "sr-only"
        }
      >
        {status}
      </p>

      {pending ? null : state.failed ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger-soft)] px-4 py-3 text-sm text-[var(--admin-danger-ink)]"
        >
          Arama şu an yapılamadı: veritabanı yanıt vermedi. Birkaç saniye sonra
          yeniden ara.
        </p>
      ) : state.groups && shown === 0 ? (
        <EmptyState
          title={`"${state.text}" için sonuç yok.`}
          description="Sipariş numarasını yalnız rakamla, e-postayı tamamıyla ya da adın bir kısmıyla dene."
        />
      ) : state.groups ? (
        <div className="grid gap-4">
          {state.groups.map((g) => (
            <ResultGroup key={g.section} group={g} />
          ))}
        </div>
      ) : null}
    </>
  );
}
