import { META_PIXEL_IN_LEGAL_TEXTS } from "@/lib/legal/meta";
import { isAdminDocumentPath } from "@/lib/security/admin-document";
import { isCheckoutPath } from "@/lib/security/checkout-document";

import { readConsent } from "./cookie";

/**
 * The Meta Pixel ("LAF Pixel"), loaded only for a visitor who said yes to the
 * marketing category (KVKK, docs/META-PIXEL.md).
 *
 * Client-safe and import-safe on the server: nothing here touches `window`
 * until a function is called, so a Server Component may import the event
 * builders and a Server Action the id check.
 *
 * Nothing leaves the browser before consent: `trackPixel` is the single door,
 * and it reads the consent cookie on every call, so a withdrawal closes it
 * even if a listener missed the event. No request goes to Meta, not even for
 * the script, until the first call that passes the checks below.
 */

/** The "LAF Pixel" of the köşk's Meta business account. */
export const META_PIXEL_DEFAULT_ID = "1433246991545596";

/** Where the pixel may run: the live site, never a preview or localhost. */
export const META_PIXEL_HOSTS: readonly string[] = [
  "laffogato.net",
  "www.laffogato.net",
];

const FBEVENTS_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/**
 * The pixel id the site loads, or "" for none.
 *
 * `configured` is `NEXT_PUBLIC_META_PIXEL_ID`: unset falls back to the köşk's
 * pixel, an empty value switches the pixel off. And only while the legal
 * texts say the pixel runs (`META_PIXEL_IN_LEGAL_TEXTS`). Anything that is not
 * a numeric id is no id.
 */
export function metaPixelId(
  configured: string | undefined,
  allowed: boolean = META_PIXEL_IN_LEGAL_TEXTS,
): string {
  if (!allowed) return "";
  const id = (configured ?? META_PIXEL_DEFAULT_ID).trim();
  return /^\d{10,20}$/.test(id) ? id : "";
}

/**
 * The hosts the pixel may run on. `configured` is the optional
 * `NEXT_PUBLIC_META_PIXEL_HOSTS` (comma separated): a way to point Events
 * Manager's "Olayları test edin" at a staging address. Unset or blank, it is
 * the live site alone.
 */
