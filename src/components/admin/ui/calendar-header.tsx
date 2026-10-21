"use client";

import { Button } from "react-aria-components/Button";
import { Heading } from "react-aria-components/Heading";

import { CALENDAR_HEADING, CALENDAR_NAV } from "./date-styles";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

/**
 * The month's header inside a React Aria Calendar or RangeCalendar:
 * previous, the month and year, next. The buttons take their names
 * ("Önceki", "Sonraki") and the heading its text from the calendar.
 */
export function CalendarHeader() {
  return (
    <header className="flex items-center gap-1 pb-2">
      <Button slot="previous" className={CALENDAR_NAV}>
        <Chevron direction="left" />
      </Button>
      <Heading className={CALENDAR_HEADING} />
      <Button slot="next" className={CALENDAR_NAV}>
        <Chevron direction="right" />
      </Button>
    </header>
  );
}
