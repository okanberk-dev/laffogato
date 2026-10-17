"use client";

import { unstable_rethrow } from "next/navigation";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";

import { cx } from "@/components/laffogato/cx";
import type { ActionResult } from "@/lib/admin/action-result";

import { BUTTON, useToast, type ButtonVariant, type ModalAction } from "./ui";

/**
 * The two pieces the panel's plain forms and one-click buttons were missing:
 * an answer the operator can see. Both drive a Server Action that answers
 * with an ActionResult (lib/admin/action-result.ts), the same shape
 * ActionModal / ConfirmButton use, so one action works behind either.
 *
 * - ActionButton: a one-click, reversible action (Aktifleştir, Tükendi).
 *   Success and refusal both come back as a toast.
 * - ActionForm: a page form. Field errors land under their fields
 *   (<FormFieldError name="…" />), the form error next to the submit button
 *   (<FormMessage />), success as a toast. An action that redirects leaves
 *   its toast with setAdminFlash (lib/admin/flash.ts).
 */

const FAILED =
  "Bir hata oldu ve işlem yarıda kalmış olabilir. Sayfayı yenileyip durumu kontrol et.";

interface ToastActionOptions {
  /** Show a refusal as a toast too; default true. */
  toastError?: boolean;
  onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void;
}

/**
 * Runs a panel action once. A thrown error becomes a "Bir hata oldu…"
 * answer instead of the full-page error screen; redirect() and notFound()
 * still run (unstable_rethrow). An action that redirected answers nothing
 * (null); its flash cookie is the toast.
 */
export async function runPanelAction(
  action: ModalAction,
  prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult | null> {
  try {
    return (await action(prev, formData)) ?? null;
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: FAILED };
  }
}

/** `useActionState` for a panel action, with its answer shown as a toast. */
export function useToastAction(
  action: ModalAction,
  { toastError = true, onSuccess }: ToastActionOptions = {},
) {
  const toast = useToast();
  return useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await runPanelAction(action, prev, formData);
      if (!result) return null;
      if (result.ok) {
        toast.fromResult(result);
        onSuccess?.(result);
      } else if (toastError) {
        toast.fromResult(result);
      }
      return result;
    },
    null,
  );
}

/**
 * A one-click action: hidden inputs plus one submit button, the answer as a
 * toast. For something reversible that needs no second look; anything that
 * deletes, closes or takes away goes behind ConfirmButton instead.
 */
export function ActionButton({
  action,
  hidden,
  children,
  pendingLabel,
  variant = "ghost",
  className,
  title,
  ariaLabel,
}: {
  action: ModalAction;
  hidden?: Record<string, string | number>;
  children: ReactNode;
  /** Button text while the action runs; default the label itself. */
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  title?: string;
  /**
   * The name a screen reader hears, for a button repeated on every row
   * ("Tükendi: Çilekli Matcha" rather than a list of "Tükendi"). Start it
   * with the visible text so a voice command still finds it.
   */
  ariaLabel?: string;
}) {
  const [, formAction, pending] = useToastAction(action);
  return (
    <form
      action={formAction}
      className={variant.startsWith("menu") ? "w-full" : "inline-flex"}
    >
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        aria-label={ariaLabel}
        title={title}
        className={cx(BUTTON[variant], className)}
      >
        {pending ? (pendingLabel ?? children) : children}
      </button>
    </form>
  );
}

interface FormState {
  fieldErrors: Record<string, string>;
  error: string | null;
  pending: boolean;
  errorId: (name: string) => string;
}

const FormStateContext = createContext<FormState>({
  fieldErrors: {},
  error: null,
  pending: false,
  errorId: (name) => `form-error-${name}`,
});

/** The enclosing ActionForm's field errors, form error and pending state. */
export function useActionFormState(): FormState {
  return useContext(FormStateContext);
}

/** The part of a form control markFieldErrors touches. */
interface MarkableControl {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Ties the last refusal to the controls it names: `aria-invalid` and an
 * `aria-describedby` pointing at the field's FormFieldError, both cleared
 * from a control that is fine again. A message under a field is only read
 * out with its field when the field says so; the forms' own markup does not
 * (Field puts the hint inside the label), so this runs on the form after
 * each answer. Returns the first control marked, for focus. Exported for
 * tests.
 */
export function markFieldErrors(
  controls: Iterable<MarkableControl>,
  fieldErrors: Record<string, string>,
  errorId: (name: string) => string,
): MarkableControl | null {
  let first: MarkableControl | null = null;
  for (const el of controls) {
    const name = el.getAttribute("name");
    if (!name || el.getAttribute("type") === "hidden") continue;
    const id = errorId(name);
    const described = (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter((x) => x && x !== id);
    if (fieldErrors[name]) {
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", [...described, id].join(" "));
      first ??= el;
    } else {
      el.removeAttribute("aria-invalid");
      if (described.length > 0) {
        el.setAttribute("aria-describedby", described.join(" "));
      } else {
        el.removeAttribute("aria-describedby");
      }
    }
  }
  return first;
}

/**
 * A page form driven by an ActionResult action.
 *
 * Dispatched by hand (like ActionModal) rather than through `<form action>`:
 * React resets an action form's uncontrolled fields once the action
 * finishes, which wiped everything the operator typed each time the server
 * refused one field.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: ModalAction;
  children: ReactNode;
  className?: string;
  /** Empty the form after a success that stays on the page. */
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const baseId = useId();
  const [state, formAction, pending] = useToastAction(action, {
    // A refusal is shown in the form itself, next to what has to change.
    toastError: false,
    onSuccess: () => {
      if (resetOnSuccess) formRef.current?.reset();
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };

  const errorId = (name: string) => `${baseId}-err-${name}`;
  const ctx: FormState = {
    fieldErrors: state && !state.ok ? (state.fieldErrors ?? {}) : {},
    error: state && !state.ok ? state.error : null,
    pending,
    errorId,
  };

  // After each answer: mark the refused fields for assistive tech and move
  // focus to the first one, so a keyboard user lands on what to change
  // instead of staying on the submit button.
  useEffect(() => {
    const form = formRef.current;
    if (!form || !state) return;
    const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
    const first = markFieldErrors(
      Array.from(form.elements),
      errors,
      (name) => `${baseId}-err-${name}`,
    );
    if (first instanceof HTMLElement) first.focus();
  }, [state, baseId]);

  return (
    <FormStateContext.Provider value={ctx}>
      <form ref={formRef} onSubmit={onSubmit} className={className}>
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

/** The message for field `name` from the last refusal, or nothing. */
export function FormFieldError({ name }: { name: string }) {
  const { fieldErrors, errorId } = useActionFormState();
  const message = fieldErrors[name];
  if (!message) return null;
  return (
    <p
      id={errorId(name)}
      className="text-xs text-[var(--admin-danger-ink)]"
      role="alert"
    >
      {message}
    </p>
  );
}

/** The form-level refusal ("Formdaki uyarıları gider."), or nothing. */
export function FormMessage() {
  const { error } = useActionFormState();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
    >
      {error}
    </div>
  );
}

/** The form's submit button: disabled, with its own label, while it runs. */
export function SubmitButton({
  children,
  pendingLabel = "Kaydediliyor…",
  variant = "primary",
  className,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useActionFormState();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(BUTTON[variant], className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