export function metaPixelHosts(configured: string | undefined): string[] {
  const listed = (configured ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return listed.length > 0 ? listed : [...META_PIXEL_HOSTS];
}

export function metaPixelHostAllowed(
  hostname: string,
  hosts: readonly string[] = metaPixelHosts(
    process.env.NEXT_PUBLIC_META_PIXEL_HOSTS,
  ),
): boolean {
  return hosts.includes(hostname.trim().toLowerCase());
}

/**
 * Whether a document loaded at `pathname` may run the pixel at all: not the
 * card page (it runs under a policy with no third party, and a card field has
 * no business next to an ad pixel) and not the admin panel (customer names,
 * addresses and an admin session). The same rule as `ConsentScripts`
 * (site-tags.tsx). /odeme/basarili, /odeme/donus and the rest of /odeme/* are
 * ordinary site pages and stay in.
 */
export function pixelDocumentAllowed(pathname: string | null | undefined) {
  return !isCheckoutPath(pathname) && !isAdminDocumentPath(pathname);
}

/**
 * The page key a PageView is sent for. A route change is a new path or new
 * query; the karaoke wizard's `adim` is a step inside one page, and counting
 * each step as a page view would swell the number.
 */
export function pixelPageKey(pathname: string, search: string): string {
  const query = new URLSearchParams(search);
  query.delete("adim");
  query.sort();
  const rest = query.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

/** The parameters an event may carry: ids, a name, a price - never a person. */
export interface PixelParams {
  content_ids?: string[];
  content_name?: string;
  content_type?: "product";
  contents?: { id: string; quantity: number; item_price?: number }[];
  currency?: "TRY";
  value?: number;
  num_items?: number;
}

export type PixelEventName =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "Schedule"
  | "Contact";

const PARAM_KEYS: ReadonlySet<string> = new Set([
  "content_ids",
  "content_name",
  "content_type",
  "contents",
  "currency",
  "value",
  "num_items",
]);

/** Text that reads as an e-mail address or a phone number. */
function looksPersonal(text: string): boolean {
  return /\S+@\S+\.\S+/.test(text) || /(?:\+?\d[\s().-]*){10,}/.test(text);
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value && !looksPersonal(value)
    ? value.slice(0, 200)
    : undefined;
}

/**
 * Keeps only the allowed keys and drops any text that reads as an e-mail or a
 * phone number: the types already say "no person", this is the belt for a
 * caller that casts. Numbers must be finite.
 */
export function sanitizePixelParams(params: PixelParams | undefined) {
  const out: Record<string, unknown> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (!PARAM_KEYS.has(key) || value === undefined) continue;
    if (key === "value" || key === "num_items") {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    } else if (key === "currency" || key === "content_type") {
      if (typeof value === "string" && /^[A-Za-z_]{1,16}$/.test(value)) {
        out[key] = value;
      }
    } else if (key === "content_name") {
      const text = cleanText(value);
      if (text) out[key] = text;
    } else if (key === "content_ids" && Array.isArray(value)) {
      out[key] = value
        .map(cleanText)
        .filter((id): id is string => id !== undefined);
    } else if (key === "contents" && Array.isArray(value)) {
      out[key] = value.flatMap((line) => {
        const id = cleanText((line as { id?: unknown })?.id);
        const quantity = (line as { quantity?: unknown })?.quantity;
        if (!id || typeof quantity !== "number" || !Number.isFinite(quantity)) {
          return [];
        }
        const price = (line as { item_price?: unknown }).item_price;
        return [
          {
            id,
            quantity,
            ...(typeof price === "number" && Number.isFinite(price)
              ? { item_price: price }
              : {}),
          },
        ];
      });
    }
  }
  return out;
}

/** Kuruş to a decimal lira amount for an event's `value`. */
export function pixelAmount(minor: number): number {
  return Math.round(minor) / 100;
}

/** The karaoke room as a product: the same four fields on every event. */
export function karaokeParams(valueMinor: number, hours: number): PixelParams {
  return {
    content_ids: ["karaoke-odasi"],
    content_name: "Karaoke odası",
    content_type: "product",
    currency: "TRY",
    value: pixelAmount(valueMinor),
    num_items: hours,
  };
}

/** One shop line, in lira (the cart's own unit). */
export interface PixelShopLine {
  id: string;
  name?: string;
  quantity: number;
  price: number;
}

/** A shop basket: ids and quantities, the total in lira. */
export function shopParams(lines: readonly PixelShopLine[]): PixelParams {
  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const named = lines.length === 1 ? lines[0].name : undefined;
  return {
    content_ids: lines.map((l) => l.id),
    ...(named ? { content_name: named } : {}),
    content_type: "product",
    contents: lines.map((l) => ({
      id: l.id,
      quantity: l.quantity,
      item_price: l.price,
    })),
    currency: "TRY",
    value: Math.round(total * 100) / 100,
    num_items: lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}

/** What a page reports once a payment is confirmed: the id and the events. */
export interface PixelConversionSpec {
  /** The deduplication id: `purchase_<code>`, the same one a server copy uses. */
  eventId: string;
  events: PixelEventName[];
  params: PixelParams;
}

/**
 * A karaoke booking whose payment is confirmed: Purchase and Schedule under
 * `purchase_<booking code>`. The value is what the bank took (the booking's
 * total when that is not recorded); a booking that cost nothing is a Schedule
 * alone, since a Purchase of 0 teaches an ad campaign nothing about value.
 */
export function karaokeConversion(r: {
  id: string;
  hours: number;
  totalMinor: number;
  paidMinor?: number;
}): PixelConversionSpec {
  const value = r.paidMinor && r.paidMinor > 0 ? r.paidMinor : r.totalMinor;
  return {
    eventId: `purchase_${r.id}`,
    events: value > 0 ? ["Purchase", "Schedule"] : ["Schedule"],
    params: karaokeParams(value, r.hours),
  };
}

/**
 * A shop order whose payment is confirmed: Purchase under
 * `purchase_<order number>`. The lines carry product ids and quantities; the
 * value is the order's total (shipping and discount included), in lira.
 */
export function orderConversion(order: {
  orderNo: number | string;
  totalMinor: number;
  items: readonly {
    productId?: string;
    productName: string;
    qty: number;
    unitPriceMinor: number;
  }[];
}): PixelConversionSpec {
  const lines = order.items.flatMap((it) =>
    it.productId
      ? [
          {
            id: it.productId,
            quantity: it.qty,
            price: pixelAmount(it.unitPriceMinor),
          },
        ]
      : [],
  );
  const basket = shopParams(lines);
  return {
    eventId: `purchase_${order.orderNo}`,
    events: order.totalMinor > 0 ? ["Purchase"] : [],
    params: { ...basket, value: pixelAmount(order.totalMinor) },
  };
}

// ─── Browser side ──────────────────────────────────────────────────────────

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: unknown;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
  allowDuplicatePageViews: boolean;
};

interface PixelWindow {
  fbq?: Fbq;
  _fbq?: Fbq;
}

/** Inlined at build: the client bundle carries the id, not the server. */
const PIXEL_ID = metaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);

