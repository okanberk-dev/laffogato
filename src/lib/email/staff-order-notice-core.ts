// Pure half of the staff "new order" e-mail: who receives it and what it
// says. NO "server-only", NO database - tests call these directly, and the
// server half (`staff-order-notice.ts`) only fetches the rows they read.

import {
  ORDER_CHANNEL_LABELS,
  ORDER_FULFILLMENT_LABELS,
  ORDER_KIND_LABELS,
  orderChannel,
  orderFulfillment,
  orderKind,
  orderTable,
} from "@/lib/admin/order-channel";
import {
  ADMIN_ROLES,
  canAccess,
  isAdminRole,
  type AdminRole,
} from "@/lib/admin/roles";
import { formatTRYMinor } from "@/lib/utils/commerce";

/** What Ayarlar → Bildirimler starts with (and the migration's default). */
export const DEFAULT_ORDER_NOTIFY_ROLES: AdminRole[] = [
  "owner",
  "manager",
  "cashier",
];

/** How many extra addresses the panel keeps; a list, not a newsletter. */
export const MAX_ORDER_NOTIFY_EMAILS = 20;

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export function isNotifyEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

// Personal webmail, every one hosted abroad. Staff mail carries customer
// data (a first name and the order; the deletion request: name and e-mail),
// and keeping it in such an inbox is a transfer abroad that the KVKK
// Aydınlatma Metni (§14, §15) does not name and no standard contract covers
// (KVKK m.9/1, m.9/4; LEGAL-REDLINES §15.6). A company domain is trusted: its
// host cannot be read from the address (operator step 3 there).
const CONSUMER_MAILBOX_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "msn.com",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "ya.ru",
  "mail.ru",
  "proton.me",
  "protonmail.com",
  "pm.me",
]);
const CONSUMER_MAILBOX_FAMILIES =
  /^(?:hotmail|outlook|live|windowslive|yahoo|yandex|gmx)\.[a-z]{2,}(?:\.[a-z]{2})?$/;

/** True for a personal webmail address (Gmail, Hotmail, iCloud...). */
export function isConsumerMailbox(email: string): boolean {
  const at = String(email ?? "").lastIndexOf("@");
  if (at < 0) return false;
  const domain = String(email)
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return (
    CONSUMER_MAILBOX_DOMAINS.has(domain) ||
    CONSUMER_MAILBOX_FAMILIES.test(domain)
  );
}

/**
 * The stored role list as the code may trust it: known roles only, each once,
 * in the panel's order. Anything that is not an array (a hand-edited row, a
 * row from before the column) reads as the default.
 */
export function normalizeNotifyRoles(raw: unknown): AdminRole[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ORDER_NOTIFY_ROLES];
  const wanted = new Set(
    raw.filter((r): r is string => typeof r === "string").filter(isAdminRole),
  );
  return ADMIN_ROLES.filter((r) => wanted.has(r));
}

/**
 * The extra-addresses textarea, split on commas, semicolons and line breaks,
 * lower-cased, de-duplicated. `invalid` is what the panel refuses to save.
 */
export function parseNotifyEmails(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of String(raw ?? "").split(/[,;\n\r]+/)) {
    const value = part.trim().toLowerCase();
    if (!value) continue;
    if (!isNotifyEmail(value)) {
      invalid.push(value);
      continue;
    }
    if (!valid.includes(value)) valid.push(value);
  }
  return { valid, invalid };
}

export interface NotifyAccount {
  email: string;
  role: AdminRole;
  /** Panel rows only; an env break-glass account is always active. */
  isActive?: boolean;
}

export interface StaffRecipient {
  email: string;
  /** The button target: the order itself when the role may open it. */
  canOpenOrders: boolean;
}

export interface RecipientSources {
  enabled: boolean;
  roles: readonly AdminRole[];
  /** `settings.orderNotifyEmails`, raw. */
  extraEmails: string;
  /** `settings.notificationEmail` (Ayarlar → "Operasyon e-postası"). */
  notificationEmail: string;
  /** `admin_users` rows. */
  panelUsers: readonly NotifyAccount[];
  /** `ADMIN_USERS` / `ADMIN_EMAIL` break-glass accounts. */
  envAdmins: readonly NotifyAccount[];
}

/**
 * Who is mailed when an order is paid.
 *
 * The role an account has is decided exactly as the login decides it: an
 * ACTIVE panel row wins; an inactive or missing row leaves the env
 * break-glass record (if any) in charge. A deactivated panel user is
 * therefore never mailed under the panel role, and a demoted manager stops
 * receiving it with their demotion.
 *
 * The extra addresses and the operations address carry no role; they get the
 * order link (the panel's own login still decides what they can see).
 * Addresses are compared lower-case, and each appears once. A personal
 * webmail inbox (`isConsumerMailbox`) is never mailed, from any source: the
 * panel refuses one in Bildirimler, but an env admin or a panel login may
 * still be a Gmail address.
 */
