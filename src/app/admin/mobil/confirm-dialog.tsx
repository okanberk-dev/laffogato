"use client";

import { useEffect, useId, useRef, useState } from "react";

import { TextInput } from "@/components/admin/forms";
import { BUTTON, NUMERIC_STYLE } from "@/components/admin/ui";

/**
 * The question a save asks before it does something it cannot take back:
 * the app going into maintenance, the minimum version going up, a post's
 * commercial mail to the members.
 */
export interface ConfirmAsk {
  title: string;
  /** One sentence per consequence. */
  lines: string[];
  submitLabel: string;
  /** Typed back before the yes button opens (a version, a recipient count). */
  phrase?: string;
}

/** The phrase as typed matches: surrounding spaces and case do not count. */
export function phraseMatches(typed: string, phrase: string): boolean {
  return (
    typed.trim().toLocaleUpperCase("tr-TR") ===
    phrase.trim().toLocaleUpperCase("tr-TR")
  );
}

/**
 * "Bunu kaydedersen…": a native modal dialog (focus stays inside, Esc is
 * Vazgeç). Rendered inside the form it guards, so its buttons are
 * type="button" and the phrase box has no name: the yes hands the form to
 * `onConfirm`, which posts it, instead of submitting it again itself. With
 * a phrase, yes stays off until it is typed back.
 */
export function ConfirmDialog({
  ask,
  onCancel,
  onConfirm,
}: {
  ask: ConfirmAsk;
  onCancel: () => void;
  onConfirm: (form: HTMLFormElement) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const titleId = useId();
  const linesId = useId();
  const phraseId = useId();
  const [typed, setTyped] = useState("");
  const ready = !ask.phrase || phraseMatches(typed, ask.phrase);
  const yes = () => {
    confirmed.current = true;
    ref.current?.close();
  };
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Read out on open with the title, as the kit's ActionModal does:
      // focus lands on the phrase box or a button, not on the sentences.
      aria-describedby={linesId}
      onClose={() => {
        const form = ref.current?.closest("form");
        if (confirmed.current && form) onConfirm(form);
        else onCancel();
      }}
      // The kit dialog's frame (ActionModal), so both read the same.
      className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_12px_40px_rgba(28,25,23,0.14)] backdrop:bg-[rgba(28,25,23,0.32)] sm:max-w-lg"
      style={{ fontFamily: "var(--font-geist-sans), var(--sans)" }}
    >
      <div className="grid gap-4 p-5 sm:p-6">
        <h2
          id={titleId}
          className="text-lg font-semibold text-[var(--admin-text)]"
        >
          {ask.title}
        </h2>
        <div
          id={linesId}
          className="grid gap-2 text-sm text-[var(--admin-text-soft)]"
        >
          {ask.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {ask.phrase ? (
          <div className="grid gap-2">
            <label
              htmlFor={phraseId}
              className="text-sm text-[var(--admin-text-soft)]"
            >
              Onaylamak için{" "}
              <strong
                className="font-semibold text-[var(--admin-text)]"
                style={NUMERIC_STYLE}
              >
                {ask.phrase}
              </strong>{" "}
              yaz
            </label>
            <TextInput
              id={phraseId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                // Enter here would submit the form again, without the
                // yes; it means yes once the phrase matches.
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (ready) yes();
              }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              // A count is digits (the number pad); a version has dots.
              inputMode={/^\d+$/.test(ask.phrase) ? "numeric" : "text"}
              style={NUMERIC_STYLE}
            />
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={BUTTON.ghost}
            onClick={() => ref.current?.close()}
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!ready}
            className={BUTTON.dangerSolid}
            onClick={yes}
          >
            {ask.submitLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
