"use client";

import { useActionState } from "react";

import {
  addCounterStampAction,
  type CounterStampState,
} from "@/app/admin/musteriler/[email]/actions";
import type { LoyaltyStamp, LoyaltyView } from "@/lib/mobile/loyalty-core";

import { Card, Field, PrimaryButton, TextInput, formatDateTime } from "./forms";

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
}: {
  email: string;
  loyalty: LoyaltyView;
  history: LoyaltyStamp[];
}) {
  const bound = addCounterStampAction.bind(null, email);
  const [state, action, pending] = useActionState(bound, initial);

  return (
    <Card className="grid gap-4">
      <h2
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
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
        action={action}
        className="grid gap-3 border-t border-[var(--admin-border)] pt-4"
      >
        <h3
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Damga ekle (kasa)
        </h3>
        <Field label="Not (opsiyonel)">
          <TextInput name="note" placeholder="Kasa · QR" maxLength={120} />
        </Field>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state.message && (
          <p className="text-xs text-green-700">{state.message}</p>
        )}
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Ekleniyor…" : "+1 damga"}
        </PrimaryButton>
      </form>

      <div className="border-t border-[var(--admin-border)] pt-4">
        <h3
          className="mb-2 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Damga geçmişi ({history.length})
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-neutral-400">Henüz damga yok.</p>
        ) : (
          <ul className="grid gap-1.5">
            {history.slice(0, 30).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate text-neutral-700">
                  <span
                    className={
                      s.kind === "earn" ? "text-green-700" : "text-rose-700"
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
                  className="shrink-0 text-neutral-400"
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
        className="text-[9px] tracking-[0.18em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-base text-neutral-900"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {value}
      </div>
    </div>
  );
}
