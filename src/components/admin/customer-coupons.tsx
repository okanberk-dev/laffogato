"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  grantCustomerCouponAction,
  revokeCustomerCouponAction,
  type CouponGrantState,
} from "@/app/admin/musteriler/actions";
import type { AdminTone } from "@/lib/admin/tone";
import { couponStatus, type CustomerCoupon } from "@/lib/customer/coupon-utils";

import {
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
import { FormError, FormSuccess } from "./form-feedback";
import {
  Card,
  Field,
  PrimaryButton,
  Select,
  TextInput,
  formatTRY,
} from "./forms";
import { Badge, ConfirmButton } from "./ui";

const initial: CouponGrantState = {};

// Kit tones (AA on their ground, tests/admin-ui-kit.test.ts); the grey
// pills they replace were 4.34:1 (PEO-17).
const STATUS_BADGE: Record<string, { label: string; tone: AdminTone }> = {
  active: { label: "Hazır", tone: "success" },
  redeemed: { label: "Kullanıldı", tone: "neutral" },
  expired: { label: "Süresi doldu", tone: "neutral" },
  inactive: { label: "Pasif", tone: "neutral" },
};

export function CustomerCoupons({
  email,
  coupons,
}: {
  email: string;
  coupons: CustomerCoupon[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const boundGrant = grantCustomerCouponAction.bind(null, email);
  // Posted by hand: a refused grant used to reset the form, putting "Tür"
  // back on % so a retyped "15" became 15% instead of 15 TL. A grant that
  // went through empties it for the next one.
  const [state, action, pending] = useActionState(
    withPanelCatch(boundGrant, () => ({ error: PANEL_ACTION_FAILED })),
    initial,
  );
  const post = useHandPost(action, pending);
  useEffect(() => {
    if (state.message && !state.error) formRef.current?.reset();
  }, [state]);
  // Read once when the card mounts; a render-time Date.now() is impure and
  // would let two renders disagree about which coupon has expired.
  const [now] = useState(() => Date.now());

  return (
    <Card className="grid gap-4">
      <h2
        className="text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        Kuponlar ({coupons.length})
      </h2>

      {coupons.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Bu üyeye tanımlı kupon yok.
        </p>
      ) : (
        <ul className="grid gap-2">
          {coupons.map((c) => {
            const badge = STATUS_BADGE[couponStatus(c, now)];
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--admin-border)] p-2.5"
              >
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium text-[var(--admin-text)]"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {c.code}
                  </div>
                  <div className="text-xs text-[var(--admin-text-soft)]">
                    {c.kind === "pct" ? `%${c.value}` : formatTRY(c.value)}{" "}
                    indirim
                    {c.minSubtotalMinor > 0 &&
                      ` · ${formatTRY(c.minSubtotalMinor)}+`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {/* A stamp-card or milestone coupon is never deleted (its
                      card would lose its coupon and give the stamps back):
                      unused ones are deactivated, used or inactive ones have
                      nothing left to do. */}
                  {(c.source === "loyalty" || c.source === "milestone") &&
                  (c.redeemedAt || !c.isActive) ? null : (
                    <ConfirmButton
                      action={revokeCustomerCouponAction}
                      hidden={{ id: c.id, email }}
                      label={
                        c.source === "loyalty" || c.source === "milestone"
                          ? "Pasifleştir"
                          : "Sil"
                      }
                      description={
                        c.source === "loyalty" || c.source === "milestone"
                          ? `${c.code} pasifleşir, üye artık kullanamaz. Damgalar geri dönmez.`
                          : `${c.code} silinir, üye artık kullanamaz.`
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        ref={formRef}
        action={post.action}
        onSubmit={post.onSubmit}
        className="grid gap-3 border-t border-[var(--admin-border)] pt-4"
      >
        <h3
          className="text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
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
        <FormError message={state.error} />
        <FormSuccess message={state.error ? undefined : state.message} />
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Tanımlanıyor…" : "Kupon tanımla"}
        </PrimaryButton>
      </form>
    </Card>
  );
}
