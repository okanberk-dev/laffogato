"use client";

import { unstable_rethrow } from "next/navigation";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cx } from "@/components/laffogato/cx";
import type { ActionResult } from "@/lib/admin/action-result";

import { Field, TextInput, Textarea } from "../forms";
import { BUTTON, MONO_STYLE, type ButtonVariant } from "./styles";
import { useNoResetSubmit } from "./submit";
import { adminPortalRoot, useToast } from "./toast";

/**
 * A Server Action that ActionModal can drive: `useActionState`'s shape, and
 * it answers with an ActionResult (lib/admin/action-result.ts). Every such
 * action does its own session + role check (CLAUDE.md rule 27).
 */
export type ModalAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

/** What the fields inside an ActionModal can read. */
export interface ActionModalState {
  /** `fieldErrors` of the last answer, by field `name`. */
  fieldErrors: Record<string, string>;
  pending: boolean;
  /** The id FieldError gives its message; point `aria-describedby` at it. */
  errorId: (name: string) => string;
}

const ModalStateContext = createContext<ActionModalState>({
  fieldErrors: {},
  pending: false,
  errorId: (name) => `field-error-${name}`,
});

/** The open modal's field errors and pending state, for nested fields. */
export function useActionModalState(): ActionModalState {
  return useContext(ModalStateContext);
}

/** The message for field `name` from the last answer, or nothing. */
export function FieldError({ name }: { name: string }) {
  const { fieldErrors, errorId } = useActionModalState();
  const message = fieldErrors[name];
  if (!message) return null;
  return (
    <p id={errorId(name)} className="text-xs text-[var(--admin-danger-ink)]">
      {message}
    </p>
  );
}

