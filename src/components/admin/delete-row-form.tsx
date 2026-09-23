"use client";

import { useFormStatus } from "react-dom";

import { DangerButton } from "./forms";

function DeleteButton({
  confirmMessage,
  label,
}: {
  confirmMessage: string;
  label: string;
}) {
  // `useFormStatus` reflects the in-flight state of the enclosing <form>, so
  // the button disables itself and swaps to a progress label while the server
  // action runs - preventing accidental double-submits.
  const { pending } = useFormStatus();
  return (
    <DangerButton
      type="submit"
      className="text-xs"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? "Siliniyor…" : label}
    </DangerButton>
  );
}

/**
 * Single-row delete form with a confirm guard and pending feedback. Wraps the
 * given server action with a hidden `id` field; the submit button asks for
 * confirmation before firing and shows a busy state while it runs.
 */
export function DeleteRowForm({
  action,
  id,
  confirmMessage,
  label = "Sil",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  confirmMessage: string;
  label?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <DeleteButton confirmMessage={confirmMessage} label={label} />
    </form>
  );
}
