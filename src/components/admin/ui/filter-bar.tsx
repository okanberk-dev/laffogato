"use client";

import dynamic from "next/dynamic";
import { useActionState, useId, useRef, useState, type ReactNode } from "react";

import { listSearchAction } from "@/app/admin/liste-arama/actions";
import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";
import { activeDatePreset, datePresets } from "@/lib/admin/date-presets";
import {
  DEFAULT_PAGE_PARAM,
  filterChips,
  filterParamNames,
  parseFilters,
  toSearchParams,
  withParams,
  type DateRangeFilterField,
  type FilterField,
  type FilterValues,
} from "@/lib/admin/list-params";
import {
  LIST_SEARCH_FIELDS,
  listSearchFor,
  withoutListSearch,
} from "@/lib/admin/list-search-core";

import { FIELD_INPUT, TOOLBAR_FIELD } from "../forms";
import { LinkPending } from "./link-pending";
import { openFromMd } from "./open-from-md";
import { ListSearchButton } from "./list-search-button";
import {
  SavedViewsBoundary,
  useSavedViewsKey,
  useTouchedSince,
} from "./saved-views-key";
import { BUTTON, EYEBROW, MONO_STYLE } from "./styles";
import { useNoResetSubmit } from "./submit";
import {
  armWidget,
  createWidgetLoader,
  DATE_WIDGETS_ENABLED,
  rangeFromValues,
  snapshotRange,
  type RangeSnapshot,
} from "./widget-loader";

export interface FilterBarProps {
  fields: readonly FilterField[];
  /**
   * The page's address params (listSearchView's `url`): the tab and the
   * sort ride along, the chips are built from them. A search text in them
   * is ignored.
   */
  searchParams: Record<string, string | string[] | undefined>;
  /** The list's path (one of LIST_SEARCHES); the chips' base. */
  pathname: string;
  /**
   * What the page parsed from listSearchView's `view` (parseFilters), so
   * the box shows the remembered text; parsed from `searchParams` (no
   * text) when omitted.
   */
  values?: FilterValues;
  /** Dropped on apply / reset / chip removal; default "sayfa". */
  pageParam?: string;
  /** Accessible name of the search landmark; default "Filtreler". */
  label?: string;
  /**
   * Saved views (admin UI v2, UI-11): a "Görünümler" menu at the end of
   * the chips' row, for this list (`key`: short lower-case ASCII, one per
   * list, e.g. "orders"). Kept in this browser per signed-in account and
   * drawn only once the page is in the browser, so the bar's markup
   * without JavaScript, and before hydration, is the same as without it.
   * `tabParam`: the list's StatusTabs param when it is not the default
   * `durum`, so a view keeps the tab. `hold`: the page shows a record over
   * the list (a quick look, `?gor=`) whose param the bar never sees; the
   * default view would replace the address and close it.
   */
  views?: { key: string; tabParam?: string; hold?: boolean };
  /**
   * The list's own controls for the row under the bar (the orders' sound
   * switch): drawn at its end, before "Görünümler", so a list has one row
   * of controls there rather than a row each.
   */
  toolbar?: ReactNode;
}

// The saved views menu (UI-11): its own chunk, asked for only once a list
// with `views` is in the browser. Never drawn on the server either way.
const SavedViews = dynamic(
  () => import("./saved-views").then((m) => m.SavedViews),
  { ssr: false },
);

// The date range widget (UI-14): React Aria's calendar and segmented dates,
// a chunk of its own that nothing asks for until a fine pointer reaches a
// date field or focus lands in it (widget-loader.ts). Plain import(), not
// next/dynamic: a loaded chunk must swap in at once, without the Suspense
// hold that would let the native boxes lose their focus first.
type DateRangeWidget = (typeof import("./date-range-field"))["DateRangeField"];

const dateRangeLoader = createWidgetLoader<DateRangeWidget>(() =>
  DATE_WIDGETS_ENABLED
    ? import("./date-range-field").then((m) => m.DateRangeField)
    : Promise.resolve(null),
);

