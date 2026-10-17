"use client";

import { useActionState, useState } from "react";

import {
  saveOrderDetailsAction,
  type OrderDetailsActionState,
} from "@/app/admin/siparisler/actions";
import {
  emailChanges,
  type OrderDetailsRules,
} from "@/lib/admin/order-details";

import { Card } from "./forms";

const initial: OrderDetailsActionState = {};

interface Props {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  /** The customer's page (`/admin/musteriler/<email>`) when the role may open it. */
  customerHref?: string | null;
  /**
   * What this role may change here (`orderDetailsRules`): the e-mail only
   * for an owner or manager on an open order, behind a confirm; nothing on
   * a closed order for staff. The server asks the same rule again.
   */
  rules: OrderDetailsRules;
}

export function OrderCustomerEditor({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
  customerHref = null,
  rules,
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
          {rules.emailEditable ? (
            <>
              <LabeledInput
                label="E-posta"
                name="customerEmail"
                type="email"
                maxLength={160}
                value={vals.customerEmail}
                onChange={set("customerEmail")}
              />
              {emailChanges(customerEmail, vals.customerEmail) ? (
                <label className="flex items-start gap-3 rounded-xl bg-[var(--admin-warning-soft)] px-3 py-2.5 text-xs text-[var(--admin-text)]">
                  <input
                    type="checkbox"
                    name="emailConfirm"
                    value="1"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--admin-primary)]"
                  />
                  <span>
                    E-postayı değiştir. Sipariş eski adresin üye geçmişinden
                    çıkar, yeni adresinkine girer.
                  </span>
                </label>
              ) : null}
            </>
          ) : (
            <div className="grid gap-1">
              <span className="text-[10px] tracking-[0.18em] text-[var(--admin-text-soft)] uppercase">
                E-posta
              </span>
              <span className="break-all text-[var(--admin-text)]">
                {customerEmail || "Yok"}
              </span>
              <span className="text-xs text-[var(--admin-text-soft)]">
                {rules.emailReason}
              </span>
            </div>
          )}
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
            disabled={!rules.editable}
            aria-describedby={rules.editable ? undefined : `${orderId}-lock`}
            className="rounded-full border border-neutral-300 px-3 py-1 text-[11px] text-neutral-600 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-50"
          >
            Düzenle
          </button>
        </div>
        {rules.editable ? null : (
          <p
            id={`${orderId}-lock`}
            className="mb-3 text-xs text-[var(--admin-text-soft)]"
          >
            {rules.reason}
          </p>
        )}
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
          {customerHref ? (
            <a
              href={customerHref}
              className="justify-self-start text-xs text-[var(--admin-primary)] underline underline-offset-4"
            >
              Müşteri sayfasını aç
            </a>
          ) : null}
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
            Teslimat adresi yok.
            {rules.editable ? ' "Düzenle" ile ekleyebilirsin.' : ""}
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
