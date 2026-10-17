"use client";

import { useEffect, useId, type RefObject } from "react";

import { markFieldErrors } from "./action-form";

/**
 * The answer lines of the forms that keep their own `useActionState` shape
 * (`{ error, message, fieldErrors }`) instead of ActionForm's ActionResult:
 * the member, promo, coupon, stamp and panel-user forms.
 *
 * Their field errors used to go through Field's `hint`, the same grey 12 px
 * as the help text (4.16:1), with nothing announced and focus left on the
 * submit button. These are ActionForm's FormFieldError and FormMessage
 * without its context: danger ink, `role="alert"`.
 */

/** The form-level refusal, or nothing. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
    >
      {message}
    </div>
  );
}

/** A success that stays on the page, or nothing. */
export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-xl bg-[var(--admin-success-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-success)]"
    >
      {message}
    </div>
  );
}

/** One field's message, under the field; `id` is what the field points at. */
export function FieldErrorText({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-[var(--admin-danger-ink)]">
      {message}
    </p>
  );
}

/**
 * After each answer: marks the refused fields (`aria-invalid` and an
 * `aria-describedby` to their FieldErrorText) and moves focus to the first
 * one, as ActionForm does. Returns the id for a field's message.
 */
export function useFieldErrors(
  formRef: RefObject<HTMLFormElement | null>,
  state: { fieldErrors?: Record<string, string> },
): (name: string) => string {
  const baseId = useId();
  const errorId = (name: string) => `${baseId}-err-${name}`;
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const first = markFieldErrors(
      Array.from(form.elements),
      state.fieldErrors ?? {},
      (name) => `${baseId}-err-${name}`,
    );
    if (first instanceof HTMLElement) first.focus();
  }, [formRef, state, baseId]);
  return errorId;
}
