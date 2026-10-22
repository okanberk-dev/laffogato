// Pure (no I/O, no "server-only"): what an e-Arşiv invoice is, when it is
// due, what it says and the Paraşüt request bodies that cut it
// (docs/EARSIV.md). Everything that reads the database or calls Paraşüt is
// in ./store.ts, ./parasut-client.ts and ./run.ts; the panel's pages and
// the tests read this module.

import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { karaokeBillableMinor } from "@/lib/admin/karaoke-panel";
import { karaokeEndInstant } from "@/lib/mobile/karaoke-time";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";
import {
  allocateMinor,
  isTaxRate,
  kdvBreakdown,
  kdvOfGross,
  orderKdvBreakdown,
  orderShippingTaxRate,
  REWARD_COUPON_SOURCES,
  type KdvRow,
} from "@/lib/utils/kdv";

import { parseDistrictCity, stripPhones } from "./address-core";

// ─── Vocabulary ────────────────────────────────────────────────────────────

export type InvoiceSourceKind = "order" | "karaoke";

export type InvoiceStatus =
  | "waiting"
  | "due"
  | "working"
  | "draft"
  | "formalizing"
  | "issued"
  | "failed"
  | "manual"
  | "manual_done"
  | "skipped";

/** How the sale reached the buyer: decides the due time and `shipment`. */
export type InvoiceRoute =
  "parcel" | "courier" | "pickup" | "table" | "karaoke";

/**
 * Why a person cuts the invoice instead of the site. `corporate` is set by
 * a person (sticky); the others are worked out from the order and are
 * worked out again while nothing exists in Paraşüt.
 */
export type ManualCode =
  | "corporate"
  | "payment_method"
  | "no_payment"
  | "zero_total"
  | "refund_before_issue"
  | "reward_coupon"
  | "no_rates"
  | "totals_mismatch"
  | "carrier_vkn"
  | "address"
  | "amount_mismatch"
  | "attempts"
  | "parasut"
  | "other";

/** Codes the sync may clear again once their cause is gone. */
export const RECHECKABLE_MANUAL: ReadonlySet<string> = new Set([
  "payment_method",
  "no_payment",
  "zero_total",
  "refund_before_issue",
  "reward_coupon",
  "no_rates",
  "totals_mismatch",
  "carrier_vkn",
  "address",
]);

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  waiting: "Bekliyor",
  due: "Kesilecek",
  working: "Kesiliyor",
  draft: "Taslak (Paraşüt)",
  formalizing: "Resmileşiyor",
  issued: "Kesildi",
  failed: "Hata, yeniden denenecek",
  manual: "Elle kesilecek",
  manual_done: "Elle kesildi",
  skipped: "Fatura yok",
};

export const INVOICE_ROUTE_LABELS: Record<InvoiceRoute, string> = {
  parcel: "Kargo",
  courier: "Kurye",
  pickup: "Gel-al",
  table: "Masaya servis",
  karaoke: "Karaoke",
};

/** Statuses after which nothing changes by itself. */
export const FINAL_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  "issued",
  "manual_done",
  "skipped",
]);

/** One invoice row (`public.invoices`). */
export interface InvoiceRow {
  id: string;
  sourceKind: InvoiceSourceKind;
  sourceId: string;
  sourceLabel: string;
  route: InvoiceRoute | "";
  status: InvoiceStatus;
  dueAt: string;
  deadlineAt: string;
  amountMinor: number;
  kdvRows: KdvRow[];
  billingCity: string;
  billingDistrict: string;
  billingAddress: string;
  billingEditedBy: string;
  contactId: string;
  salesInvoiceId: string;
  createStartedAt: string;
  jobId: string;
  jobPostedAt: string;
  formalizePosts: number;
  eDocumentId: string;
  eDocumentType: string;
  invoiceNo: string;
  uuid: string;
  issuedAt: string;
  emailedAt: string;
  emailError: string;
  emailAttempts: number;
  attempts: number;
  lastError: string;
  nextAttemptAt: string;
  claimedAt: string;
  manualReason: string;
  manualCode: string;
  actor: string;
  refundNotedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Fixed rules ───────────────────────────────────────────────────────────

/** VUK m.231/5: an invoice later than 7 days after delivery is not one. */
export const DEADLINE_DAYS = 7;
const DAY_MS = 24 * 60 * 60_000;
/** The panel warns this long before the legal deadline. */
export const DEADLINE_WARN_MS = 2 * DAY_MS;
/** A cafe order nobody marked delivered is invoiced this long after payment. */
export const CAFE_FALLBACK_MS = 3 * 60 * 60_000;
/** A run that died leaves its rows reclaimable after this long. */
export const STALE_CLAIM_MS = 15 * 60_000;
/** Attempts before an invoice is handed to a person. */
export const MAX_ATTEMPTS = 5;
/** Mail attempts before the PDF mail is left to a person. */
export const MAX_EMAIL_ATTEMPTS = 5;
/** Paraşüt keeps a job for 15 minutes; after that its id answers 404. */
export const JOB_TTL_MS = 15 * 60_000;
/** Paraşüt's total may differ from ours by at most this much (kuruş). */
export const TOTAL_TOLERANCE_MINOR = 1;
/** A PDF larger than this is refused. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/**
 * GİB's placeholder for a final consumer who gave no TCKN (11 ones). The
 * accountant confirms it (docs/EARSIV.md "Muhasebeciye açık sorular").
 * Never used to look a contact up: every consumer contact carries it.
 */
export const CONSUMER_TAX_NUMBER = "11111111111";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60_000;

/** The Istanbul calendar day of an instant (rule 22), "YYYY-MM-DD". */
export function istanbulDay(at: Date | string): string {
  const ms = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

function plusMs(iso: string, ms: number): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + ms).toISOString() : "";
}

