"use client";

import { useActionState, useState } from "react";

import { SchemeMark, schemeOfBrand } from "@/app/odeme/scheme-marks";
import type { CheckoutSavedCard } from "@/lib/checkout/start";

import {
  deleteAccountSavedCardAction,
  type DeleteSavedCardState,
} from "./actions";

/**
 * The member's saved cards, each with a two-step "Sil": the first press
 * asks, the second posts the card's `tranId` to the delete action. The list
 * itself comes from the server after every delete (`revalidatePath`).
 */
export function SavedCardList({ cards }: { cards: CheckoutSavedCard[] }) {
  const [state, formAction, pending] = useActionState<
    DeleteSavedCardState | null,
    FormData
  >(deleteAccountSavedCardAction, null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <>
      {state ? (
        <p
          className={state.ok ? "account-cards-note" : "account-cards-error"}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      <ul className="account-cards">
        {cards.map((card) => {
          const mark = schemeOfBrand(card.brand);
          const meta = [card.bank, card.brand].filter(Boolean).join(" · ");
          const asking = confirming === card.tranId;
          return (
            <li key={card.tranId} className="account-saved-card">
              <div className="account-saved-card-face">
                {mark ? (
                  <SchemeMark name={mark} className="account-saved-card-mark" />
                ) : (
                  <span className="account-saved-card-mark is-plain" />
                )}
                <div>
                  <div className="account-saved-card-name">
                    {card.alias || "Kayıtlı kart"}
                  </div>
                  <div className="account-saved-card-number tabular">
                    •••• {card.last4}
                  </div>
                  {meta ? (
                    <div className="account-saved-card-meta">{meta}</div>
                  ) : null}
                </div>
              </div>
              {asking ? (
                <form action={formAction} className="account-saved-card-ask">
                  <input type="hidden" name="tranId" value={card.tranId} />
                  <span>Bu kart silinsin mi?</span>
                  <button
                    type="submit"
                    className="btn btn-ghost btn-sm account-saved-card-delete"
                    disabled={pending}
                  >
                    {pending ? "Siliniyor…" : "Evet, sil"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirming(null)}
                    disabled={pending}
                  >
                    Vazgeç
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm account-saved-card-delete"
                  aria-label={`•••• ${card.last4} kartını sil`}
                  onClick={() => setConfirming(card.tranId)}
                  disabled={pending}
                >
                  Sil
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
