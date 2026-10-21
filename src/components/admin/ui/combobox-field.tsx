"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type SelectHTMLAttributes,
} from "react";

import { optionRuns, type ComboboxOption } from "@/lib/admin/option-filter";

import { Select } from "../forms";
import {
  armWidget,
  createWidgetLoader,
  DATE_WIDGETS_ENABLED,
} from "./widget-loader";

/*
 * A picker you can type in (admin UI v2, UI-16, design §5 #8), in place of a
 * long `<select>`: "sire" finds "Şire" on a phone keyboard without scrolling
 * 200 options. The same name, the same options and the same posted value;
 * the same markup on the server.
 *
 * It draws the native `<select>`: what the server renders, what works before
 * and without JavaScript, and what stays if the widget cannot be fetched.
 * Once the pointer reaches it or focus lands in it, on any pointer, the
 * React Aria widget's chunk is asked for (combobox-picker, never just after
 * hydration: a form nobody picks in pays nothing) and takes the select's
 * place with its value and its focus. This file is all a form loads: React
 * Aria stays in the chunk. A chunk that cannot be fetched leaves the select.
 *
 * `value` and `onChange` make it controlled, as the native select is with
 * them; `onChange` gets the new value (a string), not an event. A box with
 * no `name` posts nothing (a form that keeps its own state, like the manual
 * order's lines).
 */

type ComboWidget = (typeof import("./combobox-picker"))["ComboboxPicker"];

const loader = createWidgetLoader<ComboWidget>(() =>
  DATE_WIDGETS_ENABLED
    ? import("./combobox-picker").then((m) => m.ComboboxPicker)
    : Promise.resolve(null),
);

/** Any pointer: a finger has no hover, but a tap focuses, and that asks too. */
const always = () => true;

export interface ComboboxFieldProps extends Pick<
  SelectHTMLAttributes<HTMLSelectElement>,
  | "id"
  | "required"
  | "disabled"
  | "className"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
> {
  name?: string;
  options: readonly ComboboxOption[];
  /**
   * The empty choice's text ("Ürün seç…"); with none, the list has no empty
   * choice. `placeholderDisabled`: the empty choice cannot be picked back.
   */
  placeholder?: string;
  placeholderDisabled?: boolean;
  /**
   * What the picker is called, for the widget's accessible name (the
   * native select is named by the label around it, and keeps that markup).
   */
  label?: string;
  /** The start value (uncontrolled). */
  defaultValue?: string;
  /** The value when the form holds it (controlled), with `onChange`. */
  value?: string;
  onChange?: (value: string) => void;
}

interface Swapped {
  Widget: ComboWidget;
  value: string;
  focus: boolean;
}

export function ComboboxField({
  name,
  options,
  placeholder,
  placeholderDisabled,
  label,
  defaultValue,
  value,
  onChange,
  "aria-invalid": ariaInvalid,
  ...native
}: ComboboxFieldProps) {
  const box = useRef<HTMLSelectElement>(null);
  // A chunk an earlier picker on this page already asked for draws at once
  // (a form opened after a navigation); the server and the first draw of a
  // freshly loaded page never find one.
  const [swapped, setSwapped] = useState<Swapped | null>(() => {
    const Widget = loader.peek();
    return Widget ? { Widget, value: defaultValue ?? "", focus: false } : null;
  });

  const arm = () => {
    if (swapped) return;
    armWidget(
      loader,
      (Widget) => {
        const field = box.current;
        setSwapped({
          Widget,
          value: field?.value ?? defaultValue ?? "",
          focus: field !== null && document.activeElement === field,
        });
      },
      always,
    );
  };

  if (swapped) {
    const { Widget } = swapped;
    return (
      <Widget
        name={name}
        options={options}
        placeholder={placeholder}
        {...(value !== undefined ? { value } : { defaultValue: swapped.value })}
        onChange={onChange}
        required={native.required}
        disabled={native.disabled}
        invalid={ariaInvalid === true || ariaInvalid === "true"}
        id={native.id}
        className={native.className}
        aria-label={native["aria-label"] ?? label}
        aria-labelledby={native["aria-labelledby"]}
        aria-describedby={native["aria-describedby"]}
        focus={swapped.focus}
      />
    );
  }

  return (
    <Select
      ref={box}
      name={name}
      aria-invalid={ariaInvalid}
      {...native}
      {...(value !== undefined
        ? {
            value,
            onChange: (e: ChangeEvent<HTMLSelectElement>) =>
              onChange?.(e.target.value),
          }
        : { defaultValue })}
      onPointerEnter={arm}
      onFocus={arm}
    >
      {placeholder !== undefined && (
        <option value="" disabled={placeholderDisabled}>
          {placeholder}
        </option>
      )}
      {optionRuns(options).map((run, i) =>
        run.group === null ? (
          run.options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))
        ) : (
          <optgroup key={`${run.group}:${i}`} label={run.group}>
            {run.options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </Select>
  );
}