/** The first non-empty instant of a list. */
function firstOf(...values: Array<string | undefined | null>): string {
  for (const v of values) if (v && Number.isFinite(Date.parse(v))) return v;
  return "";
}

/** Retry delay after `attempts` failed attempts: 5 min, 15 min, 1 h, 3 h. */
export function retryDelayMs(attempts: number): number {
  const steps = [5, 15, 60, 180, 360];
  const i = Math.min(Math.max(1, attempts), steps.length) - 1;
  return steps[i] * 60_000;
}

export type DeadlineState = "none" | "ok" | "soon" | "late" | "done";

/** How close an invoice is to its legal deadline, for the badges. */
export function deadlineState(
  row: Pick<InvoiceRow, "status" | "deadlineAt">,
  now: Date,
): DeadlineState {
  if (FINAL_STATUSES.has(row.status)) return "done";
  const at = Date.parse(row.deadlineAt);
  if (!row.deadlineAt || !Number.isFinite(at)) return "none";
  if (now.getTime() > at) return "late";
  if (at - now.getTime() <= DEADLINE_WARN_MS) return "soon";
  return "ok";
}

// ─── Small checks ──────────────────────────────────────────────────────────

/**
 * Whether a VKN is ten digits with the right check digit (GİB's
 * algorithm). Catches a typo in a carrier's number before Paraşüt does.
 */
export function isValidVkn(vkn: string): boolean {
  if (!/^\d{10}$/.test(vkn)) return false;
  const d = vkn.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const tmp = (d[i] + 9 - i) % 10;
    let r = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && r === 0) r = 9;
    sum += r;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

/** A carrier as the panel lists it: the name typed when shipping, its title and VKN. */
export interface CarrierEntry {
  /** As typed in "Kargo firması" when the parcel is shipped ("Yurtiçi"). */
  name: string;
  /** Legal title, as on its tax plate. */
  title: string;
  vkn: string;
}

function foldName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The listed carrier an order's carrier text means: the same name, or the
 * name followed by more words ("Yurtiçi Kargo" for "Yurtiçi"). Null when
 * none or more than one fits: never a guess.
 */
export function matchCarrier(
  text: string,
  carriers: readonly CarrierEntry[],
): CarrierEntry | null {
  const t = foldName(text);
  if (!t) return null;
  const hits = carriers.filter((c) => {
    const n = foldName(c.name);
    return n && (t === n || t.startsWith(`${n} `) || n.startsWith(`${t} `));
  });
  return hits.length === 1 ? hits[0] : null;
}