export interface ActionModalProps {
  /** The Server Action; it must answer with an ActionResult. */
  action: ModalAction;
  /** Dialog heading. */
  title: string;
  /** One or two plain sentences under the heading: what will happen. */
  description?: ReactNode;
  /** The button that opens the dialog. */
  trigger: ReactNode;
  /** Look of that button; default `ghost`. `menu` / `menuDanger` fit an ActionMenu. */
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  /**
   * When set, the trigger is drawn disabled with this reason next to it
   * ("İade yetkisi gerekiyor") and nothing opens. Hiding an action the
   * operator expected is worse than saying why it is off.
   */
  disabledReason?: string;
  /** Submit button text; default "Onayla". */
  submitLabel?: string;
  /** Default "Vazgeç". */
  cancelLabel?: string;
  /** Submit text while the action runs; default "İşleniyor…". */
  pendingLabel?: string;
  /** `danger` paints the submit solid red. */
  tone?: "default" | "danger";
  /**
   * "Type X to confirm": submit stays off until this text is typed (case and
   * surrounding spaces ignored). Posted as `confirm`, so the server can check
   * it too. Use it for actions that move money or touch many records.
   */
  confirmPhrase?: string;
  /** Label of that box; default `Onaylamak için "<phrase>" yaz`. */
  confirmLabel?: string;
  /** Hidden inputs posted with the form, e.g. `{ id: order.id }`. */
  hidden?: Record<string, string | number>;
  /**
   * The form's fields. A function receives the field errors and pending
   * state; plain children can read them with useActionModalState() or show
   * them with <FieldError name="…" />.
   */
  children?: ReactNode | ((state: ActionModalState) => ReactNode);
  /** After a success, once the dialog has closed and the toast is up. */
  onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void;
  /** Show the success message as a toast; default true. */
  toastOnSuccess?: boolean;
  /** Dialog width; default `md`. */
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<ActionModalProps["size"]>, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

/**
 * A form in a native modal `<dialog>` (`showModal()`: focus stays inside,
 * Esc closes, the page behind is inert). Built for actions that need a
 * reason, a choice or a second look before they run.
 *
 * - The form posts through `useActionState`; a refusal stays in the dialog
 *   (form error at the bottom, field errors under their fields).
 * - A success closes the dialog and shows the message as a toast (a warning
 *   tone stays until closed).
 * - Each opening starts from a fresh form: no stale error, no old typing.
 * - Rendered through a portal (adminPortalRoot, inside the admin wrapper so
 *   the tokens apply), so it works from inside an ActionMenu or a table cell
 *   whose overflow would clip it.
 *
 * @example
 * <ActionModal
 *   action={cancelOrderAction}
 *   title="Siparişi iptal et"
 *   description="Stok geri alınır, müşteriye e-posta gider."
 *   trigger="İptal et"
 *   triggerVariant="danger"
 *   tone="danger"
 *   submitLabel="İptal et"
 *   confirmPhrase={String(order.orderNo)}
 *   hidden={{ id: order.id }}
 * >
 *   <Field label="Neden"><Textarea name="reason" required /></Field>
 *   <FieldError name="reason" />
 * </ActionModal>
 */
export function ActionModal(props: ActionModalProps) {
  const {
    trigger,
    triggerVariant = "ghost",
    triggerClassName,
    disabledReason,
  } = props;
  const [open, setOpen] = useState(false);
  // A new key per opening: the form, its action state and its typing reset.
  const [session, setSession] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();

  if (disabledReason) {
    return (
      <span
        className={cx(
          "inline-flex flex-col",
          triggerVariant.startsWith("menu") && "w-full",
        )}
      >
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={reasonId}
          onClick={(e) => e.preventDefault()}
          className={cx(BUTTON[triggerVariant], triggerClassName)}
        >
          {trigger}
        </button>
        <span
          id={reasonId}
          className={cx(
            "text-xs text-[var(--admin-text-soft)]",
            triggerVariant.startsWith("menu") ? "-mt-2 px-3 pb-2" : "mt-1",
          )}
        >
          {disabledReason}
        </span>
      </span>
    );
  }

  const onClosed = () => {
    setOpen(false);
    // The browser hands focus back to the trigger. When the trigger sat in an
    // ActionMenu that has closed since, it is hidden and cannot take focus:
    // give it to the menu's button instead, so keyboard users are not
    // dropped on <body>.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      const t = triggerRef.current;
      if (!t) return;
      t.focus();
      if (document.activeElement !== t) {
        t.closest("details")?.querySelector("summary")?.focus();
      }
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
        className={cx(BUTTON[triggerVariant], triggerClassName)}
      >
        {trigger}
      </button>
      {open
        ? createPortal(
            <ModalDialog key={session} {...props} onClosed={onClosed} />,
            adminPortalRoot(),
          )
        : null}
    </>
  );
}

function ModalDialog({
  action,
  title,
  description,
  submitLabel = "Onayla",
  cancelLabel = "Vazgeç",
  pendingLabel = "İşleniyor…",
  tone = "default",
  confirmPhrase,
  confirmLabel,
  hidden,
  children,
  onSuccess,
  toastOnSuccess = true,
  size = "md",
  onClosed,
}: ActionModalProps & { onClosed: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const confirmId = `${baseId}-confirm`;

  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, formData) => {
    let result: ActionResult;
    try {
      result = await action(prev, formData);
    } catch (err) {
      // redirect() / notFound() are Next's own control flow: let them run.
      unstable_rethrow(err);
      return {
        ok: false,
        error:
          "Bir hata oldu ve işlem yarıda kalmış olabilir. Sayfayı yenileyip durumu kontrol et.",
      };
    }
    if (!result) {
      // An action that answered nothing (it redirected): nothing to show here.
      dialogRef.current?.close();
      return null;
    }
    if (result.ok) {
      if (toastOnSuccess) toast.fromResult(result);
      dialogRef.current?.close();
      onSuccess?.(result);
    }
    return result;
  }, null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Dispatched by hand rather than through `<form action>`: React resets an
  // action form's uncontrolled fields before the action runs, which would
  // wipe the reason the operator typed every time the server refuses it.
  const onSubmit = useNoResetSubmit(formAction, pending);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const ctx: ActionModalState = {
    fieldErrors,
    pending,
    errorId: (name) => `${baseId}-err-${name}`,
  };
  const confirmed =
    !confirmPhrase ||
    typed.trim().toLocaleLowerCase("tr-TR") ===
      confirmPhrase.trim().toLocaleLowerCase("tr-TR");

  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  // A click that both started and ended on the backdrop closes the dialog;
  // one that started inside (selecting text, then dragging out) does not.
  const onBackdropDown = (e: MouseEvent<HTMLDialogElement>) => {
    downOnBackdrop.current = e.target === e.currentTarget;
  };
  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (downOnBackdrop.current && e.target === e.currentTarget) close();
    downOnBackdrop.current = false;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClosed}
      onCancel={(e) => {
        // Esc while the action runs would hide a result the operator needs.
        if (pending) e.preventDefault();
      }}
      onMouseDown={onBackdropDown}
      onClick={onBackdropClick}
      className={cx(
        "fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_24px_64px_rgba(44,29,17,0.28)] backdrop:bg-[rgba(44,29,17,0.45)]",
        SIZE[size],
      )}
      style={{ fontFamily: "var(--font-poppins), var(--sans)" }}
    >
      <ModalStateContext.Provider value={ctx}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--admin-text)]"
            >
              {title}
            </h2>
            {description ? (
              <div
                id={descId}
                className="mt-1.5 text-sm text-[var(--admin-text-soft)]"
              >
                {description}
              </div>
            ) : null}
          </div>

          {hidden
            ? Object.entries(hidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))
            : null}

          {typeof children === "function" ? children(ctx) : children}

          {confirmPhrase ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor={confirmId}
                className="text-sm text-[var(--admin-text-soft)]"
              >
                {confirmLabel ?? (
                  <>
                    Onaylamak için{" "}
                    <strong
                      className="font-semibold text-[var(--admin-text)]"
                      style={MONO_STYLE}
                    >
                      {confirmPhrase}
                    </strong>{" "}
                    yaz
                  </>
                )}
              </label>
              <TextInput
                id={confirmId}
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          ) : null}

          {state && !state.ok ? (
            <div
              role="alert"
              className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
            >
              {state.error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className={BUTTON.ghost}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={pending || !confirmed}
              className={
                tone === "danger" ? BUTTON.dangerSolid : BUTTON.primary
              }
            >
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        </form>
      </ModalStateContext.Provider>
    </dialog>
  );
}

export interface ConfirmButtonProps {
  action: ModalAction;
  /** The button text, also the default submit text. */
  label: ReactNode;
  /** Dialog heading; default "Emin misin?". */
  title?: string;
  /** What will happen, in a sentence. */
  description?: ReactNode;
  /** Submit text; default `label` when it is a string, else "Onayla". */
  confirmLabel?: string;
  /** Default `danger`. */
  tone?: "default" | "danger";
  /** Trigger look; default `danger` for a danger tone, else `ghost`. */
  variant?: ButtonVariant;
  className?: string;
  hidden?: Record<string, string | number>;
  /**
   * Ask for a reason, posted as `reason` (or `name`). `true` for an
   * optional one; an object to require it or set its label.
   */
  reason?:
    | boolean
    | {
        label?: string;
        name?: string;
        required?: boolean;
        minLength?: number;
        maxLength?: number;
        placeholder?: string;
      };
  confirmPhrase?: string;
  disabledReason?: string;
  onSuccess?: ActionModalProps["onSuccess"];
}

/**
 * A one-click action behind "Emin misin?": ActionModal with no fields but an
 * optional reason. For pasifleştir, sil, kodu yenile and the like.
 *
 * @example
 * <ConfirmButton
 *   action={deletePromoAction}
 *   hidden={{ id: promo.id }}
 *   label="Sil"
 *   description={`${promo.code} kalıcı olarak silinir.`}
 * />
 */
export function ConfirmButton({
  action,
  label,
  title = "Emin misin?",
  description,
  confirmLabel,
  tone = "danger",
  variant,
  className,
  hidden,
  reason,
  confirmPhrase,
  disabledReason,
  onSuccess,
}: ConfirmButtonProps) {
  const r = reason === true ? {} : reason || null;
  const reasonName = r?.name ?? "reason";
  return (
    <ActionModal
      action={action}
      title={title}
      description={description}
      trigger={label}
      triggerVariant={variant ?? (tone === "danger" ? "danger" : "ghost")}
      triggerClassName={className}
      submitLabel={
        confirmLabel ?? (typeof label === "string" ? label : "Onayla")
      }
      tone={tone}
      hidden={hidden}
      confirmPhrase={confirmPhrase}
      disabledReason={disabledReason}
      onSuccess={onSuccess}
      size="sm"
    >
      {r
        ? ({ fieldErrors, errorId }) => (
            <div className="flex flex-col gap-1.5">
              <Field
                label={
                  r.label ?? (r.required ? "Neden" : "Neden (isteğe bağlı)")
                }
              >
                <Textarea
                  name={reasonName}
                  required={r.required}
                  minLength={r.minLength}
                  maxLength={r.maxLength ?? 500}
                  placeholder={r.placeholder}
                  aria-invalid={fieldErrors[reasonName] ? true : undefined}
                  aria-describedby={
                    fieldErrors[reasonName] ? errorId(reasonName) : undefined
                  }
                  className="min-h-[80px]"
                />
              </Field>
              <FieldError name={reasonName} />
            </div>
          )
        : null}
    </ActionModal>
  );
}