let initialised = false;
let revoked = false;
let documentOk: boolean | null = null;

/**
 * The path the document was LOADED at, decided once and kept for its whole
 * life (the rule `useTagsAllowed` applies to the consent scripts): a document
 * loaded at /odeme keeps its card-page policy after a client-side navigation
 * away, and one loaded elsewhere never becomes the card page.
 */
function loadedDocumentAllowed(): boolean {
  if (documentOk !== null) return documentOk;
  let path = window.location.pathname;
  try {
    const entry = performance.getEntriesByType("navigation")[0];
    if (entry?.name) path = new URL(entry.name).pathname;
  } catch {
    // No navigation entry: the address in the bar is the best there is.
  }
  documentOk = pixelDocumentAllowed(path);
  return documentOk;
}

/** Whether the pixel is switched on for this page, consent aside. */
export function metaPixelAvailable(): boolean {
  return (
    PIXEL_ID !== "" &&
    typeof window !== "undefined" &&
    metaPixelHostAllowed(window.location.hostname) &&
    loadedDocumentAllowed()
  );
}

/** Whether the visitor has said yes to the marketing category right now. */
export function metaPixelConsented(): boolean {
  return readConsent()?.marketing === true;
}

/**
 * The official fbevents.js stub, written out: `fbq` queues calls until the
 * script it injects takes over. No automatic PageView and no history-change
 * PageView: the route tracker sends exactly one per route.
 */
function installStub(w: PixelWindow): Fbq {
  if (w.fbq) return w.fbq;
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as Fbq;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.disablePushState = true;
  fbq.allowDuplicatePageViews = true;
  w.fbq = fbq;
  if (!w._fbq) w._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = FBEVENTS_SRC;
  const first = document.getElementsByTagName("script")[0];
  if (first?.parentNode) first.parentNode.insertBefore(script, first);
  else document.head.appendChild(script);
  return fbq;
}

/**
 * Opens the pixel for a visitor who consented, loading it the first time.
 * False (and nothing sent, nothing loaded) without consent, on a host or a
 * document that is not allowed, or when the pixel is off.
 */
export function grantMetaPixel(): boolean {
  if (!metaPixelAvailable() || !metaPixelConsented()) return false;
  const w = window as unknown as PixelWindow;
  const fbq = installStub(w);
  if (!initialised) {
    // Automatic button and metadata events off: only the events this site
    // sends go out.
    fbq("set", "autoConfig", false, PIXEL_ID);
    fbq("init", PIXEL_ID);
    initialised = true;
  }
  if (revoked) {
    fbq("consent", "grant");
    revoked = false;
  }
  return true;
}

/** The domains a cookie of this host may have been set on. */
function cookieDomains(hostname: string): string[] {
  const labels = hostname.split(".");
  if (labels.length < 2 || /^[\d.]+$/.test(hostname)) return [];
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i += 1) {
    out.push(labels.slice(i).join("."));
  }
  return out;
}

/** Meta's first-party cookies: the browser id and the click id. */
const META_COOKIES = ["_fbp", "_fbc"] as const;

