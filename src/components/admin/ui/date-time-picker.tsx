"use client";

import { CalendarDateTime } from "@internationalized/date";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker,
  DateSegment,
  Group,
  Popover,
  type DateSegmentProps,
} from "react-aria-components/DatePicker";
import { Dialog } from "react-aria-components/Dialog";
import { I18nProvider } from "react-aria-components/I18nProvider";

import { istanbulDayOf } from "@/lib/admin/date-presets";
import {
  formatLocalDateTime,
  parseLocalDateTime,
  type LocalDateTime,
} from "@/lib/admin/date-time-local";

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
 * DateTimeField's widget on a laptop (admin UI v2, UI-14, design §5 #7): a
 * segmented date and 24-hour time in Turkish order (gg.aa.yyyy ss:dd), a
 * Monday-first calendar for the day, and the form's own value posted under
 * the original name as `YYYY-MM-DDTHH:mm`, the Istanbul wall clock a native
 * `datetime-local` box posts and publish-window.ts reads back. A chunk of its
 * own: date-time-field.tsx draws the native box (server render, no
 * JavaScript, phones) and swaps this in only where the pointer is fine and
 * has reached the box (ui/widget-loader.ts).
 *
 * What posts is a hidden input of this file's, not React Aria's: its own
 * value always carries seconds, and the forms (and their tests) know this
 * shape. Incomplete segments post nothing, as an unfinished native box does.
 * Validation (required, min, max) is React Aria's native kind: it holds the
 * post back, as the box it replaces does.
 */

export { DATE_WIDGETS_ENABLED };

export interface DateTimePickerProps {
  /** The name the value posts under. */
  name: string;
  /** `YYYY-MM-DDTHH:mm` or "": the start value (uncontrolled). */
  defaultValue?: string;
  /** The value when the form holds it (controlled), with `onChange`. */
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** The native box had focus when this took its place. */
  focus?: boolean;
}

const calendarOf = (p: LocalDateTime) =>
  new CalendarDateTime(p.year, p.month, p.day, p.hour, p.minute);

/** A `YYYY-MM-DDTHH:mm` value as a date object, or null for none or nonsense. */
function toCalendar(value: string | undefined): CalendarDateTime | null {
  const parts = value ? parseLocalDateTime(value) : null;
  return parts ? calendarOf(parts) : null;
}

const textOf = (value: CalendarDateTime | null) =>
  value
    ? formatLocalDateTime({
        year: value.year,
        month: value.month,
        day: value.day,
        hour: value.hour,
        minute: value.minute,
      })
    : "";

const renderSegment = (segment: DateSegmentProps["segment"]) => (
  <DateSegment segment={segment} className={DATE_SEGMENT} />
);

export function DateTimePicker({
  name,
  defaultValue,
  value,
  onChange,
  min,
  max,
  required,
  invalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  focus = false,
}: DateTimePickerProps) {
  const root = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<Element | undefined>();
  // The köşk's today, midnight: the calendar's mark and first month, and the
  // time a day picked in the calendar takes when none is typed yet.
  const [today] = useState(() => istanbulDayOf(new Date()));
  const controlled = value !== undefined;
  const [kept, setKept] = useState(defaultValue ?? "");
  const text = controlled ? value : kept;

  useEffect(() => {
    if (!focus) return;
    root.current?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus();
  }, [focus]);

  return (
    <I18nProvider locale="tr-TR">
      <DatePicker
        ref={root}
        // A box with no label of its own still needs a name; the form says
        // which one it is (aria-labelledby, or aria-label).
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : "Tarih ve saat")}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        granularity="minute"
        hourCycle={24}
        shouldForceLeadingZeros
        firstDayOfWeek="mon"
        placeholderValue={toCalendar(`${today}T00:00`) ?? undefined}
        minValue={toCalendar(min)}
        maxValue={toCalendar(max)}
        isRequired={required}
        isInvalid={invalid || undefined}
        {...(controlled
          ? { value: toCalendar(value) }
          : { defaultValue: toCalendar(defaultValue) })}
        onChange={(next) => {
          const posted = textOf(next);
          setKept(posted);
          onChange?.(posted);
        }}
        onOpenChange={(open) => {
          if (open) setPortal(overlayContainer(root.current));
        }}
        className="min-w-0"
      >
        <Group className={DATE_GROUP}>
          <DateInput className={DATE_INPUT}>{renderSegment}</DateInput>
          <Button className={DATE_BUTTON}>
            <AdminIcon name="dateRange" />
          </Button>
        </Group>
        <Popover {...popoverPortal(portal)} className={DATE_POPOVER}>
          <Dialog className="outline-none">
            <Calendar>
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
                        calendarDayClass(state, today, false)
                      }
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
      <input type="hidden" name={name} value={text} />
    </I18nProvider>
  );
}
