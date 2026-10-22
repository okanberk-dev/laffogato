"use client";

import { useRef, type ReactNode } from "react";

import { ActionForm, useActionFormState } from "./action-form";
import type { ModalAction } from "./ui";
import type { BeforeSubmit } from "./ui/submit";
import { useUnsavedGuard } from "./ui/unsaved-guard";
import {
  useWizard,
  WizardFrame,
  type Wizard,
  type WizardStep,
} from "./ui/wizard";

/**
 * GuardedActionForm as a wizard (ui/wizard.tsx): the form's sections as
 * steps, a summary at the end, the same ActionForm post (answers, toasts,
 * field errors, the unsaved-changes guard). The steps may be drawn on the
 * server (their bodies are plain elements); the summary step then uses
 * WizardAutoSummary. With `mode: "page"` (an edit) the sections are cards
 * on one page.
 */
export function WizardActionForm({
  action,
  steps,
  mode = "wizard",
  label,
  cancelHref,
  submitLabel,
  pendingLabel = "Kaydediliyor…",
  extraActions,
  beforeSubmit,
  className = "grid gap-5",
  children,
}: {
  action: ModalAction;
  steps: WizardStep[];
  mode?: "wizard" | "page";
  label: string;
  cancelHref: string;
  submitLabel: string;
  pendingLabel?: string;
  /** Beside the submit on the last step (a second submit button). */
  extraActions?: ReactNode;
  /** The form's own check before the post, after the steps' (a dialog). */
  beforeSubmit?: BeforeSubmit;
  className?: string;
  /** Drawn after the steps, inside the form (a dialog it opens). */
  children?: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedGuard(formRef);
  const wizard = useWizard({ steps, formRef, enabled: mode === "wizard" });
  return (
    <ActionForm
      action={action}
      formRef={formRef}
      wizard={wizard}
      beforeSubmit={(form, submitter) =>
        wizard.beforeSubmit() && beforeSubmit?.(form, submitter) !== false
      }
      className={`${className} [&>*]:min-w-0`}
    >
      <Frame
        wizard={wizard}
        steps={steps}
        label={label}
        cancelHref={cancelHref}
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        extraActions={extraActions}
      />
      {children}
    </ActionForm>
  );
}

/** Inside the ActionForm: its pending state and last refusal. */
function Frame({
  wizard,
  steps,
  label,
  cancelHref,
  submitLabel,
  pendingLabel,
  extraActions,
}: {
  wizard: Wizard;
  steps: WizardStep[];
  label: string;
  cancelHref: string;
  submitLabel: string;
  pendingLabel: string;
  extraActions?: ReactNode;
}) {
  const { pending, fieldErrors, error } = useActionFormState();
  return (
    <WizardFrame
      wizard={wizard}
      steps={steps}
      serverErrors={fieldErrors}
      formError={error}
      cancelHref={cancelHref}
      submitLabel={submitLabel}
      pendingLabel={pendingLabel}
      pending={pending}
      label={label}
      extraActions={extraActions}
    />
  );
}
