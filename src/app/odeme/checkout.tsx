"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

import { BusyDots } from "@/components/laffogato/busy-dots";
import { cx } from "@/components/laffogato/cx";
import { checkoutCartKey, textFingerprint } from "@/lib/checkout/cart-key";
import {
  deliveryDraftErrors,
  EMPTY_DELIVERY_DRAFT,
  isValidPhone,
  joinAddress,
  PHONE_MESSAGE,
  type DeliveryDraft,
  type DeliveryField,
} from "@/lib/checkout/delivery";
import {
  checkoutReturnCopy,
  type CheckoutReturn,
} from "@/lib/checkout/return-codes";
import {
  CHECKOUT_DRAFT_KEY,
  CHECKOUT_PENDING_KEY,
  CHECKOUT_RELOAD_KEY,
} from "@/lib/checkout/session-keys";
import type {
  CheckoutQuote,
  CheckoutSavedCard,
  CheckoutStart,
} from "@/lib/checkout/start";
import type { CustomerAddress } from "@/lib/customer/store";
import { documentLoadedAtCheckout } from "@/lib/security/checkout-document";
import { computeOrderTotals, type CheckoutConfig } from "@/lib/utils/commerce";
import { priceLabel } from "@/lib/utils/format";

import {
  deleteSavedCardAction,
  previewPromoAction,
  startCheckoutAction,
  type PromoPreviewState,
} from "./actions";
import {
  CardPayment,
  PAY_FORM_ID,
  type CardPaymentHandle,
} from "./card-payment";
import {
  CheckoutConsent,
  checkoutConsentGiven,
  type CheckoutConsentTicks,
  NO_CHECKOUT_CONSENT,
} from "./checkout-consent";
import { CheckoutDocPanel } from "./checkout-doc-panel";
import type { CheckoutDocSlug, CheckoutDocument } from "./checkout-documents";
import {
  checkoutKdvParts,
  checkoutKdvRows,
  type CheckoutKdvRates,
} from "./checkout-kdv";
import {
  CARD_PAYMENT_METHOD,
  istanbulDateLabel,
  NOTHING_TO_PAY_METHOD,
  OrderBrief,
  type OrderBriefLine,
  type OrderFacts,
  WithdrawalNote,
} from "./checkout-preinfo";
import { AcceptedSchemes } from "./scheme-marks";

/**
 * The one-page checkout (operator, 16 Eki 2026: "checkout sihirbazını genel
 * bilinen e-ticaret siteleri gibi tasarla, kart girerken başka sayfaya
 * atmasın"; docs/PAYNKOLAY.md §15.5).
 *
 * Delivery, payment and the order summary on one page. The card is typed in
 * `CardPayment`'s native form; this component never touches it. Pressing
 * "Siparişi onayla ve öde":
 *
 * 1. checks the address, the two consent boxes and (through the card form)
 *    the card, focusing the first thing to fix;
 * 2. calls `startCheckoutAction` with the ORDER form below - hidden fields
 *    only, no card field can be in it - which creates the order, or reuses
 *    the one a declined attempt left (sessionStorage `PENDING`);
 * 3. compares the server's total with the total shown beside the button.
 *    Equal: the card form posts itself to /odeme/paynkolay and the bank's
 *    3D page opens. Different (a price changed, a code could not be
 *    applied): the new amount is shown and the customer presses again.
 *
 * This document must have been LOADED at /odeme: only then does it run
 * under the checkout's policy, with no Google Tag Manager ever in it. A
 * client-side navigation from another page keeps that page's document and
 * its tags, so the page reloads itself before showing a card field.
 */

export const ORDER_FORM_ID = "order-form";

/**
 * The order form's `action`, never called: nothing submits that form (onPay
 * reads it). A bare form would post itself the browser's way, a GET with the
 * name, phone and address in the URL; a function action makes React draw its
 * guard (`action="javascript:..."`) instead, and onSubmit stops the rest.
 */
const orderFormNeverPosts = () => {};

/** Per-line ceiling, the server's MAX_LINE_QTY (store.ts). */
const MAX_LINE_QTY = 99;

/**
 * How long a pending order may be offered back. The payload is accepted for
 * 30 minutes and the server wants 5 of them left (REUSE_HEADROOM_MS); after
 * that a new order is the only way on, so the browser stops asking.
 */
const PENDING_MAX_AGE_MS = 25 * 60_000;

/**
 * How long "Bankaya yönlendiriliyorsun…" may stay on screen after the pay
 * form was handed to the browser. The route answers within its POS deadline
 * and the bank's page replaces this one; if nothing has replaced it by then
 * (a dropped connection, a blocked navigation) the button comes back with a
 * message instead of leaving a page that waits forever.
 *
 * The route may legitimately take as long as the POS deadline for a payment
 * (`POS_TIMEOUT_MS.payment`, 25 s, paynkolay.ts) before it answers, so this
 * wait is longer than that - a slow bank must not look like a failure while
 * the request is still alive (`tests/checkout-document.test.ts` keeps it so).
 */
const BANK_HANDOFF_WAIT_MS = 30_000;

/** The order step's own bound: an action that never answers is an error. */
const ACTION_WAIT_MS = 30_000;

const HANDOFF_STALLED =
  "Bankanın sayfası açılamadı; kartından para çekilmedi. Bağlantını kontrol edip yeniden dene.";

const CART_STORAGE_KEY = "laffogato_cart_v1";

interface CartItem {
  productId?: string;
  variantId?: string;
  variantName?: string;
  name: string;
  /** Major units (₺), variant delta included - display only. */
  price: number;
  qty?: number;
  maxStock?: number;
  tag?: string;
}

export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
}

/** The seller's identity line (src/lib/legal/entity.ts); empty parts hidden. */
export interface CheckoutSeller {
  name: string;
  address: string;
  phone: string;
  email: string;
  mersis: string;
}

export interface CheckoutPaymentProps {
  mode: "card" | "redirect";
  savedCards: CheckoutSavedCard[];
  savedCardsUnavailable: boolean;
  canSave: boolean;
}

export interface CheckoutProps {
  customer: CheckoutCustomer;
  config: CheckoutConfig;
  payment: CheckoutPaymentProps;
  seller: CheckoutSeller;
  /**
   * The Ön Bilgilendirme Formu and the Mesafeli Satış Sözleşmesi, rendered
   * by the page, for the panel the payment step opens them in. A document
   * missing here opens its own page in a new tab instead.
   */
  documents: CheckoutDocument[];
  /** The rate each product's line will carry, for the KDV note. */
  kdv: CheckoutKdvRates;
  /** Why the page opened with `?odeme=` / `?error=`, if it did. */
  returned: CheckoutReturn | null;
}

