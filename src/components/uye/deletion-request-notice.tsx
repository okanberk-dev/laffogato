"use client";

import { useActionState } from "react";

import {
  withdrawAccountDeletionAction,
  type DeletionRequestState,
} from "@/app/uye/actions";
import { BusyDots } from "@/components/laffogato/busy-dots";
import Link from "@/components/link";

const initial: DeletionRequestState = {};

/**
 * "Silme talebin alındı": an open web deletion request, on the account
 * overview and on /uye/hesap/sil, with the way to take it back. Dates come
 * formatted from the server (the köşk's calendar, rule 22).
 */
export function DeletionRequestNotice({
  requestedOn,
  deadline,
  showLink = false,
}: {
  requestedOn: string;
  deadline: string;
  /** On the overview: a link to the request page. */
  showLink?: boolean;
}) {
  const [state, action, pending] = useActionState(
    withdrawAccountDeletionAction,
    initial,
  );
  return (
    <div className="deletion-notice" role="status">
      <div className="deletion-notice-copy">
        <strong className="deletion-notice-title">
          Silme talebin alındı ({requestedOn})
        </strong>
        <p>
          Hesabını en geç {deadline} tarihine kadar siler ve sana e-posta ile
          haber veririz. Fikrini değiştirdiysen talebini geri alabilirsin.
        </p>
        {showLink && (
          <Link href="/uye/hesap/sil" className="deletion-notice-link">
            Talebin ve saklanan bilgiler
          </Link>
        )}
      </div>
      <form action={action} className="deletion-notice-action">
        <button
          type="submit"
          className="btn btn-ghost btn-sm"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <>
              <BusyDots />
              Geri alınıyor…
            </>
          ) : (
            "Talebi geri al"
          )}
        </button>
      </form>
      {state.error && (
        <div
          className="account-msg deletion-notice-msg"
          data-tone="error"
          role="alert"
        >
          {state.error}
        </div>
      )}
    </div>
  );
}
