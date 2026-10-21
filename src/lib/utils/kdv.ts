/**
 * KDV (Turkish VAT) rates and the per-rate split of a KDV-included order.
 *
 * Client-safe: no "server-only", no database. The admin forms, the order page,
 * the mobile mappers and the tests all read the same rules from here.
 *
 * Every price on the site and in the app is KDV-INCLUDED. Nothing in this file
 * changes what a customer pays: it only says how much of a price is KDV, so a
 * receipt, the panel and the app can show it per rate.
 *
 * The defaults follow the law as of October 2026 (research note in the PR):
 *
 * - Cafe menu, served, gel-al, courier or table: 10%. BKK 2007/13033 list (II)
 *   item 24 and KDV GUT III/B-2.4 (Tebliğ Seri No 51, 1 May 2024): goods a
 *   yeme-içme business sells, made there or bought in, are 10% wherever they
 *   are eaten. Alcohol would be 20% (the köşk serves none).
 * - Karaoke room: 20%, the general rate. An entertainment service is in
 *   neither list.
 * - Shop food: 10% too. The köşk is a kafeterya business and KDV GUT
 *   III/B-2.4.1 (Seri 51) puts every food sale of such a business at 10%,
 *   internet orders sent to an address included. Equipment, gifts and merch
 *   20%; textile garments and bags 10% (list (II) items 5 and 8), set per
 *   product. A food under gift carries its own rate (the edible cup box,
 *   10%). Operator decision 18 Oct 2026 (ASK-Y2-1, ASK-Y2-3-5): the 1% of
 *   list (I) is for a plain retailer, which the köşk is not.
 * - Shipping or courier fee: shown on its own line and carried by an outside
 *   firm, so it is a transport service at the general rate (GİB özelge
 *   32391, 28945; KDV K. m.24/a folds it into the goods only when it is
 *   inside the goods price as one amount, özelge 32558). Its own key,
 *   `shipping`, 20% (ASK-Y2-2, 18 Oct 2026).
 *
 * A decree that changes a rate between payment and dispatch does not move
 * what the customer paid: the e-Arşiv invoice is cut at dispatch with the
 * rate in force then and the same KDV-included total (KDV K. m.10; the
 * köşk carries the difference). The rate stamped on an order line says what
 * the rate was at the sale; it is informational (ASK-Y2-4).
 *
 * Rates are whole percentages. Turkish rates are 0, 1, 10 or 20. The panel
 * accepts any whole number from 0 to 100 so a future decree does not need a
 * deploy, but never a fraction: the columns are integers.
 */

/** Shop category slugs (`products.cat`), the same five the store knows. */
export type KdvShopCategory = "beans" | "gift" | "gear" | "merch" | "pantry";

/** One default rate per kind of sale, edited at Ayarlar > Vergi. */
export interface TaxRates {
  /** Cafe menu items (`menu_items`), every fulfillment. */
  menu: number;
  /** Karaoke room bookings. */
  karaoke: number;
  /** Shop products, by category. */
  beans: number;
  pantry: number;
  gift: number;
  gear: number;
  merch: number;
  /** The shipping or courier fee, its own line on the invoice. */
  shipping: number;
}

export type TaxRateKey = keyof TaxRates;

/** Order of the keys in the panel and in tests. */
export const TAX_RATE_KEYS: readonly TaxRateKey[] = [
  "menu",
  "karaoke",
  "beans",
  "pantry",
  "gift",
  "gear",
  "merch",
  "shipping",
];

/** What the law says today (see the header). Used when the panel set nothing. */
export const LEGAL_TAX_RATES: Readonly<TaxRates> = Object.freeze({
  menu: 10,
  karaoke: 20,
  beans: 10,
  pantry: 10,
  gift: 20,
  gear: 20,
  merch: 20,
  shipping: 20,
});

/** Panel labels for each default. */
export const TAX_RATE_LABELS: Readonly<Record<TaxRateKey, string>> =
  Object.freeze({
    menu: "Kafe menüsü (masa, gel-al, kurye)",
    karaoke: "Karaoke odası",
    beans: "Mağaza: kahve çekirdeği",
    pantry: "Mağaza: kiler (gıda)",
    gift: "Mağaza: hediye",
    gear: "Mağaza: ekipman",
    merch: "Mağaza: merch",
    shipping: "Kargo ve kurye ücreti",
  });

/** The rates Turkish law uses today, offered first in every select. */
export const KDV_RATE_CHOICES: readonly number[] = [0, 1, 10, 20];

