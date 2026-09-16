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
 *
 * Both now also mail the member (confirmation or cancellation), so the
 * success sentence is shown too: it says whether that message left. A booking
 * the member was never told about is the whole failure this was built to end.
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
  const error = confirmState.error ?? cancelState.error;
  const message = confirmState.message ?? cancelState.message;
  // "Gönderilemedi" is the one success worth reading as a warning.
  const mailFailed = Boolean(message?.includes("GÖNDERİLEMEDİ"));

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
      {error ? (
        <p
          role="alert"
          className="max-w-sm rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {error}
        </p>
      ) : null}
      {!error && message ? (
        <p
          role="status"
          className={`max-w-sm rounded-lg px-3 py-2 text-xs ${
            mailFailed
              ? "bg-amber-50 text-amber-800"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
