"use client";

import { parseDate } from "@internationalized/date";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateRangePicker,
  DateSegment,
  Group,
  Popover,
  RangeCalendar,
  type DateSegmentProps,
} from "react-aria-components/DateRangePicker";
import { Dialog } from "react-aria-components/Dialog";
import { I18nProvider } from "react-aria-components/I18nProvider";

import { istanbulDayOf } from "@/lib/admin/date-presets";

import { CalendarHeader } from "./calendar-header";
import {
  CALENDAR_WEEKDAY,
  DATE_BUTTON,
  DATE_GROUP,
  DATE_INPUT,
  DATE_POPOVER,
  DATE_SEGMENT,
  calendarDayClass,
} from "./date-styles";
import { AdminIcon } from "./icons";
import {
  DATE_WIDGETS_ENABLED,
  overlayContainer,
  popoverPortal,
} from "./overlay";

/*
 * The list filters' date range on a laptop (admin UI v2, UI-14, design §5
 * #6): two segmented dates in Turkish order (gg.aa.yyyy, whatever the
 * browser's own language says), a Monday-first calendar for the range, and
 * the same two values posted under the FilterBar field's own names, as
 * "YYYY-MM-DD", so the page, its chips and the server read them as they
 * always did. It is a chunk of its own: the FilterBar draws native
 * `<input type="date">` boxes (server render, no JavaScript, phones) and
 * swaps this in only where the pointer is fine and has reached the field
 * (ui/widget-loader.ts, filter-bar.tsx).
 *
 * Both ends or neither: React Aria's range holds no half range, so a filter
 * with one end keeps the native boxes (widget-loader.ts snapshotRange). A
 * range typed backwards is posted as typed and marked; the list swaps it.
 * No validation blocks the post (`validationBehavior="aria"`): "Uygula" is
 * never held back by a date box.
 */

export { DATE_WIDGETS_ENABLED };

export interface DateRangeFieldProps {
  /** The field's label (the fieldset's legend): the group's accessible name. */
  label: string;
  /** The FilterField's `from` and `to`: the names the two days post under. */
  fromName: string;
  toName: string;
  /** "YYYY-MM-DD", or "" for none (both set, or neither). */
  defaultFrom: string;
  defaultTo: string;
  /** The native box that had focus when this took its place. */
  focus?: "start" | "end" | null;
}

/** Enter in a date segment sends the filter, as it does in a native box. */
function submitOnEnter(e: { key: string; target: EventTarget }) {
  const segment = e.target as HTMLElement;
  if (e.key !== "Enter" || segment.getAttribute("role") !== "spinbutton") {
    return;
  }
  segment.closest("form")?.requestSubmit();
}

const renderSegment = (segment: DateSegmentProps["segment"]) => (
  <DateSegment segment={segment} className={DATE_SEGMENT} />
);

export function DateRangeField({
  label,
  fromName,
  toName,
  defaultFrom,
  defaultTo,
  focus = null,
}: DateRangeFieldProps) {
  const root = useRef<HTMLDivElement>(null);
  // Where the calendar is drawn, chosen when it opens (overlay.ts).
  const [portal, setPortal] = useState<Element | undefined>();
  // The köşk's today: the calendar's mark and its first month. React Aria's
  // own follows the machine's zone.
  const [today] = useState(() => istanbulDayOf(new Date()));

  // The native box had focus: the matching part of this has it now.
  useEffect(() => {
    if (!focus) return;
    root.current
      ?.querySelector<HTMLElement>(
        `[data-range-part="${focus}"] [role="spinbutton"]`,
      )
      ?.focus();
  }, [focus]);

  return (
    <I18nProvider locale="tr-TR">
      <DateRangePicker
        ref={root}
        aria-label={label}
        startName={fromName}
        endName={toName}
        firstDayOfWeek="mon"
        validationBehavior="aria"
        placeholderValue={parseDate(today)}
        defaultValue={
          defaultFrom && defaultTo
            ? { start: parseDate(defaultFrom), end: parseDate(defaultTo) }
            : undefined
        }
        onOpenChange={(open) => {
          if (open) setPortal(overlayContainer(root.current));
        }}
        onKeyDown={submitOnEnter}
        className="min-w-0"
      >
        <Group className={DATE_GROUP}>
          <DateInput
            slot="start"
            data-range-part="start"
            className={DATE_INPUT}
          >
            {renderSegment}
          </DateInput>
          <span
            aria-hidden="true"
            className="px-0.5 text-[var(--admin-text-soft)]"
          >
            -
          </span>
          <DateInput slot="end" data-range-part="end" className={DATE_INPUT}>
            {renderSegment}
          </DateInput>
          <Button className={DATE_BUTTON}>
            <AdminIcon name="dateRange" />
          </Button>
        </Group>
        <Popover {...popoverPortal(portal)} className={DATE_POPOVER}>
          <Dialog className="outline-none">
            <RangeCalendar>
              <CalendarHeader />
              <CalendarGrid weekdayStyle="short" className="border-collapse">
                <CalendarGridHeader>
                  {(day) => (
                    <CalendarHeaderCell className={CALENDAR_WEEKDAY}>
                      {day}
                    </CalendarHeaderCell>
                  )}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => (
                    <CalendarCell
                      date={date}
                      className={(state) =>
                        calendarDayClass(state, today, true)
                      }
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </RangeCalendar>
          </Dialog>
        </Popover>
      </DateRangePicker>
    </I18nProvider>
  );
}
