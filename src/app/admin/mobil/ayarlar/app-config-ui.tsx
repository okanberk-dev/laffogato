"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  markFieldErrors,
  PANEL_ACTION_FAILED,
  useNoResetSubmit,
  withPanelCatch,
} from "@/components/admin/action-form";
import { Field, PrimaryButton } from "@/components/admin/forms";
import { announceAdminChange, useToast } from "@/components/admin/ui";
import {
  savedAnswer,
  useUnsavedGuard,
} from "@/components/admin/ui/unsaved-guard";

import { ConfirmDialog } from "../confirm-dialog";
import {
  CONFIRMED_FIELD,
  type AppConfigConfirm,
  type AppConfigState,
} from "./app-config-core";

// The pieces every Uygulama ayarları tab is built from: a form that keeps
// what was typed when the server refuses it, says what happened, puts each
// refusal under its field and asks before a save that closes the app.

export type AppConfigAction = (
  prev: AppConfigState,
  formData: FormData,
) => Promise<AppConfigState>;

export interface AppConfigFormApi {
  state: AppConfigState;
  pending: boolean;
  /** Typed into since the last answer: an old "kaydedildi" no longer holds. */
  edited: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onEdit: () => void;
  /** The confirm question of the last answer, until it is answered. */
  ask: AppConfigConfirm | null;
  cancelAsk: () => void;
  /** "Yes": post `form` again with the confirmed keys. */
  confirmAsk: (form: HTMLFormElement) => void;
  errorId: (name: string) => string;
}

/**
 * One tab's form state.
 *
 * - Posted by hand (useNoResetSubmit): React reset a `<form action>`'s
 *   fields once the action answered, so one refused field (a sales word in
 *   a reminder, the version typed as 1,2) put every field of the tab back
 *   to what was saved and ticked the boxes again (admin audit CON-03,
 *   KAR-02). A second press before the answer is dropped; a throw becomes
 *   a sentence instead of the panel's error page (withPanelCatch).
 * - A success is a toast (and the line by the button until the next edit);
 *   a refusal stays by the button (role="alert") and under its fields.
 * - An answer with `confirm` wrote nothing: the dialog asks, and "yes"
 *   posts the same form again with the confirmed keys.
 */
export function useAppConfigForm(action: AppConfigAction): AppConfigFormApi {
  const toast = useToast();
  const baseId = useId();
  const [edited, setEdited] = useState(false);
  // The answer whose question was answered (Vazgeç or yes): its dialog stays
  // closed. Every answer is a fresh object, so identity tells them apart.
  const [settled, setSettled] = useState<AppConfigState | null>(null);

  const [state, dispatch, pending] = useActionState<AppConfigState, FormData>(
    withPanelCatch<AppConfigState>(
      async (prev, formData) => {
        const result = { ...(await action(prev, formData)) };
        setEdited(false);
        if (!result.confirm && result.message && !result.error) {
          toast.show({ tone: "success", message: result.message });
          announceAdminChange();
        }
        return result;
      },
      () => {
        setEdited(false);
        return { error: PANEL_ACTION_FAILED };
      },
    ),
    {},
  );

  const onSubmit = useNoResetSubmit(dispatch, pending);
  const errorId = useCallback(
    (name: string) => `${baseId}-err-${name}`,
    [baseId],
  );

  return {
    state,
    pending,
    edited,
    onSubmit,
    onEdit: () => setEdited(true),
    ask: state.confirm && settled !== state ? state.confirm : null,
    cancelAsk: () => setSettled(state),
    confirmAsk: (form) => {
      const keys = state.confirm?.keys ?? [];
      setSettled(state);
      const formData = new FormData(form);
      for (const key of keys) formData.append(CONFIRMED_FIELD, key);
      startTransition(() => dispatch(formData));
    },
    errorId,
  };
}

const FieldErrorsContext = createContext<{
  fieldErrors: Record<string, string>;
  errorId: (name: string) => string;
}>({ fieldErrors: {}, errorId: (name) => `app-config-err-${name}` });

/** A tab's `<form>`, with its confirm dialog. */
export function ConfigForm({
  form,
  children,
}: {
  form: AppConfigFormApi;
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const { state, errorId } = form;

  // Leaving with this tab's edits unsaved asks (a link, the palette, a
  // reload); a save that wrote makes what was posted the saved state. One
  // call guards all nine tabs: each is its own form, and the guard asks
  // once however many are dirty.
  useUnsavedGuard(ref, { saved: savedAnswer(state) });

  // After each answer: mark the refused fields for assistive tech and move
  // focus to the first one (the same as ActionForm).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = markFieldErrors(
      Array.from(el.elements),
      state.fieldErrors ?? {},
      errorId,
    );
    if (first instanceof HTMLElement) first.focus();
  }, [state, errorId]);

  return (
    <FieldErrorsContext.Provider
      value={{ fieldErrors: state.fieldErrors ?? {}, errorId }}
    >
      {/* method="post": pressed before the JavaScript runs, a bare form is
          a GET that puts what was typed in the address bar. */}
      <form
        ref={ref}
        method="post"
        onSubmit={form.onSubmit}
        onInput={form.onEdit}
        onChange={form.onEdit}
      >
        {children}
        {form.ask ? (
          <ConfirmDialog
            ask={form.ask}
            onCancel={form.cancelAsk}
            onConfirm={form.confirmAsk}
          />
        ) : null}
      </form>
    </FieldErrorsContext.Provider>
  );
}

/** The message under field `name` from the last refusal, or nothing. */
export function ConfigFieldError({ name }: { name: string }) {
  const { fieldErrors, errorId } = useContext(FieldErrorsContext);
  const message = fieldErrors[name];
  if (!message) return null;
  return (
    <p id={errorId(name)} className="text-xs text-[var(--admin-danger-ink)]">
      {message}
    </p>
  );
}

/**
 * A Field with the last refusal for its control under it, outside the
 * label (inside, the message would become part of the control's name).
 */
export function ConfigField({
  name,
  label,
  hint,
  children,
}: {
  /** The control's `name`, which the action's fieldErrors use. */
  name: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Field label={label} hint={hint}>
        {children}
      </Field>
      <ConfigFieldError name={name} />
    </div>
  );
}

const IDLE =
  "Yalnız bu bölüm kaydedilir. Uygulama açılışta okur; en geç 5 dakikada yayılır.";

/**
 * The tab's answer and its button. A refusal is read out (role="alert");
 * a success is the toast, and its line here (role="status") goes once the
 * form is typed into again.
 */
export function SaveBar({ form }: { form: AppConfigFormApi }) {
  const { state, pending, edited } = form;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
      <div className="min-w-0 flex-1 basis-56 text-xs">
        {state.error ? (
          <p role="alert" className="text-sm text-[var(--admin-danger-ink)]">
            {state.error}
          </p>
        ) : (
          <p role="status" className="text-[var(--admin-text-soft)]">
            {state.message && !edited ? (
              <span className="text-[var(--admin-success)]">
                {state.message}
              </span>
            ) : (
              IDLE
            )}
          </p>
        )}
      </div>
      <PrimaryButton
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </PrimaryButton>
    </div>
  );
}
