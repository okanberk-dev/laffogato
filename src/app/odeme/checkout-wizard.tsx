"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

import type { PublicCustomer, CustomerAddress } from "@/lib/customer/store";
import {
  computeOrderTotals,
  type CheckoutConfig,
  DEFAULT_CHECKOUT_CONFIG,
} from "@/lib/utils/commerce";

import {
  placeOrderAction,
  previewPromoAction,
  type PromoPreviewState,
} from "./actions";
import {
  CheckoutConsent,
  checkoutConsentGiven,
  type CheckoutConsentTicks,
  NO_CHECKOUT_CONSENT,
} from "./checkout-consent";

interface CartItem {
  productId?: string;
  variantId?: string;
  variantName?: string;
  name: string;
  price: number;
  qty?: number;
  tag?: string;
}

const CART_STORAGE_KEY = "laffogato_cart_v1";
const promoInitial: PromoPreviewState = {};

type Step = "review" | "shipping" | "payment";

const STEPS: { key: Step; label: string; hint: string }[] = [
  { key: "review", label: "Sepet", hint: "Ürünleri incele" },
  { key: "shipping", label: "Teslimat", hint: "Adres bilgileri" },
  { key: "payment", label: "Ödeme", hint: "Güvenli kapanış" },
];

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (it): it is CartItem =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as CartItem).name === "string",
    );
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore (private mode, full quota)
  }
}

