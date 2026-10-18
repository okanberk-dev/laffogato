"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  addCounterStampAction,
  reverseCounterStampAction,
  type CounterStampState,
} from "@/app/admin/musteriler/[email]/actions";
import type { LoyaltyStamp, LoyaltyView } from "@/lib/mobile/loyalty-core";

import {
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
import { FormError, FormSuccess } from "./form-feedback";
import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  TextInput,
  formatDateTime,
} from "./forms";
import { ConfirmButton } from "./ui";

const initial: CounterStampState = {};

const SOURCE_LABEL: Record<string, string> = {
  order: "Uygulama siparişi",
  counter: "Kasa",
  invite: "Davet",
  admin: "Yönetici",
  app: "Uygulama",
};

export function CustomerStamps({
  email,
  loyalty,
  history,
  canReverse = false,
}: {
  email: string;
  loyalty: LoyaltyView;
  history: LoyaltyStamp[];
  /**
   * Whether to offer "−1 düzeltme". Off at /admin/kasa, which the shift staff
   * reach with the `orders` role; the action itself requires `customers`, so
   * this only decides whether the button is worth showing.
   */
  canReverse?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const bound = addCounterStampAction.bind(null, email);
  // Posted by hand: a refused stamp used to reset the form and drop the note
  // exactly when the server asked to tick "tekrar". A stamp that went
  // through empties it (note and "tekrar" off) for the next one.
  const [state, action, pending] = useActionState(
    withPanelCatch(bound, () => ({ error: PANEL_ACTION_FAILED })),
    initial,
  );
  const post = useHandPost(action, pending);
  useEffect(() => {
    if (state.message && !state.error) formRef.current?.reset();
  }, [state]);
  const boundReverse = reverseCounterStampAction.bind(null, email);

  return (
    <Card className="grid gap-4">
      <h2
        className="text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        Sadakat · {loyalty.tierLabel}
      </h2>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Kart" value={`${loyalty.stamps}/${loyalty.stampTarget}`} />
        <Stat label="Hazır ödül" value={String(loyalty.rewardsReady)} />
        <Stat label="Toplam" value={String(loyalty.lifetimeStamps)} />
      </div>

      <form
        ref={formRef}
        action={post.action}
        onSubmit={post.onSubmit}
        className="grid gap-3 border-t border-[var(--admin-border)] pt-4"
      >
        <h3
          className="text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Damga ekle (kasa)
        </h3>
        <Field label="Not (opsiyonel)">
          <TextInput name="note" placeholder="Kasa · QR" maxLength={120} />
        </Field>
        {/* Only needed after the server refuses a repeat inside its window. */}
        <Checkbox name="force" label="Tekrar (aynı üyeye ikinci damga)" />
        <FormError message={state.error} />
        <FormSuccess message={state.error ? undefined : state.message} />
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Ekleniyor…" : "+1 damga"}
        </PrimaryButton>
      </form>

      {canReverse && (
        <div className="grid gap-3 border-t border-[var(--admin-border)] pt-4">
          <h3
            className="text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Damga geri al (düzeltme)
          </h3>
          {/* Takes a stamp away from the member: asks first, and the reason
              goes into the stamp history as its note. */}
          <ConfirmButton
            action={boundReverse}
            label="−1 düzeltme"
            title="Bir damga geri alınsın mı?"
            description="Üyenin kartından bir damga düşülür ve geçmişe düzeltme olarak yazılır."
            confirmLabel="Damgayı geri al"
            variant="ghost"
            reason={{
              name: "note",
              label: "Sebep (isteğe bağlı)",
              maxLength: 120,
              placeholder: "Yanlış üyeye verildi",
            }}
          />
        </div>
      )}

      <div className="border-t border-[var(--admin-border)] pt-4">
        <h3
          className="mb-2 text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Damga geçmişi ({history.length})
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--admin-text-soft)]">
            Henüz damga yok.
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {history.slice(0, 30).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate text-[var(--admin-text)]">
                  <span
                    className={
                      s.kind === "earn"
                        ? "text-[var(--admin-success)]"
                        : "text-[var(--admin-danger-ink)]"
                    }
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {s.delta > 0 ? `+${s.delta}` : s.delta}
                  </span>{" "}
                  {SOURCE_LABEL[s.source] ?? s.source}
                  {s.note ? ` · ${s.note}` : ""}
                  {s.actor ? ` · ${s.actor}` : ""}
                </span>
                <span
                  className="shrink-0 text-[var(--admin-text-soft)]"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  {formatDateTime(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] p-2">
      <div
        className="text-[10px] tracking-[0.18em] text-[var(--admin-text-soft)] uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-base text-[var(--admin-text)]"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {value}
      </div>
    </div>
  );
}
