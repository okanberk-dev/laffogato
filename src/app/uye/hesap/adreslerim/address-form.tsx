"use client";

import { useActionState } from "react";

import Link from "@/components/link";
import type { CustomerAddress } from "@/lib/customer/store";

import { BusyDots } from "@/components/laffogato/busy-dots";

import { createAddressAction, type AddressFormState } from "../../actions";

const initial: AddressFormState = {};

export function AddressForm({
  defaults,
  action,
  submitLabel,
}: {
  defaults?: Partial<CustomerAddress>;
  action: (
    prev: AddressFormState,
    formData: FormData,
  ) => Promise<AddressFormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    action ?? createAddressAction,
    initial,
  );
  const d = defaults ?? {};
  return (
    <form action={formAction} style={{ display: "grid", gap: 16 }}>
      <div className="account-field-row">
        <div className="account-field">
          <label htmlFor="adr-label">Etiket</label>
          <input
            id="adr-label"
            name="label"
            defaultValue={d.label ?? ""}
            placeholder="Ev / Ofis / Yazlık"
            maxLength={40}
          />
        </div>
        <div className="account-field">
          <label htmlFor="adr-recipient">Alıcı adı *</label>
          <input
            id="adr-recipient"
            name="recipientName"
            defaultValue={d.recipientName ?? ""}
            required
            minLength={2}
            autoComplete="name"
          />
        </div>
      </div>
      <div className="account-field-row">
        <div className="account-field">
          <label htmlFor="adr-phone">Telefon *</label>
          <input
            id="adr-phone"
            name="phone"
            type="tel"
            defaultValue={d.phone ?? ""}
            required
            autoComplete="tel"
            placeholder="+90 ___ ___ __ __"
          />
        </div>
        <div className="account-field">
          <label htmlFor="adr-zip">Posta kodu</label>
          <input
            id="adr-zip"
            name="zip"
            defaultValue={d.zip ?? ""}
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={12}
          />
        </div>
      </div>
      <div className="account-field">
        <label htmlFor="adr-line1">Adres *</label>
        <input
          id="adr-line1"
          name="line1"
          defaultValue={d.line1 ?? ""}
          required
          minLength={5}
          autoComplete="address-line1"
          placeholder="Mahalle, sokak, bina no"
        />
      </div>
      <div className="account-field">
        <label htmlFor="adr-line2">Adres satırı 2</label>
        <input
          id="adr-line2"
          name="line2"
          defaultValue={d.line2 ?? ""}
          autoComplete="address-line2"
          placeholder="Daire no, kat, tarif"
        />
      </div>
      <div className="account-field-row">
        <div className="account-field">
          <label htmlFor="adr-district">İlçe</label>
          <input
            id="adr-district"
            name="district"
            defaultValue={d.district ?? ""}
            autoComplete="address-level2"
          />
        </div>
        <div className="account-field">
          <label htmlFor="adr-city">Şehir *</label>
          <input
            id="adr-city"
            name="city"
            defaultValue={d.city ?? ""}
            required
            minLength={2}
            autoComplete="address-level1"
          />
        </div>
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: "var(--muted)",
        }}
      >
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={!!d.isDefault}
          style={{ width: 18, height: 18, accentColor: "var(--ink)" }}
        />
        Bu adresi varsayılan olarak ayarla
      </label>
      {state.error && (
        <div className="account-msg" data-tone="error">
          {state.error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
            submitLabel
          )}
        </button>
        <Link href="/uye/hesap/adreslerim" className="btn btn-ghost">
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