function formatTRY(value: number): string {
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}₺`;
}

export function CheckoutWizard({
  customer,
  config = DEFAULT_CHECKOUT_CONFIG,
}: {
  customer: PublicCustomer | null;
  config?: CheckoutConfig;
}) {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>("review");

  useEffect(() => {
    // Hydration read: the server renders an empty cart (it has no
    // localStorage), so the stored items arrive here, after hydration, and
    // `mounted` holds the empty-cart message back until they have. The cart
    // is written back by the next effect, which a read-only
    // useSyncExternalStore snapshot would not model.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart());
    setMounted(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setItems(readCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (mounted) writeCart(items);
  }, [items, mounted]);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0),
    [items],
  );

  const [promoState, promoAction, promoPending] = useActionState(
    previewPromoAction,
    promoInitial,
  );
  const promoOk = promoState.ok;
  const discountMajor = promoOk ? promoOk.discountMinor / 100 : 0;

  // Authoritative money math (shipping + total) using the same helper the
  // server uses at placeOrder - keeps the displayed total === charged total.
  const totals = useMemo(
    () =>
      computeOrderTotals(
        Math.round(subtotal * 100),
        Math.round(discountMajor * 100),
        config,
      ),
    [subtotal, discountMajor, config],
  );
  const shippingMajor = totals.shippingMinor / 100;
  const total = totals.totalMinor / 100;
  const freeShippingRemainingMajor = totals.freeShippingRemainingMinor / 100;

  const setQty = (idx: number, qty: number) => {
    setItems((prev) =>
      prev
        .map((it, i) => (i === idx ? { ...it, qty: Math.max(0, qty) } : it))
        .filter((it) => (it.qty ?? 1) > 0),
    );
  };

  // Shipping form state
  const defaultAddress =
    customer?.addresses.find((a) => a.isDefault) ?? customer?.addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    defaultAddress ? defaultAddress.id : "new",
  );
  const [shippingDraft, setShippingDraft] = useState<{
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    line1: string;
    line2: string;
    district: string;
    city: string;
    zip: string;
  }>({
    customerName: customer?.name ?? "",
    customerEmail: customer?.email ?? "",
    customerPhone: customer?.phone ?? "",
    line1: "",
    line2: "",
    district: "",
    city: "",
    zip: "",
  });

  const selectedAddress: CustomerAddress | null =
    selectedAddressId !== "new"
      ? (customer?.addresses.find((a) => a.id === selectedAddressId) ?? null)
      : null;

  const shippingSummary = useMemo(() => {
    if (selectedAddress) {
      return {
        customerName: selectedAddress.recipientName || customer?.name || "",
        customerEmail: customer?.email ?? "",
        customerPhone: selectedAddress.phone || customer?.phone || "",
        shippingAddress: [
          selectedAddress.line1,
          selectedAddress.line2,
          selectedAddress.district,
          selectedAddress.city,
          selectedAddress.zip,
        ]
          .filter(Boolean)
          .join(", "),
      };
    }
    return {
      customerName: shippingDraft.customerName,
      customerEmail: shippingDraft.customerEmail,
      customerPhone: shippingDraft.customerPhone,
      shippingAddress: [
        shippingDraft.line1,
        shippingDraft.line2,
        shippingDraft.district,
        shippingDraft.city,
        shippingDraft.zip,
      ]
        .filter(Boolean)
        .join(", "),
    };
  }, [selectedAddress, shippingDraft, customer]);

  const canContinueShipping =
    shippingSummary.customerName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingSummary.customerEmail) &&
    shippingSummary.customerPhone.trim().length >= 7 &&
    shippingSummary.shippingAddress.length >= 5;

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          name: it.name,
          price: it.price ?? 0,
          qty: it.qty ?? 1,
        })),
      ),
    [items],
  );

  // Order placement state
  const [placing, setPlacing] = useState(false);

  if (!mounted) {
    return <div className="checkout-skeleton" />;
  }

  if (items.length === 0) {
    return (
      <section className="checkout-empty">
        <div className="checkout-empty-mark" aria-hidden="true">
          ✻
        </div>
        <h1 className="h2" style={{ marginBottom: 10 }}>
          Sepetin <span className="script">boş.</span>
        </h1>
        <p className="lede" style={{ margin: "0 auto 24px" }}>
          Birkaç adım sonra evine espresso, gelato veya yenilebilir kup
          gelebilir. Mağazaya göz at, gerisi bizde.
        </p>
        <Link href="/#shop" className="btn btn-primary">
          Mağazaya git →
        </Link>
      </section>
    );
  }

  return (
    <div className="checkout-grid">
      <div className="checkout-main">
        <Stepper current={step} />

        {step === "review" && (
          <ReviewStep
            items={items}
            setQty={setQty}
            subtotal={subtotal}
            onContinue={() => setStep("shipping")}
          />
        )}

        {step === "shipping" && (
          <ShippingStep
            customer={customer}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setSelectedAddressId}
            draft={shippingDraft}
            setDraft={setShippingDraft}
            canContinue={canContinueShipping}
            onBack={() => setStep("review")}
            onContinue={() => setStep("payment")}
          />
        )}

        {step === "payment" && (
          <PaymentStep
            placing={placing}
            setPlacing={setPlacing}
            itemsJson={itemsJson}
            promoCode={promoOk?.code}
            shipping={shippingSummary}
            total={total}
            onBack={() => setStep("shipping")}
          />
        )}
      </div>

      <aside className="checkout-summary">
        <div className="checkout-summary-card">
          <header className="checkout-summary-head">
            <span className="eyebrow">Sipariş özeti</span>
            <span className="eyebrow tabular">{items.length} ürün</span>
          </header>
          <ul className="checkout-summary-items">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`}>
                <div>
                  <div className="checkout-summary-name">{it.name}</div>
                  <div className="checkout-summary-qty tabular">
                    {it.qty || 1} adet
                  </div>
                </div>
                <div className="tabular checkout-summary-price">
                  {formatTRY((it.price || 0) * (it.qty || 1))}
                </div>
              </li>
            ))}
          </ul>
          <PromoBlock
            subtotal={subtotal}
            promoAction={promoAction}
            promoPending={promoPending}
            promoState={promoState}
          />
          <div className="checkout-summary-row">
            <span>Ara toplam</span>
            <span className="tabular">{formatTRY(subtotal)}</span>
          </div>
          {promoOk && (
            <div
              className="checkout-summary-row"
              style={{ color: "var(--matcha)" }}
            >
              <span>İndirim · {promoOk.code}</span>
              <span className="tabular">−{formatTRY(discountMajor)}</span>
            </div>
          )}
          <div className="checkout-summary-row">
            <span>Kargo</span>
            <span className="tabular">
              {shippingMajor > 0 ? formatTRY(shippingMajor) : "Ücretsiz"}
            </span>
          </div>
          {freeShippingRemainingMajor > 0 && (
            <div className="checkout-freeship-hint">
              <strong>{formatTRY(freeShippingRemainingMajor)}</strong> daha
              ekle, kargo ücretsiz olsun
            </div>
          )}
          <div className="checkout-summary-total">
            <span>Toplam</span>
            <span className="tabular">{formatTRY(total)}</span>
          </div>
          <div className="checkout-summary-note">
            KDV dahil{config.taxRatePct > 0 ? ` (%${config.taxRatePct})` : ""} ·
            Türkiye geneli teslimat
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="checkout-stepper" aria-label="Ödeme adımları">
      {STEPS.map((s, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <li
            key={s.key}
            className="checkout-stepper-item"
            data-state={done ? "done" : active ? "active" : "todo"}
          >
            <span className="checkout-stepper-num tabular">
              {done ? "✓" : String(idx + 1).padStart(2, "0")}
            </span>
            <span>
              <span className="checkout-stepper-label">{s.label}</span>
              <span className="checkout-stepper-hint">{s.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ReviewStep({
  items,
  setQty,
  subtotal,
  onContinue,
}: {
  items: CartItem[];
  setQty: (idx: number, qty: number) => void;
  subtotal: number;
  onContinue: () => void;
}) {
  return (
    <section className="checkout-step">
      <header className="checkout-step-head">
        <span className="eyebrow">01 - Sepet</span>
        <h2 className="h2" style={{ marginTop: 8 }}>
          Sepetini <span className="script">incele.</span>
        </h2>
      </header>
      <ul className="checkout-line-list">
        {items.map((it, i) => (
          <li key={`${it.name}-${i}`} className="checkout-line">
            <div className="checkout-line-info">
              <div className="checkout-line-name">{it.name}</div>
              {it.tag && (
                <div className="eyebrow" style={{ marginTop: 4 }}>
                  {it.tag}
                </div>
              )}
            </div>
            <div className="checkout-line-qty">
              <button
                type="button"
                aria-label="Azalt"
                onClick={() => setQty(i, (it.qty || 1) - 1)}
              >
                −
              </button>
              <span className="tabular">{it.qty || 1}</span>
              <button
                type="button"
                aria-label="Arttır"
                onClick={() => setQty(i, (it.qty || 1) + 1)}
              >
                +
              </button>
            </div>
            <div className="checkout-line-price tabular">
              {formatTRY((it.price || 0) * (it.qty || 1))}
            </div>
          </li>
        ))}
      </ul>
      <div className="checkout-step-actions">
        <Link href="/#shop" className="btn btn-ghost btn-sm">
          ← Alışverişe devam et
        </Link>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onContinue}
          disabled={subtotal === 0}
        >
          Teslimat bilgilerine geç <span className="arrow">→</span>
        </button>
      </div>
    </section>
  );
}

function ShippingStep({
  customer,
  selectedAddressId,
  onSelectAddress,
  draft,
  setDraft,
  canContinue,
  onBack,
  onContinue,
}: {
  customer: PublicCustomer | null;
  selectedAddressId: string;
  onSelectAddress: (id: string) => void;
  draft: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    line1: string;
    line2: string;
    district: string;
    city: string;
    zip: string;
  };
  setDraft: (next: typeof draft) => void;
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const showNewForm =
    selectedAddressId === "new" || !customer || customer.addresses.length === 0;
  return (
    <section className="checkout-step">
      <header className="checkout-step-head">
        <span className="eyebrow">02 - Teslimat</span>
        <h2 className="h2" style={{ marginTop: 8 }}>
          Nereye <span className="script">gelsin?</span>
        </h2>
      </header>
      {customer && customer.addresses.length > 0 && (
        <div className="checkout-address-grid">
          {customer.addresses.map((a) => {
            const active = a.id === selectedAddressId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelectAddress(a.id)}
                className="checkout-address-card"
                data-active={active ? "true" : undefined}
              >
                <div className="checkout-address-head">
                  <span className="checkout-address-label">
                    {a.label || a.city || "Adres"}
                  </span>
                  {a.isDefault && (
                    <span className="checkout-address-default">Varsayılan</span>
                  )}
                </div>
                <div className="checkout-address-body">
                  {a.recipientName && <div>{a.recipientName}</div>}
                  <div>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </div>
                  <div>
                    {a.district && `${a.district}, `}
                    {a.city} {a.zip}
                  </div>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSelectAddress("new")}
            className="checkout-address-card checkout-address-new"
            data-active={selectedAddressId === "new" ? "true" : undefined}
          >
            <span className="checkout-address-plus">+</span>
            <span className="checkout-address-label">Yeni adres kullan</span>
          </button>
        </div>
      )}
      {showNewForm && (
        <div className="checkout-shipping-form">
          {!customer && (
            <div className="checkout-guest-note">
              <span className="eyebrow">Üye değilsin</span>
              <p>
                Sipariş geçmişine erişebilmek istersen{" "}
                <Link
                  href="/uye/kayit"
                  style={{
                    color: "var(--gold-deep)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  ücretsiz üye ol
                </Link>{" "}
                - yine de misafir olarak devam edebilirsin.
              </p>
            </div>
          )}
          <div className="checkout-field-row">
            <CheckoutField
              label="Ad Soyad"
              required
              autoComplete="name"
              value={draft.customerName}
              onChange={(v) => setDraft({ ...draft, customerName: v })}
            />
            <CheckoutField
              label="E-posta"
              type="email"
              required
              autoComplete="email"
              value={draft.customerEmail}
              onChange={(v) => setDraft({ ...draft, customerEmail: v })}
            />
          </div>
          <div className="checkout-field-row">
            <CheckoutField
              label="Telefon"
              type="tel"
              required
              autoComplete="tel"
              placeholder="+90 ___ ___ __ __"
              value={draft.customerPhone}
              onChange={(v) => setDraft({ ...draft, customerPhone: v })}
            />
            <CheckoutField
              label="Posta kodu"
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={12}
              value={draft.zip}
              onChange={(v) => setDraft({ ...draft, zip: v })}
            />
          </div>
          <CheckoutField
            label="Adres"
            required
            autoComplete="address-line1"
            placeholder="Mahalle, cadde, bina no"
            value={draft.line1}
            onChange={(v) => setDraft({ ...draft, line1: v })}
          />
          <CheckoutField
            label="Adres satırı 2"
            autoComplete="address-line2"
            placeholder="Daire, kat, tarif"
            value={draft.line2}
            onChange={(v) => setDraft({ ...draft, line2: v })}
          />
          <div className="checkout-field-row">
            <CheckoutField
              label="İlçe"
              autoComplete="address-level2"
              value={draft.district}
              onChange={(v) => setDraft({ ...draft, district: v })}
            />
            <CheckoutField
              label="Şehir"
              required
              autoComplete="address-level1"
              value={draft.city}
              onChange={(v) => setDraft({ ...draft, city: v })}
            />
          </div>
        </div>
      )}
      <div className="checkout-step-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Sepet
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onContinue}
          disabled={!canContinue}
        >
          Ödemeye geç <span className="arrow">→</span>
        </button>
      </div>
    </section>
  );
}

function PaymentStep({
  placing,
  setPlacing,
  itemsJson,
  promoCode,
  shipping,
  total,
  onBack,
}: {
  placing: boolean;
  setPlacing: (p: boolean) => void;
  itemsJson: string;
  promoCode?: string;
  shipping: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
  };
  total: number;
  onBack: () => void;
}) {
  const [consent, setConsent] =
    useState<CheckoutConsentTicks>(NO_CHECKOUT_CONSENT);
  const consentGiven = checkoutConsentGiven(consent);
  return (
    <section className="checkout-step">
      <header className="checkout-step-head">
        <span className="eyebrow">03 - Ödeme</span>
        <h2 className="h2" style={{ marginTop: 8 }}>
          Güvenli <span className="script">kapanış.</span>
        </h2>
      </header>

      <div className="checkout-payment-info">
        <span className="eyebrow">Sipariş özeti</span>
        <dl>
          <div>
            <dt>Alıcı</dt>
            <dd>{shipping.customerName}</dd>
          </div>
          <div>
            <dt>E-posta</dt>
            <dd>{shipping.customerEmail}</dd>
          </div>
          <div>
            <dt>Telefon</dt>
            <dd className="tabular">{shipping.customerPhone}</dd>
          </div>
          <div>
            <dt>Adres</dt>
            <dd>{shipping.shippingAddress}</dd>
          </div>
        </dl>
      </div>

      <div className="checkout-payment-card">
        <div className="checkout-payment-card-strip">
          <span className="eyebrow on-dark">Sanal POS</span>
          <span className="eyebrow on-dark tabular">PCI-DSS · 3D Secure</span>
        </div>
        <div className="checkout-payment-card-body">
          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: 14,
              lineHeight: 1.65,
              maxWidth: "52ch",
              margin: 0,
            }}
          >
            {/* Sağlayıcının adı yazılmıyor: sağlayıcı bir sunucu ayarı
                (PAYMENT_PROVIDER) ve bir kez zaten değişti - adı buraya
                yazmak, değiştiği gün müşteriye yanlış kurumu söylerdi. */}
            Ödemen sağlayıcının güvenli ödeme sayfasında tamamlanır. Kart bilgin
            hiçbir aşamada bu siteye girilmez ve burada saklanmaz.
          </p>
          <div className="checkout-payment-amount">
            <span className="eyebrow">Tahsil edilecek</span>
            <span className="tabular">{formatTRY(total)}</span>
          </div>
        </div>
      </div>

      <form
        action={placeOrderAction}
        onSubmit={() => setPlacing(true)}
        className="checkout-payment-form"
      >
        <input type="hidden" name="items" value={itemsJson} />
        {promoCode && (
          <input type="hidden" name="promoCode" value={promoCode} />
        )}
        <input
          type="hidden"
          name="customerName"
          value={shipping.customerName}
        />
        <input
          type="hidden"
          name="customerEmail"
          value={shipping.customerEmail}
        />
        <input
          type="hidden"
          name="customerPhone"
          value={shipping.customerPhone}
        />
        <input
          type="hidden"
          name="shippingAddress"
          value={shipping.shippingAddress}
        />

        {/* Mesafeli Sözleşmeler Yönetmeliği: the consumer confirms the
            ön bilgilendirme formu and accepts the mesafeli satış sözleşmesi
            BEFORE the order is created, one box each, never pre-ticked. The
            hidden `legalConsent` the server reads exists only once both are
            ticked (./checkout-consent); the server refuses the order without
            it and stores it with its time, IP, browser and document revision. */}
        <CheckoutConsent
          ticks={consent}
          onTick={(key, ticked) =>
            setConsent((prev) => ({ ...prev, [key]: ticked }))
          }
          disabled={placing}
        />

        <div className="checkout-step-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            disabled={placing}
          >
            ← Teslimat
          </button>
          <button
            type="submit"
            disabled={placing || !consentGiven}
            className="btn btn-primary btn-lg"
            style={{ minWidth: 240, justifyContent: "center" }}
          >
            {placing ? (
              "Sipariş veriliyor…"
            ) : (
              <>
                Siparişi tamamla · {formatTRY(total)}{" "}
                <span className="arrow">→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function CheckoutField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
  inputMode,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?:
    | "numeric"
    | "tel"
    | "email"
    | "text"
    | "url"
    | "search"
    | "decimal";
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="checkout-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function PromoBlock({
  subtotal,
  promoAction,
  promoPending,
  promoState,
}: {
  subtotal: number;
  promoAction: (formData: FormData) => void;
  promoPending: boolean;
  promoState: PromoPreviewState;
}) {
  return (
    <form action={promoAction} className="checkout-promo">
      <input type="hidden" name="subtotal" value={String(subtotal)} />
      <input
        name="code"
        aria-label="Promosyon kodu"
        placeholder="Promosyon kodu"
        defaultValue={promoState.ok?.code ?? ""}
        autoCapitalize="characters"
      />
      <button type="submit" disabled={promoPending}>
        {promoPending ? "…" : "Uygula"}
      </button>
      {/* Both outcomes were visual only: a rejected code looked exactly like
          a pending one to a screen-reader user. */}
      {promoState.error && (
        <div className="checkout-promo-msg" data-tone="error" role="alert">
          {promoState.error}
        </div>
      )}
      {promoState.ok && (
        <div
          className="checkout-promo-msg"
          data-tone="ok"
          role="status"
          aria-live="polite"
        >
          {promoState.ok.code} uygulandı
        </div>
      )}
    </form>
  );
}
