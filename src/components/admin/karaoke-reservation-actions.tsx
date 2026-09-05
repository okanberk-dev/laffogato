"use client";

import { useActionState } from "react";

import {
  cancelReservationAction,
  confirmReservationAction,
  type ReservationActionState,
} from "@/app/admin/mobil/karaoke/actions";

import { DangerButton, PrimaryButton } from "./forms";

const initial: ReservationActionState = {};

interface Props {
  id: string;
  /** Only a `requested` booking can still be confirmed. */
  canConfirm: boolean;
  /** A cancelled booking has nothing left to cancel. */
  canCancel: boolean;
}

/**
 * Onayla / İptal buttons with somewhere for the refusal to land.
 *
 * The two actions can legitimately fail — the hour was taken by another
 * confirmed booking in the meantime, or someone else already answered this
 * request — and they used to return void, so the button just re-rendered the
 * same row and the staff member assumed it had worked.
 */
export function KaraokeReservationActions({
  id,
  canConfirm,
  canCancel,
}: Props) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmReservationAction,
    initial,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelReservationAction,
    initial,
  );
  const feedback = confirmState.error ?? cancelState.error;

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex items-center gap-2">
        {canConfirm ? (
          <form action={confirmAction}>
            <input type="hidden" name="id" value={id} />
            <PrimaryButton type="submit" disabled={confirmPending}>
              Onayla
            </PrimaryButton>
          </form>
        ) : null}
        {canCancel ? (
          <form action={cancelAction}>
            <input type="hidden" name="id" value={id} />
            <DangerButton type="submit" disabled={cancelPending}>
              İptal
            </DangerButton>
          </form>
        ) : null}
      </div>
      {feedback ? (
        <p
          role="alert"
          className="max-w-sm rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
