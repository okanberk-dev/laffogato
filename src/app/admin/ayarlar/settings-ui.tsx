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
import { announceAdminChange, BUTTON, useToast } from "@/components/admin/ui";

import {
  CONFIRMED_FIELD,
  defaultsSnapshot,
  formSnapshot,
  type DefaultsControl,
  type SettingsConfirm,
  type SettingsState,
  type SettingsTabId,
} from "./settings-core";

// The pieces every settings tab is built from (settings-form.tsx and
// karaoke-tab.tsx): a form that keeps what was typed, says what happened,
// asks before a dangerous save and knows when it has unsaved changes.

export type SettingsAction = (
  prev: SettingsState,
  formData: FormData,
) => Promise<SettingsState>;

/** SettingsForm hears which tabs have unsaved changes through this. */
export const DirtyReportContext = createContext<
  (tab: SettingsTabId, dirty: boolean) => void
>(() => {});

export interface SettingsFormApi {
  state: SettingsState;
  pending: boolean;
  /** The form differs from what was last loaded or saved. */
  dirty: boolean;
  /** Typed into since the last answer: an old "kaydedildi" no longer holds. */
  edited: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** The form's input / change handler. */
  onEdit: (e: FormEvent<HTMLFormElement>) => void;
  /** The confirm question of the last answer, until it is answered. */
  ask: SettingsConfirm | null;
  cancelAsk: () => void;
  /** "Yes": post `form` again with the confirmed keys. */
  confirmAsk: (form: HTMLFormElement) => void;
  errorId: (name: string) => string;
}

const readSnapshot = (form: HTMLFormElement) =>
  formSnapshot(new FormData(form).entries());

const readDefaults = (form: HTMLFormElement) =>
  defaultsSnapshot(
    Array.from(form.elements) as unknown as Iterable<DefaultsControl>,
  );

/**
 * One settings form's state.
 *
 * - Posted by hand (useNoResetSubmit): React reset a `<form action>`'s
 *   fields once the action answered, so a refused save put "Online mağaza
 *   açık" and the indexing switch back ON and dropped the rest of the typing
 *   (admin audit SYS-01, KAR-02). A throw becomes a sentence instead of the
 *   panel's error page (withPanelCatch).
 * - A success is a toast, like the rest of the panel; a refusal stays next
 *   to the button (role="alert") and on the fields it names.
 * - An answer with `confirm` wrote nothing: the dialog asks, and "yes"
 *   posts the same form again with the confirmed keys.
 * - `dirty` compares the form with its own defaults (what the page was
 *   rendered with, i.e. what is saved), then with what the last successful
 *   save posted; with `trackDirty` it is reported to SettingsForm (tab dot,
 *   leave guard).
 */
