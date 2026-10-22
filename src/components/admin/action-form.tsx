"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from "react";

import { cx } from "@/components/laffogato/cx";
import type { ActionResult } from "@/lib/admin/action-result";

import { BUTTON, useToast, type ButtonVariant, type ModalAction } from "./ui";
import { announceAdminChange } from "./ui/admin-changed";
import { useHandPost, withPanelCatch, type BeforeSubmit } from "./ui/submit";
import type { Wizard } from "./ui/wizard";

// The hand-dispatch helpers live in ui/submit.ts (ActionModal uses them
// too); the panel's forms import them from here.
export {
  replayByHand,
  submitByHand,
  useHandPost,
  useNoResetSubmit,
  withPanelCatch,
  type BeforeSubmit,
  type HandPost,
} from "./ui/submit";

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

/** The answer to an action that threw: something may have been written. */
export const PANEL_ACTION_FAILED =
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
export function runPanelAction(
  action: ModalAction,
  prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult | null> {
  return withPanelCatch<ActionResult | null>(
    async (p, fd) => (await action(p, fd)) ?? null,
    () => ({ ok: false, error: PANEL_ACTION_FAILED }),
  )(prev, formData);
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
        announceAdminChange();
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
  /** "bare": none of the kit's looks, `className` is all of it (MoveButtons). */
  variant?: ButtonVariant | "bare";
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
        className={cx(variant === "bare" ? null : BUTTON[variant], className)}
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
    // A searchable picker (ui/combobox-field.tsx) posts its value from a
    // hidden input and names its visible box in data-field-name instead.
    const name = el.getAttribute("name") ?? el.getAttribute("data-field-name");
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
 * Dispatched by hand (useHandPost, like ActionModal) rather than
 * through `<form action>`: React resets an action form's uncontrolled
 * fields once the action finishes, whatever it answers, which wiped
 * everything the operator typed each time the server refused one field. A second submit before the
 * answer is dropped. The form has an `action` too, so an Enter before
 * hydration meets React's guard instead of the browser's own GET, and the
 * submit React replays once the page is live passes the same gate
 * (ui/submit.ts).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  beforeSubmit,
  formRef: outerRef,
  wizard,
}: {
  action: ModalAction;
  children: ReactNode;
  className?: string;
  /** Empty the form after a success that stays on the page. */
  resetOnSuccess?: boolean;
  /**
   * The form's element, for what the page itself does with it (the
   * unsaved-changes guard, ui/unsaved-guard.ts).
   */
  formRef?: Ref<HTMLFormElement>;
  /**
   * Runs before the post; return `false` to stop it (nothing is sent, the
   * form stays as typed). For a check only the browser can make.
   */
  beforeSubmit?: BeforeSubmit;
  /**
   * A step-by-step form (ui/wizard.tsx, WizardActionForm): the browser's
   * own check is off (the kit checks each step), Enter moves to the next
   * step, and a refusal opens the step of its first field.
   */
  wizard?: Pick<Wizard, "enabled" | "onKeyDown" | "openErrors">;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Handed out by a layout effect, so the page's own effects find it set.
  useImperativeHandle(outerRef, () => formRef.current as HTMLFormElement);
  const baseId = useId();
  const run: ModalAction = wizard?.enabled
    ? async (prev, formData) => {
        const result = await action(prev, formData);
        if (result && !result.ok) wizard.openErrors(result.fieldErrors);
        return result;
      }
    : action;
  const [state, formAction, pending] = useToastAction(run, {
    // A refusal is shown in the form itself, next to what has to change.
    toastError: false,
    onSuccess: () => {
      if (resetOnSuccess) formRef.current?.reset();
    },
  });

  const post = useHandPost(formAction, pending, { beforeSubmit });

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
      <form
        ref={formRef}
        action={post.action}
        onSubmit={post.onSubmit}
        onKeyDown={wizard?.enabled ? wizard.onKeyDown : undefined}
        noValidate={wizard?.enabled || undefined}
        className={className}
      >
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
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  /**
   * Posted with the form when this button sends it (a form with two submit
   * buttons tells them apart: "Kaydet ve yenisini ekle").
   */
  name?: string;
  value?: string;
}) {
  const { pending } = useActionFormState();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cx(BUTTON[variant], className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