/** One preset link: its label, where it goes, whether it is the range now. */
interface PresetLink {
  id: string;
  label: string;
  href: string;
  active: boolean;
}

const PRESET_LINK =
  "relative inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/45 focus-visible:outline-none pointer-coarse:min-h-11";
const PRESET_IDLE =
  "border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]";
const PRESET_ACTIVE =
  "border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]";

type RangeSwap = RangeSnapshot & { Widget: DateRangeWidget };

/**
 * A date range: the two native `<input type="date">` boxes (what the server
 * draws, what works without JavaScript and what a phone keeps), then the
 * preset links under them. On a fine pointer the boxes give way to the
 * React Aria widget once the pointer or focus reaches the field and its
 * chunk is in, with the dates they hold and the focus they had.
 *
 * The links come after the boxes (21 Oct 2026): above them they made the
 * date column three rows tall, and the search and select boxes beside it,
 * aligned to its bottom, floated under an empty band. Now every box sits
 * on the row's first line and the links hang under the dates like help.
 */
function DateRangeFieldset({
  field,
  baseId,
  values,
  presets,
}: {
  field: DateRangeFilterField;
  baseId: string;
  values: FilterValues;
  presets: readonly PresetLink[];
}) {
  const fromId = `${baseId}-${field.from}`;
  const toId = `${baseId}-${field.to}`;
  const fromBox = useRef<HTMLInputElement>(null);
  const toBox = useRef<HTMLInputElement>(null);
  // A chunk an earlier visit to a list already asked for draws at once (this
  // form was rebuilt after a filter was applied); the server's draw and a
  // freshly loaded page's first one never find one.
  const [swapped, setSwapped] = useState<RangeSwap | null>(() => {
    const Widget = dateRangeLoader.peek();
    const held = Widget
      ? rangeFromValues(values[field.from], values[field.to])
      : null;
    return Widget && held ? { Widget, ...held } : null;
  });

  const arm = () => {
    if (swapped) return;
    armWidget(dateRangeLoader, (Widget) => {
      const held = snapshotRange(
        fromBox.current,
        toBox.current,
        document.activeElement,
      );
      if (held) setSwapped((cur) => cur ?? { Widget, ...held });
    });
  };

  const Widget = swapped?.Widget;
  return (
    // Capped: on a row of its own (Olay kaydı) the two dates stretched to
    // 300 px each.
    <fieldset className="flex max-w-[34rem] min-w-[16rem] flex-[2_1_18rem] flex-col gap-2">
      <legend className={cx(EYEBROW, "mb-2")} style={MONO_STYLE}>
        {field.label}
      </legend>
      {swapped && Widget ? (
        <Widget
          label={field.label}
          fromName={field.from}
          toName={field.to}
          defaultFrom={swapped.from}
          defaultTo={swapped.to}
          focus={swapped.focus}
        />
      ) : (
        // Armed by the date boxes only: a preset link is a plain link and
        // never asks for the widget's chunk.
        <div
          className="flex items-center gap-2"
          onPointerEnter={arm}
          onFocus={arm}
        >
          <label htmlFor={fromId} className="sr-only">
            {field.label}: başlangıç
          </label>
          <input
            ref={fromBox}
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
            ref={toBox}
            id={toId}
            type="date"
            name={field.to}
            defaultValue={values[field.to] ?? ""}
            className={cx(FIELD_INPUT, "min-w-0")}
          />
        </div>
      )}
      <ul
        aria-label={`${field.label}: hazır aralıklar`}
        className="flex flex-wrap gap-1.5"
      >
        {presets.map((p) => (
          <li key={p.id}>
            {/* The clock decides the links; the server's reading stands. */}
            <Link
              href={p.href}
              prefetch={false}
              aria-current={p.active ? "true" : undefined}
              suppressHydrationWarning
              className={cx(
                PRESET_LINK,
                p.active ? PRESET_ACTIVE : PRESET_IDLE,
              )}
            >
              {p.label}
              <LinkPending className="bottom-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** A chip's × (a link, or a button for a search text). */
const CHIP_REMOVE =
  "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none";

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

/**
 * Whether the fields beside the search box stay in the toolbar's row: one
 * or two dropdowns do (the product list's "Kategori"); more, a date range
 * or a second search box fold behind "Filtreler". Pure, exported for tests.
 */
export function foldsInline(folded: readonly FilterField[]): boolean {
  return (
    folded.length > 0 &&
    folded.length <= 2 &&
    folded.every((f) => f.type === "select")
  );
}

/**
 * A toolbar dropdown's "all" choice: a name of its own ("Tüm kategoriler")
 * as it is, a bare "Tümü" with the field's name before it ("Durum: tümü").
 */
export function compactAllLabel(field: {
  label: string;
  allLabel?: string;
}): string {
  const all = field.allLabel ?? "Tümü";
  return /\s/.test(all.trim())
    ? all
    : `${field.label}: ${all.toLocaleLowerCase("tr-TR")}`;
}

/** The search box's magnifier (inline: this chunk loads no icon set). */
function SearchGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className="pointer-events-none absolute left-4 size-4 text-[var(--admin-text-mute)]"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** "Filtreler"'s three narrowing lines. */
function FilterGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className="size-4 shrink-0 text-[var(--admin-text-soft)]"
    >
      <path d="M3 6h18M7 12h10M10 18h4" />
    </svg>
  );
}

// The folded group is always open from md up (open-from-md.ts); exported
// from here too for the tests that read it with the bar.
export { openFromMd };

/** listSearchAction as a useActionState step: the post with JavaScript. */
async function postListSearch(_prev: null, formData: FormData): Promise<null> {
  await listSearchAction(formData);
  return null;
}

/**
 * The list's filter row: a form (search box, dropdowns, date range) with
 * "Uygula" and "Sıfırla", and a chip per active filter with its own ×.
 *
 * - It POSTS, to listSearchAction (lib/admin/list-search-core.ts): the
 *   search box's text is kept in the list's own short-lived cookie and
 *   never reaches an address; the rest (dropdowns, dates, and the params
 *   the bar does not own, the tab and the sort, riding along as hidden
 *   inputs) is the address the action redirects to, without the page
 *   param. A typed e-mail or phone used to sit in `?q=`: the address bar,
 *   the history, a proxy and the request log.
 * - With JavaScript the post is sent by hand ("Uygula" says "Uygulanıyor…"
 *   until the list is in, a second press meanwhile is dropped); without it,
 *   the browser posts the form and follows the 303.
 * - "Sıfırla" and a search chip's × post too (they forget the text); the
 *   other chips are links.
 * - The path must be a list in LIST_SEARCHES, and every search field one
 *   of its boxes: listSearchFor throws otherwise, so a new search box
 *   cannot quietly put its text back into the address.
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
  views,
  toolbar,
}: FilterBarProps) {
  const list = listSearchFor(pathname, fields);
  // Null before the page is in the browser, and without `views`.
  const viewsKey = useSavedViewsKey(views?.key);
  // A press, key or form sent since then: the menu's default stays away.
  const touched = useTouchedSince(viewsKey !== null);
  const baseId = useId();
  const resetId = `${baseId}-reset`;
  // The post runs as an action, so `pending` holds until the filtered list
  // is on screen: the old list used to stay with no sign of the click.
  const [, dispatch, pending] = useActionState(postListSearch, null);
  const onSubmit = useNoResetSubmit(dispatch, pending);
  // Built from the address alone: no link or hidden field below can carry
  // a search text, whatever the page passed.
  const address = withoutListSearch(searchParams, list);
  const values = given ?? parseFilters(address, fields);
  const owned = new Set([...filterParamNames(fields), pageParam]);
  const kept = [...toSearchParams(address)].filter(([k]) => !owned.has(k));
  const chips = filterChips(fields, values, address, pathname, pageParam);
  const boxes = new Set(list.params.map((p) => p.name));
  // Only a bar with a date range needs the clock.
  const presets = fields.some((f) => f.type === "date-range")
    ? datePresets()
    : [];
  const { lead, folded, foldedActive } = splitFilterFields(
    fields,
    chips.map((c) => c.key),
  );
  // One or two dropdowns stay in the row; more, or a date range, fold.
  const inline = foldsInline(folded);
  const listField = (
    <input type="hidden" name={LIST_SEARCH_FIELDS.path} value={pathname} />
  );

  const renderField = (field: FilterField, compact = false) => {
    if (field.type === "search" && field === lead) {
      const id = `${baseId}-${field.name}`;
      // The toolbar's own box: a magnifier in place of the label above it
      // (the label is still there, for a screen reader), as wide as the row
      // allows.
      return (
        <div
          key={field.name}
          className="relative flex min-w-0 basis-full items-center sm:max-w-2xl sm:flex-[1_1_18rem] sm:basis-auto"
        >
          <label htmlFor={id} className="sr-only">
            {field.label}
          </label>
          <SearchGlyph />
          <input
            id={id}
            type="search"
            name={field.name}
            defaultValue={values[field.name] ?? ""}
            placeholder={field.placeholder}
            maxLength={field.maxLength ?? 100}
            enterKeyHint="search"
            // The `/` shortcut's box (shortcuts.tsx): the bar's lead search only.
            data-admin-search=""
            // shortcuts.tsx writes aria-keyshortcuts="/" on it once the shell
            // has hydrated, which can be before this page has.
            suppressHydrationWarning
            className={cx(TOOLBAR_FIELD, "pl-10")}
          />
        </div>
      );
    }
    if (field.type === "select" && compact) {
      const id = `${baseId}-${field.name}`;
      // A dropdown in the toolbar's row: its name inside each choice
      // ("Kategori: Kiler"), so the closed box says what it filters.
      return (
        <div key={field.name} className="flex min-w-0 flex-[0_1_auto]">
          <label htmlFor={id} className="sr-only">
            {field.label}
          </label>
          <select
            id={id}
            name={field.name}
            defaultValue={values[field.name] ?? ""}
            className={cx(FIELD_INPUT, "w-auto max-w-full")}
          >
            <option value="">{compactAllLabel(field)}</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {field.label}: {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
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
    return (
      <DateRangeFieldset
        key={fieldKey(field)}
        field={field}
        baseId={baseId}
        values={values}
        presets={presets.map((p) => ({
          id: p.id,
          label: p.label,
          href: withParams(
            address,
            { [field.from]: p.from, [field.to]: p.to, [pageParam]: null },
            pathname,
          ),
          active:
            activeDatePreset(presets, values[field.from], values[field.to]) ===
            p.id,
        }))}
      />
    );
  };

  const chipList = (className: string) => (
    <ul aria-label="Etkin filtreler" className={className}>
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
          {boxes.has(chip.key) ? (
            // The text is not in the address: removing it is a post.
            <ListSearchButton
              href={chip.removeHref}
              intent="clear"
              clear={chip.key}
              ariaLabel={`Filtreyi kaldır: ${chip.label} ${chip.value}`}
              className={CHIP_REMOVE}
            >
              <span aria-hidden="true">×</span>
            </ListSearchButton>
          ) : (
            <Link
              href={chip.removeHref}
              aria-label={`Filtreyi kaldır: ${chip.label} ${chip.value}`}
              className={CHIP_REMOVE}
            >
              <span aria-hidden="true">×</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mb-4">
      {/* Innex's toolbar (22 Eki 2026): one row in a white card, the search
          box, "Filtreler" and "Uygula", the list's own controls and
          "Görünümler" at its end; the other filters open under it as a row
          of their own. The form is `contents`, so its boxes and the
          controls outside it (a form inside a form is not allowed, and the
          form remounts on every address change) share the card's row; the
          card carries the search landmark. */}
      <div
        role="search"
        aria-label={label}
        aria-busy={pending || undefined}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-surface)] p-2"
      >
        <form
          // Remount on a URL change (a chip removed, a tab clicked): the inputs
          // are uncontrolled and would otherwise keep showing the old values.
          key={JSON.stringify(values)}
          action={listSearchAction}
          onSubmit={onSubmit}
          className="contents"
        >
          {listField}
          {kept.map(([key, value], i) => (
            <input key={`${key}-${i}`} type="hidden" name={key} value={value} />
          ))}

          {lead ? renderField(lead) : null}

          {inline ? folded.map((f) => renderField(f, true)) : null}

          {!inline && folded.length > 0 ? (
            // `contents`: the summary sits in the row as a button and the
            // fields open as a full-width row under it (order-2), whatever
            // the width. A closed group's fields are hidden by their own
            // class, so the ::details-content box can be `contents` too.
            <details
              open={foldedActive > 0}
              className="group contents details-content:contents"
            >
              <summary
                className={cx(
                  BUTTON.ghost,
                  "cursor-pointer list-none select-none group-open:bg-[var(--admin-surface-2)] [&::-webkit-details-marker]:hidden",
                )}
              >
                <FilterGlyph />
                {foldedFiltersLabel(foldedActive)}
                <span
                  aria-hidden="true"
                  className="mb-0.5 ml-0.5 inline-block size-1.5 rotate-45 border-r-[1.5px] border-b-[1.5px] border-current transition-transform group-open:mt-1 group-open:mb-0 group-open:-rotate-135"
                />
              </summary>
              <div className="order-2 hidden basis-full flex-wrap items-start gap-3 border-t border-[var(--admin-divider)] px-2 pt-3 pb-1 group-open:flex">
                {folded.map((f) => renderField(f))}
              </div>
            </details>
          ) : null}

          {/* After the fields when they are open, beside the search box when
            they are not: the order a keyboard reaches them in, top to
            bottom. */}
          <div className="order-1 flex flex-wrap items-center justify-end gap-2 [:has(>details[open])>&]:order-3 [:has(>details[open])>&]:ml-auto">
            {chips.length > 0 ? (
              // Submits the reset form below, not this one: Enter in the box
              // presses the form's first own submit button, "Uygula".
              <button type="submit" form={resetId} className={BUTTON.ghost}>
                Sıfırla
              </button>
            ) : null}
            <button type="submit" className={BUTTON.primary}>
              {pending ? "Uygulanıyor…" : "Uygula"}
            </button>
          </div>
        </form>
        {toolbar || viewsKey ? (
          // With the fields open, after "Uygula" on the last row, as they
          // come in the page: a keyboard no longer jumps from "Uygula" back
          // up to the first row (review of #231).
          <div className="order-1 ml-auto flex flex-wrap items-center justify-end gap-2 [:has(>form>details[open])>&]:order-4 [:has(>form>details[open])>&]:ml-0">
            {toolbar}
            {viewsKey ? (
              // A menu that cannot load is not drawn; the list stays.
              <SavedViewsBoundary>
                <SavedViews
                  storageKey={viewsKey}
                  pathname={pathname}
                  address={address}
                  fields={fields}
                  values={values}
                  pageParam={pageParam}
                  tabParam={views?.tabParam}
                  hold={views?.hold}
                  touched={touched}
                />
              </SavedViewsBoundary>
            ) : null}
          </div>
        ) : null}
      </div>

      {chips.length > 0 ? (
        // "Sıfırla": the list with the tab and the sort, without the bar's
        // filters and without the search.
        <form id={resetId} hidden action={listSearchAction} onSubmit={onSubmit}>
          {listField}
          <input type="hidden" name={LIST_SEARCH_FIELDS.intent} value="reset" />
          {kept.map(([key, value], i) => (
            <input key={`${key}-${i}`} type="hidden" name={key} value={value} />
          ))}
        </form>
      ) : null}

      {chips.length > 0 ? chipList("mt-2 flex flex-wrap gap-2") : null}
    </div>
  );
}