/** A storable rate: a whole number from 0 to 100. */
export function isTaxRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
  );
}

/** What a rate field holds when it is filled wrong, shown under the field. */
export const TAX_RATE_INPUT_ERROR =
  "KDV oranını 0 ile 100 arasında tam sayı olarak yaz (ör. 1, 10, 20).";

/**
 * A rate typed or picked in the panel. "" (and "varsayilan") means "use the
 * default" and reads as null; "%10", " 10 " and "10" read as 10. A fraction,
 * a negative number or text is refused rather than rounded: a rate the
 * operator did not write must never reach an invoice.
 */
export function parseTaxRateInput(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const text = String(raw).trim().replace(/^%/, "").trim();
  if (text === "" || text === "varsayilan") return { ok: true, value: null };
  if (!/^\d{1,3}$/.test(text)) return { ok: false };
  const value = Number(text);
  return isTaxRate(value) ? { ok: true, value } : { ok: false };
}

/**
 * The defaults as stored (`settings."taxRates"`, jsonb), every key filled.
 * A key that is missing or holds anything but a valid rate reads as the
 * legal default, so a row written before a key existed is never `undefined`.
 */
export function normalizeTaxRates(raw: unknown): TaxRates {
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...LEGAL_TAX_RATES };
  for (const key of TAX_RATE_KEYS) {
    const v = src[key];
    if (isTaxRate(v)) out[key] = v;
  }
  return out;
}

/**
 * The rate a shop product sells at: its own, else its category's default.
 * `rates` is `settings.taxRates`, always complete from `getSettings()`; a
 * missing key (a partial settings object) falls back to the legal rate, and
 * an unknown category to the general 20%, never to 0.
 */
export function productTaxRate(
  product: { cat: string; taxRatePct?: number | null },
  rates: Partial<TaxRates> | undefined,
): number {
  if (isTaxRate(product.taxRatePct)) return product.taxRatePct;
  const key = product.cat as KdvShopCategory;
  const value = rates?.[key];
  if (isTaxRate(value)) return value;
  return LEGAL_TAX_RATES[key] ?? LEGAL_TAX_RATES.gear;
}

/** The rate a menu item sells at: its own, else the menu default. */
export function menuItemTaxRate(
  item: { taxRatePct?: number | null },
  rates: Partial<TaxRates> | undefined,
): number {
  if (isTaxRate(item.taxRatePct)) return item.taxRatePct;
  return isTaxRate(rates?.menu) ? rates.menu : LEGAL_TAX_RATES.menu;
}

/** The karaoke rate from `settings.taxRates`, the legal 20% when unset. */
export function karaokeTaxRate(rates: Partial<TaxRates> | undefined): number {
  return isTaxRate(rates?.karaoke) ? rates.karaoke : LEGAL_TAX_RATES.karaoke;
}

/** The shipping and courier fee's rate from `settings.taxRates`, 20% when unset. */
export function shippingTaxRate(rates: Partial<TaxRates> | undefined): number {
  return isTaxRate(rates?.shipping) ? rates.shipping : LEGAL_TAX_RATES.shipping;
}

/** "%10" - how a rate is written everywhere it is shown. */
export function kdvRateLabel(ratePct: number): string {
  return `%${ratePct}`;
}

/**
 * The KDV inside a KDV-included amount, rounded to the kuruş:
 * gross × r / (100 + r). Half a kuruş rounds up, like every other amount here.
 */
export function kdvOfGross(grossMinor: number, ratePct: number): number {
  if (grossMinor <= 0 || ratePct <= 0) return 0;
  return Math.round((grossMinor * ratePct) / (100 + ratePct));
}

/**
 * Splits `total` kuruş over `weights` in proportion, in whole kuruş, so the
 * parts always add up to `total` exactly (largest remainder). Weights that
 * are all zero share it equally. Ties go to the earlier line.
 */
export function allocateMinor(
  total: number,
  weights: readonly number[],
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeTotal = Math.max(0, Math.round(total));
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((s, w) => s + w, 0);
  const basis = sum > 0 ? clean : clean.map(() => 1);
  const basisSum = sum > 0 ? sum : n;
  const raw = basis.map((w) => (safeTotal * w) / basisSum);
  const parts = raw.map((r) => Math.floor(r));
  let left = safeTotal - parts.reduce((s, p) => s + p, 0);
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < byFraction.length; k += 1, left -= 1) {
    parts[byFraction[k].i] += 1;
  }
  // Floating point can only ever overshoot by a kuruş; take it back from the
  // smallest fraction that has something to give.
  for (let k = byFraction.length - 1; left < 0 && k >= 0; k -= 1) {
    const i = byFraction[k].i;
    if (parts[i] > 0) {
      parts[i] -= 1;
      left += 1;
    }
  }
  return parts;
}

