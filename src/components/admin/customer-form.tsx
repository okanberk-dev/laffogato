"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { CustomerActionState } from "@/app/admin/musteriler/actions";
import type { AdminCustomer } from "@/lib/customer/store";

import {
  Card,
  Checkbox,
  Field,
  GhostButton,
  PrimaryButton,
  TextInput,
} from "./forms";

const initial: CustomerActionState = {};

interface Props {
  customer: AdminCustomer;
  action: (
    prev: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
}

export function CustomerForm({ customer, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = (k: string) => state.fieldErrors?.[k];
  const prefs = customer.notificationPrefs;

  return (
    <form action={formAction} className="grid gap-5">
      <Card className="grid gap-5">
        <Field label="E-posta" hint="E-posta değiştirilemez (hesabın kimliği).">
          <TextInput value={customer.email} disabled readOnly />
        </Field>

        <Field label="Ad Soyad" hint={fe("name")}>
          <TextInput
            name="name"
            defaultValue={customer.name}
            required
            aria-invalid={Boolean(fe("name"))}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Telefon" hint={fe("phone")}>
            <TextInput
              name="phone"
              defaultValue={customer.phone}
              placeholder="+90 5xx xxx xx xx"
            />
          </Field>
          <Field label="Doğum tarihi (opsiyonel)">
            <TextInput
              name="birthday"
              type="date"
              defaultValue={customer.birthday}
            />
          </Field>
        </div>

        <div>
          <div
            className="mb-1 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Bildirim tercihleri
          </div>
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
        </div>

        {state.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/musteriler/${encodeURIComponent(customer.email)}`}>
          <GhostButton type="button">Vazgeç</GhostButton>
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </PrimaryButton>
      </Card>
    </form>
  );
}
