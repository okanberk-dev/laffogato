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
      <Toggle
        name="orderUpdates"
        label="Sipariş güncellemeleri"
        hint="Sipariş alındı, kargoya verildi, teslim edildi e-postaları."
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
        border: "1px solid var(--ink-line)",
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
            fontFamily: "var(--serif-display)",
            fontSize: 16,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            color: "var(--ink-soft)",
            fontSize: 13,
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
