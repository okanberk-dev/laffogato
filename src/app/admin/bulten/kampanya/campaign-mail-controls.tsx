"use client";

import { useActionState } from "react";

import {
  PANEL_ACTION_FAILED,
  useNoResetSubmit,
  withPanelCatch,
} from "@/components/admin/action-form";
import { FormError, FormSuccess } from "@/components/admin/form-feedback";
import { GhostButton, TextInput } from "@/components/admin/forms";
import { ActionModal, type ModalAction } from "@/components/admin/ui";

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

/** What the operator types to send: the count they agree to, or GÖNDER. */
export function campaignSendPhrase(audienceCount: number | null): string {
  return audienceCount === null ? "GÖNDER" : String(audienceCount);
}

/**
 * "Gönder": a commercial e-mail to everyone the audience rule resolves to,
 * behind a dialog that quotes how many addresses that is right now (the
 * same function the enqueue reads) and asks for the number typed back
 * (decision D15). It was one OK on the browser's own dialog. A null count
 * means the database could not be asked; the operator is told so rather
 * than shown a zero, and types GÖNDER instead.
 *
 * The answer is a toast: on the list the row stops offering "Gönder" as
 * soon as the campaign is queued, and the old inline message went with it.
 */
export function CampaignSendForm({
  action,
  audienceCount,
  audienceLabel,
  label = "Gönder",
}: {
  action: ModalAction;
  audienceCount: number | null;
  audienceLabel: string;
  label?: string;
}) {
  const description =
    audienceCount === null
      ? `Kitle şu an sayılamadı (${audienceLabel}). Gönderim başlarsa geri alınamaz.`
      : audienceCount === 0
        ? `Kitle boş (${audienceLabel}): kimseye e-posta gitmez, kampanya 0 alıcıyla “Gönderildi” olarak kapanır.`
        : `${audienceCount} adrese ticari e-posta gider: ${audienceLabel}. Kitle kuyruğa alınırken yeniden sayılır. Gönderim başlayınca geri alınamaz.`;
  return (
    <ActionModal
      action={action}
      title="Kampanya gönderilsin mi?"
      description={description}
      trigger={label}
      triggerVariant="primary"
      submitLabel={label}
      pendingLabel="Kuyruğa alınıyor…"
      confirmPhrase={campaignSendPhrase(audienceCount)}
      size="sm"
    />
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
