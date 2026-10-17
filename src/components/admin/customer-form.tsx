"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";

import type { CustomerActionState } from "@/app/admin/musteriler/actions";
import type { AdminCustomer } from "@/lib/customer/store";

import {
  PANEL_ACTION_FAILED,
  useNoResetSubmit,
  withPanelCatch,
} from "./action-form";
import { FieldErrorText, FormError, useFieldErrors } from "./form-feedback";
import { Card, Checkbox, Field, PrimaryButton, TextInput } from "./forms";
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
 * The member edit form. Posted by hand (useNoResetSubmit): a refused save
 * used to put every field back to the stored value, so the error sat under
 * a name that had jumped back and the other edits were gone.
 */
export function CustomerForm({ customer, action }: Props) {
  const [state, formAction, pending] = useActionState(
    withPanelCatch(action, (prev) => ({ ...prev, error: PANEL_ACTION_FAILED })),
    initial,
  );
  const onSubmit = useNoResetSubmit(formAction, pending);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useFieldErrors(formRef, state);
  const fe = (k: string) => state.fieldErrors?.[k];
  const prefs = customer.notificationPrefs;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5">
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
          <Field label="Doğum tarihi (opsiyonel)">
            <TextInput
              name="birthday"
              type="date"
              defaultValue={customer.birthday}
            />
          </Field>
        </div>

        <Field label="Bildirim tercihleri" as="fieldset">
          <Checkbox
            name="notifyOrderUpdates"
            label="Sipariş güncellemeleri"
            defaultChecked={prefs.orderUpdates}
          />
          <Checkbox
            name="notifyMarketing"
            label="Kampanya / pazarlama"
            defaultChecked={prefs.marketing}
          />
          <Checkbox
            name="notifyNewsletter"
            label="Bülten"
            defaultChecked={prefs.newsletter}
          />
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
