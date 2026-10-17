"use client";

import { useActionState, useId, useState } from "react";

import {
  saveOrderDetailsAction,
  type OrderDetailsActionState,
} from "@/app/admin/siparisler/actions";
import {
  emailChanges,
  type OrderDetailsRules,
} from "@/lib/admin/order-details";

import { PANEL_ACTION_FAILED } from "./action-form";
import { Field, TextInput, Textarea } from "./forms";
import { KeyValueGrid, Section, useToast } from "./ui";
import { BUTTON } from "./ui/styles";
import { useNoResetSubmit, withPanelCatch } from "./ui/submit";

const initial: OrderDetailsActionState = {};

// A throw (a dropped connection) answers like a refusal, inside the card,
// instead of the panel's error page taking the typing with it.
const save = withPanelCatch(
  saveOrderDetailsAction,
  (prev: OrderDetailsActionState) => ({
    ...prev,
    savedAt: undefined,
    error: PANEL_ACTION_FAILED,
  }),
);

interface Props {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  /**
   * The order goes to an address (kargo, kurye): the form edits it. A
   * gel-al or table order has none to edit; its stored value is posted back
   * as it is, so a save never clears it. The address itself is shown in the
   * Teslimat section (order-detail.tsx).
   */
  hasAddress: boolean;
  /** The customer's page (`/admin/musteriler/<email>`) when the role may open it. */
  customerHref?: string | null;
  /**
   * What this role may change here (`orderDetailsRules`): the e-mail only
   * for an owner or manager on an open order, behind a confirm; nothing on
   * a closed order for staff. The server asks the same rule again.
   */
  rules: OrderDetailsRules;
}

/**
 * The order page's customer card, on the kit (admin audit ORD-11): a
 * Section with the details as a key/value list, and "Düzenle" opening the
 * form in place. The form posts by hand (useNoResetSubmit), so a refusal
 * keeps what was typed and the e-mail confirm box as it was ticked; a save
 * says so in a toast.
 */
export function OrderCustomerEditor({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
  hasAddress,
  customerHref = null,
  rules,
}: Props) {
  const toast = useToast();
  const lockId = useId();
  const [state, formAction, pending] = useActionState(
    async (prev: OrderDetailsActionState, formData: FormData) => {
      const next = await save(prev, formData);
      if (next.savedAt) toast.show({ message: "Müşteri bilgisi kaydedildi." });
      return next;
    },
    initial,
  );
  const onSubmit = useNoResetSubmit(formAction, pending);
  const [editing, setEditing] = useState(false);
  const stored = {
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
  };
  const [vals, setVals] = useState(stored);

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
      <Section title="Müşteri bilgisini düzenle">
        <form onSubmit={onSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={orderId} />
          <Field label="Ad Soyad">
            <TextInput
              name="customerName"
              value={vals.customerName}
              onChange={set("customerName")}
              required
              minLength={2}
              autoComplete="off"
            />
          </Field>
          {rules.emailEditable ? (
            <>
              <Field label="E-posta">
                <TextInput
                  name="customerEmail"
                  type="email"
                  maxLength={160}
                  value={vals.customerEmail}
                  onChange={set("customerEmail")}
                  autoComplete="off"
                />
              </Field>
              {emailChanges(customerEmail, vals.customerEmail) ? (
                <label className="flex items-start gap-3 rounded-xl bg-[var(--admin-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-text)]">
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
            <KeyValueGrid
              columns={1}
              empty="Yok"
              items={[
                {
                  label: "E-posta",
                  value: customerEmail,
                  hint: rules.emailReason,
                },
              ]}
            />
          )}
          <Field label="Telefon">
            <TextInput
              name="customerPhone"
              type="tel"
              value={vals.customerPhone}
              onChange={set("customerPhone")}
              autoComplete="off"
            />
          </Field>
          {hasAddress ? (
            <Field label="Teslimat adresi">
              <Textarea
                name="shippingAddress"
                rows={4}
                value={vals.shippingAddress}
                onChange={set("shippingAddress")}
              />
            </Field>
          ) : (
            <input
              type="hidden"
              name="shippingAddress"
              value={shippingAddress}
            />
          )}
          {state.error ? (
            <p
              role="alert"
              className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
            >
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(false)}
              className={BUTTON.ghost}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className={BUTTON.primary}
            >
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </form>
      </Section>
    );
  }

  return (
    <Section
      title="Müşteri"
      actions={
        <button
          type="button"
          onClick={() => {
            // Every opening starts from what is stored: a page refreshed
            // since (another device saved) is not overwritten by old typing.
            setVals(stored);
            setEditing(true);
          }}
          disabled={!rules.editable}
          aria-describedby={rules.editable ? undefined : lockId}
          className={BUTTON.ghost}
        >
          Düzenle
        </button>
      }
    >
      {rules.editable ? null : (
        <p id={lockId} className="mb-4 text-sm text-[var(--admin-text-soft)]">
          {rules.reason}
        </p>
      )}
      <KeyValueGrid
        columns={1}
        items={[
          { label: "Ad", value: customerName },
          {
            label: "E-posta",
            value: customerEmail ? (
              <a
                href={`mailto:${customerEmail}`}
                className="[overflow-wrap:anywhere] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
              >
                {customerEmail}
              </a>
            ) : (
              <span className="text-[var(--admin-text-soft)]">Yok</span>
            ),
          },
          {
            label: "Telefon",
            value: customerPhone ? (
              <a
                href={`tel:${customerPhone.replace(/\s/g, "")}`}
                className="underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
              >
                {customerPhone}
              </a>
            ) : (
              <span className="text-[var(--admin-text-soft)]">Toplanmadı</span>
            ),
          },
        ]}
      />
      {customerHref ? (
        <a href={customerHref} className={`${BUTTON.link} mt-2 -ml-1`}>
          Müşteri sayfasını aç
        </a>
      ) : null}
    </Section>
  );
}