/** What a declined attempt leaves for the retry. No card, no address. */
interface PendingCheckout {
  v: 1;
  owner: string;
  orderId: string;
  d: string;
  s: string;
  cartKey: string;
  createdAt: number;
  quote: CheckoutQuote;
}

/** The delivery choice and the code, kept for a trip to the bank and back. */
interface DraftRecord {
  v: 1;
  owner: string;
  addressId: string;
  draft: DeliveryDraft;
  savedPhone: string;
  promoCode: string;
}

interface Boot {
  items: CartItem[];
  pending: PendingCheckout | null;
  draft: DraftRecord | null;
}

// ── Storage (every access guarded: private modes throw) ──────────────────

function readCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
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
  try {
    if (items.length === 0) window.localStorage.removeItem(CART_STORAGE_KEY);
    else window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Private mode or a full quota: the cart lives on in memory.
  }
}

function readSession<T>(key: string, valid: (v: unknown) => v is T): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (valid(value)) return value;
    window.sessionStorage.removeItem(key);
  } catch {
    // Unreadable: treated as absent.
  }
  return null;
}

function writeSession(key: string, value: unknown | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Without storage the retry simply creates a new order.
  }
}

const isText = (v: unknown): v is string => typeof v === "string";

function isPending(v: unknown): v is PendingCheckout {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  const q = p.quote as Record<string, unknown> | undefined;
  return (
    p.v === 1 &&
    isText(p.owner) &&
    isText(p.orderId) &&
    isText(p.d) &&
    isText(p.s) &&
    isText(p.cartKey) &&
    typeof p.createdAt === "number" &&
    typeof q === "object" &&
    q !== null &&
    typeof q.totalMinor === "number" &&
    typeof q.subtotalMinor === "number" &&
    typeof q.discountMinor === "number" &&
    typeof q.shippingMinor === "number" &&
    isText(q.promoCode) &&
    isText(q.cartKey) &&
    Array.isArray(q.lines)
  );
}

function isDraft(v: unknown): v is DraftRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  const d = r.draft as Record<string, unknown> | undefined;
  return (
    r.v === 1 &&
    isText(r.owner) &&
    isText(r.addressId) &&
    isText(r.savedPhone) &&
    isText(r.promoCode) &&
    typeof d === "object" &&
    d !== null &&
    (Object.keys(EMPTY_DELIVERY_DRAFT) as DeliveryField[]).every((k) =>
      isText(d[k]),
    )
  );
}

/** What the tab keeps of an order the card is about to pay. */
function pendingRecord(
  owner: string,
  d: string,
  s: string,
  quote: CheckoutQuote,
  previous: PendingCheckout | null,
): PendingCheckout {
  return {
    v: 1,
    owner,
    orderId: quote.orderId,
    d,
    s,
    cartKey: quote.cartKey,
    // A reused order keeps its own age: the payload expires with it.
    createdAt:
      previous && previous.orderId === quote.orderId
        ? previous.createdAt
        : Date.now(),
    quote,
  };
}

function readBoot(owner: string): Boot {
  let pending = readSession(CHECKOUT_PENDING_KEY, isPending);
  if (
    pending &&
    (pending.owner !== owner ||
      Date.now() - pending.createdAt > PENDING_MAX_AGE_MS)
  ) {
    writeSession(CHECKOUT_PENDING_KEY, null);
    pending = null;
  }
  let draft = readSession(CHECKOUT_DRAFT_KEY, isDraft);
  if (draft && draft.owner !== owner) {
    writeSession(CHECKOUT_DRAFT_KEY, null);
    draft = null;
  }
  return { items: readCart(), pending, draft };
}

// ── The document guard ───────────────────────────────────────────────────

/**
 * Whether this document may show card fields: it was loaded at /odeme (so
 * it runs under the checkout's policy), or - when the browser keeps no
 * navigation record - no tag manager ever ran in it.
 */
function checkoutDocumentIsClean(): boolean {
  let entryName: string | undefined;
  try {
    const entry = performance.getEntriesByType("navigation")[0];
    entryName = entry?.name;
  } catch {
    entryName = undefined;
  }
  const loaded = documentLoadedAtCheckout(entryName);
  if (loaded !== null) return loaded;
  const w = window as unknown as {
    google_tag_manager?: unknown;
    dataLayer?: unknown;
  };
  return !(
    w.google_tag_manager ||
    w.dataLayer ||
    document.querySelector('script[src*="googletagmanager.com"]')
  );
}

/** Reloads once; `false` when a reload just happened and did not help. */
function reloadOnce(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(CHECKOUT_RELOAD_KEY));
    if (Number.isFinite(last) && Date.now() - last < 15_000) return false;
    window.sessionStorage.setItem(CHECKOUT_RELOAD_KEY, String(Date.now()));
  } catch {
    // No storage: reload anyway - a document loaded at /odeme passes.
  }
  window.location.reload();
  return true;
}

export function Checkout(props: CheckoutProps) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [stuck, setStuck] = useState(false);
  const owner = textFingerprint(props.customer.email);

  useEffect(() => {
    if (!checkoutDocumentIsClean()) {
      // A soft navigation brought the visitor here inside another page's
      // document. Load /odeme for real before any card field exists.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!reloadOnce()) setStuck(true);
      return;
    }
    writeSession(CHECKOUT_RELOAD_KEY, null);
    // Hydration read: the server renders no cart (it has no storage), so
    // the basket, a pending order and the delivery draft arrive here, once.
    setBoot(readBoot(owner));
  }, [owner]);

  if (stuck) {
    return (
      <section className="checkout-empty">
        <h1 className="h2">Ödeme sayfası açılamadı</h1>
        <p className="lede">
          Güvenliğin için ödeme sayfası kendi başına açılmalı.
        </p>
        <a href="/odeme" className="btn btn-primary">
          Ödeme sayfasını aç
        </a>
      </section>
    );
  }
  if (!boot) return <div className="checkout-skeleton" aria-hidden="true" />;
  return <CheckoutForm {...props} boot={boot} owner={owner} />;
}

// ── The page ─────────────────────────────────────────────────────────────

type PromoIntent = { code: string; source: "preview" | "order" };

function unitMinor(it: CartItem): number {
  return Math.max(0, Math.round((it.price || 0) * 100));
}

function itemLabel(it: CartItem): string {
  return it.variantName ? `${it.name} · ${it.variantName}` : it.name;
}

