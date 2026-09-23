"use client";

import { useActionState, useState } from "react";

import {
  grantCustomerCouponAction,
  revokeCustomerCouponAction,
  type CouponGrantState,
} from "@/app/admin/musteriler/actions";
import { couponStatus, type CustomerCoupon } from "@/lib/customer/coupon-utils";

import {
  Card,
  Field,
  PrimaryButton,
  Select,
  TextInput,
  formatTRY,
} from "./forms";

const initial: CouponGrantState = {};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: "Hazır", cls: "bg-green-50 text-green-700" },
  redeemed: { label: "Kullanıldı", cls: "bg-neutral-100 text-neutral-500" },
  expired: { label: "Süresi doldu", cls: "bg-neutral-100 text-neutral-500" },
  inactive: { label: "Pasif", cls: "bg-neutral-100 text-neutral-500" },
};

export function CustomerCoupons({
  email,
  coupons,
}: {
  email: string;
  coupons: CustomerCoupon[];
}) {
  const boundGrant = grantCustomerCouponAction.bind(null, email);
  const [state, action, pending] = useActionState(boundGrant, initial);
  // Read once when the card mounts; a render-time Date.now() is impure and
  // would let two renders disagree about which coupon has expired.
  const [now] = useState(() => Date.now());

  return (
    <Card className="grid gap-4">
      <h2
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        Kuponlar ({coupons.length})
      </h2>

      {coupons.length === 0 ? (
        <p className="text-sm text-neutral-400">Bu üyeye tanımlı kupon yok.</p>
      ) : (
        <ul className="grid gap-2">
          {coupons.map((c) => {
            const badge = STATUS_BADGE[couponStatus(c, now)];
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] p-2.5"
              >
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium text-neutral-900"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {c.code}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {c.kind === "pct" ? `%${c.value}` : formatTRY(c.value)}{" "}
                    indirim
                    {c.minSubtotalMinor > 0 &&
                      ` · ${formatTRY(c.minSubtotalMinor)}+`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.16em] uppercase ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                  <form action={revokeCustomerCouponAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="email" value={email} />
                    <button
                      type="submit"
                      className="text-xs text-rose-600 underline-offset-2 hover:underline"
                      title="Kuponu sil"
                    >
                      Sil
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        action={action}
        className="grid gap-3 border-t border-[var(--admin-border)] pt-4"
      >
        <h3
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Yeni kupon tanımla
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tür">
            <Select name="kind" defaultValue="pct">
              <option value="pct">Yüzde (%)</option>
              <option value="fixed">Sabit (₺)</option>
            </Select>
          </Field>
          <Field label="Değer">
            <TextInput
              name="value"
              inputMode="decimal"
              placeholder="15"
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min. sepet (₺)" hint="0 = limitsiz">
            <TextInput
              name="minSubtotal"
              inputMode="decimal"
              placeholder="200"
            />
          </Field>
          <Field label="Son kullanma">
            <TextInput name="expiresAt" type="date" />
          </Field>
        </div>
        <Field label="Başlık (opsiyonel)">
          <TextInput name="title" placeholder="Hediye kuponu" maxLength={80} />
        </Field>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state.message && (
          <p className="text-xs text-green-700">{state.message}</p>
        )}
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Tanımlanıyor…" : "Kupon tanımla"}
        </PrimaryButton>
      </form>
    </Card>
  );
}
