"use client";

import { useState } from "react";

import { cancelReservationAction } from "@/app/admin/mobil/karaoke/actions";
import {
  isBusinessCause,
  karaokeRequestDefault,
  KARAOKE_CALL_HINT,
  KARAOKE_CANCEL_CAUSES,
  KARAOKE_CAUSE_LABEL,
  KARAOKE_CHANNEL_LABEL,
  KARAOKE_REQUEST_CHANNELS,
  type KaraokeCancelCause,
} from "@/lib/mobile/karaoke-cancel-cause";

import { Field, Textarea, TextInput } from "./forms";
import { ActionModal, FieldError, useActionModalState } from "./ui";
import type { ButtonVariant } from "./ui/styles";

// "İptal et ve iade et" on a paid karaoke booking (ASK-OTH-3 (c), ASK-Y3-4
// (c), 19 Eki 2026): the reason comes from a fixed list, a guest's own
// request also says how and when it came, and the note stays in the audit
// row. The server decides what the request gets
// (cancelReservationAction -> cancelKaraokeReservation); this only asks.

export interface KaraokeRefundCancelProps {
  id: string;
  /** "2.000,00 ₺": what a full refund sends back. */
  amount: string;
  /** "30 Ekim 2026, 18:00": the booking's last free-cancel moment. */
  freeUntil: string;
  /** Under 24 hours before the start, with a phone on the booking. */
  callHint: boolean;
  /** Unconfirmed bookings were never promised: always a full refund. */
  confirmed: boolean;
  /** The server's clock when the page was drawn (ms). */
  serverNow: number;
  /** The köşk's wall clock at booking, `YYYY-MM-DDTHH:mm`. */
  bookedAt: string;
  variant: ButtonVariant;
  disabledReason?: string;
}

const RADIO = "h-5 w-5 shrink-0 accent-[var(--admin-primary)]";
const CHOICE = "flex min-h-11 pointer-fine:min-h-9 items-center gap-3 text-sm";

/** What the chosen code will do, in one sentence under the list. */
function outcome(cause: KaraokeCancelCause | "", p: KaraokeRefundCancelProps) {
  if (cause === "misafir" && !p.confirmed) {
    return `Rezervasyon onaylanmadığı için ${p.amount} tamamı karta iade edilir; misafire "isteğin üzerine iptal ettik" e-postası gider.`;
  }
  if (cause === "misafir") {
    return `İstek anı son ücretsiz iptal anından (${p.freeUntil}) önceyse ya da tam o andaysa ${p.amount} karta iade edilir. Sonraysa rezervasyonun kuralı uygulanır: geç iptalde iade vermiyorsa rezervasyon iptal edilmez, misafire kodunu başkasına verebileceğini söyleyen e-posta gider.`;
  }
  if (cause === "yeniden") {
    return `Saat başka bir misafire verildiği için ${p.amount} tamamı karta iade edilir ve misafire bunu söyleyen e-posta gider.`;
  }
  if (cause) {
    return `${p.amount} tamamı karta iade edilir; misafire nedeni ve özrümüzü yazan e-posta gider.`;
  }
  return null;
}

function CancelFields(p: KaraokeRefundCancelProps & { clientAtDraw: number }) {
  const { fieldErrors, errorId } = useActionModalState();
  // The fields mount when the dialog opens: the request defaults to now
  // then, not to when the page was drawn.
  const [requestNow] = useState(() =>
    karaokeRequestDefault(p.serverNow, p.clientAtDraw, Date.now()),
  );
  const [cause, setCause] = useState<KaraokeCancelCause | "">("");
  const said = outcome(cause, p);
  const err = (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true as const, "aria-describedby": errorId(name) }
      : {};
  return (
    <div className="flex flex-col gap-4">
      <Field label="Neden" as="fieldset">
        <div className="flex flex-col">
          {KARAOKE_CANCEL_CAUSES.map((c) => (
            <label key={c} className={CHOICE}>
              <input
                type="radio"
                name="neden"
                value={c}
                required
                checked={cause === c}
                onChange={() => setCause(c)}
                className={RADIO}
                {...err("neden")}
              />
              {KARAOKE_CAUSE_LABEL[c]}
            </label>
          ))}
        </div>
        <FieldError name="neden" />
      </Field>

      {said ? (
        <p className="text-sm text-[var(--admin-text-soft)]">{said}</p>
      ) : null}

      {isBusinessCause(cause) && p.callHint ? (
        <p
          role="status"
          className="rounded-lg bg-[var(--admin-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-warning)]"
        >
          {KARAOKE_CALL_HINT}
        </p>
      ) : null}

      {cause === "misafir" ? (
        <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] p-3.5">
          <Field label="İstek nereden geldi?" as="fieldset">
            <div className="flex flex-wrap gap-x-6">
              {KARAOKE_REQUEST_CHANNELS.map((c) => (
                <label key={c} className={CHOICE}>
                  <input
                    type="radio"
                    name="kanal"
                    value={c}
                    required
                    className={RADIO}
                    {...err("kanal")}
                  />
                  {KARAOKE_CHANNEL_LABEL[c]}
                </label>
              ))}
            </div>
            <FieldError name="kanal" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <Field
              label="İstek anı"
              hint="Telefonda görüşmenin ya da cevapsız aramanın saati; e-postada gönderildiği saat. Köşk saatiyle."
            >
              <TextInput
                type="datetime-local"
                name="istekAni"
                defaultValue={requestNow}
                min={p.bookedAt}
                required
                {...err("istekAni")}
              />
            </Field>
            <FieldError name="istekAni" />
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm pointer-fine:min-h-9">
            <input
              type="checkbox"
              name="tamIade"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--admin-primary)]"
            />
            <span>
              Yine de tamamını iade et
              <span className="block text-xs text-[var(--admin-text-soft)]">
                Süre geçmiş olsa da {p.amount} karta iade edilir ve misafire
                &quot;isteğin üzerine iptal ettik&quot; e-postası gider.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Field
          label="Not (yalnız kayıtta kalır)"
          hint="Misafire gitmez; geçmişte ve denetim kaydında görünür."
        >
          <Textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder="Ör. projektör çalışmıyor; misafir 18:05'te aradı"
            className="min-h-[80px]"
            {...err("reason")}
          />
        </Field>
        <FieldError name="reason" />
      </div>
    </div>
  );
}

/**
 * The paid booking's cancel dialog. The trigger sits in the list's ⋯ menu
 * (`menuDanger`) or on the booking's page (`danger`); a user without the
 * refund right sees it off, with the reason.
 */
export function KaraokeRefundCancel(props: KaraokeRefundCancelProps) {
  // This machine's clock next to the server's draw, kept as one pair: the
  // dialog adds only the time counted here since then.
  const [clientAtDraw] = useState(() => Date.now());
  const [serverAtDraw] = useState(props.serverNow);
  return (
    <ActionModal
      action={cancelReservationAction}
      title="İptal et ve iade et"
      description="Önce nedeni seç. İade geri alınamaz."
      trigger="İptal et ve iade et"
      triggerVariant={props.variant}
      submitLabel="Onayla"
      tone="danger"
      hidden={{ id: props.id, beklenen: "iade" }}
      disabledReason={props.disabledReason}
      size="md"
    >
      <CancelFields
        {...props}
        serverNow={serverAtDraw}
        clientAtDraw={clientAtDraw}
      />
    </ActionModal>
  );
}
