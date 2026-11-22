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
    <form action={action} style={{ display: "grid", gap: 18, maxWidth: 560 }}>
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
        className="btn btn-primary btn-sm"
        style={{ justifySelf: "start" }}
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
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr",
        gap: 12,
        alignItems: "flex-start",
        cursor: "pointer",
        padding: "12px 14px",
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--bg)",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{
          width: 20,
          height: 20,
          accentColor: "var(--ink)",
          marginTop: 2,
        }}
      />
      <span>
        <span
          style={{
            display: "block",
            fontFamily: "var(--display)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            color: "var(--muted)",
            fontSize: 14,
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </span>
      </span>
    </label>
  );
}
