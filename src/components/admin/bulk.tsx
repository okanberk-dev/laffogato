"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

export interface Selection {
  selected: Set<string>;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  set: (ids: string[]) => void;
  clear: () => void;
  count: number;
  ids: string[];
}

export function useSelection(): Selection {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const set = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(
    () => ({
      selected,
      has: (id: string) => selected.has(id),
      toggle,
      set,
      clear,
      count: selected.size,
      ids: Array.from(selected),
    }),
    [selected, toggle, set, clear],
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
 * Sticky bottom bar that slides in when at least one row is selected.
 * Hosts the action buttons / parametric selects supplied by the parent.
 * All actions submit to a single server action via the wrapping form.
 */
export function BulkActionBar({
  selection,
  pending,
  message,
  children,
}: BulkActionBarProps) {
  if (selection.count === 0) return null;
  return (
    <div className="sticky bottom-4 z-30 mt-4">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <span
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            {selection.count} seçili
          </span>
          <button
            type="button"
            onClick={selection.clear}
            className="text-xs text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
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
  );
}