/** Removes `_fbp` and `_fbc` from this host and from its parent domains. */
export function deleteMetaCookies(): void {
  const expired = "=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  for (const name of META_COOKIES) {
    document.cookie = `${name}${expired}`;
    for (const domain of cookieDomains(window.location.hostname)) {
      document.cookie = `${name}${expired}; domain=${domain}`;
    }
  }
}

/**
 * Closes the pixel: `fbq('consent','revoke')` for a pixel that was loaded, and
 * the two cookies gone either way. A visitor who withdraws consent leaves
 * nothing of Meta's behind.
 */
export function revokeMetaPixel(): void {
  const w = window as unknown as PixelWindow;
  if (initialised && w.fbq) {
    w.fbq("consent", "revoke");
    revoked = true;
  }
  deleteMetaCookies();
}

/**
 * Sends a standard event, once the checks pass: consent now, an allowed host,
 * an allowed document, a pixel id. Otherwise nothing happens, silently.
 * `eventId` is the deduplication id a server-side copy would carry. Returns
 * whether the event went to the pixel.
 */
export function trackPixel(
  event: PixelEventName,
  params?: PixelParams,
  eventId?: string,
): boolean {
  if (!grantMetaPixel()) return false;
  const fbq = (window as unknown as PixelWindow).fbq;
  if (!fbq) return false;
  const data = sanitizePixelParams(params);
  if (eventId) fbq("track", event, data, { eventID: eventId });
  else fbq("track", event, data);
  return true;
}

/**
 * A page's own view event (ViewContent), held in memory when the visitor has
 * not said yes yet. Most visitors from an ad land on /karaoke and answer the
 * banner after the page has opened: without this the yes sent a PageView and
 * the page's ViewContent was lost for exactly the visitors the ads bring.
 * Nothing is stored and nothing leaves the browser until the yes; a page
 * change drops what was held for the page before.
 */
let heldForPage: {
  path: string;
  events: Array<[PixelEventName, PixelParams | undefined, string | undefined]>;
} | null = null;

/**
 * `trackPixel` for an event that belongs to the page on screen: sent now when
 * it can be, otherwise held until the visitor says yes on this page
 * (`sendHeldPageEvents`). Refused on a host, document or build where the pixel
 * cannot run at all.
 */
export function trackPixelForPage(
  event: PixelEventName,
  params?: PixelParams,
  eventId?: string,
): boolean {
  if (trackPixel(event, params, eventId)) return true;
  if (!metaPixelAvailable() || metaPixelConsented()) return false;
  const path = window.location.pathname;
  if (heldForPage?.path !== path) heldForPage = { path, events: [] };
  heldForPage.events.push([event, params, eventId]);
  return false;
}

/**
 * Sends what `trackPixelForPage` held, once the visitor has said yes, if they
 * are still on the page it was held for. Returns how many went out.
 */
export function sendHeldPageEvents(): number {
  const held = heldForPage;
  heldForPage = null;
  if (!held || held.path !== window.location.pathname) return 0;
  let sent = 0;
  for (const [event, params, eventId] of held.events) {
    if (trackPixel(event, params, eventId)) sent += 1;
  }
  return sent;
}

const firedThisPage = new Set<string>();

/**
 * Runs `fire` once per `key`, across reloads: the key is kept in localStorage
 * once the pixel took the events, so a refreshed confirmation page does not
 * count the sale twice. Without storage the key lives for the page only.
 */
export function fireOnce(key: string, fire: () => boolean): boolean {
  if (firedThisPage.has(key)) return false;
  try {
    if (window.localStorage.getItem(key)) return false;
  } catch {
    // Storage blocked: the page's own memory is all there is.
  }
  if (!fire()) return false;
  firedThisPage.add(key);
  try {
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Same: nothing kept beyond this page.
  }
  return true;
}

/** How long a navigation waits for the pixel's request to leave. */
const FLUSH_MS = 300;

/**
 * Navigates to `href` after an event was sent: a full page load right behind
 * `fbq` could cancel its request. Without a sent event there is nothing to
 * wait for.
 */
export function navigateAfterPixel(href: string, sent: boolean): void {
  if (!sent) {
    window.location.assign(href);
    return;
  }
  window.setTimeout(() => window.location.assign(href), FLUSH_MS);
}
