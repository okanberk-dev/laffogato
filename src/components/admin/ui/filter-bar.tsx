"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useTransition, type FormEvent } from "react";

import { cx } from "@/components/laffogato/cx";

import {
  DEFAULT_PAGE_PARAM,
  filterChips,
  filterParamNames,
  parseFilters,
  toSearchParams,
  withParams,
  type FilterField,
  type FilterValues,
} from "@/lib/admin/list-params";

import { FIELD_INPUT } from "../forms";
import { BUTTON, EYEBROW, MONO_STYLE } from "./styles";

export interface FilterBarProps {
  fields: readonly FilterField[];
  /** The page's (awaited) searchParams: a plain object. */
  searchParams: Record<string, string | string[] | undefined>;
  /** The list's path; the form's GET target and the chips' base. */
  pathname: string;
  /** What the page parsed (parseFilters); parsed here when omitted. */
  values?: FilterValues;
  /** Dropped on apply / reset / chip removal; default "sayfa". */
  pageParam?: string;
  /** Accessible name of the search landmark; default "Filtreler". */
  label?: string;
}

/** A field's chip key (filterChips): the name, or "from|to" for a range. */
const fieldKey = (field: FilterField) =>
  field.type === "date-range" ? `${field.from}|${field.to}` : field.name;

/**
 * How the bar splits on a phone: the first search box stays in view and
 * everything else folds behind "Filtreler (n)", n being how many of the
 * folded filters are set. Pure, exported for tests.
 */
export function splitFilterFields(
  fields: readonly FilterField[],
  activeKeys: Iterable<string>,
): { lead: FilterField | null; folded: FilterField[]; foldedActive: number } {
  const lead = fields.find((f) => f.type === "search") ?? null;
  const folded = fields.filter((f) => f !== lead);
  const keys = new Set(folded.map(fieldKey));
  let foldedActive = 0;
  for (const key of activeKeys) if (keys.has(key)) foldedActive += 1;
  return { lead, folded, foldedActive };
}

/** The summary's text: "Filtreler", or "Filtreler (2)" with two set. */
export function foldedFiltersLabel(active: number): string {
  return active > 0 ? `Filtreler (${active})` : "Filtreler";
}

// The folded group is always open from md up: CSS shows a closed
// <details>' content there (::details-content), and this opens it as well
// for a browser without that pseudo-element.
const openFromMd = (el: HTMLDetailsElement | null) => {
  if (el && window.matchMedia("(min-width: 48rem)").matches) el.open = true;
};

/**
 * The list's filter row: a GET form (search box, dropdowns, date range)
 * with "Uygula" and "Sıfırla", and a chip per active filter with its own ×.
 *
 * - The URL is the state: params the bar does not own (the tab, the sort)
 *   ride along as hidden inputs, the page param is dropped.
 * - With JavaScript, empty fields are left out of the URL and the move is a
 *   client navigation ("Uygula" says "Uygulanıyor…" until the list is in);
 *   without it, it is a plain GET form.
 * - Below md the dropdowns and dates fold behind "Filtreler (n)" (a
 *   <details>, so it works without JavaScript too), open when one of them
 *   is set: on a phone the orders list started 1.3 screens down, under an
 *   always-open 658 px form (admin audit SHE-07, ORD-08, KAR-10).
 * - Use the same `fields` with parseFilters() on the page, so the query the
 *   page runs and the chips the bar shows can never disagree.
 *
 * @example
 * const FIELDS: FilterField[] = [
 *   { type: "search", name: "q", label: "Ara", placeholder: "No, ad, e-posta" },
 *   { type: "select", name: "kanal", label: "Kanal", options: [{ value: "web", label: "Web" }, { value: "app", label: "Uygulama" }] },
 *   { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
 * ];
 * <FilterBar fields={FIELDS} searchParams={sp} pathname="/admin/siparisler" />
 */
