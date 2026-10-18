"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ManualOrderActionState } from "@/app/admin/siparisler/actions";
import {
  MANUAL_FULFILLMENTS,
  MANUAL_ORDER_LIMITS,
  manualShippingMode,
  manualStartIsPaid,
  type ManualFulfillment,
} from "@/lib/admin/manual-order-schema";
import {
  MANUAL_PAYMENT_LABELS,
  MANUAL_PAYMENT_METHODS,
} from "@/lib/admin/order-actions";
import { ORDER_FULFILLMENT_LABELS } from "@/lib/admin/order-channel";
import { computeTotalsWithShipping } from "@/lib/mobile/order-pricing";

import {
  PANEL_ACTION_FAILED,
  markFieldErrors,
  useNoResetSubmit,
  withPanelCatch,
} from "./action-form";
import {
  Card,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
  Textarea,
  formatTRY,
} from "./forms";
import { BUTTON } from "./ui";
import { NUMERIC_STYLE } from "./ui/styles";

export interface ManualProductVariant {
  id: string;
  name: string;
  priceDeltaMinor: number;
  stock: number;
}

export interface ManualProduct {
  id: string;
  name: string;
  priceMinor: number;
  stock: number;
  variants: ManualProductVariant[];
}

/** The settings the delivery line is previewed from (the server charges). */
export interface ManualOrderShipping {
  courierFeeMinor: number;
  shippingFlatMinor: number;
  shippingFreeThresholdMinor: number;
}

interface Line {
  key: number;
  productId: string;
  variantId: string;
  qty: number;
}

const initial: ManualOrderActionState = {};

/** A line holds at most this many units (the schema's cap). */
const LINE_MAX = 99;

interface Props {
  products: ManualProduct[];
  shipping: ManualOrderShipping;
  action: (
    prev: ManualOrderActionState,
    formData: FormData,
  ) => Promise<ManualOrderActionState>;
  /**
   * This page load's attempt id (the page makes one per render). Sent with
   * every post of the form: after an answer that never arrived, a second
   * press finds the order the first one made instead of making another.
   */
  clientOrderId: string;
}

const SECTION_TITLE =
  "text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase";
const SECTION_TITLE_STYLE = { fontFamily: "var(--mono), monospace" } as const;
const LINE_LABEL =
  "text-[10px] tracking-[0.18em] text-[var(--admin-text-soft)] uppercase";

/** Units the line's product or variant has; null before a product is picked. */
function availableFor(product: ManualProduct | undefined, variantId: string) {
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === variantId);
  if (variant) return variant.stock;
  return product.variants.length > 0 ? 0 : product.stock;
}

/**
 * Whether anything of the product can be sold. A product with variants is
 * sold by them only: the server refuses its line without one, so its own
 * total is no reason to offer it.
 */
export function manualProductSellable(product: ManualProduct): boolean {
  return product.variants.length > 0
    ? product.variants.some((v) => v.stock > 0)
    : product.stock > 0;
}

/**
 * The variant a picked product's line starts on: its first in stock, else
 * its first. "" for a product without variants. There is no "Varsayılan"
 * line for a product with variants: it was charged the base price and took
 * its unit from the total alone, and the server refuses it now.
 */
export function manualLineVariant(product: ManualProduct | undefined): string {
  if (!product || product.variants.length === 0) return "";
  return (product.variants.find((v) => v.stock > 0) ?? product.variants[0]).id;
}

function stockNote(stock: number): string {
  return stock > 0 ? `(stok: ${stock})` : "(tükendi)";
}

/** The highest quantity a line may ask for: the stock, at most 99. */
function lineCap(available: number | null): number {
  if (available === null) return LINE_MAX;
  return Math.max(1, Math.min(LINE_MAX, available));
}

/**
 * The panel's manual order (phone or counter sale).
 *
 * It posts by hand (useNoResetSubmit), not through `<form action>`: React
 * resets an action form after every answer, so a refused order ("Yetersiz
 * stok") came back with the customer block empty and the status select on
 * "Ödendi" again; re-filling the name turned an order typed as "Ödeme
 * bekleniyor" into a paid one nobody paid (admin audit ORD-03). Every
 * refusal is shown under its own field. Stock is shown in the options and
 * caps the quantity (ORD-M03); the server's check stays the authority.
 */