function CheckoutForm({
  customer,
  config,
  payment,
  seller,
  documents,
  kdv,
  returned,
  boot,
  owner,
}: CheckoutProps & { boot: Boot; owner: string }) {
  const cardRef = useRef<CardPaymentHandle | null>(null);
  const orderFormRef = useRef<HTMLFormElement | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const consentRef = useRef<HTMLDivElement | null>(null);
  const deliveryRef = useRef<HTMLElement | null>(null);
  const placingRef = useRef(false);

  // Basket ─────────────────────────────────────────────────────────────
  const [items, setItems] = useState<CartItem[]>(boot.items);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setItems(readCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const firstWrite = useRef(true);
  useEffect(() => {
    if (firstWrite.current) {
      firstWrite.current = false;
      return;
    }
    writeCart(items);
  }, [items]);

  // Delivery ───────────────────────────────────────────────────────────
  const addresses = customer.addresses;
  const defaultAddress =
    addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const [addressId, setAddressId] = useState<string>(() => {
    const kept = boot.draft?.addressId;
    if (kept === "new" || addresses.some((a) => a.id === kept)) return kept!;
    return defaultAddress ? defaultAddress.id : "new";
  });
  const [draft, setDraft] = useState<DeliveryDraft>(
    () =>
      boot.draft?.draft ?? {
        ...EMPTY_DELIVERY_DRAFT,
        customerName: customer.name,
        customerPhone: customer.phone,
      },
  );
  const [savedPhone, setSavedPhone] = useState(boot.draft?.savedPhone ?? "");
  const [deliveryErrors, setDeliveryErrors] = useState<
    Partial<Record<DeliveryField | "savedPhone" | "address", string>>
  >({});

  const selected: CustomerAddress | null =
    addressId === "new"
      ? null
      : (addresses.find((a) => a.id === addressId) ?? null);
  const selectedPhone = selected
    ? (selected.phone || customer.phone || "").trim()
    : "";
  const needsPhone = !!selected && !isValidPhone(selectedPhone);

  const delivery = useMemo(
    () =>
      selected
        ? {
            customerName: (selected.recipientName || customer.name).trim(),
            customerPhone: needsPhone ? savedPhone.trim() : selectedPhone,
            shippingAddress: joinAddress(selected),
          }
        : {
            customerName: draft.customerName.trim(),
            customerPhone: draft.customerPhone.trim(),
            shippingAddress: joinAddress(draft),
          },
    [selected, customer.name, needsPhone, savedPhone, selectedPhone, draft],
  );

  // Consent ────────────────────────────────────────────────────────────
  const [consent, setConsent] =
    useState<CheckoutConsentTicks>(NO_CHECKOUT_CONSENT);
  const consentGiven = checkoutConsentGiven(consent);

  // Promo ──────────────────────────────────────────────────────────────
  const [pending, setPending] = useState<PendingCheckout | null>(boot.pending);
  const [quote, setQuote] = useState<CheckoutQuote | null>(
    boot.pending?.quote ?? null,
  );
  const [promoState, promoDispatch, promoPending] = useActionState<
    PromoPreviewState,
    FormData
  >(previewPromoAction, {});
  const [asked, setAsked] = useState<{ code: string; at: number } | null>(null);
  const [intent, setIntent] = useState<PromoIntent | null>(() => {
    if (boot.pending?.quote.promoCode) {
      return { code: boot.pending.quote.promoCode, source: "order" };
    }
    const kept = boot.draft?.promoCode.trim();
    return kept ? { code: kept, source: "preview" } : null;
  });
  const [promoInput, setPromoInput] = useState(intent?.code ?? "");

  const subtotalMinor = useMemo(
    () => items.reduce((s, it) => s + unitMinor(it) * (it.qty || 1), 0),
    [items],
  );

  const sameCode = (a: string, b: string) =>
    a.trim().toUpperCase() === b.trim().toUpperCase();
  const promoResult: { discountMinor: number; at: number } | null = !intent
    ? null
    : intent.source === "order"
      ? quote && sameCode(quote.promoCode, intent.code)
        ? { discountMinor: quote.discountMinor, at: quote.subtotalMinor }
        : null
      : !promoPending &&
          promoState.ok &&
          asked &&
          sameCode(asked.code, intent.code) &&
          sameCode(promoState.ok.code, intent.code)
        ? { discountMinor: promoState.ok.discountMinor, at: asked.at }
        : null;
  const promoFresh =
    intent && promoResult && promoResult.at === subtotalMinor
      ? { code: intent.code, discountMinor: promoResult.discountMinor }
      : null;
  const promoRefused =
    !!intent &&
    intent.source === "preview" &&
    !promoPending &&
    !!promoState.error &&
    !!asked &&
    sameCode(asked.code, intent.code) &&
    asked.at === subtotalMinor;
  const promoStale = !!intent && !promoFresh && !promoRefused;

  const runPreview = useCallback(
    (code: string, at: number) => {
      const fd = new FormData();
      fd.set("code", code);
      fd.set("subtotal", String(at / 100));
      setAsked({ code, at });
      setIntent({ code, source: "preview" });
      startTransition(() => promoDispatch(fd));
    },
    [promoDispatch],
  );

  // A code applied to a different basket is not a discount on this one: the
  // preview runs again for the new subtotal (debounced), and the discount is
  // left out of the total until it answers.
  useEffect(() => {
    if (!intent || !promoStale || promoPending) return;
    const timer = window.setTimeout(
      () => runPreview(intent.code, subtotalMinor),
      450,
    );
    return () => window.clearTimeout(timer);
  }, [intent, promoStale, promoPending, subtotalMinor, runPreview]);

  // Totals ─────────────────────────────────────────────────────────────
  const lineKeys = useMemo(
    () =>
      items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        name: it.name,
        qty: it.qty || 1,
      })),
    [items],
  );
  const cartKey = checkoutCartKey({
    items: lineKeys,
    ...delivery,
    promoCode: promoFresh?.code ?? "",
  });
  const computed = computeOrderTotals(
    subtotalMinor,
    promoFresh?.discountMinor ?? 0,
    config,
  );
  // The server's own figures for this very basket, when it has quoted them
  // (a price confirmation, or the order a declined card left).
  const quoted = quote && quote.cartKey === cartKey ? quote : null;
  const totals = quoted
    ? {
        subtotalMinor: quoted.subtotalMinor,
        discountMinor: quoted.discountMinor,
        shippingMinor: quoted.shippingMinor,
        totalMinor: quoted.totalMinor,
      }
    : computed;
  const payAmountMinor = totals.totalMinor;
  const reuse = pending && pending.cartKey === cartKey ? pending : null;

  /** A line's amount: the server's price once it has quoted this basket. */
  const lineMinorOf = (it: CartItem): number => {
    const qty = it.qty || 1;
    const line = quoted?.lines.find(
      (l) =>
        l.productId === it.productId &&
        (l.variantId ?? "") === (it.variantId ?? ""),
    );
    return line ? line.unitPriceMinor * qty : unitMinor(it) * qty;
  };
  const briefLines: OrderBriefLine[] = items.map((it) => ({
    key: `${it.productId ?? it.name}::${it.variantId ?? ""}`,
    label: itemLabel(it),
    qty: it.qty || 1,
    lineMinor: lineMinorOf(it),
  }));
  // The KDV inside the total, per rate (operator, 18 Eki 2026): from the
  // rate each line will carry, never assumed; without one, no note.
  const kdvParts = checkoutKdvParts(
    checkoutKdvRows({
      lines: items.map((it, i) => ({
        grossMinor: briefLines[i].lineMinor,
        ratePct: it.productId ? kdv.products[it.productId] : null,
      })),
      subtotalMinor: totals.subtotalMinor,
      discountMinor: totals.discountMinor,
      shippingMinor: totals.shippingMinor,
      totalMinor: totals.totalMinor,
      shippingRatePct: kdv.shippingRatePct,
    }),
  );

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

  // Paying ─────────────────────────────────────────────────────────────
  const [placing, setPlacing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<CheckoutReturn | null>(returned);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Documents ──────────────────────────────────────────────────────────
  // The Ön Bilgilendirme Formu and the Mesafeli Satış Sözleşmesi open in a
  // panel on this page, filled with the order (ASK-OTH-2, 18 Eki 2026), so
  // reading them never takes the customer away from a typed card.
  const [openDoc, setOpenDoc] = useState<CheckoutDocSlug | null>(null);
  const openDocFrom = (
    event: MouseEvent<HTMLAnchorElement>,
    slug: CheckoutDocSlug,
  ) => {
    // A new tab when asked for one (Cmd/Ctrl/Shift, middle button), and
    // the page itself when the text did not come with this one.
    if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
    if (event.shiftKey || event.altKey) return;
    if (!documents.some((d) => d.slug === slug)) return;
    event.preventDefault();
    setOpenDoc(slug);
  };
  const docLink =
    (slug: CheckoutDocSlug) => (event: MouseEvent<HTMLAnchorElement>) =>
      openDocFrom(event, slug);

  // Steps ──────────────────────────────────────────────────────────────
  // 1 Teslimat → 2 Ödeme, on this one page: no reload between them, so the
  // card typed in step 2 stays where it is (uncontrolled) when the customer
  // looks back at the address. A member whose address is complete - the
  // default one, or the one kept from a trip to the bank - starts on step 2
  // with the address summed up and a "Değiştir" link.
  const deliveryReady = selected
    ? (!needsPhone || isValidPhone(savedPhone.trim())) &&
      delivery.customerName.length >= 2 &&
      delivery.shippingAddress.length >= 5
    : Object.keys(deliveryDraftErrors(draft)).length === 0;
  const [step, setStep] = useState<1 | 2>(() =>
    returned || deliveryReady ? 2 : 1,
  );
  const topRef = useRef<HTMLDivElement | null>(null);

  /**
   * A step change moves the reader: to the top of the page, and keyboard and
   * screen-reader focus onto the new step's heading (`tabIndex={-1}`) - the
   * button that was pressed is hidden with its step, which would otherwise
   * drop focus on the document.
   */
  const showStep = useCallback((which: 1 | 2) => {
    window.setTimeout(() => {
      topRef.current?.scrollIntoView({ block: "start" });
      document
        .getElementById(which === 1 ? "co-delivery-title" : "co-pay-title")
        ?.focus({ preventScroll: true });
    }, 0);
  }, []);

  // Back and Forward move between the steps: step 2 is its own history
  // entry when it was reached from step 1 (same URL, a marker in the state).
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { coStep?: number } | null;
      const next = state?.coStep === 2 ? 2 : 1;
      setStep(next);
      showStep(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [showStep]);

  const handoffTimer = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (handoffTimer.current !== null) {
      window.clearTimeout(handoffTimer.current);
      handoffTimer.current = null;
    }
    placingRef.current = false;
    setPlacing(false);
  }, []);
  useEffect(() => stop, [stop]);

  /** The page is leaving for the bank (or another page): wait, but not forever. */
  const awaitHandoff = () => {
    if (handoffTimer.current !== null)
      window.clearTimeout(handoffTimer.current);
    handoffTimer.current = window.setTimeout(() => {
      handoffTimer.current = null;
      placingRef.current = false;
      setPlacing(false);
      setPayError(HANDOFF_STALLED);
    }, BANK_HANDOFF_WAIT_MS);
  };

  // Came back with a reason: say it where the card is, and put the reader
  // there. The query is dropped so a reload does not repeat it.
  useEffect(() => {
    if (!returned) return;
    const el = bannerRef.current;
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
    try {
      window.history.replaceState(null, "", "/odeme");
    } catch {
      // Not fatal: the notice would only show again on a reload.
    }
    // Once, for the reason the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setQty = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const cap = Math.min(MAX_LINE_QTY, Math.max(1, it.maxStock ?? 99));
        return { ...it, qty: Math.min(cap, Math.max(1, qty)) };
      }),
    );
  };
  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  /** The server's prices, written into the basket the customer sees. */
  const adoptQuote = (q: CheckoutQuote) => {
    setQuote(q);
    setItems((prev) =>
      prev.map((it) => {
        const line = q.lines.find(
          (l) =>
            l.productId === it.productId &&
            (l.variantId ?? "") === (it.variantId ?? ""),
        );
        return line ? { ...it, price: line.unitPriceMinor / 100 } : it;
      }),
    );
    if (q.promoCode) {
      setIntent({ code: q.promoCode, source: "order" });
      setPromoInput(q.promoCode);
    } else {
      setIntent(null);
      setPromoInput("");
    }
  };

  /**
   * Checks the delivery step and shows its messages. Returns the id of the
   * first thing to fix, or `null` when the address can be sent.
   */
  const checkDelivery = (): string | null => {
    if (selected) {
      const problems: typeof deliveryErrors = {};
      if (needsPhone && !isValidPhone(savedPhone.trim())) {
        problems.savedPhone = PHONE_MESSAGE;
      }
      if (
        delivery.customerName.length < 2 ||
        delivery.shippingAddress.length < 5
      ) {
        problems.address =
          "Bu adreste eksik bilgi var. Yeni adres ekleyip öyle devam et.";
      }
      setDeliveryErrors(problems);
      if (problems.savedPhone) return "co-saved-phone";
      if (problems.address) return "co-delivery-title";
      return null;
    }
    const problems = deliveryDraftErrors(draft);
    setDeliveryErrors(problems);
    const order: DeliveryField[] = [
      "customerName",
      "customerPhone",
      "line1",
      "district",
      "city",
    ];
    const first = order.find((f) => problems[f]);
    return first ? `co-${first}` : null;
  };

  /** Back to step 1, with the reader on the field to fix. */
  const showDeliveryProblem = (id: string) => {
    setStep(1);
    window.setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
    }, 0);
  };

  const goToPayment = () => {
    const problem = checkDelivery();
    if (problem) {
      showDeliveryProblem(problem);
      return;
    }
    saveDraft();
    setStep(2);
    try {
      window.history.pushState({ coStep: 2 }, "");
    } catch {
      // Without history the visible "Değiştir" link still goes back.
    }
    showStep(2);
  };

  const goToDelivery = () => {
    if (placingRef.current) return;
    let pushed = false;
    try {
      pushed =
        (window.history.state as { coStep?: number } | null)?.coStep === 2;
    } catch {
      pushed = false;
    }
    // The entry step 2 pushed is the one Back leaves; the popstate handler
    // above shows step 1.
    if (pushed) window.history.back();
    else {
      setStep(1);
      showStep(1);
    }
  };

  const saveDraft = () =>
    writeSession(CHECKOUT_DRAFT_KEY, {
      v: 1,
      owner,
      addressId,
      draft,
      savedPhone,
      promoCode: promoFresh?.code ?? "",
    } satisfies DraftRecord);

  const onPay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (placingRef.current) return;
    setPayError(null);
    setNotice(null);

    if (items.length === 0) return;
    const deliveryProblem = checkDelivery();
    if (deliveryProblem) {
      showDeliveryProblem(deliveryProblem);
      return;
    }
    if (!consentGiven) {
      setPayError("Devam etmek için iki sözleşme onayını da işaretle.");
      consentRef.current?.focus();
      return;
    }
    if (promoStale || promoPending) {
      setPayError(
        "İndirim kodun yeniden hesaplanıyor; bir an sonra yeniden dene.",
      );
      return;
    }
    if (!(cardRef.current?.validate() ?? true)) return;

    placingRef.current = true;
    setPlacing(true);
    setBanner(null);
    saveDraft();
    const shownAmount = payAmountMinor;
    const form = orderFormRef.current;
    if (!form) {
      stop();
      return;
    }

    let result: CheckoutStart;
    let actionTimer: number | undefined;
    try {
      result = await Promise.race([
        startCheckoutAction(new FormData(form)),
        new Promise<never>((_, reject) => {
          actionTimer = window.setTimeout(
            () => reject(new Error("timeout")),
            ACTION_WAIT_MS,
          );
        }),
      ]);
    } catch {
      stop();
      setPayError(
        "Bağlantı kurulamadı; kartından para çekilmedi. İnternet bağlantını kontrol edip yeniden dene.",
      );
      return;
    } finally {
      window.clearTimeout(actionTimer);
    }

    if (result.kind === "error") {
      stop();
      const err = result.error;
      if (err.code === "delivery") {
        if (selected) setDeliveryErrors({ address: err.message });
        else if (err.field) setDeliveryErrors({ [err.field]: err.message });
        showDeliveryProblem(
          !selected && err.field ? `co-${err.field}` : "co-delivery-title",
        );
      }
      setPayError(err.message);
      if (err.code === "consent") consentRef.current?.focus();
      return;
    }
    if (result.kind === "paid") {
      writeSession(CHECKOUT_PENDING_KEY, null);
      awaitHandoff();
      window.location.assign(result.url);
      return;
    }

    const q = result.quote;
    if (result.kind === "card" && q) {
      const record = pendingRecord(owner, result.d, result.s, q, pending);
      writeSession(CHECKOUT_PENDING_KEY, record);
      setPending(record);
    }
    if (q && q.totalMinor !== shownAmount) {
      // Not the total on screen: the bank is not asked for it. The
      // customer sees the order's real total and decides again.
      adoptQuote(q);
      stop();
      setNotice(
        `${q.promoDropped ? "İndirim kodun bu siparişe uygulanamadı." : "Fiyatlar güncellendi."} Ödenecek tutar artık ${priceLabel(q.totalMinor)}. Onaylıyorsan yeniden “Siparişi onayla ve öde”ye bas.`,
      );
      return;
    }
    if (result.kind === "redirect") {
      awaitHandoff();
      window.location.assign(result.url);
      return;
    }
    // The card form posts itself; the browser leaves for the bank's 3D page.
    awaitHandoff();
    cardRef.current?.submitToBank(result.d, result.s);
  };

  const onDeleteCard = useCallback(async (tranId: string) => {
    const fd = new FormData();
    fd.set("tranId", tranId);
    try {
      return await deleteSavedCardAction(fd);
    } catch {
      return {
        ok: false as const,
        message: "Kart şu an silinemedi. Birazdan yeniden dene.",
      };
    }
  }, []);

  if (items.length === 0) {
    return (
      <section className="checkout-empty">
        <div className="checkout-empty-mark" aria-hidden="true">
          ✻
        </div>
        <h1 className="h2" style={{ marginBottom: 24 }}>
          Sepetin <span className="script">boş</span>
        </h1>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load on purpose: the checkout document keeps its own policy (checkout-chrome.tsx) */}
        <a href="/magaza" className="btn btn-primary">
          Mağazaya git <span className="arrow">→</span>
        </a>
      </section>
    );
  }

  const nothingToPay = payAmountMinor === 0;
  const busyLabel =
    payment.mode === "card" && !nothingToPay
      ? "Bankaya yönlendiriliyorsun…"
      : nothingToPay
        ? "Sipariş onaylanıyor…"
        : "Ödeme sayfasına yönlendiriliyorsun…";
  const sellerLine = [
    seller.name,
    seller.address,
    seller.phone,
    seller.email,
    seller.mersis ? `MERSİS ${seller.mersis}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const unitCount = items.reduce((n, it) => n + (it.qty || 1), 0);
  const copy = banner ? checkoutReturnCopy(banner) : null;
  const deliverySummary = [
    delivery.customerName,
    delivery.customerPhone,
    delivery.shippingAddress,
  ]
    .filter(Boolean)
    .join(" · ");
  // The total stands right above the button ("Toplam (KDV dahil)"), so the
  // button only says what pressing it does: order, and pay.
  const payLabel = nothingToPay ? "Siparişi onayla" : "Siparişi onayla ve öde";
  // The head of a document opened from here: this order, from what the
  // page shows (the address from step 1, the amounts from the quote).
  const orderFacts = (): OrderFacts => ({
    buyer: delivery.customerName,
    email: customer.email,
    phone: delivery.customerPhone,
    address: delivery.shippingAddress,
    lines: briefLines,
    shippingMinor: totals.shippingMinor,
    discountMinor: totals.discountMinor,
    totalMinor: totals.totalMinor,
    promoCode: promoFresh?.code,
    kdvParts,
    paymentMethod: nothingToPay ? NOTHING_TO_PAY_METHOD : CARD_PAYMENT_METHOD,
    date: istanbulDateLabel(),
  });

  return (
    <div className="co-layout" data-step={step} ref={topRef}>
      <div className="co-head">
        <h1 className="co-title">Ödeme</h1>
        <ol className="co-steps" aria-label="Ödeme adımları">
          <li
            className={cx("co-steps-item", step === 1 && "is-current")}
            aria-current={step === 1 ? "step" : undefined}
          >
            {step === 2 ? (
              <button
                type="button"
                className="co-steps-link"
                onClick={goToDelivery}
                disabled={placing}
              >
                <span className="co-step is-done" aria-hidden="true">
                  1
                </span>
                Teslimat
              </button>
            ) : (
              <span className="co-steps-link">
                <span className="co-step" aria-hidden="true">
                  1
                </span>
                Teslimat
              </span>
            )}
          </li>
          <li
            className={cx("co-steps-item", step === 2 && "is-current")}
            aria-current={step === 2 ? "step" : undefined}
          >
            <span className="co-steps-link">
              <span className="co-step" aria-hidden="true">
                2
              </span>
              Ödeme
            </span>
          </li>
        </ol>
      </div>

      <aside className="co-side">
        {/* Sipariş özeti ------------------------------------------------- */}
        <section className="co-summary" aria-labelledby="co-summary-title">
          <button
            type="button"
            className="co-summary-toggle"
            aria-expanded={summaryOpen}
            aria-controls="co-summary-body"
            onClick={() => setSummaryOpen((open) => !open)}
          >
            <span>
              Sipariş özeti{" "}
              <span className="co-summary-count">· {unitCount} ürün</span>
            </span>
            <strong className="tabular">{priceLabel(payAmountMinor)}</strong>
            <span className="co-chevron" aria-hidden="true" />
          </button>
          <h2 className="co-summary-title" id="co-summary-title">
            Sipariş özeti
          </h2>
          <div
            className="co-summary-body"
            id="co-summary-body"
            data-open={summaryOpen ? "true" : undefined}
          >
            <ul className="co-lines">
              {items.map((it, i) => {
                const qty = it.qty || 1;
                const cap = Math.min(
                  MAX_LINE_QTY,
                  Math.max(1, it.maxStock ?? 99),
                );
                const lineMinor = lineMinorOf(it);
                return (
                  <li key={`${it.productId ?? it.name}::${it.variantId ?? ""}`}>
                    <div className="co-line-info">
                      <span className="co-line-name">{itemLabel(it)}</span>
                      <span className="co-qty" role="group" aria-label="Adet">
                        <button
                          type="button"
                          aria-label={`${itemLabel(it)}: bir azalt`}
                          onClick={() => setQty(i, qty - 1)}
                          disabled={placing || qty <= 1}
                        >
                          −
                        </button>
                        <span className="tabular" aria-live="polite">
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`${itemLabel(it)}: bir arttır`}
                          onClick={() => setQty(i, qty + 1)}
                          disabled={placing || qty >= cap}
                        >
                          +
                        </button>
                      </span>
                    </div>
                    <div className="co-line-side">
                      <span className="tabular">{priceLabel(lineMinor)}</span>
                      <button
                        type="button"
                        className="co-link"
                        aria-label={`${itemLabel(it)} ürününü sepetten çıkar`}
                        onClick={() => removeItem(i)}
                        disabled={placing}
                      >
                        Çıkar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <form
              action={promoDispatch}
              className="checkout-promo"
              onSubmit={(e) => {
                const code = promoInput.trim();
                if (!code || placing) {
                  e.preventDefault();
                  return;
                }
                setAsked({ code, at: subtotalMinor });
                setIntent({ code, source: "preview" });
              }}
            >
              <input
                type="hidden"
                name="subtotal"
                value={String(subtotalMinor / 100)}
              />
              <input
                name="code"
                aria-label="İndirim kodu"
                placeholder="İndirim kodu"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                autoCapitalize="characters"
                disabled={placing}
              />
              <button
                type="submit"
                disabled={promoPending || placing}
                aria-busy={promoPending}
              >
                {/* A bare "…" was the whole pending label: nothing a screen
                    reader could say, and a glyph the eye reads as truncation. */}
                {promoPending ? (
                  <>
                    <BusyDots />
                    <span className="sr-only">Kod kontrol ediliyor</span>
                  </>
                ) : (
                  "Uygula"
                )}
              </button>
              {promoRefused && promoState.error ? (
                <div
                  className="checkout-promo-msg"
                  data-tone="error"
                  role="alert"
                >
                  {promoState.error}
                </div>
              ) : null}
              {promoFresh ? (
                <div
                  className="checkout-promo-msg"
                  data-tone="ok"
                  role="status"
                  aria-live="polite"
                >
                  {promoFresh.code} uygulandı{" "}
                  <button
                    type="button"
                    className="co-link"
                    onClick={() => {
                      setIntent(null);
                      setPromoInput("");
                    }}
                    disabled={placing}
                  >
                    Kaldır
                  </button>
                </div>
              ) : promoStale ? (
                <div
                  className="checkout-promo-msg"
                  role="status"
                  aria-live="polite"
                >
                  İndirim yeniden hesaplanıyor…
                </div>
              ) : null}
            </form>

            <dl className="co-totals">
              <div>
                <dt>Ara toplam</dt>
                <dd className="tabular">{priceLabel(totals.subtotalMinor)}</dd>
              </div>
              {totals.discountMinor > 0 ? (
                <div className="co-totals-discount">
                  <dt>İndirim{promoFresh ? ` · ${promoFresh.code}` : ""}</dt>
                  <dd className="tabular">
                    −{priceLabel(totals.discountMinor)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Kargo</dt>
                <dd className="tabular">
                  {totals.shippingMinor > 0
                    ? priceLabel(totals.shippingMinor)
                    : "Ücretsiz"}
                </dd>
              </div>
              <div className="co-totals-total">
                <dt>
                  Toplam <span>(KDV dahil)</span>
                </dt>
                <dd className="tabular">{priceLabel(totals.totalMinor)}</dd>
              </div>
              {kdvParts ? (
                <div className="co-totals-kdv">
                  <dt>KDV dahil:</dt>
                  <dd className="tabular">{kdvParts}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {/* Outside the collapsible body: on a phone the summary is closed,
              and this is what tells the customer how far free shipping is,
              on both steps. */}
          {computed.freeShippingRemainingMinor > 0 && !quoted ? (
            <p className="checkout-freeship-hint co-freeship">
              <strong>{priceLabel(computed.freeShippingRemainingMinor)}</strong>{" "}
              daha ekle, kargo ücretsiz olsun
            </p>
          ) : null}
        </section>
      </aside>

      <div className="co-main">
        {/* 1 - Teslimat ------------------------------------------------ */}
        <section
          className="co-section"
          aria-labelledby="co-delivery-title"
          ref={deliveryRef}
          hidden={step !== 1}
        >
          <header className="co-section-head">
            <span className="co-step" aria-hidden="true">
              1
            </span>
            <h2
              className="co-section-title"
              id="co-delivery-title"
              tabIndex={-1}
            >
              Teslimat bilgileri
            </h2>
          </header>

          {addresses.length > 0 ? (
            <div
              className="co-addresses"
              role="radiogroup"
              aria-label="Teslimat adresi"
            >
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={cx(
                    "co-address",
                    addressId === a.id && "is-active",
                  )}
                >
                  <input
                    type="radio"
                    name="deliveryAddress"
                    value={a.id}
                    checked={addressId === a.id}
                    onChange={() => {
                      setAddressId(a.id);
                      setDeliveryErrors({});
                    }}
                    disabled={placing}
                  />
                  <span className="co-address-body">
                    <span className="co-address-title">
                      {a.label || a.city || "Adres"}
                      {a.isDefault ? (
                        <span className="co-address-badge">Varsayılan</span>
                      ) : null}
                    </span>
                    <span>{a.recipientName || customer.name}</span>
                    <span className="co-address-lines">{joinAddress(a)}</span>
                  </span>
                </label>
              ))}
              <label
                className={cx(
                  "co-address co-address-new",
                  addressId === "new" && "is-active",
                )}
              >
                <input
                  type="radio"
                  name="deliveryAddress"
                  value="new"
                  checked={addressId === "new"}
                  onChange={() => {
                    setAddressId("new");
                    setDeliveryErrors({});
                  }}
                  disabled={placing}
                />
                <span className="co-address-body">
                  <span className="co-address-title">+ Yeni adres ekle</span>
                </span>
              </label>
            </div>
          ) : null}
          {deliveryErrors.address ? (
            <p className="co-field-error" role="alert">
              {deliveryErrors.address}
            </p>
          ) : null}

          {selected && needsPhone ? (
            <DeliveryInput
              id="co-saved-phone"
              label="Telefon"
              hint="Kargo firması teslimat için arar."
              type="tel"
              autoComplete="tel"
              value={savedPhone}
              error={deliveryErrors.savedPhone}
              onChange={setSavedPhone}
              disabled={placing}
            />
          ) : null}

          {!selected ? (
            <div className="co-address-form">
              <div className="co-field-row">
                <DeliveryInput
                  id="co-customerName"
                  label="Ad soyad"
                  autoComplete="name"
                  value={draft.customerName}
                  error={deliveryErrors.customerName}
                  onChange={(v) => setDraft({ ...draft, customerName: v })}
                  disabled={placing}
                />
                <DeliveryInput
                  id="co-customerPhone"
                  label="Telefon"
                  hint="Kargo firması teslimat için arar."
                  type="tel"
                  autoComplete="tel"
                  value={draft.customerPhone}
                  error={deliveryErrors.customerPhone}
                  onChange={(v) => setDraft({ ...draft, customerPhone: v })}
                  disabled={placing}
                />
              </div>
              <DeliveryInput
                id="co-line1"
                label="Adres"
                placeholder="Mahalle, cadde, bina no"
                autoComplete="address-line1"
                value={draft.line1}
                error={deliveryErrors.line1}
                onChange={(v) => setDraft({ ...draft, line1: v })}
                disabled={placing}
              />
              <DeliveryInput
                id="co-line2"
                label="Daire, kat, tarif (isteğe bağlı)"
                autoComplete="address-line2"
                value={draft.line2}
                onChange={(v) => setDraft({ ...draft, line2: v })}
                disabled={placing}
              />
              <div className="co-field-row co-field-row-3">
                <DeliveryInput
                  id="co-district"
                  label="İlçe"
                  autoComplete="address-level2"
                  value={draft.district}
                  error={deliveryErrors.district}
                  onChange={(v) => setDraft({ ...draft, district: v })}
                  disabled={placing}
                />
                <DeliveryInput
                  id="co-city"
                  label="Şehir"
                  autoComplete="address-level1"
                  value={draft.city}
                  error={deliveryErrors.city}
                  onChange={(v) => setDraft({ ...draft, city: v })}
                  disabled={placing}
                />
                <DeliveryInput
                  id="co-zip"
                  label="Posta kodu"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={12}
                  value={draft.zip}
                  onChange={(v) => setDraft({ ...draft, zip: v })}
                  disabled={placing}
                />
              </div>
            </div>
          ) : null}

          <p className="co-quiet">
            Sipariş bilgilerin <strong>{customer.email}</strong> adresine gelir.
          </p>
          <div className="co-ship-method">
            <span className="co-ship-method-name">Kargo ile teslimat</span>
            <span className="co-ship-method-meta">
              Yalnız Türkiye içindeki adreslere gönderiyoruz
            </span>
            <span className="co-ship-method-price tabular">
              {totals.shippingMinor > 0
                ? priceLabel(totals.shippingMinor)
                : "Ücretsiz"}
            </span>
          </div>
          <div className="co-next">
            <button
              type="button"
              className="btn btn-primary btn-lg co-next-btn"
              onClick={goToPayment}
            >
              Ödemeye geç <span className="arrow">→</span>
            </button>
          </div>
        </section>

        {/* 2 - Ödeme --------------------------------------------------- */}
        <div className="co-step2" hidden={step !== 2}>
          <section
            className="co-section co-delivery-summary"
            aria-label="Teslimat"
          >
            <div>
              <p className="co-label">Teslimat adresi</p>
              <p className="co-delivery-summary-text">{deliverySummary}</p>
              <p className="co-quiet">
                Kargo ile ·{" "}
                {totals.shippingMinor > 0
                  ? priceLabel(totals.shippingMinor)
                  : "Ücretsiz"}
              </p>
            </div>
            <button
              type="button"
              className="co-link"
              onClick={goToDelivery}
              disabled={placing}
            >
              Değiştir
            </button>
          </section>

          <section
            className="co-section"
            id="odeme-adimi"
            aria-labelledby="co-pay-title"
          >
            <header className="co-section-head">
              <span className="co-step" aria-hidden="true">
                2
              </span>
              <h2 className="co-section-title" id="co-pay-title" tabIndex={-1}>
                Ödeme
              </h2>
            </header>

            {copy ? (
              <div
                className="co-banner"
                role="alert"
                tabIndex={-1}
                ref={bannerRef}
              >
                <p className="co-banner-title">{copy.title}</p>
                <p>{copy.reason}</p>
                {copy.notCharged ? (
                  <p className="co-banner-safe">Kartından para çekilmedi.</p>
                ) : null}
              </div>
            ) : null}

            <div className="co-docs">
              <p>Ödemeden önce okuyabilirsin:</p>
              {/* One item each: inside a sentence a link that wraps on a
                  phone had its tap area over the line of the next one. Each
                  opens in the panel, filled with this order. */}
              <ul className="co-docs-links">
                <li>
                  <a
                    href="/hukuk/on-bilgilendirme-formu"
                    target="_blank"
                    rel="noopener"
                    onClick={docLink("on-bilgilendirme-formu")}
                  >
                    Ön Bilgilendirme Formu
                  </a>
                </li>
                <li>
                  <a
                    href="/hukuk/mesafeli-satis-sozlesmesi"
                    target="_blank"
                    rel="noopener"
                    onClick={docLink("mesafeli-satis-sozlesmesi")}
                  >
                    Mesafeli Satış Sözleşmesi
                  </a>
                </li>
              </ul>
              {/* The seller's one identity line on the page (MSY m.5/1-b, c),
                  on every screen size, before the card and the pay button. */}
              {sellerLine ? (
                <p className="co-docs-seller">Satıcı: {sellerLine}</p>
              ) : null}
              {/* MSY m.6/2-a: the lines, the total with its taxes and the
                  withdrawal terms as one block right above the card, open on
                  every screen size (the side summary folds on a phone), then
                  the withdrawal document itself. */}
              <OrderBrief
                lines={briefLines}
                totals={{
                  shippingMinor: totals.shippingMinor,
                  discountMinor: totals.discountMinor,
                  totalMinor: totals.totalMinor,
                  promoCode: promoFresh?.code,
                }}
                kdvParts={kdvParts}
              />
              <WithdrawalNote sellerEmail={seller.email} />
            </div>
            {nothingToPay ? null : (
              <div className="co-accepted">
                <span>Kabul edilen kartlar</span>
                <AcceptedSchemes className="co-schemes" />
              </div>
            )}

            <CardPayment
              ref={cardRef}
              mode={payment.mode}
              nothingToPay={nothingToPay}
              savedCards={payment.savedCards}
              savedCardsUnavailable={payment.savedCardsUnavailable}
              canSave={payment.canSave}
              returnField={banner?.field}
              onPay={onPay}
              onRestored={stop}
              onDeleteCard={onDeleteCard}
              busy={placing}
            />
          </section>

          {/* Onay ve ödeme ----------------------------------------------- */}
          <section
            className="co-section co-confirm"
            aria-label="Siparişi onayla"
          >
            {notice ? (
              <p className="auth-note co-notice" role="status">
                {notice}
              </p>
            ) : null}
            {payError ? (
              <p className="auth-alert co-pay-error" role="alert">
                {payError}
              </p>
            ) : null}
            {/* Mesafeli Sözleşmeler Yönetmeliği: the consumer confirms the
                ön bilgilendirme formu and accepts the mesafeli satış
                sözleşmesi BEFORE the order is created, one box each, never
                pre-ticked. The hidden `legalConsent` the server reads exists
                only once both are ticked, and belongs to the order form
                (never the card's). */}
            <div className="co-consent" ref={consentRef} tabIndex={-1}>
              <CheckoutConsent
                ticks={consent}
                onTick={(key, ticked) =>
                  setConsent((prev) => ({ ...prev, [key]: ticked }))
                }
                disabled={placing}
                form={ORDER_FORM_ID}
                onDocClick={openDocFrom}
              />
            </div>
            <div className="co-paybar">
              <div className="co-paybar-total">
                <span>
                  Toplam <small>(KDV dahil)</small>
                </span>
                <strong className="tabular">
                  {priceLabel(payAmountMinor)}
                </strong>
              </div>
              {/* The pay form's only submit button (it sits outside that
                  form and names it): Enter in a card field presses this,
                  and nothing else. */}
              <button
                type="submit"
                disabled={placing || !consentGiven}
                aria-busy={placing}
                form={PAY_FORM_ID}
                className="btn btn-primary btn-lg co-pay-btn"
              >
                {placing ? (
                  <>
                    <BusyDots />
                    {busyLabel}
                  </>
                ) : (
                  payLabel
                )}
              </button>
              {!consentGiven && !placing ? (
                <p className="co-paybar-hint">
                  Devam etmek için iki sözleşme onayını da işaretle.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <CheckoutDocPanel
        doc={documents.find((d) => d.slug === openDoc) ?? null}
        facts={openDoc ? orderFacts() : null}
        onClose={() => setOpenDoc(null)}
      />

      {/* The order form: what the server action reads. Hidden fields only -
          the card is in the pay form above, which this one never contains. */}
      <form
        id={ORDER_FORM_ID}
        ref={orderFormRef}
        action={orderFormNeverPosts}
        onSubmit={(e) => e.preventDefault()}
        className="co-order-form"
      >
        <input type="hidden" name="items" value={itemsJson} />
        <input
          type="hidden"
          name="customerName"
          value={delivery.customerName}
        />
        <input
          type="hidden"
          name="customerPhone"
          value={delivery.customerPhone}
        />
        <input
          type="hidden"
          name="shippingAddress"
          value={delivery.shippingAddress}
        />
        {promoFresh ? (
          <input type="hidden" name="promoCode" value={promoFresh.code} />
        ) : null}
        {reuse ? (
          <>
            <input type="hidden" name="reuseOrderId" value={reuse.orderId} />
            <input type="hidden" name="reuseData" value={reuse.d} />
            <input type="hidden" name="reuseSignature" value={reuse.s} />
            <input type="hidden" name="reuseCartKey" value={reuse.cartKey} />
          </>
        ) : null}
      </form>
    </div>
  );
}

function DeliveryInput({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "text";
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const describedBy =
    cx(hint && `${id}-hint`, error && `${id}-error`) || undefined;
  return (
    <div className="co-field">
      <label className="co-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {hint ? (
        <p className="co-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="co-field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
