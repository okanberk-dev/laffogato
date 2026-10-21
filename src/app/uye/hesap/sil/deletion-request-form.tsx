"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";

import { BusyDots } from "@/components/laffogato/busy-dots";
import { DELETION_REASON_MAX } from "@/lib/customer/deletion-request-core";

import {
  requestAccountDeletionAction,
  type DeletionRequestState,
} from "../../actions";

const initial: DeletionRequestState = {};

/**
 * The member's deletion request: an optional reason and one box, unticked
 * until they tick it (the server refuses without it as well).
 *
 * Posted by hand from onSubmit, so a refusal - a reason past the limit, the
 * daily budget - comes back with the text still in the box: React 19 empties
 * a form action's fields when it answers. Without JavaScript the form still
 * posts to the action itself (never a GET with the reason in the address).
 */
export function DeletionRequestForm() {
  const [state, action, pending] = useActionState(
    requestAccountDeletionAction,
    initial,
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form action={action} onSubmit={onSubmit} className="deletion-form">
      <div className="account-field">
        <label htmlFor="deletion-reason">
          Neden ayrılıyorsun? <small>İsteğe bağlı</small>
        </label>
        <textarea
          id="deletion-reason"
          name="reason"
          rows={3}
          maxLength={DELETION_REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <small aria-live="polite">
          {reason.length}/{DELETION_REASON_MAX}
        </small>
      </div>
      <label className="auth-consent">
        <input
          type="checkbox"
          name="confirm"
          required
          onChange={(e) => setConfirmed(e.currentTarget.checked)}
        />
        <span>Hesabımın silinmesini istiyorum</span>
      </label>
      {state.error && (
        <div className="account-msg" data-tone="error" role="alert">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending || !confirmed}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <BusyDots />
            Gönderiliyor…
          </>
        ) : (
          "Silme talebini gönder"
        )}
      </button>
    </form>
  );
}