/** An address the invoice mail may go to (never the placeholder domains). */
export function invoiceRecipient(
  email: string | undefined | null,
): string | null {
  const to = String(email ?? "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  const lower = to.toLowerCase();
  if (lower.endsWith("@laffogato.local") || lower.endsWith("@anon.local")) {
    return null;
  }
  return to;
}

/**
 * A message safe for a log or the panel (rule 9): e-mail addresses and
 * runs of ten or more digits (phones, TCKN) masked, at most 500 characters.
 */
export function maskText(text: string): string {
  return String(text ?? "")
    .replace(/[^\s@<>"',;:]+@[^\s@<>"',;:]+/g, "[e-posta]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, (m) =>
      m.replace(/\D/g, "").length >= 10 ? "[numara]" : m,
    )
    .slice(0, 500);
}

/** A short change detector for what was last sent to a contact (not secret). */
export function fingerprint(parts: readonly string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = parts.join("\u0001");
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

// ─── Billing address ───────────────────────────────────────────────────────

export interface BillingAddress {
  city: string;
  district: string;
  /** Free text; phone numbers already taken out. */
  address: string;
}

/** The köşk's own district and province (entity.ts). */
export function venueBilling(addressText = ""): BillingAddress {
  return {
    city: LEGAL_ENTITY.address.city,
    district: LEGAL_ENTITY.address.district,
    address: stripPhones(addressText).slice(0, 500),
  };
}

/**
 * A parcel's billing address from the order's text; null when the province
 * and district cannot be read.
 */
export function parcelBilling(addressText: string): BillingAddress | null {
  const place = parseDistrictCity(addressText);
  if (!place) return null;
  return {
    city: place.city,
    district: place.district,
    address: stripPhones(addressText).slice(0, 500),
  };
}

// ─── Plans: what the source asks for ──────────────────────────────────────

/** The order fields a plan reads (AdminOrder). */
export interface InvoiceOrder {
  id: string;
  orderNo: number;
  status: string;
  source?: string;
  kind?: string;
  fulfillment?: string;
  customerEmail: string;
  shippingAddress: string;
  items: ReadonlyArray<{
    productName: string;
    qty: number;
    unitPriceMinor: number;
    taxRatePct?: number | null;
    detail?: string;
  }>;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  shippingTaxRatePct?: number | null;
  totalMinor: number;
  refunds: ReadonlyArray<{ amountMinor: number }>;
  createdAt: string;
  paidAt?: string;
  shippedAt?: string;
  completedAt?: string;
  carrier?: string;
}

/** A payment row as the plan reads it. */
export interface InvoicePayment {
  provider: string;
  status: string;
}

export interface InvoicePlan {
  route: InvoiceRoute;
  status: "waiting" | "due" | "manual" | "skipped";
  dueAt: string;
  deadlineAt: string;
  amountMinor: number;
  sourceLabel: string;
  /** Why it waits, is skipped or goes to a person; "" when it simply waits for time. */
  reason: string;
  manualCode: ManualCode | "";
  billing: BillingAddress | null;
}

/** Whether a payment provider is one the site invoices by itself. */
export function automatedProvider(
  provider: string,
  production: boolean,
): boolean {
  return provider === "paynkolay" || (!production && provider === "mock");
}

function providerReason(provider: string): string {
  if (provider === "wallet") {
    return "Cüzdanla ödendi: e-Arşiv'in ödeme şekli muhasebeciyle netleşmeden otomatik kesilmez.";
  }
  if (provider === "free") {
    return "Ödemesiz sipariş (tutarın tamamını kupon karşıladı): faturası elle kesilir.";
  }
  if (provider.startsWith("manual:")) {
    return "Ödeme panelden elle işlendi (kasa, havale ya da diğer): faturası elle kesilir.";
  }
  if (provider === "mock") {
    return "Deneme ödemesi (mock): canlıda fatura kesilmez.";
  }
  return `"${provider.slice(0, 40)}" ile alınan ödemenin faturası otomatik kesilmez.`;
}

/** Days and minutes on deadlines are those of the instant the sale was delivered. */
function deadlineFrom(deliveredAt: string): string {
  return deliveredAt ? plusMs(deliveredAt, DEADLINE_DAYS * DAY_MS) : "";
}

export interface OrderPlanInput {
  order: InvoiceOrder;
  payments: readonly InvoicePayment[];
  /** The redeemed member coupon's source; null for a shared code or none. */
  couponSource: string | null;
  /** EARSIV_START_AT. */
  startAt: string;
  production: boolean;
  carriers: readonly CarrierEntry[];
  /** A billing address a person typed in the panel; wins over the order's text. */
  billingOverride?: BillingAddress | null;
  now: Date;
}

function routeOf(order: InvoiceOrder): InvoiceRoute {
  const f = order.fulfillment;
  if (f === "pickup" || f === "table") return f;
  if (f === "delivery") return "courier";
  return "parcel";
}

/**
 * Whether an order is in scope at all: not typed into the panel (the till's
 * ÖKC receipt is its document), paid, and paid at or after
 * EARSIV_START_AT (before it, invoices were cut by hand).
 */
export function orderInScope(order: InvoiceOrder, startAt: string): boolean {
  if (order.source === "manual") return false;
  const paid = Date.parse(order.paidAt ?? "");
  const start = Date.parse(startAt);
  return Number.isFinite(paid) && Number.isFinite(start) && paid >= start;
}

/**
 * What an order asks for now: null when no invoice row should exist (out of
 * scope), else its route, due time, legal deadline, amount and status.
 */
export function planOrderInvoice(input: OrderPlanInput): InvoicePlan | null {
  const { order, now } = input;
  if (!orderInScope(order, input.startAt)) return null;
  const route = routeOf(order);
  const label = `#${order.orderNo}`;
  const base = {
    route,
    sourceLabel: label,
    amountMinor: Math.max(0, Math.round(order.totalMinor)),
  };
  const manual = (
    code: ManualCode,
    reason: string,
    extra: Partial<InvoicePlan> = {},
  ): InvoicePlan => ({
    ...base,
    status: "manual",
    dueAt: "",
    deadlineAt: "",
    reason,
    manualCode: code,
    billing: null,
    ...extra,
  });

  // Delivery: a parcel when it was handed over; anything else when it was
  // ready, served or handed to the courier, or completed.
  const deliveredAt =
    route === "parcel"
      ? firstOf(order.shippedAt)
      : firstOf(order.shippedAt, order.completedAt);
  const dueAt =
    route === "parcel"
      ? deliveredAt
      : deliveredAt || plusMs(order.paidAt ?? "", CAFE_FALLBACK_MS);
  const deadlineAt = deadlineFrom(
    deliveredAt || (route === "parcel" ? "" : (order.paidAt ?? "")),
  );
  const timing = { dueAt, deadlineAt };

  if (order.status === "cancelled" || order.status === "refunded") {
    return {
      ...base,
      ...timing,
      status: "skipped",
      reason: "Sipariş iptal edildi; fatura kesilmez.",
      manualCode: "",
      billing: null,
    };
  }
  const succeeded = input.payments.filter((p) => p.status === "succeeded");
  if (succeeded.length === 0) {
    return manual(
      "no_payment",
      "Siparişin başarılı ödeme kaydı bulunamadı.",
      timing,
    );
  }
  const other = succeeded.find(
    (p) => !automatedProvider(p.provider, input.production),
  );
  if (other)
    return manual("payment_method", providerReason(other.provider), timing);
  if (order.totalMinor <= 0) {
    return manual(
      "zero_total",
      "Sipariş tutarı sıfır: faturası elle kesilir.",
      timing,
    );
  }
  const refunded = order.refunds.reduce(
    (s, r) => s + Math.max(0, Number(r.amountMinor) || 0),
    0,
  );
  if (refunded > 0) {
    return manual(
      "refund_before_issue",
      `Fatura kesilmeden ${formatMinor(refunded)} iade edildi: fatura iade düşülerek elle kesilir.`,
      timing,
    );
  }
  if (
    order.discountMinor > 0 &&
    (order.discountMinor >= order.subtotalMinor ||
      (input.couponSource !== null &&
        REWARD_COUPON_SOURCES.has(input.couponSource)))
  ) {
    return manual(
      "reward_coupon",
      "Ödül kuponu kullanıldı: kuponun faturada indirim mi ödeme aracı mı olacağı muhasebeciyle netleşmeden otomatik kesilmez.",
      timing,
    );
  }
  if (
    !order.items.length ||
    !order.items.every((it) => isTaxRate(it.taxRatePct))
  ) {
    return manual(
      "no_rates",
      "Satırlarda satış anındaki KDV oranı yok (eski sipariş).",
      timing,
    );
  }
  if (!orderKdvBreakdown(order)) {
    return manual(
      "totals_mismatch",
      "Satırlar siparişin toplamıyla tutmuyor.",
      timing,
    );
  }

  let billing: BillingAddress | null = input.billingOverride ?? null;
  if (route === "parcel") {
    if (!deliveredAt) {
      return {
        ...base,
        status: "waiting",
        dueAt: "",
        deadlineAt: "",
        reason: "Kargoya verilince kesilir.",
        manualCode: "",
        billing,
      };
    }
    if (!billing) billing = parcelBilling(order.shippingAddress);
    if (!billing) {
      return manual(
        "address",
        "Fatura ili/ilçesi okunamadı: il ve ilçeyi girip yeniden dene.",
        timing,
      );
    }
    const carrier = matchCarrier(order.carrier ?? "", input.carriers);
    if (!carrier || !isValidVkn(carrier.vkn) || !carrier.title.trim()) {
      return manual(
        "carrier_vkn",
        `Kargo firmasının VKN'si eksik: "${(order.carrier ?? "").trim().slice(0, 60) || "firma yazılmamış"}" Faturalar > Kargo firmaları listesinde yok ya da unvanı/VKN'si eksik.`,
        { ...timing, billing },
      );
    }
  } else if (!billing) {
    // Cafe, table, pickup, courier: the köşk's district and province unless
    // a courier address names its own.
    const own =
      route === "courier" ? parcelBilling(order.shippingAddress) : null;
    billing = own ?? venueBilling(order.shippingAddress);
  }
  return {
    ...base,
    ...timing,
    status: dueAt && Date.parse(dueAt) <= now.getTime() ? "due" : "waiting",
    reason: "",
    manualCode: "",
    billing,
  };
}

/** The booking fields a karaoke plan reads. */
export type InvoiceBooking = Pick<
  KaraokeReservation,
  | "id"
  | "date"
  | "startHour"
  | "hours"
  | "status"
  | "paymentStatus"
  | "paidMinor"
  | "totalMinor"
  | "refundMinor"
  | "taxRatePct"
  | "makeGoodFor"
  | "customerEmail"
  | "contactEmail"
  | "createdAt"
  | "paidAt"
>;

export interface KaraokePlanInput {
  booking: InvoiceBooking;
  payments: readonly InvoicePayment[];
  startAt: string;
  production: boolean;
  now: Date;
}

const KARAOKE_COLLECTED = new Set(["paid", "refunding", "refunded"]);

/**
 * What a paid karaoke booking asks for: null when no row should exist (no
 * online payment, or an evening that ended before EARSIV_START_AT). Due
 * once the evening is over; the amount is what the köşk keeps
 * (`karaokeBillableMinor`).
 */
export function planKaraokeInvoice(
  input: KaraokePlanInput,
): InvoicePlan | null {
  const { booking, now } = input;
  if (!KARAOKE_COLLECTED.has(booking.paymentStatus ?? "")) return null;
  const end = karaokeEndInstant(booking).toISOString();
  const start = Date.parse(input.startAt);
  if (!Number.isFinite(start) || Date.parse(end) < start) return null;
  const base = {
    route: "karaoke" as const,
    sourceLabel: booking.id,
    dueAt: end,
    deadlineAt: deadlineFrom(end),
    billing: venueBilling(""),
  };
  if (booking.makeGoodFor) {
    return {
      ...base,
      amountMinor: 0,
      status: "skipped",
      reason: "Köşkün verdiği ücretsiz saat: fatura kesilmez.",
      manualCode: "",
    };
  }
  const succeeded = input.payments.filter((p) => p.status === "succeeded");
  if (succeeded.length === 0) {
    return {
      ...base,
      amountMinor: 0,
      status: "manual",
      reason: "Rezervasyonun başarılı ödeme kaydı bulunamadı.",
      manualCode: "no_payment",
    };
  }
  const other = succeeded.find(
    (p) => !automatedProvider(p.provider, input.production),
  );
  if (other) {
    return {
      ...base,
      amountMinor: 0,
      status: "manual",
      reason: providerReason(other.provider),
      manualCode: "payment_method",
    };
  }
  if (booking.paymentStatus === "refunding") {
    return {
      ...base,
      amountMinor: 0,
      status: "waiting",
      reason: "İade sürüyor; tamamlanınca kalan tutar faturalanır.",
      manualCode: "",
    };
  }
  const billable = karaokeBillableMinor(booking, now);
  if (billable === null) {
    return {
      ...base,
      amountMinor: 0,
      status: "waiting",
      reason: "Rezervasyon saati bitince kesilir.",
      manualCode: "",
    };
  }
  if (billable <= 0) {
    return {
      ...base,
      amountMinor: 0,
      status: "skipped",
      reason: "Tutarın tamamı iade edildi; fatura kesilmez.",
      manualCode: "",
    };
  }
  return {
    ...base,
    amountMinor: billable,
    status: Date.parse(end) <= now.getTime() ? "due" : "waiting",
    reason: "",
    manualCode: "",
  };
}

// ─── Lines and amounts ─────────────────────────────────────────────────────

export type ProductGroup = "KAFE" | "MAGAZA" | "TESLIMAT" | "KARAOKE";

const PRODUCT_NAMES: Record<ProductGroup, string> = {
  KAFE: "Kafe siparişi",
  MAGAZA: "Mağaza ürünü",
  TESLIMAT: "Kargo / kurye bedeli",
  KARAOKE: "Karaoke odası",
};

/** Paraşüt product code for a group and rate: "LAF-KAFE-10". */
export function productCode(group: ProductGroup, ratePct: number): string {
  return `LAF-${group}-${ratePct}`;
}

/** Paraşüt product name: "Kafe siparişi (KDV %10)". */
export function productName(group: ProductGroup, ratePct: number): string {
  return `${PRODUCT_NAMES[group]} (KDV %${ratePct})`;
}

/** One invoice line, in kuruş and in what Paraşüt is sent. */
export interface InvoiceLine {
  group: ProductGroup;
  productCode: string;
  productName: string;
  description: string;
  quantity: number;
  vatRate: number;
  /** TL, KDV excluded, 6 decimals. */
  unitPrice: number;
  /** TL, KDV excluded, 6 decimals; 0: no discount on the line. */
  discountValue: number;
  /** KDV-included before discount. */
  grossMinor: number;
  /** KDV-included share of the discount. */
  discountMinor: number;
  /** KDV-included after discount: what this line costs the buyer. */
  totalMinor: number;
  /** KDV excluded after discount, as sent. */
  netMinor: number;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** KDV on a net amount, half up, in kuruş (integer arithmetic). */
export function vatOfNet(netMinor: number, ratePct: number): number {
  if (netMinor <= 0 || ratePct <= 0) return 0;
  return Math.floor((2 * netMinor * ratePct + 100) / 200);
}

/**
 * The line's net (kuruş) so that net + its KDV, rounded half up, is the
 * KDV-included `totalMinor` again. Starts from the receipt's own split
 * (`kdvOfGross`); one kuruş either way when that does not add up. Some
 * totals cannot be reached (the KDV step skips them); then the receipt's
 * split, and Paraşüt's total may differ by a kuruş (the verification
 * tolerates one).
 */
export function lineNetMinor(totalMinor: number, ratePct: number): number {
  const n0 = totalMinor - kdvOfGross(totalMinor, ratePct);
  for (const n of [n0, n0 - 1, n0 + 1]) {
    if (n >= 0 && n + vatOfNet(n, ratePct) === totalMinor) return n;
  }
  return n0;
}

function makeLine(
  group: ProductGroup,
  description: string,
  quantity: number,
  unitGrossMinor: number,
  ratePct: number,
  discountMinor: number,
): InvoiceLine {
  const grossMinor = unitGrossMinor * quantity;
  const totalMinor = grossMinor - discountMinor;
  const netMinor = lineNetMinor(totalMinor, ratePct);
  let unitPrice: number;
  let discountValue = 0;
  if (discountMinor > 0) {
    // The list price net of KDV, and the discount as the net amount that
    // brings the line to its net after discount.
    unitPrice = round6(unitGrossMinor / 100 / (1 + ratePct / 100));
    discountValue = round6(quantity * unitPrice - netMinor / 100);
    if (discountValue < 0) {
      unitPrice = round6(netMinor / 100 / quantity);
      discountValue = 0;
    }
  } else {
    unitPrice = round6(netMinor / 100 / quantity);
  }
  return {
    group,
    productCode: productCode(group, ratePct),
    productName: productName(group, ratePct),
    description: description.slice(0, 250),
    quantity,
    vatRate: ratePct,
    unitPrice,
    discountValue,
    grossMinor,
    discountMinor,
    totalMinor,
    netMinor,
  };
}

/**
 * The invoice lines of an order: one per item at its stored rate, the
 * promo discount shared over the items exactly as `kdvBreakdown` shares it
 * (largest remainder, by what each line was charged), and the shipping or
 * courier fee as its own line at its own rate. Null when the order cannot
 * be split (a line without a rate, totals that do not add up).
 */
export function orderInvoiceLines(order: InvoiceOrder): InvoiceLine[] | null {
  if (!order.items.length) return null;
  if (!order.items.every((it) => isTaxRate(it.taxRatePct))) return null;
  const group: ProductGroup = order.kind === "cafe" ? "KAFE" : "MAGAZA";
  const gross = order.items.map((it) => it.unitPriceMinor * it.qty);
  const subtotal = gross.reduce((s, g) => s + g, 0);
  if (subtotal !== order.subtotalMinor) return null;
  const discount = Math.min(
    Math.max(0, Math.round(order.discountMinor)),
    subtotal,
  );
  const shares = allocateMinor(discount, gross);
  const lines = order.items.map((it, i) =>
    makeLine(
      group,
      [it.productName, it.detail]
        .filter((s) => s && String(s).trim())
        .join(" · "),
      it.qty,
      it.unitPriceMinor,
      it.taxRatePct as number,
      shares[i],
    ),
  );
  const shipping = Math.max(0, Math.round(order.shippingMinor));
  if (shipping > 0) {
    lines.push(
      makeLine(
        "TESLIMAT",
        order.fulfillment === "delivery" ? "Kurye bedeli" : "Kargo bedeli",
        1,
        shipping,
        orderShippingTaxRate(order),
        0,
      ),
    );
  }
  const total = lines.reduce((s, l) => s + l.totalMinor, 0);
  return total === order.totalMinor ? lines : null;
}

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** "23 Ekim 2026" from "2026-10-23". */
export function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

/**
 * The one line of a karaoke invoice (LEGAL-REDLINES §24.5): "Karaoke odası,
 * 23 Ekim 2026 21:00, 2 saat", ", geç iptal" after a late cancel whose
 * share the köşk keeps. The amount is what the köşk keeps, at the rate the
 * booking was made at (the karaoke default for an older booking).
 */
export function karaokeInvoiceLines(
  booking: InvoiceBooking,
  amountMinor: number,
  defaultRatePct: number,
): InvoiceLine[] {
  const rate = isTaxRate(booking.taxRatePct)
    ? booking.taxRatePct
    : defaultRatePct;
  const hour = String(booking.startHour).padStart(2, "0");
  const late = booking.status === "cancelled" ? ", geç iptal" : "";
  return [
    makeLine(
      "KARAOKE",
      `Karaoke odası, ${dayLabel(booking.date)} ${hour}:00, ${booking.hours} saat${late}`,
      1,
      amountMinor,
      rate,
      0,
    ),
  ];
}

/** The KDV rows of what is invoiced (kept on the row when it is issued). */
export function linesKdvRows(lines: readonly InvoiceLine[]): KdvRow[] {
  return kdvBreakdown({
    lines: lines.map((l) => ({ grossMinor: l.totalMinor, ratePct: l.vatRate })),
    discountMinor: 0,
    shippingMinor: 0,
  }).rows;
}

/** What Paraşüt should report as `net_total` (Genel Toplam), kuruş. */
export function expectedTotalMinor(lines: readonly InvoiceLine[]): number {
  return lines.reduce((s, l) => s + l.totalMinor, 0);
}

/** Paraşüt's decimal ("270.0", 270) in kuruş; null when it is not a number. */
export function parasutMinor(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.replace(",", "."))
        : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Whether Paraşüt's total is ours, within the tolerance. */
export function totalsAgree(
  parasutTotal: unknown,
  expectedMinor: number,
): boolean {
  const got = parasutMinor(parasutTotal);
  return got !== null && Math.abs(got - expectedMinor) <= TOTAL_TOLERANCE_MINOR;
}

export function formatMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const lira = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${lira},${String(abs % 100).padStart(2, "0")} TL`;
}

// ─── Paraşüt request bodies (field names: tests/_support/parasut-fields.ts) ─

/** The unique marker on the sales invoice: how a lost answer is found again. */
export function invoiceMarker(kind: InvoiceSourceKind, label: string): string {
  return kind === "order" ? `L'Affogato ${label}` : `Karaoke ${label}`;
}

export interface ContactInput {
  name: string;
  email: string;
  billing: BillingAddress;
}

/** A final consumer as a Paraşüt contact. No phone, no TCKN. */
export function contactAttributes(c: ContactInput): Record<string, unknown> {
  return {
    name: c.name.trim().slice(0, 200) || "Nihai tüketici",
    // Only a real address: the placeholder domains and an empty one stay out.
    ...(invoiceRecipient(c.email) ? { email: c.email.trim() } : {}),
    contact_type: "person",
    account_type: "customer",
    tax_number: CONSUMER_TAX_NUMBER,
    address: c.billing.address,
    district: c.billing.district,
    city: c.billing.city,
    country: "Türkiye",
    is_abroad: false,
  };
}

export function contactBody(c: ContactInput, id?: string) {
  return {
    data: {
      ...(id ? { id } : {}),
      type: "contacts",
      attributes: contactAttributes(c),
    },
  };
}

/** What a contact was last sent, for `invoice_contacts.fingerprint`. */
export function contactFingerprint(c: ContactInput): string {
  return fingerprint([
    c.name.trim(),
    c.billing.city,
    c.billing.district,
    c.billing.address,
  ]);
}

export function productBody(group: ProductGroup, ratePct: number) {
  return {
    data: {
      type: "products",
      attributes: {
        code: productCode(group, ratePct),
        name: productName(group, ratePct),
        vat_rate: ratePct,
        unit: "Adet",
        currency: "TRL",
      },
    },
  };
}

export interface SalesInvoiceInput {
  marker: string;
  note: string;
  /** YYYY-MM-DD, Istanbul: the day the invoice is cut. */
  issueDate: string;
  orderNo: string;
  /** YYYY-MM-DD, Istanbul: the day of the order or the booking. */
  orderDate: string;
  contactId: string;
  billing: BillingAddress;
  lines: ReadonlyArray<InvoiceLine & { productId: string }>;
  /** EARSIV_PAYMENT_ACCOUNT_ID and the payment's day; null: no payment recorded. */
  cashSale: { accountId: number; paymentDate: string } | null;
}

export function salesInvoiceBody(s: SalesInvoiceInput) {
  return {
    data: {
      type: "sales_invoices",
      attributes: {
        item_type: "invoice",
        description: s.marker,
        issue_date: s.issueDate,
        due_date: s.issueDate,
        currency: "TRL",
        order_no: s.orderNo,
        order_date: s.orderDate,
        invoice_note: s.note,
        billing_address: s.billing.address,
        city: s.billing.city,
        district: s.billing.district,
        country: "Türkiye",
        tax_number: CONSUMER_TAX_NUMBER,
        is_abroad: false,
        ...(s.cashSale
          ? {
              cash_sale: true,
              payment_account_id: s.cashSale.accountId,
              payment_date: s.cashSale.paymentDate,
              payment_description: "PayNkolay",
            }
          : {}),
      },
      relationships: {
        contact: { data: { id: s.contactId, type: "contacts" } },
        details: {
          data: s.lines.map((l) => ({
            type: "sales_invoice_details",
            attributes: {
              quantity: l.quantity,
              unit_price: l.unitPrice,
              vat_rate: l.vatRate,
              description: l.description,
              ...(l.discountValue > 0
                ? { discount_type: "amount", discount_value: l.discountValue }
                : {}),
            },
            relationships: {
              product: { data: { id: l.productId, type: "products" } },
            },
          })),
        },
      },
    },
  };
}

export interface EArchiveInput {
  salesInvoiceId: string;
  siteUrl: string;
  /** YYYY-MM-DD, Istanbul. */
  paymentDate: string;
  /** Required when goods were sent; absent for a service or an in-venue handover. */
  shipment: { title: string; vkn: string; date: string } | null;
}

export function eArchiveBody(e: EArchiveInput) {
  return {
    data: {
      type: "e_archives",
      attributes: {
        internet_sale: {
          url: e.siteUrl,
          payment_type: "KREDIKARTI/BANKAKARTI",
          payment_platform: "PayNkolay",
          payment_date: e.paymentDate,
        },
        ...(e.shipment
          ? {
              shipment: {
                title: e.shipment.title,
                vkn: e.shipment.vkn,
                date: e.shipment.date,
              },
            }
          : {}),
      },
      relationships: {
        sales_invoice: {
          data: { id: e.salesInvoiceId, type: "sales_invoices" },
        },
      },
    },
  };
}

/**
 * The `shipment` block of an order's e-Arşiv: the carrier for a parcel, the
 * köşk itself for its own courier (no courier name or TCKN is ever sent;
 * the accountant confirms, docs/EARSIV.md), none for pickup and table.
 */
export function shipmentFor(
  route: InvoiceRoute,
  carrier: CarrierEntry | null,
  deliveredDay: string,
): EArchiveInput["shipment"] {
  if (route === "parcel" && carrier) {
    return {
      title: carrier.title.trim(),
      vkn: carrier.vkn,
      date: deliveredDay,
    };
  }
  if (route === "courier") {
    return {
      title: LEGAL_ENTITY.legalName,
      vkn: LEGAL_ENTITY.taxNo,
      date: deliveredDay,
    };
  }
  return null;
}

/** A trackable job's status read the safe way: only done and error end it. */
export function jobOutcome(status: unknown): "done" | "error" | "running" {
  return status === "done" ? "done" : status === "error" ? "error" : "running";
}

/** The note printed on the invoice. */
export function invoiceNote(
  kind: InvoiceSourceKind,
  label: string,
  route: InvoiceRoute,
): string {
  const ref =
    kind === "order"
      ? `Sipariş no: ${label.replace(/^#/, "")}`
      : `Karaoke rezervasyonu: ${label}`;
  return route === "parcel" ? `${ref}. İrsaliye yerine geçer.` : `${ref}.`;
}

/** "L-Affogato-e-Arsiv-GIB2026000000123.pdf": ASCII only, safe in a header. */
export function invoicePdfName(
  row: Pick<InvoiceRow, "invoiceNo" | "sourceLabel">,
): string {
  const ref = (row.invoiceNo || row.sourceLabel || "").replace(
    /[^A-Za-z0-9-]+/g,
    "",
  );
  return `L-Affogato-e-Arsiv-${ref || "fatura"}.pdf`;
}
