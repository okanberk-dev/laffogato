import { cx } from "@/components/laffogato/cx";

import { COMPACT } from "./compact";

/*
 * The class strings the two React Aria date widgets share (date-range-field
 * and date-time-picker): the segmented field in the panel's field look, its
 * calendar button, the pop-over and the month grid. Plain strings, written
 * out for Tailwind's scanner, so the widgets stay about behaviour. React
 * Aria draws no style of its own: its state shows as data attributes
 * (`data-focus-within`, `data-focused`, `data-selected`, ...).
 *
 * The panel's one focus ring (globals.css `[data-admin-root] :focus-visible`)
 * covers every segment, button and day; what is added here is only the
 * field's own highlight, so a focused field still reads as a field.
 */

/** The field: what FIELD_INPUT is for a native box (forms.tsx). */
export const DATE_GROUP = `flex min-h-11 w-full min-w-0 items-center gap-1 rounded-lg border border-[var(--admin-border-field)] bg-[var(--admin-surface)] pr-1 pl-3.5 text-base text-[var(--admin-text)] transition-[border-color,background-color,box-shadow] data-[focus-within]:border-[var(--admin-primary)] data-[focus-within]:bg-white data-[focus-within]:ring-2 data-[focus-within]:ring-[var(--admin-primary)]/25 data-[invalid]:border-[var(--admin-danger)] sm:text-sm ${COMPACT.minH8}`;

/** One date's (or time's) segments. */
export const DATE_INPUT = "flex min-w-0 items-center";

export const DATE_SEGMENT =
  "rounded-sm px-0.5 tabular-nums caret-transparent outline-none data-[focused]:bg-[var(--admin-primary-soft)] data-[focused]:text-[var(--admin-primary)] data-[placeholder]:text-[var(--admin-text-mute)] data-[type=literal]:px-0";

/** The calendar button at the field's end. */
export const DATE_BUTTON =
  "ml-auto grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--admin-text-soft)] hover:bg-[var(--admin-border)]/40 hover:text-[var(--admin-primary)] data-[pressed]:bg-[var(--admin-border)]/60";

export const DATE_POPOVER =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-[var(--admin-text)] shadow-[0_16px_48px_rgba(12,14,27,0.18)] outline-none";

/** Previous and next month. */
export const CALENDAR_NAV =
  "grid size-9 cursor-pointer place-items-center rounded-lg text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40";

export const CALENDAR_HEADING =
  "flex-1 text-center text-sm font-semibold text-[var(--admin-text)]";

export const CALENDAR_WEEKDAY =
  "pb-1 text-center text-xs font-medium text-[var(--admin-text-mute)]";

/** What a day's class needs of React Aria's cell state. */
export interface CalendarDayState {
  date: { toString(): string };
  isSelected: boolean;
  isSelectionStart: boolean;
  isSelectionEnd: boolean;
  isOutsideMonth: boolean;
  isDisabled: boolean;
}

/**
 * A day of the month grid. In a range the ends are filled and the days
 * between them tinted (the cells touch, so the tint reads as one band); a
 * single date is one filled circle. `today` is the köşk's "YYYY-MM-DD", not
 * the browser's: React Aria's own today mark follows the machine's zone.
 */
export function calendarDayClass(
  day: CalendarDayState,
  today: string,
  range: boolean,
): string {
  const filled = range
    ? day.isSelectionStart || day.isSelectionEnd
    : day.isSelected;
  const rounded =
    !range || (day.isSelectionStart && day.isSelectionEnd)
      ? "rounded-full"
      : day.isSelectionStart
        ? "rounded-l-full"
        : day.isSelectionEnd
          ? "rounded-r-full"
          : day.isSelected
            ? "rounded-none"
            : "rounded-full";
  return cx(
    "flex size-10 cursor-pointer items-center justify-center text-sm outline-none",
    rounded,
    day.isOutsideMonth && "invisible",
    day.isDisabled && "cursor-not-allowed opacity-40",
    filled
      ? "bg-[var(--admin-primary)] font-medium text-white"
      : day.isSelected
        ? "bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
        : "text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]",
    !filled &&
      day.date.toString() === today &&
      "font-semibold text-[var(--admin-primary)] underline decoration-2 underline-offset-4",
  );
}