export function ManualOrderForm({
  products,
  shipping,
  action,
  clientOrderId,
}: Props) {
  const save = withPanelCatch<ManualOrderActionState>(action, () => ({
    error: PANEL_ACTION_FAILED,
  }));
  const [state, formAction, pending] = useActionState(save, initial);
  const onSubmit = useNoResetSubmit(formAction, pending);

  const formRef = useRef<HTMLFormElement>(null);
  const baseId = useId();
  const errorId = (key: string) => `${baseId}-err-${key}`;

  const [lines, setLines] = useState<Line[]>([
    { key: 1, productId: "", variantId: "", qty: 1 },
  ]);
  const [nextKey, setNextKey] = useState(2);
  const [fulfillment, setFulfillment] = useState<ManualFulfillment>("pickup");
  const [status, setStatus] = useState("paid");
  // Pinned for the life of the form: a refreshed page payload brings a new
  // id, and the retry must carry the one the lost post carried.
  const [attemptId] = useState(clientOrderId);

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const fe = (k: string) => state.fieldErrors?.[k];

  /** The refusal under a field: danger ink, announced, tied by its id. */
  const errorFor = (key: string): ReactNode => {
    const message = fe(key);
    if (!message) return null;
    return (
      <p
        id={errorId(key)}
        role="alert"
        tabIndex={-1}
        className="text-xs text-[var(--admin-danger-ink)]"
      >
        {message}
      </p>
    );
  };

  // After each answer: mark the refused controls for assistive tech and put
  // focus on the first one. A refusal of the lines (the hidden `items`) has
  // no control of its own: its message takes the focus.
  useEffect(() => {
    const form = formRef.current;
    if (!form || state === initial) return;
    const errors = state.fieldErrors ?? {};
    const first = markFieldErrors(
      Array.from(form.elements),
      errors,
      (key) => `${baseId}-err-${key}`,
    );
    if (first instanceof HTMLElement) {
      first.focus();
      return;
    }
    if (errors.items) document.getElementById(`${baseId}-err-items`)?.focus();
  }, [state, baseId]);

  function addLine() {
    setLines((ls) => [
      ...ls,
      { key: nextKey, productId: "", variantId: "", qty: 1 },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // A new product or variant may have less stock than the line asks.
        const cap = lineCap(
          availableFor(byId.get(next.productId), next.variantId),
        );
        return { ...next, qty: Math.min(next.qty, cap) };
      }),
    );
  }

  /** A product picked: its first variant in stock, when it has variants. */
  function pickProduct(key: number, productId: string) {
    patchLine(key, {
      productId,
      variantId: manualLineVariant(byId.get(productId)),
    });
  }

  function unitPrice(line: Line): number {
    const p = byId.get(line.productId);
    if (!p) return 0;
    const v = p.variants.find((x) => x.id === line.variantId);
    return Math.max(0, p.priceMinor + (v ? v.priceDeltaMinor : 0));
  }

  const subtotal = lines.reduce(
    (s, l) => s + (l.productId ? unitPrice(l) * l.qty : 0),
    0,
  );
  // The same rule the store charges with; the promo code is applied there.
  const preview = computeTotalsWithShipping(
    subtotal,
    0,
    manualShippingMode(fulfillment, shipping),
    {
      shippingFlatMinor: shipping.shippingFlatMinor,
      shippingFreeThresholdMinor: shipping.shippingFreeThresholdMinor,
    },
  );

  // Serialized payload the server resolves prices against.
  const itemsPayload = JSON.stringify(
    lines
      .filter((l) => l.productId && l.qty > 0)
      .map((l) => ({
        productId: l.productId,
        variantId: l.variantId || undefined,
        qty: l.qty,
      })),
  );

  const paidStart = manualStartIsPaid(status);
  const fulfillmentHint =
    fulfillment === "pickup"
      ? "Müşteri köşkten alır; teslimat ücreti yok."
      : fulfillment === "delivery"
        ? `Kurye ücreti ${formatTRY(Math.max(0, shipping.courierFeeMinor))} (Ayarlar).`
        : shipping.shippingFreeThresholdMinor > 0
          ? `Kargo ${formatTRY(shipping.shippingFlatMinor)}, ${formatTRY(shipping.shippingFreeThresholdMinor)} üzeri ücretsiz (Ayarlar). Kargoya verirken takip numarası gerekir.`
          : `Kargo ${formatTRY(shipping.shippingFlatMinor)} (Ayarlar). Kargoya verirken takip numarası gerekir.`;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="items" value={itemsPayload} readOnly />
      <input type="hidden" name="clientOrderId" value={attemptId} readOnly />

      <Card className="grid gap-4">
        <h2 className={SECTION_TITLE} style={SECTION_TITLE_STYLE}>
          Ürünler
        </h2>

        <div className="grid gap-3">
          {lines.map((line, index) => {
            const product = byId.get(line.productId);
            const variants = product?.variants ?? [];
            const cap = lineCap(availableFor(product, line.variantId));
            const n = index + 1;
            return (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-[var(--admin-border)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] sm:items-end"
              >
                <label className="grid min-w-0 gap-1">
                  <span className={LINE_LABEL}>Ürün</span>
                  <Select
                    value={line.productId}
                    onChange={(e) => pickProduct(line.key, e.target.value)}
                  >
                    <option value="">Seç…</option>
                    {products.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={!manualProductSellable(p)}
                      >
                        {p.name} · {formatTRY(p.priceMinor)}
                        {p.variants.length === 0
                          ? ` ${stockNote(p.stock)}`
                          : manualProductSellable(p)
                            ? ""
                            : " (tükendi)"}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="grid min-w-0 gap-1">
                  <span className={LINE_LABEL}>Varyant</span>
                  <Select
                    value={line.variantId}
                    disabled={variants.length === 0}
                    onChange={(e) =>
                      patchLine(line.key, { variantId: e.target.value })
                    }
                  >
                    {variants.length === 0 && <option value="">-</option>}
                    {variants.map((v) => (
                      <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                        {v.name}
                        {v.priceDeltaMinor !== 0
                          ? ` (${v.priceDeltaMinor > 0 ? "+" : ""}${formatTRY(v.priceDeltaMinor)})`
                          : ""}{" "}
                        {stockNote(v.stock)}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="grid gap-1">
                  <span className={LINE_LABEL}>Adet</span>
                  <TextInput
                    type="number"
                    min={1}
                    max={cap}
                    value={String(line.qty)}
                    onChange={(e) =>
                      patchLine(line.key, {
                        qty: Math.max(
                          1,
                          Math.min(cap, Number(e.target.value) || 1),
                        ),
                      })
                    }
                    className="w-20"
                  />
                </label>

                <div className="grid gap-1">
                  <span className={LINE_LABEL}>Tutar</span>
                  <span
                    className="py-2.5 text-sm text-[var(--admin-text)]"
                    style={NUMERIC_STYLE}
                  >
                    {line.productId
                      ? formatTRY(unitPrice(line) * line.qty)
                      : "-"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length === 1}
                  aria-label={`${n}. satırı kaldır`}
                  title={
                    lines.length === 1
                      ? "Siparişte en az bir satır kalır."
                      : undefined
                  }
                  className="min-h-[44px] rounded-full border border-[var(--admin-border)] px-3 text-xs text-[var(--admin-text-soft)] hover:border-[var(--admin-danger)] hover:text-[var(--admin-danger-ink)] disabled:opacity-40"
                >
                  Kaldır
                </button>
              </div>
            );
          })}
        </div>
        {errorFor("items")}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <GhostButton type="button" onClick={addLine}>
            + Ürün ekle
          </GhostButton>
          <dl
            className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm text-[var(--admin-text-soft)]"
            style={NUMERIC_STYLE}
          >
            <dt>Ara toplam</dt>
            <dd className="text-right text-[var(--admin-text)]">
              {formatTRY(preview.subtotalMinor)}
            </dd>
            <dt>Teslimat</dt>
            <dd className="text-right text-[var(--admin-text)]">
              {preview.shippingMinor > 0
                ? formatTRY(preview.shippingMinor)
                : "Ücretsiz"}
            </dd>
            <dt>Toplam</dt>
            <dd className="text-right font-semibold text-[var(--admin-text)]">
              {formatTRY(preview.totalMinor)}
            </dd>
          </dl>
        </div>
        <p className="text-xs text-[var(--admin-text-soft)]">
          Fiyat, stok ve promosyon kodu kaydederken sunucuda denetlenir; son
          tutar orada hesaplanır.
        </p>
      </Card>

      <Card className="grid gap-5">
        <h2 className={SECTION_TITLE} style={SECTION_TITLE_STYLE}>
          Müşteri ve teslimat
        </h2>
        <div className="grid gap-1.5">
          <Field label="Teslimat" hint={fulfillmentHint}>
            <Select
              name="fulfillment"
              value={fulfillment}
              onChange={(e) =>
                setFulfillment(e.target.value as ManualFulfillment)
              }
            >
              {MANUAL_FULFILLMENTS.map((f) => (
                <option key={f} value={f}>
                  {ORDER_FULFILLMENT_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          {errorFor("fulfillment")}
        </div>
        <div className="grid gap-1.5">
          <Field label="Ad Soyad">
            <TextInput
              name="customerName"
              required
              minLength={2}
              maxLength={MANUAL_ORDER_LIMITS.customerName}
              placeholder="Müşteri adı"
            />
          </Field>
          {errorFor("customerName")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Field label="E-posta (isteğe bağlı)">
              <TextInput
                name="customerEmail"
                type="email"
                maxLength={MANUAL_ORDER_LIMITS.customerEmail}
                placeholder="ornek@eposta.com"
              />
            </Field>
            {errorFor("customerEmail")}
          </div>
          <div className="grid content-start gap-1.5">
            <Field label="Telefon (isteğe bağlı)">
              <TextInput
                name="customerPhone"
                type="tel"
                maxLength={MANUAL_ORDER_LIMITS.customerPhone}
                placeholder="+90 5xx xxx xx xx"
              />
            </Field>
            {errorFor("customerPhone")}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Field
            label={
              fulfillment === "pickup"
                ? "Teslimat adresi (isteğe bağlı)"
                : "Teslimat adresi"
            }
          >
            <Textarea
              name="shippingAddress"
              rows={3}
              required={fulfillment !== "pickup"}
              maxLength={MANUAL_ORDER_LIMITS.shippingAddress}
              placeholder="Mahalle, cadde, no, daire, ilçe / il"
            />
          </Field>
          {errorFor("shippingAddress")}
        </div>
      </Card>

      <Card className="grid gap-5">
        <h2 className={SECTION_TITLE} style={SECTION_TITLE_STYLE}>
          Sipariş ayarları
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Field label="Başlangıç durumu">
              <Select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="paid">Ödendi</option>
                <option value="pending_payment">Ödeme bekleniyor</option>
                <option value="preparing">Hazırlanıyor</option>
              </Select>
            </Field>
            {errorFor("status")}
          </div>
          {paidStart ? (
            <div className="grid content-start gap-1.5">
              <Field
                label="Nasıl ödendi?"
                hint="Ödeme kaydına yazılır; iade ederken bu yola bakılır."
              >
                <Select name="paymentMethod" required defaultValue="">
                  <option value="">Seç…</option>
                  {MANUAL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {MANUAL_PAYMENT_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              {errorFor("paymentMethod")}
            </div>
          ) : null}
          <div className="grid content-start gap-1.5">
            <Field label="Promosyon kodu (isteğe bağlı)">
              <TextInput
                name="promoCode"
                maxLength={MANUAL_ORDER_LIMITS.promoCode}
                placeholder="YAZ25"
                autoCapitalize="characters"
              />
            </Field>
            {errorFor("promoCode")}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Field label="İç not (isteğe bağlı)">
            <Textarea
              name="internalNote"
              rows={2}
              maxLength={MANUAL_ORDER_LIMITS.internalNote}
              placeholder="Ekip için not, müşteri görmez."
            />
          </Field>
          {errorFor("internalNote")}
        </div>

        {state.error ? (
          <div
            role="alert"
            className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
          >
            {state.error}
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/siparisler" className={BUTTON.ghost}>
          Vazgeç
        </Link>
        <PrimaryButton
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Sipariş oluşturuluyor…" : "Siparişi oluştur"}
        </PrimaryButton>
      </Card>
    </form>
  );
}