export function FilterBar({
  fields,
  searchParams,
  pathname,
  values: given,
  pageParam = DEFAULT_PAGE_PARAM,
  label = "Filtreler",
}: FilterBarProps) {
  const router = useRouter();
  const baseId = useId();
  const [pending, startTransition] = useTransition();
  const values = given ?? parseFilters(searchParams, fields);
  const owned = new Set([...filterParamNames(fields), pageParam]);
  const kept = [...toSearchParams(searchParams)].filter(([k]) => !owned.has(k));
  const chips = filterChips(fields, values, searchParams, pathname, pageParam);
  const resetHref = withParams(
    searchParams,
    Object.fromEntries([...owned].map((k) => [k, null])),
    pathname,
  );
  const { lead, folded, foldedActive } = splitFilterFields(
    fields,
    chips.map((c) => c.key),
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget)) {
      if (typeof value === "string" && value.trim() !== "") {
        next.append(key, value.trim());
      }
    }
    const query = next.toString();
    // In a transition, so `pending` holds until the filtered list is on
    // screen: the old list used to stay with no sign of the click.
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  const renderField = (field: FilterField) => {
    if (field.type === "search") {
      const id = `${baseId}-${field.name}`;
      return (
        <div
          key={field.name}
          className="flex min-w-[12rem] flex-[2_1_16rem] flex-col gap-2"
        >
          <label htmlFor={id} className={EYEBROW} style={MONO_STYLE}>
            {field.label}
          </label>
          <input
            id={id}
            type="search"
            name={field.name}
            defaultValue={values[field.name] ?? ""}
            placeholder={field.placeholder}
            maxLength={field.maxLength ?? 100}
            enterKeyHint="search"
            className={FIELD_INPUT}
          />
        </div>
      );
    }
    if (field.type === "select") {
      const id = `${baseId}-${field.name}`;
      return (
        <div
          key={field.name}
          className="flex min-w-[9rem] flex-[1_1_10rem] flex-col gap-2"
        >
          <label htmlFor={id} className={EYEBROW} style={MONO_STYLE}>
            {field.label}
          </label>
          <select
            id={id}
            name={field.name}
            defaultValue={values[field.name] ?? ""}
            className={FIELD_INPUT}
          >
            <option value="">{field.allLabel ?? "Tümü"}</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    const fromId = `${baseId}-${field.from}`;
    const toId = `${baseId}-${field.to}`;
    return (
      <fieldset
        key={fieldKey(field)}
        className="flex min-w-[16rem] flex-[2_1_18rem] flex-col gap-2"
      >
        <legend className={cx(EYEBROW, "mb-2")} style={MONO_STYLE}>
          {field.label}
        </legend>
        <div className="flex items-center gap-2">
          <label htmlFor={fromId} className="sr-only">
            {field.label}: başlangıç
          </label>
          <input
            id={fromId}
            type="date"
            name={field.from}
            defaultValue={values[field.from] ?? ""}
            className={cx(FIELD_INPUT, "min-w-0")}
          />
          <span aria-hidden="true" className="text-[var(--admin-text-soft)]">
            -
          </span>
          <label htmlFor={toId} className="sr-only">
            {field.label}: bitiş
          </label>
          <input
            id={toId}
            type="date"
            name={field.to}
            defaultValue={values[field.to] ?? ""}
            className={cx(FIELD_INPUT, "min-w-0")}
          />
        </div>
      </fieldset>
    );
  };

  return (
    <div className="mb-4">
      <form
        // Remount on a URL change (a chip removed, a tab clicked): the inputs
        // are uncontrolled and would otherwise keep showing the old values.
        key={JSON.stringify(values)}
        role="search"
        aria-label={label}
        aria-busy={pending || undefined}
        method="get"
        action={pathname}
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
      >
        {kept.map(([key, value], i) => (
          <input key={`${key}-${i}`} type="hidden" name={key} value={value} />
        ))}

        {lead ? renderField(lead) : null}

        {folded.length > 0 ? (
          <details
            ref={openFromMd}
            open={foldedActive > 0}
            className="group min-w-0 flex-[1_1_10rem] open:basis-full md:contents md:details-content:contents"
          >
            <summary
              className={cx(
                BUTTON.ghost,
                "w-full cursor-pointer list-none md:hidden [&::-webkit-details-marker]:hidden",
              )}
            >
              {foldedFiltersLabel(foldedActive)}
              <span
                aria-hidden="true"
                className="mb-0.5 inline-block h-2 w-2 rotate-45 border-r-2 border-b-2 border-current transition-transform group-open:mt-1 group-open:mb-0 group-open:-rotate-135"
              />
            </summary>
            <div className="mt-3 flex flex-wrap items-end gap-3 md:contents">
              {folded.map(renderField)}
            </div>
          </details>
        ) : null}

        <div className="flex flex-[1_0_auto] flex-wrap items-center justify-end gap-2">
          {chips.length > 0 ? (
            <Link href={resetHref} className={BUTTON.ghost}>
              Sıfırla
            </Link>
          ) : null}
          <button type="submit" className={BUTTON.primary}>
            {pending ? "Uygulanıyor…" : "Uygula"}
          </button>
        </div>
      </form>

      {chips.length > 0 ? (
        <ul aria-label="Etkin filtreler" className="mt-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 pr-1 pl-3 text-xs text-[var(--admin-text-soft)]"
            >
              <span>
                {chip.label}:{" "}
                <strong className="font-medium text-[var(--admin-text)]">
                  {chip.value}
                </strong>
              </span>
              <Link
                href={chip.removeHref}
                aria-label={`Filtreyi kaldır: ${chip.label} ${chip.value}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none"
              >
                <span aria-hidden="true">×</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
