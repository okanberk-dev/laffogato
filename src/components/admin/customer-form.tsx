"use client";

import { useActionState, useRef } from "react";

import type { CustomerActionState } from "@/app/admin/musteriler/actions";
import Link from "@/components/link";
import type { AdminCustomer } from "@/lib/customer/store";

import {
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
import { FieldErrorText, FormError, useFieldErrors } from "./form-feedback";
import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  TextInput,
  formatDateTime,
} from "./forms";
import { BUTTON } from "./ui";

const initial: CustomerActionState = {};

interface Props {
  customer: AdminCustomer;
  action: (
    prev: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
}

/**
 * The member edit form. Posted by hand (useHandPost): a refused save
 * used to put every field back to the stored value, so the error sat under
 * a name that had jumped back and the other edits were gone.
 */
export function CustomerForm({ customer, action }: Props) {
  const [state, formAction, pending] = useActionState(
    withPanelCatch(action, (prev) => ({ ...prev, error: PANEL_ACTION_FAILED })),
    initial,
  );
  const post = useHandPost(formAction, pending);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useFieldErrors(formRef, state);
  const fe = (k: string) => state.fieldErrors?.[k];
  const prefs = customer.notificationPrefs;

  return (
    <form
      ref={formRef}
      action={post.action}
      onSubmit={post.onSubmit}
      className="grid gap-5"
    >
      <Card className="grid gap-5">
        <Field label="E-posta" hint="E-posta değiştirilemez (hesabın kimliği).">
          <TextInput value={customer.email} disabled readOnly />
        </Field>

        <div className="grid gap-1.5">
          <Field label="Ad Soyad">
            <TextInput name="name" defaultValue={customer.name} required />
          </Field>
          <FieldErrorText id={errorId("name")} message={fe("name")} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Field label="Telefon">
              <TextInput
                name="phone"
                defaultValue={customer.phone}
                placeholder="+90 5xx xxx xx xx"
              />
            </Field>
            <FieldErrorText id={errorId("phone")} message={fe("phone")} />
          </div>
          <Field label="Doğum tarihi (isteğe bağlı)">
            <TextInput
              name="birthday"
              type="date"
              defaultValue={customer.birthday}
            />
          </Field>
        </div>

        <Field
          label="Bildirim tercihleri"
          as="fieldset"
          hint="Kampanya ve bülten izni panelden yalnız kapatılır; açmak üyenin kendi işi (6563). Kapatınca izin tarihi de silinir."
        >
          <Checkbox
            name="notifyOrderUpdates"
            label="Sipariş güncellemeleri"
            defaultChecked={prefs.orderUpdates}
          />
          {/* Off: drawn disabled, so it is not posted. The hidden fields
              say so, and the server keeps what the row has then (the
              member may have opted in since this page loaded). The server
              refuses a switch-on whatever the form sends. */}
          <input
            type="hidden"
            name="shownMarketing"
            value={prefs.marketing ? "on" : "off"}
          />
          <input
            type="hidden"
            name="shownNewsletter"
            value={prefs.newsletter ? "on" : "off"}
          />
          <div className="grid gap-1">
            <Checkbox
              name="notifyMarketing"
              label={
                prefs.marketing
                  ? "Kampanya / pazarlama"
                  : "Kampanya / pazarlama (kapalı, yalnız üye açabilir)"
              }
              defaultChecked={prefs.marketing}
              disabled={!prefs.marketing}
            />
            <FieldErrorText
              id={errorId("notifyMarketing")}
              message={fe("notifyMarketing")}
            />
          </div>
          <div className="grid gap-1">
            <Checkbox
              name="notifyNewsletter"
              label={
                prefs.newsletter
                  ? "Bülten"
                  : "Bülten (kapalı, yalnız üye açabilir)"
              }
              defaultChecked={prefs.newsletter}
              disabled={!prefs.newsletter}
            />
            <FieldErrorText
              id={errorId("notifyNewsletter")}
              message={fe("notifyNewsletter")}
            />
          </div>
          <p className="text-xs text-[var(--admin-text-soft)]">
            Ticari ileti izni:{" "}
            {customer.marketingConsentAt
              ? formatDateTime(customer.marketingConsentAt)
              : "tarih kaydı yok"}
          </p>
        </Field>

        <FormError message={state.error} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        {/* One link styled as a button, not a button inside a link. */}
        <Link
          href={`/admin/musteriler/${encodeURIComponent(customer.email)}`}
          className={BUTTON.ghost}
        >
          Vazgeç
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </PrimaryButton>
      </Card>
    </form>
  );
}
