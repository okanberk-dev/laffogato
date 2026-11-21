"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { adminPortalRoot } from "./ui/toast";

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

// The row checkboxes: the panel's 20px espresso box (forms.tsx Checkbox)
// in a 44px hit area. They were 16px browser-blue boxes: their classes were
// @tailwindcss/forms idioms and that plugin is not installed (SHE-19). The
// negative margin keeps the 44px area from pushing the row apart.
const BOX_HIT =
  "-m-3 inline-flex h-11 w-11 pointer-fine:h-9 pointer-fine:w-9 shrink-0 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed";
const BOX =
  "h-5 w-5 cursor-pointer accent-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-30";

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
    <label className={BOX_HIT}>
      <input
        type="checkbox"
        checked={selection.has(id)}
        onChange={() => selection.toggle(id)}
        aria-label={label ?? "Seç"}
        className={BOX}
      />
    </label>
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
    <label className={BOX_HIT}>
      <input
        type="checkbox"
        checked={allChecked}
        ref={(el) => {
          if (el) el.indeterminate = some;
        }}
        onChange={onChange}
        disabled={total === 0}
        aria-label={label ?? "Tümünü seç"}
        className={BOX}
      />
    </label>
  );
}

export interface BulkActionBarProps {
  selection: Selection;
  pending: boolean;
  message?: ReactNode;
  children: ReactNode;
}

const noSubscribe = () => () => {};

/**
 * The room the bar takes at the bottom of the page: its measured height,
 * the 1rem it floats above the edge and a 1rem gap. Pure, exported for
 * tests.
 */
export function bulkBarSpace(barHeight: number): number {
  return barHeight > 0 ? Math.ceil(barHeight) + 32 : 0;
}

/**
 * Bottom bar that appears when at least one row is selected.
 * Hosts the action buttons / parametric selects supplied by the parent.
 * All actions submit to a single server action via the wrapping form.
 *
 * Fixed to the viewport, not `sticky`: every list wraps only this bar in its
 * form, and a sticky element cannot leave its parent, so the "sticky" bar sat
 * below the last row - an operator ticking rows at the top of a 100-order
 * page never saw it.
 *
 * The room it takes is kept free at the very end of the page: a spacer as
 * tall as the bar (measured, it wraps to 237px on a phone) is rendered
 * after everything else in the panel (the portal root ToastProvider puts
 * after the page). A fixed spacer inside the list sat before the
 * pagination, so the bar covered the page links (admin audit ORD-06).
 */
export function BulkActionBar({
  selection,
  pending,
  message,
  children,
}: BulkActionBarProps) {
  const open = selection.count > 0;
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  // The portal root on the client; nothing on the server (where the bar is
  // never open anyway: a selection starts empty).
  const end = useSyncExternalStore<HTMLElement | null>(
    noSubscribe,
    adminPortalRoot,
    () => null,
  );

  useEffect(() => {
    const bar = barRef.current;
    if (!open || !bar || typeof ResizeObserver === "undefined") return;
    // Called once on observe and again whenever the bar wraps or unwraps.
    const observer = new ResizeObserver(() =>
      setBarHeight(bar.getBoundingClientRect().height),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, [open]);

  if (!open) return null;
  const space = bulkBarSpace(barHeight);
  return (
    <>
      {/* The toast stack sits this far up while the bar is open
          (ui/toast.tsx); a fixed 8rem left it over a two-row phone bar. */}
      {space > 0 ? (
        <style>{`:root{--admin-bulk-space:${space}px}`}</style>
      ) : null}
      {end
        ? createPortal(
            <div
              aria-hidden="true"
              data-admin-bulk-spacer=""
              style={{ height: space }}
            />,
            end,
          )
        : null}
      {/* data-admin-bulk-bar lifts the toast stack above this bar (ui/toast.tsx).
          A solid ground, no backdrop-blur: a backdrop filter makes the bar
          the containing block of fixed descendants, and the ActionMenu a
          phone bar folds its buttons into (order-actions-ui.tsx) placed its
          panel 750 px below the screen.
          It takes the phone's bottom bar's place (the bar hides, and the
          shared --admin-bottom-inset drops to 0 while this bar is up,
          layout.tsx); the margin adds that inset all the same, so the bar
          never sits on a bar under it. */}
      <div
        ref={barRef}
        data-admin-bulk-bar=""
        role="region"
        aria-label="Toplu işlem"
        className="fixed inset-x-4 bottom-4 z-30 mb-[var(--admin-bottom-inset,0px)] lg:right-6 lg:left-[calc(var(--admin-side,15.5rem)+2.25rem)]"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-surface)] px-5 py-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-x-3">
            <span
              className="rounded-full bg-[var(--admin-primary)] px-3 py-1 text-xs font-medium whitespace-nowrap text-white"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {selection.count} seçili
            </span>
            <button
              type="button"
              onClick={selection.clear}
              className="inline-flex min-h-11 items-center text-xs whitespace-nowrap text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline pointer-fine:min-h-9"
            >
              Seçimi temizle
            </button>
            {message && (
              <span className="text-xs text-[var(--admin-text-soft)]">
                {message}
              </span>
            )}
            {pending && (
              <span className="text-xs text-[var(--admin-text-soft)]">
                İşleniyor…
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
      </div>
    </>
  );
}