export function resolveStaffRecipients(
  src: RecipientSources,
): StaffRecipient[] {
  if (!src.enabled) return [];
  const roles = new Set(src.roles);
  const out = new Map<string, StaffRecipient>();
  const norm = (e: string) =>
    String(e ?? "")
      .trim()
      .toLowerCase();

  const activePanel = new Map<string, AdminRole>();
  for (const u of src.panelUsers) {
    const email = norm(u.email);
    if (email && u.isActive !== false) activePanel.set(email, u.role);
  }
  const consider = (email: string, role: AdminRole) => {
    if (!roles.has(role) || !isNotifyEmail(email) || out.has(email)) return;
    if (isConsumerMailbox(email)) return;
    out.set(email, { email, canOpenOrders: canAccess("orders", role) });
  };
  for (const [email, role] of activePanel) consider(email, role);
  for (const a of src.envAdmins) {
    const email = norm(a.email);
    // The active panel row decides this account's role (see above).
    if (!email || activePanel.has(email)) continue;
    consider(email, a.role);
  }

  const loose = [
    ...parseNotifyEmails(src.extraEmails).valid,
    norm(src.notificationEmail),
  ];
  for (const email of loose) {
    if (!email || out.has(email) || !isNotifyEmail(email)) continue;
    if (isConsumerMailbox(email)) continue;
    out.set(email, { email, canOpenOrders: true });
  }
  return [...out.values()];
}

/** The slice of an order the notice is built from - and nothing more. */
export interface StaffNoticeOrder {
  id: string;
  orderNo: number;
  customerName: string;
  channel?: string;
  kind?: string;
  fulfillment?: string;
  tableCode?: string;
  tableName?: string;
  scheduledFor?: string;
  deliveryNote?: string;
  totalMinor: number;
  items: Array<{ productName: string; qty: number; detail?: string }>;
}

/** The provider that confirmed the payment, as the team reads it. */
export function paymentMethodLabel(provider: string): string {
  switch (provider) {
    case "paynkolay":
      return "Kart (PayNkolay)";
    case "wallet":
      return "Cüzdan";
    case "free":
      return "Ödeme yok (kupon tutarı karşıladı)";
    case "mock":
      return "Test ödemesi";
    default:
      return provider ? `Kart (${provider})` : "Kart";
  }
}

/**
 * First word of the name only: the kitchen needs a name to call, no more.
 * A "name" that is really an address or a number (a checkout that fell back
 * to the e-mail, a phone typed into the name field) is dropped, not mailed.
 */
export function firstName(full: string): string {
  const first =
    String(full ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";
  if (first.includes("@") || /\d{3,}/.test(first)) return "";
  return first.slice(0, 40);
}

function istanbulDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

export interface StaffNoticeContent {
  subject: string;
  summary: string;
  label: string;
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
  note?: { label: string; text: string };
  footnote: string;
}

/**
 * The mail's words, from the order alone.
 *
 * Deliberately minimal (KVKK m.4 ölçülülük): the member's first name to call
 * out, what to make, where it goes. No surname, phone, e-mail or address -
 * the panel holds those for whoever is allowed to open the order. A courier
 * or cargo order's note is left out as well, because the order path writes
 * the address note (door codes, floor) into the same field; the panel shows
 * it. The note of a table or gel-al order is only ever the member's own.
 */
export function buildStaffNoticeContent(
  order: StaffNoticeOrder,
  provider: string,
): StaffNoticeContent {
  const channel = orderChannel(order);
  const kind = orderKind(order);
  const fulfillment = orderFulfillment(order);
  const table = orderTable(order);
  const where = table
    ? `Masa: ${table.name || table.code}`
    : ORDER_FULFILLMENT_LABELS[fulfillment];
  const total = formatTRYMinor(order.totalMinor);
  const scheduled = order.scheduledFor
    ? istanbulDateTime(order.scheduledFor)
    : "";
  // One row per line: the template escapes values and keeps no line breaks.
  const itemRows = (order.items ?? []).map((it) => {
    const detail = String(it.detail ?? "").trim();
    return {
      label: "Ürün",
      value: `${it.qty} × ${it.productName}${detail ? ` (${detail})` : ""}`,
    };
  });
  const name = firstName(order.customerName);
  const noteAllowed = fulfillment === "table" || fulfillment === "pickup";
  const note = noteAllowed ? String(order.deliveryNote ?? "").trim() : "";

  return {
    subject: `Yeni sipariş #${order.orderNo} · ${where} · ${total}`,
    summary: `${ORDER_CHANNEL_LABELS[channel]} · ${where} · ${total}`,
    label: "SİPARİŞ · ÖDENDİ",
    title: `Yeni sipariş #${order.orderNo}`,
    subtitle: `${ORDER_CHANNEL_LABELS[channel]} · ${ORDER_KIND_LABELS[kind]} · ${where}`,
    rows: [
      { label: "Sipariş", value: `#${order.orderNo}` },
      { label: "Kanal", value: ORDER_CHANNEL_LABELS[channel] },
      { label: "Tür", value: ORDER_KIND_LABELS[kind] },
      { label: "Teslimat", value: where },
      { label: "Planlanan saat", value: scheduled },
      ...itemRows,
      { label: "Müşteri", value: name },
      { label: "Toplam", value: total },
      { label: "Ödeme", value: paymentMethodLabel(provider) },
    ],
    ...(note ? { note: { label: "MÜŞTERİNİN NOTU", text: note } } : {}),
    footnote:
      "Ödeme alındı. Müşterinin iletişim bilgileri yalnız panelde, yetkisi olanlara görünür.",
  };
}

/**
 * One key per provider request: the order, a digest of WHO it goes to (so a
 * changed recipient list is a new request, not a 409 from the provider), and
 * the batch number. A retry of the same request carries the same key, and
 * Resend answers it from its record instead of mailing anyone twice.
 */
export function staffNoticeIdempotencyKey(
  orderId: string,
  recipientsDigest: string,
  batch: number,
): string {
  return `order-${orderId}-staff-new-${recipientsDigest}-b${batch}`;
}
