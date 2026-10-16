"use client";

import { useActionState } from "react";

import {
  cancelReservationAction,
  confirmReservationAction,
  retryKaraokeRefundAction,
  settleKaraokeRefundAction,
  type ReservationActionState,
} from "@/app/admin/mobil/karaoke/actions";

import { DangerButton, GhostButton, PrimaryButton } from "./forms";

const initial: ReservationActionState = {};

interface Props {
  id: string;
  /**
   * Only a paid booking waiting for its confirmation, or a pay-at-the-venue
   * request while prepayment is switched off. An unpaid hold never.
   */
  canConfirm: boolean;
  /** A cancelled booking has nothing left to cancel. */
  canCancel: boolean;
  /** Cancelling sends the payment back to the card (and needs `refunds`). */
  cancelRefunds: boolean;
  /** A refund that did not settle itself, and this user may move money. */
  canResolveRefund: boolean;
}

/**
 * Onayla / İptal buttons with somewhere for the refusal to land.
 *
 * The actions can legitimately fail - the hour was taken, someone else
 * answered first, the POS declined a refund - and each says which. Both also
 * mail the member, so the success sentence says whether that message left.
 */
export function KaraokeReservationActions({
  id,
  canConfirm,
  canCancel,
  cancelRefunds,
  canResolveRefund,
}: Props) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmReservationAction,
    initial,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelReservationAction,
    initial,
  );
  const [retryState, retryAction, retryPending] = useActionState(
    retryKaraokeRefundAction,
    initial,
  );
  const [settleState, settleAction, settlePending] = useActionState(
    settleKaraokeRefundAction,
    initial,
  );
  const error =
    confirmState.error ??
    cancelState.error ??
    retryState.error ??
    settleState.error;
  const message =
    confirmState.message ??
    cancelState.message ??
    retryState.message ??
    settleState.message;
  // "Gönderilemedi" is the one success worth reading as a warning.
  const mailFailed = Boolean(message?.includes("GÖNDERİLEMEDİ"));

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canConfirm ? (
          <form action={confirmAction}>
            <input type="hidden" name="id" value={id} />
            <PrimaryButton type="submit" disabled={confirmPending}>
              Onayla
            </PrimaryButton>
          </form>
        ) : null}
        {canCancel ? (
          <form
            action={cancelAction}
            onSubmit={(e) => {
              if (
                cancelRefunds &&
                !window.confirm(
                  "Bu rezervasyon ödenmiş. İptal edersen tutarın tamamı karta iade edilir. Devam edilsin mi?",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={id} />
            <DangerButton type="submit" disabled={cancelPending}>
              {cancelRefunds ? "İptal et ve iade et" : "İptal"}
            </DangerButton>
          </form>
        ) : null}
        {canResolveRefund ? (
          <>
            <form action={retryAction}>
              <input type="hidden" name="id" value={id} />
              <GhostButton type="submit" disabled={retryPending}>
                İadeyi yeniden dene
              </GhostButton>
            </form>
            <form
              action={settleAction}
              onSubmit={(e) => {
                if (
                  !window.confirm(
                    "PayNkolay panelinde bu iadeyi gördün mü? İade yapılmış olarak kaydedilecek.",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={id} />
              <GhostButton type="submit" disabled={settlePending}>
                İade POS&apos;ta görüldü
              </GhostButton>
            </form>
          </>
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
