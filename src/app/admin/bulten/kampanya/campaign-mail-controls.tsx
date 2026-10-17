"use client";

import { useActionState } from "react";

import {
  PANEL_ACTION_FAILED,
  useNoResetSubmit,
  withPanelCatch,
} from "@/components/admin/action-form";
import { FormError, FormSuccess } from "@/components/admin/form-feedback";
import {
  GhostButton,
  PrimaryButton,
  TextInput,
} from "@/components/admin/forms";

import type { CampaignMailState } from "./actions";

type StateAction = (
  prev: CampaignMailState,
  formData: FormData,
) => Promise<CampaignMailState>;

const initial: CampaignMailState = {};

function Feedback({ state }: { state: CampaignMailState }) {
  if (state.error) return <FormError message={state.error} />;
  return <FormSuccess message={state.message} />;
}

/**
 * "Gönder", behind a confirm that says how many addresses the audience rule
 * resolves to right now - the same function the enqueue reads, so the number
 * the operator agrees to is the number that gets queued. A null count means
 * the database could not be asked; the operator is told so rather than shown
 * a zero.
 */
export function CampaignSendForm({
  action,
  audienceCount,
  audienceLabel,
  label = "Gönder",
}: {
  action: StateAction;
  audienceCount: number | null;
  audienceLabel: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const confirmText =
    audienceCount === null
      ? `Kitle şu an sayılamadı (${audienceLabel}). Yine de gönderim başlatılsın mı? Bu işlem geri alınamaz.`
      : `${audienceCount} adrese gönderilecek: ${audienceLabel}. Gönderim başlatılsın mı? Bu işlem geri alınamaz.`;
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="grid gap-2"
    >
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Kuyruğa alınıyor…" : label}
      </PrimaryButton>
      <Feedback state={state} />
    </form>
  );
}

/** "Bana test gönder": one real message, to the operator's own inbox by default. */
export function CampaignTestForm({
  action,
  defaultTo,
}: {
  action: StateAction;
  defaultTo: string;
}) {
  // Posted by hand: a refused address used to be wiped with the answer.
  const [state, formAction, pending] = useActionState(
    withPanelCatch(action, () => ({ error: PANEL_ACTION_FAILED })),
    initial,
  );
  const onSubmit = useNoResetSubmit(formAction, pending);
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <TextInput
        name="to"
        type="email"
        defaultValue={defaultTo}
        placeholder="ornek@laffogato.net"
        aria-label="Test alıcısı"
      />
      <GhostButton type="submit" disabled={pending}>
        {pending ? "Gönderiliyor…" : "Bana test gönder"}
      </GhostButton>
      <Feedback state={state} />
    </form>
  );
}
