"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, type FormEvent } from "react";

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

import { BUTTON, EYEBROW, MONO_STYLE } from "./styles";

const INPUT =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3.5 py-2.5 text-base text-[var(--admin-text)] outline-none transition-[border-color,background-color,box-shadow] placeholder:text-[var(--admin-text-mute)]/70 focus:border-[var(--admin-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--admin-accent)]/25 sm:text-sm";

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

/**
 * The list's filter row: a GET form (search box, dropdowns, date range)
 * with "Uygula" and "Sıfırla", and a chip per active filter with its own ×.
 *
 * - The URL is the state: params the bar does not own (the tab, the sort)
 *   ride along as hidden inputs, the page param is dropped.
 * - With JavaScript, empty fields are left out of the URL and the move is a
 *   client navigation; without it, it is a plain GET form.
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
  const values = given ?? parseFilters(searchParams, fields);
  const owned = new Set([...filterParamNames(fields), pageParam]);
  const kept = [...toSearchParams(searchParams)].filter(([k]) => !owned.has(k));
  const chips = filterChips(fields, values, searchParams, pathname, pageParam);
  const resetHref = withParams(
    searchParams,
    Object.fromEntries([...owned].map((k) => [k, null])),
    pathname,
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
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="mb-4">
      <form
        // Remount on a URL change (a chip removed, a tab clicked): the inputs
        // are uncontrolled and would otherwise keep showing the old values.
        key={JSON.stringify(values)}
        role="search"
        aria-label={label}
        method="get"
        action={pathname}
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
      >
        {kept.map(([key, value], i) => (
          <input key={`${key}-${i}`} type="hidden" name={key} value={value} />
        ))}

        {fields.map((field) => {
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
                  className={INPUT}
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
                  className={INPUT}
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
              key={`${field.from}|${field.to}`}
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
                  className={cx(INPUT, "min-w-0")}
                />
                <span
                  aria-hidden="true"
                  className="text-[var(--admin-text-soft)]"
                >
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
                  className={cx(INPUT, "min-w-0")}
                />
              </div>
            </fieldset>
          );
        })}

        <div className="flex flex-[1_0_auto] flex-wrap items-center justify-end gap-2">
          {chips.length > 0 ? (
            <Link href={resetHref} className={BUTTON.ghost}>
              Sıfırla
            </Link>
          ) : null}
          <button type="submit" className={BUTTON.primary}>
            Uygula
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
