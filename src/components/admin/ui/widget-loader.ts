import { isIsoDate } from "@/lib/admin/list-params";

/*
 * How a native date control hands over to its React Aria widget (admin UI
 * v2, UI-14, design D12): no React, so the rules are tested on their own
 * (tests/admin-widget-loader.test.ts).
 *
 * The page always draws the native control: it is what the server renders,
 * what works without JavaScript, and what a phone keeps (the OS pickers
 * there are localised and better than segmented fields). Only where the
 * primary pointer is a mouse or a trackpad, and only once the pointer
 * reaches the control or focus lands in it, the widget's chunk is asked
 * for, never just after hydration: a list nobody touches a date on pays
 * nothing. When the chunk is here the widget takes the native control's
 * place, with its value and its focus.
 */

/** The widget's chunk, asked for once and kept. */
export interface WidgetLoader<W> {
  /** The widget once its chunk has come; null before, and when switched off. */
  peek(): W | null;
  /**
   * Asks for the chunk (once: the same answer to every caller). Resolves
   * null when the widgets are switched off. A chunk that cannot be fetched
   * (a deploy replaced it, the köşk lost its network) rejects, and the
   * next call asks again.
   */
  load(): Promise<W | null>;
}

export function createWidgetLoader<W>(
  importer: () => Promise<W | null>,
): WidgetLoader<W> {
  let loaded: W | null = null;
  let pending: Promise<W | null> | null = null;
  return {
    peek: () => loaded,
    load() {
      pending ??= importer().then(
        (widget) => {
          loaded = widget;
          return widget;
        },
        (error: unknown) => {
          pending = null;
          throw error;
        },
      );
      return pending;
    },
  };
}

/** `(pointer: fine)`: a mouse or a trackpad, not a finger. */
export function hasFinePointer(
  win: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined"
    ? undefined
    : window,
): boolean {
  try {
    return win?.matchMedia("(pointer: fine)").matches === true;
  } catch {
    return false;
  }
}

/**
 * The pointer entered a native date control, or focus landed in it: on a
 * fine pointer, ask for the widget and hand it to `onReady` when it is
 * here. Called on every entry, so it asks again only as far as the loader
 * does; a chunk that fails is tried again at the next entry.
 */
export function armWidget<W>(
  loader: WidgetLoader<W>,
  onReady: (widget: W) => void,
  fine: () => boolean = hasFinePointer,
): void {
  if (!fine()) return;
  loader.load().then(
    (widget) => {
      if (widget) onReady(widget);
    },
    () => {},
  );
}

/** What the native date boxes hold when the range widget takes their place. */
export interface RangeSnapshot {
  from: string;
  to: string;
  /** The native box that had focus: the widget focuses its matching part. */
  focus: "start" | "end" | null;
}

/**
 * Reads the two native boxes. A day is kept only when the box holds a whole
 * one (an unfinished box reads as empty). Null when exactly one end is set:
 * React Aria's range holds both ends or neither, and a filter with one end
 * ("01.10.2026 ve sonrası") must not lose it, so those keep the native
 * boxes. `from` and `to` as they are, backwards included: the list swaps a
 * reversed range and the widget marks it.
 */
export function snapshotRange(
  fromBox: { value: string } | null,
  toBox: { value: string } | null,
  active: unknown,
): RangeSnapshot | null {
  const day = (box: { value: string } | null) =>
    box && isIsoDate(box.value) ? box.value : "";
  const from = day(fromBox);
  const to = day(toBox);
  if (Boolean(from) !== Boolean(to)) return null;
  return {
    from,
    to,
    focus:
      active !== null && active === fromBox
        ? "start"
        : active !== null && active === toBox
          ? "end"
          : null,
  };
}

/** The same rule for values the page already holds (a warm chunk). */
export function rangeFromValues(
  from: string | undefined,
  to: string | undefined,
): RangeSnapshot | null {
  return snapshotRange({ value: from ?? "" }, { value: to ?? "" }, null);
}
