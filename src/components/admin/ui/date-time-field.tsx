"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";

import { FIELD_INPUT } from "../forms";
import {
  armWidget,
  createWidgetLoader,
  DATE_WIDGETS_ENABLED,
} from "./widget-loader";

/*
 * A date and a time for a form (admin UI v2, UI-14, design §5 #7 and D12),
 * in place of `<input type="datetime-local">`: the same name, the same
 * `YYYY-MM-DDTHH:mm` Istanbul wall-clock value, the same min, max and
 * required, and the same markup on the server. UI-15 put it in the ten
 * publish-window boxes (promo expiry, campaign send time, hero and app
 * slides, announcements, posts); each passes an aria-label, because the
 * widget sits inside the Field's label next to a calendar button.
 *
 * It draws the native box: what the server renders, what works before and
 * without JavaScript, and what a phone keeps (the OS pickers there are
 * localised and better than segmented fields). Where the primary pointer is
 * a mouse or a trackpad, and once the pointer reaches the box or focus
 * lands in it, the React Aria widget's chunk is asked for (date-time-picker,
 * never just after hydration) and takes the box's place with its value and
 * its focus. This file is all a form loads: React Aria stays in the chunk.
 *
 * `value` and `onChange` make it controlled, as the native box is with
 * them; `onChange` gets the new value (a string), not an event.
 */

type DateTimeWidget = (typeof import("./date-time-picker"))["DateTimePicker"];

const loader = createWidgetLoader<DateTimeWidget>(() =>
  DATE_WIDGETS_ENABLED
    ? import("./date-time-picker").then((m) => m.DateTimePicker)
    : Promise.resolve(null),
);

export interface DateTimeFieldProps extends Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | "id"
  | "required"
  | "className"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
> {
  name: string;
  /** The earliest and latest value, `YYYY-MM-DDTHH:mm`. */
  min?: string;
  max?: string;
  /** `YYYY-MM-DDTHH:mm` (Istanbul time) or "": the start value. */
  defaultValue?: string;
  /** The value when the form holds it (controlled), with `onChange`. */
  value?: string;
  onChange?: (value: string) => void;
}

interface Swapped {
  Widget: DateTimeWidget;
  value: string;
  focus: boolean;
}

export function DateTimeField({
  name,
  defaultValue,
  value,
  onChange,
  className,
  "aria-invalid": ariaInvalid,
  ...native
}: DateTimeFieldProps) {
  const box = useRef<HTMLInputElement>(null);
  // A chunk an earlier box on this page already asked for draws at once (a
  // new form after a navigation); the server and the first draw of a
  // freshly loaded page never find one.
  const [swapped, setSwapped] = useState<Swapped | null>(() => {
    const Widget = loader.peek();
    return Widget ? { Widget, value: defaultValue ?? "", focus: false } : null;
  });

  const arm = () => {
    if (swapped) return;
    armWidget(loader, (Widget) => {
      const field = box.current;
      setSwapped({
        Widget,
        value: field?.value ?? defaultValue ?? "",
        focus: field !== null && document.activeElement === field,
      });
    });
  };

  if (swapped) {
    const { Widget } = swapped;
    return (
      <Widget
        name={name}
        {...(value !== undefined ? { value } : { defaultValue: swapped.value })}
        onChange={onChange}
        min={native.min}
        max={native.max}
        required={native.required}
        invalid={ariaInvalid === true || ariaInvalid === "true"}
        aria-label={native["aria-label"]}
        aria-labelledby={native["aria-labelledby"]}
        aria-describedby={native["aria-describedby"]}
        focus={swapped.focus}
      />
    );
  }

  return (
    <input
      ref={box}
      type="datetime-local"
      name={name}
      // As the kit's TextInput writes it, so the markup is the old box's.
      className={`${FIELD_INPUT} ${className ?? ""}`}
      aria-invalid={ariaInvalid}
      {...native}
      {...(value !== undefined
        ? {
            value,
            onChange: (e: ChangeEvent<HTMLInputElement>) =>
              onChange?.(e.target.value),
          }
        : { defaultValue })}
      onPointerEnter={arm}
      onFocus={arm}
    />
  );
}
