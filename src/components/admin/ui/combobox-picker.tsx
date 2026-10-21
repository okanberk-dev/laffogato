"use client";

import { useEffect, useRef, useState } from "react";
import { ComboBox } from "react-aria-components/ComboBox";
import { Header } from "react-aria-components/Header";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { Input } from "react-aria-components/Input";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";

import {
  matchesOption,
  optionRuns,
  type ComboboxOption,
} from "@/lib/admin/option-filter";

import { FIELD_INPUT } from "../forms";
import { AdminIcon } from "./icons";
import { overlayContainer, popoverPortal } from "./overlay";

/*
 * ComboboxField's widget (admin UI v2, UI-16, design §5 #8): a box you type
 * in, and a list that narrows as you type ("sire" finds "Şire", "findik"
 * finds "Fındık", see lib/admin/option-filter.ts). A chunk of its own:
 * combobox-field.tsx draws the native `<select>` (server render, before and
 * without JavaScript) and swaps this in when the box is first touched.
 *
 * What posts is a hidden input of this file's under the original name,
 * holding the picked option's value, so the form's FormData is the
 * select's. Typed text that is not a pick posts nothing (the box goes back
 * to the pick, or to empty, when it loses focus), and the server answers
 * under the field as it does for a select left on its placeholder.
 */

export interface ComboboxPickerProps {
  /** The name the picked value posts under; none posts nothing (a controlled box). */
  name?: string;
  options: readonly ComboboxOption[];
  /** The empty choice's text: what the box says while nothing is picked. */
  placeholder?: string;
  /** The picked value (uncontrolled start value, or the form's own with `value`). */
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** The native select had focus when this took its place. */
  focus?: boolean;
}

const POPOVER =
  "overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-[0_16px_48px_rgba(28,25,23,0.18)] outline-none";
const LIST = "max-h-72 overflow-auto p-1 outline-none";
const ITEM =
  "flex min-h-11 cursor-pointer items-center rounded-lg px-3 py-2 text-base outline-none data-[focused]:bg-[var(--admin-primary-soft)] data-[focused]:text-[var(--admin-primary)] data-[selected]:font-semibold data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 sm:text-sm";
const HEADING =
  "px-3 pt-2 pb-1 text-xs font-medium text-[var(--admin-text-mute)]";
const EMPTY = "px-3 py-3 text-sm text-[var(--admin-text-mute)]";

export function ComboboxPicker({
  name,
  options,
  placeholder,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  invalid,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  focus = false,
}: ComboboxPickerProps) {
  const root = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<Element | undefined>();
  const controlled = value !== undefined;
  const [kept, setKept] = useState(defaultValue ?? "");
  const picked = controlled ? value : kept;
  // A value the list no longer holds (the product changed under it) is none.
  const key = options.some((o) => o.value === picked) ? picked : "";

  // The pop-over is drawn where the field is: in the open dialog, else in
  // the panel's own portal node (ui/overlay.ts). Set before it can open.
  useEffect(() => {
    setPortal(overlayContainer(root.current));
  }, []);

  useEffect(() => {
    if (!focus) return;
    root.current?.querySelector<HTMLElement>("input")?.focus();
  }, [focus]);

  // An action form that empties itself after a success (ActionForm's
  // `resetOnSuccess`) resets the form: the pick goes with it.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form || controlled) return;
    const reset = () => setKept(defaultValue ?? "");
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue]);

  const items = (list: readonly ComboboxOption[]) =>
    list.map((o) => (
      <ListBoxItem
        key={o.value}
        id={o.value}
        textValue={o.label}
        isDisabled={o.disabled}
        className={ITEM}
      >
        {o.label}
      </ListBoxItem>
    ));

  return (
    <I18nProvider locale="tr-TR">
      <ComboBox
        ref={root}
        aria-label={
          ariaLabel ?? (ariaLabelledBy ? undefined : (placeholder ?? "Seçim"))
        }
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        selectedKey={key === "" ? null : key}
        onSelectionChange={(next) => {
          const text = next === null ? "" : String(next);
          setKept(text);
          onChange?.(text);
        }}
        defaultFilter={matchesOption}
        menuTrigger="focus"
        allowsEmptyCollection
        isRequired={required}
        isDisabled={disabled}
        isInvalid={invalid || undefined}
        className={`relative min-w-0 ${className ?? ""}`}
      >
        <Input
          id={id}
          placeholder={placeholder}
          data-field-name={name}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={`${FIELD_INPUT} pr-10 disabled:opacity-60`}
        />
        <AdminIcon
          name="chevron"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--admin-text-soft)]"
        />
        <Popover
          {...popoverPortal(portal)}
          placement="bottom start"
          className={POPOVER}
          style={{ width: "var(--trigger-width)" }}
        >
          <ListBox
            className={LIST}
            renderEmptyState={() => (
              <div className={EMPTY}>Eşleşen seçenek yok.</div>
            )}
          >
            {optionRuns(options).flatMap((run, i) =>
              run.group === null
                ? items(run.options)
                : [
                    <ListBoxSection
                      key={`${run.group}:${i}`}
                      id={`${run.group}:${i}`}
                    >
                      <Header className={HEADING}>{run.group}</Header>
                      {items(run.options)}
                    </ListBoxSection>,
                  ],
            )}
          </ListBox>
        </Popover>
      </ComboBox>
      {name !== undefined && <input type="hidden" name={name} value={key} />}
    </I18nProvider>
  );
}
