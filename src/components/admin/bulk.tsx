"use client";

import { useMemo, useReducer, type ChangeEvent, type ReactNode } from "react";

export interface Selection {
  selected: Set<string>;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  set: (ids: string[]) => void;
  clear: () => void;
  count: number;
  ids: string[];
}

export interface SelectionState {
  selected: Set<string>;
  /** The last `resetOn` value the hook has seen (see useSelection). */
  resetOn: unknown;
}

export type SelectionEvent =
  | { type: "toggle"; id: string }
  | { type: "set"; ids: readonly string[] }
  | { type: "clear" }
  | { type: "result"; resetOn: unknown };

/**
 * The selection as a pure reducer, so the "clear after a bulk action" rule
 * can be tested without a browser (tests/admin-ui-kit.test.ts).
 *
 * `result` clears only when `resetOn` is a NEW truthy value. The same value
 * seen again - the next render, the next checkbox tick - changes nothing.
 */
export function selectionReducer(
  state: SelectionState,
  event: SelectionEvent,
): SelectionState {
  switch (event.type) {
    case "toggle": {
      const next = new Set(state.selected);
      if (next.has(event.id)) next.delete(event.id);
      else next.add(event.id);
      return { ...state, selected: next };
    }
    case "set":
      return { ...state, selected: new Set(event.ids) };
    case "clear":
      return state.selected.size === 0
        ? state
        : { ...state, selected: new Set() };
    case "result":
      if (Object.is(event.resetOn, state.resetOn)) return state;
      return {
        resetOn: event.resetOn,
        selected:
          event.resetOn && state.selected.size > 0 ? new Set() : state.selected,
      };
  }
}

/**
 * Row selection for a bulk bar.
 *
 * `resetOn`: pass the success half of the bulk action's state
 * (`useSelection({ resetOn: state.ok })`). Each new truthy value - a new
 * object from each completed action - clears the selection once, so the bar
 * closes after a bulk action and the next one starts from nothing.
 *
 * This replaces an effect each list carried, keyed on `[state, selection]`
 * with a "dedupe" key built from `Date.now()`. The selection object changes
 * on every tick and the key never matched, so after the first successful
 * bulk action every new tick was wiped at once: bulk worked once per page
 * load. The reset is now decided while rendering, by identity, in one place.
 */
export function useSelection(options: { resetOn?: unknown } = {}): Selection {
  const { resetOn } = options;
  const [state, dispatch] = useReducer(
    selectionReducer,
    resetOn,
    (initial): SelectionState => ({ selected: new Set(), resetOn: initial }),
  );

  // React's "adjust state when a prop changes" pattern: a render-phase
  // update on this component's own reducer, applied before anything paints.
  if (!Object.is(resetOn, state.resetOn)) {
    dispatch({ type: "result", resetOn });
  }

  const { selected } = state;
  return useMemo(
    () => ({
      selected,
      has: (id: string) => selected.has(id),
      toggle: (id: string) => dispatch({ type: "toggle", id }),
      set: (ids: string[]) => dispatch({ type: "set", ids }),
      clear: () => dispatch({ type: "clear" }),
      count: selected.size,
      ids: Array.from(selected),
    }),
    [selected],
  );
}

export function RowCheckbox({
  id,
  selection,
  label,
}: {
  id: string;
  selection: Selection;
  label?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={selection.has(id)}
      onChange={() => selection.toggle(id)}
      aria-label={label ?? "Seç"}
      className="h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-900 focus:ring-neutral-700"
    />
  );
}

export function SelectAllCheckbox({
  ids,
  selection,
  label,
}: {
  ids: string[];
  selection: Selection;
  label?: string;
}) {
  const total = ids.length;
  const inScope = ids.filter((id) => selection.has(id)).length;
  const allChecked = total > 0 && inScope === total;
  const some = inScope > 0 && inScope < total;

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Add these ids to selection (preserve out-of-scope selections)
      const next = new Set(selection.selected);
      for (const id of ids) next.add(id);
      selection.set(Array.from(next));
    } else {
      const next = new Set(selection.selected);
      for (const id of ids) next.delete(id);
      selection.set(Array.from(next));
    }
  };

  return (
    <input
      type="checkbox"
      checked={allChecked}
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={onChange}
      disabled={total === 0}
      aria-label={label ?? "Tümünü seç"}
      className="h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-900 focus:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}

export interface BulkActionBarProps {
  selection: Selection;
  pending: boolean;
  message?: ReactNode;
  children: ReactNode;
}

/**
 * Bottom bar that appears when at least one row is selected.
 * Hosts the action buttons / parametric selects supplied by the parent.
 * All actions submit to a single server action via the wrapping form.
 *
 * Fixed to the viewport, not `sticky`: every list wraps only this bar in its
 * form, and a sticky element cannot leave its parent, so the "sticky" bar sat
 * below the last row - an operator ticking rows at the top of a 100-order
 * page never saw it. The spacer keeps the last rows reachable above it.
 */
export function BulkActionBar({
  selection,
  pending,
  message,
  children,
}: BulkActionBarProps) {
  if (selection.count === 0) return null;
  return (
    <>
      <div aria-hidden="true" className="h-32 sm:h-24" />
      {/* data-admin-bulk-bar lifts the toast stack above this bar (ui/toast.tsx). */}
      <div
        data-admin-bulk-bar=""
        role="region"
        aria-label="Toplu işlem"
        className="fixed inset-x-4 bottom-4 z-30 lg:left-[calc(16rem+1rem)]"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--admin-border)] bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <span
              className="rounded-full bg-[var(--admin-primary)] px-3 py-1 text-xs font-medium text-white"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {selection.count} seçili
            </span>
            <button
              type="button"
              onClick={selection.clear}
              className="text-xs text-neutral-500 underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
            >
              Seçimi temizle
            </button>
            {message && (
              <span className="text-xs text-neutral-600">{message}</span>
            )}
            {pending && (
              <span className="text-xs text-neutral-500">İşleniyor…</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
      </div>
    </>
  );
}
