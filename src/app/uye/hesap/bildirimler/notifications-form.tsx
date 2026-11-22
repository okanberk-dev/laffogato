"use client";

import { useActionState } from "react";

import type { NotificationPrefs } from "@/lib/customer/store";

import { BusyDots } from "@/components/laffogato/busy-dots";

import {
  updateNotificationsAction,
  type NotificationFormState,
} from "../../actions";

const initial: NotificationFormState = {};

export function NotificationsForm({
  defaults,
}: {
  defaults: NotificationPrefs;
}) {
  const [state, action, pending] = useActionState(
    updateNotificationsAction,
    initial,
  );
  return (
    <form action={action} className="account-form">
      {/* What the switch really governs (docs/API-MOBILE.md §23): the
          app's order-stage phone notifications and the gel-al "hazır"
          fallback e-mail. The order, payment and shipping e-mails are
          transactional and go whatever it says; the old caption promised
          it would stop them. Named as the app and the legal texts name it. */}
      <Toggle
        name="orderUpdates"
        label="Sipariş durumu"
        hint="Açıkken, uygulamada bildirime izin verdiğin telefonlara hazırlanıyor, hazır, yolda ve iptal bildirimleri gelir; gel-al siparişin hazır olduğunda telefonuna ulaşamazsak e-postayla haber veririz. Sipariş, ödeme ve kargo e-postaları bu ayardan bağımsız, her zaman gelir."
        defaultChecked={defaults.orderUpdates}
      />
      <Toggle
        name="marketing"
        label="Kampanya & yeni ürün"
        hint="Sezonluk lansmanlar, özel günlerde indirim haberleri."
        defaultChecked={defaults.marketing}
      />
      <Toggle
        name="newsletter"
        label="L'Affogato bülteni"
        hint="Ayda bir, İtalya-İstanbul mutfak günlüğü."
        defaultChecked={defaults.newsletter}
      />
      {state.error && (
        <div className="account-msg" data-tone="error">
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="account-msg" data-tone="success">
          {state.message}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-wide"
        aria-busy={pending}
      >
        {pending ? (
          <>
            <BusyDots />
            Kaydediliyor…
          </>
        ) : (
          "Tercihleri kaydet"
        )}
      </button>
    </form>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="account-toggle">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>
        <span className="account-toggle-label">{label}</span>
        <span className="account-toggle-hint">{hint}</span>
      </span>
    </label>
  );
}
