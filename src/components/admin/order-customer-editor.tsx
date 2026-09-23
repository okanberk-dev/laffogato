"use client";

import { useActionState, useState } from "react";

import {
  saveOrderDetailsAction,
  type OrderDetailsActionState,
} from "@/app/admin/siparisler/actions";

import { Card } from "./forms";

const initial: OrderDetailsActionState = {};

interface Props {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
}

export function OrderCustomerEditor({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
}: Props) {
  const [state, formAction, pending] = useActionState(
    saveOrderDetailsAction,
    initial,
  );
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState({
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
  });

  /* Collapse back to read-mode after a successful save: adjusted during
     render when the action's timestamp changes, not in an effect. */
  const [seenSavedAt, setSeenSavedAt] = useState(state.savedAt);
  if (state.savedAt !== seenSavedAt) {
    setSeenSavedAt(state.savedAt);
    if (state.savedAt) setEditing(false);
  }

  const set =
    (k: keyof typeof vals) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setVals((v) => ({ ...v, [k]: e.target.value }));

  if (editing) {
    return (
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Müşteri & teslimat - düzenle</SectionTitle>
        </div>
        <form action={formAction} className="grid gap-3 text-sm">
          <input type="hidden" name="id" value={orderId} />
          <LabeledInput
            label="Ad Soyad"
            name="customerName"
            value={vals.customerName}
            onChange={set("customerName")}
            required
          />
          <LabeledInput
            label="E-posta"
            name="customerEmail"
            type="email"
            value={vals.customerEmail}
            onChange={set("customerEmail")}
          />
          <LabeledInput
            label="Telefon"
            name="customerPhone"
            value={vals.customerPhone}
            onChange={set("customerPhone")}
          />
          <label className="grid gap-1">
            <span className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
              Teslimat adresi
            </span>
            <textarea
              name="shippingAddress"
              rows={4}
              value={vals.shippingAddress}
              onChange={set("shippingAddress")}
              className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2 outline-none focus:border-[var(--admin-primary)] focus:bg-white"
            />
          </label>
          {state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setVals({
                  customerName,
                  customerEmail,
                  customerPhone,
                  shippingAddress,
                });
                setEditing(false);
              }}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-[var(--admin-primary)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)] disabled:opacity-40"
            >
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Müşteri</SectionTitle>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-[11px] text-neutral-600 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            Düzenle
          </button>
        </div>
        <div className="grid gap-2 text-sm">
          <KV k="Ad">{vals.customerName || "-"}</KV>
          <KV k="E-posta">
            {vals.customerEmail ? (
              <a
                href={`mailto:${vals.customerEmail}`}
                className="text-neutral-900 hover:underline"
              >
                {vals.customerEmail}
              </a>
            ) : (
              <span className="text-neutral-400">Yok</span>
            )}
          </KV>
          <KV k="Telefon">
            {vals.customerPhone ? (
              <a
                href={`tel:${vals.customerPhone.replace(/\s/g, "")}`}
                className="text-neutral-900 hover:underline"
              >
                {vals.customerPhone}
              </a>
            ) : (
              <span className="text-neutral-400">Toplanmadı</span>
            )}
          </KV>
        </div>
      </Card>

      <Card>
        <SectionTitle>Teslimat adresi</SectionTitle>
        {vals.shippingAddress ? (
          <address className="text-sm whitespace-pre-line text-neutral-700 not-italic">
            {vals.shippingAddress}
          </address>
        ) : (
          <p className="text-sm text-neutral-400">
            Teslimat adresi yok. &quot;Düzenle&quot; ile ekleyebilirsin.
          </p>
        )}
      </Card>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
      style={{ fontFamily: "var(--mono), monospace" }}
    >
      {children}
    </h2>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <span
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {k}
      </span>
      <span className="text-neutral-800">{children}</span>
    </div>
  );
}

function LabeledInput({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
        {label}
      </span>
      <input
        {...rest}
        className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2 outline-none focus:border-[var(--admin-primary)] focus:bg-white"
      />
    </label>
  );
}