/** One line of a sale: what it was charged before discount, and its rate. */
export interface KdvLine {
  grossMinor: number;
  ratePct: number;
}

/** One rate on a receipt: the KDV-included amount, its base and its KDV. */
export interface KdvRow {
  ratePct: number;
  /**
   * KDV-included amount at this rate: the lines after discount, plus the
   * shipping or courier fee when it is at this rate.
   */
  grossMinor: number;
  /** Matrah: grossMinor − taxMinor. */
  netMinor: number;
  taxMinor: number;
}

export interface KdvBreakdown {
  /** Highest rate first. */
  rows: KdvRow[];
  /** Sum of the rows' gross, equal to the sale's total. */
  grossMinor: number;
  taxMinor: number;
}

/**
 * The per-rate KDV of a sale whose prices include KDV.
 *
 * 1. The discount is shared over the lines in proportion to what each was
 *    charged. Basket-wide promo and gift coupons are discounts on this sale
 *    (KDV K. m.25/a, özelge 31994) and are shared over the lines. A future
 *    product-scoped coupon comes off its own line only. Reward coupons
 *    earned from earlier purchases or given free (loyalty, milestone,
 *    invite), and any coupon that covers every line, are not discounts
 *    (özelge 32079; GUT III/A-6.1; KDV K. m.27/1): they pay for the line,
 *    the base stays the full price. That split is `invoiceKdvBreakdown`;
 *    this function takes whatever discount it is given.
 * 2. The shipping or courier fee is not shared over the lines: it is its own
 *    amount at `shippingRatePct` (the header: a transport service, 20%), and
 *    joins the row of the lines at that rate when there are any. A coupon
 *    that covered every line leaves the fee on its own.
 * 3. The lines are added up by rate and each rate's KDV is taken out once,
 *    rounded to the kuruş.
 *
 * The rows always add up to `Σ lines − discount + shipping`, the sale's
 * total; nothing here can change that total.
 */
export function kdvBreakdown(input: {
  lines: readonly KdvLine[];
  discountMinor: number;
  shippingMinor: number;
  /** The fee's own rate; the legal 20% when not given. */
  shippingRatePct?: number;
}): KdvBreakdown {
  const lines = input.lines.map((l) => ({
    grossMinor: Math.max(0, Math.round(l.grossMinor)),
    ratePct: l.ratePct,
  }));
  const gross = lines.map((l) => l.grossMinor);
  const subtotal = gross.reduce((s, g) => s + g, 0);
  const discount = Math.min(
    Math.max(0, Math.round(input.discountMinor)),
    subtotal,
  );
  const discountShares = allocateMinor(discount, gross);
  const shipping = Math.max(0, Math.round(input.shippingMinor));
  const shippingRate = isTaxRate(input.shippingRatePct)
    ? input.shippingRatePct
    : LEGAL_TAX_RATES.shipping;

  const byRate = new Map<number, number>();
  lines.forEach((l, i) => {
    const amount = l.grossMinor - discountShares[i];
    byRate.set(l.ratePct, (byRate.get(l.ratePct) ?? 0) + amount);
  });
  if (shipping > 0) {
    byRate.set(shippingRate, (byRate.get(shippingRate) ?? 0) + shipping);
  }
  const rows: KdvRow[] = [...byRate.entries()]
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => b - a)
    .map(([ratePct, amount]) => {
      const taxMinor = kdvOfGross(amount, ratePct);
      return {
        ratePct,
        grossMinor: amount,
        netMinor: amount - taxMinor,
        taxMinor,
      };
    });
  return {
    rows,
    grossMinor: rows.reduce((s, r) => s + r.grossMinor, 0),
    taxMinor: rows.reduce((s, r) => s + r.taxMinor, 0),
  };
}

/** The slice of an order the breakdown reads. */
export interface KdvOrderLike {
  items: ReadonlyArray<{
    qty: number;
    unitPriceMinor: number;
    taxRatePct?: number | null;
  }>;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  /**
   * The shipping or courier fee's rate, stamped when the order is written
   * (`orders."shippingTaxRatePct"`, 18 Oct 2026). Null on an older order,
   * which reads as the legal 20%: the rule applies to those too, since no
   * e-Arşiv invoice was cut before it.
   */
  shippingTaxRatePct?: number | null;
}