export function useSettingsForm(
  action: SettingsAction,
  { tab, trackDirty = true }: { tab: SettingsTabId; trackDirty?: boolean },
): SettingsFormApi {
  const toast = useToast();
  const report = useContext(DirtyReportContext);
  const baseId = useId();
  // What this form's last successful save posted; until then, the form's
  // defaults as of the last edit.
  const [saved, setSaved] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  // The answer whose question was answered (Vazgeç or yes): its dialog stays
  // closed. Every answer is a fresh object, so identity tells them apart.
  const [settled, setSettled] = useState<SettingsState | null>(null);

  const [state, dispatch, pending] = useActionState<SettingsState, FormData>(
    withPanelCatch<SettingsState>(
      async (prev, formData) => {
        const result = { ...(await action(prev, formData)) };
        setEdited(false);
        if (!result.confirm && result.message && !result.error) {
          // What was posted is what is saved now.
          setSaved(formSnapshot(formData.entries()));
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
  const baseline = saved ?? loaded;
  const dirty = baseline !== null && current !== null && current !== baseline;

  useEffect(() => {
    if (!trackDirty) return;
    report(tab, dirty);
  }, [report, tab, dirty, trackDirty]);
  useEffect(() => {
    if (!trackDirty) return;
    return () => report(tab, false);
  }, [report, tab, trackDirty]);

  const errorId = useCallback(
    (name: string) => `${baseId}-err-${name}`,
    [baseId],
  );

  return {
    state,
    pending,
    dirty,
    edited,
    onSubmit,
    onEdit: (e) => {
      const el = e.currentTarget;
      setCurrent(readSnapshot(el));
      if (saved === null) setLoaded(readDefaults(el));
      setEdited(true);
    },
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
}>({ fieldErrors: {}, errorId: (name) => `settings-err-${name}` });

/** A settings tab's `<form>`, with its confirm dialog. */
export function SettingsTabForm({
  form,
  children,
  className,
}: {
  form: SettingsFormApi;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const { state, errorId } = form;

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
      {/* method="post": pressed before the JS runs, a bare form is a GET
          that puts the addresses typed here in the URL, the history and
          the request log. A POST to the page only renders it again. */}
      <form
        ref={ref}
        method="post"
        onSubmit={form.onSubmit}
        onInput={form.onEdit}
        onChange={form.onEdit}
        className={className}
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
export function SettingsFieldError({ name }: { name: string }) {
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
export function SettingsField({
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
      <SettingsFieldError name={name} />
    </div>
  );
}

/**
 * "Bunu kaydedersen…": a native modal dialog (focus stays inside, Esc is
 * Vazgeç, and closing hands focus back to the button that asked). Inside
 * the tab's form, so its buttons are type="button": the confirm posts
 * through the hook, not by submitting the form again.
 */
function ConfirmDialog({
  ask,
  onCancel,
  onConfirm,
}: {
  ask: SettingsConfirm;
  onCancel: () => void;
  onConfirm: (form: HTMLFormElement) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        const form = ref.current?.closest("form");
        if (confirmed.current && form) onConfirm(form);
        else onCancel();
      }}
      // The kit dialog's frame (ActionModal), so both read the same.
      className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_24px_64px_rgba(44,29,17,0.28)] backdrop:bg-[rgba(44,29,17,0.45)] sm:max-w-lg"
      style={{ fontFamily: "var(--font-poppins), var(--sans)" }}
    >
      <div className="grid gap-4 p-5 sm:p-6">
        <h2
          id={titleId}
          className="text-lg font-semibold text-[var(--admin-text)]"
        >
          {ask.title}
        </h2>
        <div className="grid gap-2 text-sm text-[var(--admin-text-soft)]">
          {ask.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
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
            className={BUTTON.dangerSolid}
            onClick={() => {
              confirmed.current = true;
              ref.current?.close();
            }}
          >
            {ask.submitLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * The tab's answer and its button. A refusal is read out (role="alert");
 * a success is the toast, and its line here goes once the form is typed
 * into again. `disabledReason` holds the button back with the reason
 * next to it.
 */
export function SaveBar({
  form,
  label = "Kaydet",
  pendingLabel = "Kaydediliyor…",
  idle = "Kaydedince sitede hemen geçerli olur; uygulamaya birkaç dakika içinde yansır.",
  disabledReason,
}: {
  form: SettingsFormApi;
  label?: string;
  pendingLabel?: string;
  idle?: string;
  disabledReason?: string;
}) {
  const reasonId = useId();
  const { state, pending, dirty, edited } = form;
  let line: ReactNode;
  if (state.error) {
    line = (
      <p role="alert" className="text-sm text-[var(--admin-danger-ink)]">
        {state.error}
      </p>
    );
  } else if (state.message && !edited && !dirty) {
    line = <p className="text-[var(--admin-success)]">{state.message}</p>;
  } else if (dirty) {
    line = (
      <p className="text-[var(--admin-warning)]">
        Kaydedilmemiş değişiklik var.
      </p>
    );
  } else {
    line = <p className="text-[var(--admin-text-soft)]">{idle}</p>;
  }
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
      <div className="grid min-w-0 flex-1 basis-56 gap-1 text-xs">
        {line}
        {disabledReason ? (
          <p id={reasonId} className="text-[var(--admin-text-soft)]">
            {disabledReason}
          </p>
        ) : null}
      </div>
      <PrimaryButton
        type="submit"
        disabled={pending || Boolean(disabledReason)}
        aria-describedby={disabledReason ? reasonId : undefined}
        aria-busy={pending || undefined}
      >
        {pending ? pendingLabel : label}
      </PrimaryButton>
    </div>
  );
}