/** The rate an order's shipping or courier fee is split at. */
export function orderShippingTaxRate(order: {
  shippingTaxRatePct?: number | null;
}): number {
  return isTaxRate(order.shippingTaxRatePct)
    ? order.shippingTaxRatePct
    : LEGAL_TAX_RATES.shipping;
}

/** The stored lines with their rates, or null when one has none. */
function orderLines(order: KdvOrderLike): KdvLine[] | null {
  const items = order.items ?? [];
  if (items.length === 0) return null;
  if (!items.every((it) => isTaxRate(it.taxRatePct))) return null;
  const lines = items.map((it) => ({
    grossMinor: it.unitPriceMinor * it.qty,
    ratePct: it.taxRatePct as number,
  }));
  const subtotal = lines.reduce((s, l) => s + l.grossMinor, 0);
  return subtotal === order.subtotalMinor ? lines : null;
}

/**
 * The KDV split of a stored order, from the rate each line was sold at:
 * the KDV inside what the customer paid (`totalMinor`). The app's
 * `taxBreakdown` and the printed receipt read this.
 *
 * Every line carries the rate it was sold at (`items[].taxRatePct`, written
 * when the order is placed), so a rate changed in the panel later never
 * rewrites an old receipt. An order placed before lines carried a rate gets
 * `null`: guessing would put today's rate on yesterday's sale. The same
 * `null` comes back when the lines do not add up to the stored totals,
 * rather than a split that does not match what was charged.
 */
export function orderKdvBreakdown(order: KdvOrderLike): KdvBreakdown | null {
  const lines = orderLines(order);
  if (!lines) return null;
  const split = kdvBreakdown({
    lines,
    discountMinor: order.discountMinor,
    shippingMinor: order.shippingMinor,
    shippingRatePct: orderShippingTaxRate(order),
  });
  return split.grossMinor === order.totalMinor ? split : null;
}

/**
 * Coupon sources whose coupon is a reward, not a discount on this sale: a
 * stamp-card drink (loyalty), a lifetime-stamp milestone gift and the
 * invite drink (özelge 32079). Every other source (welcome, birthday, a gift
 * from the panel, review) and every shared promo code is a discount.
 */
export const REWARD_COUPON_SOURCES: ReadonlySet<string> = new Set([
  "loyalty",
  "milestone",
  "invite",
]);

/**
 * How much of an order's discount pays for the goods instead of taking
 * them off the base: all of it when the coupon was a reward
 * (`REWARD_COUPON_SOURCES`) or when it covered every line (a 100% coupon,
 * GUT III/A-6.1: not a discount in commercial practice), else 0.
 * `couponSource` is the redeemed member coupon's `source`, null for a
 * shared promo code or no coupon.
 */
export function invoiceRewardMinor(
  order: Pick<KdvOrderLike, "discountMinor" | "subtotalMinor">,
  couponSource: string | null | undefined,
): number {
  const discount = Math.max(0, Math.round(order.discountMinor));
  if (discount <= 0) return 0;
  if (discount >= order.subtotalMinor) return discount;
  return couponSource && REWARD_COUPON_SOURCES.has(couponSource) ? discount : 0;
}

/**
 * The KDV split the e-Arşiv invoice is cut from: like `orderKdvBreakdown`,
 * but `rewardMinor` (`invoiceRewardMinor`) is not taken off the base. The
 * rows then add up to `totalMinor + rewardMinor`: the goods at full price,
 * the reward shown on the invoice as a means of payment. With no reward it
 * is `orderKdvBreakdown` exactly.
 */
export function invoiceKdvBreakdown(
  order: KdvOrderLike,
  rewardMinor: number,
): KdvBreakdown | null {
  const lines = orderLines(order);
  if (!lines) return null;
  const reward = Math.min(
    Math.max(0, Math.round(rewardMinor)),
    Math.max(0, Math.round(order.discountMinor)),
  );
  const split = kdvBreakdown({
    lines,
    discountMinor: order.discountMinor - reward,
    shippingMinor: order.shippingMinor,
    shippingRatePct: orderShippingTaxRate(order),
  });
  return split.grossMinor === order.totalMinor + reward ? split : null;
}
