import "server-only";

import {
  CAMPAIGN_MAIL_APP_LINKS_MISSING,
  campaignMailTemplateAvailable,
} from "@/lib/admin/campaign-mail-schema";
import { hasAppLinks } from "@/lib/mobile/app-store";
import { SITE } from "@/lib/seo/site";
import { formatTRYMinor } from "@/lib/utils/commerce";

import { renderEmail, type RenderedEmail, type RenderInput } from "./render";
import type { EmailTemplateName } from "./templates.generated";
import { EMAIL_TEXT } from "./text";

/**
 * Minimal transactional e-mail sender.
 *
 * Provider-agnostic: if `RESEND_API_KEY` is set the message is delivered via
 * Resend's HTTP API; otherwise the e-mail is logged to the server console so
 * the flow stays testable without a provider wired. Swapping to SES/Postmark
 * is a one-function change.
 */

/** Default sender, used until the operator sets one in the panel. */
export const DEFAULT_FROM_NAME = "L'Affogato";
export const DEFAULT_FROM_ADDRESS = "siparis@laffogato.net";

/**
 * A display name safe to put in a `From:` header.
 *
 * Resend takes JSON, but the string lands in an RFC 5322 header, so a CR or LF
 * in it would let whatever produced the name inject headers of its own. The
 * name is operator-typed rather than customer-typed, which lowers the odds but
 * not the consequence.
 */
function headerSafe(raw: string): string {
  return raw.replace(/[\r\n]+/g, " ").trim();
}

/** `ed**@example.com` - enough to recognise a row, not enough to be one. */
function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "***";
  const local = address.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}${address.slice(at)}`;
}

/**
 * `Name <address>`, quoting the name when it carries a character an unquoted
 * atom may not (a comma in "L'Affogato, Tuzla" would otherwise read as a
 * second recipient).
 */
export function formatFrom(name: string, address: string): string {
  const addr = headerSafe(address);
  const display = headerSafe(name);
  if (!display) return addr;
  return /^[A-Za-z0-9 !#$%&'*+/=?^_`{|}~.-]+$/.test(display)
    ? `${display} <${addr}>`
    : `"${display.replace(/["\\]/g, "\\$&")}" <${addr}>`;
}

export interface EmailIdentity {
  /** Ready for the `from` field: `Name <address>`. */
  from: string;
  /** Empty when the operator has not set one. */
  replyTo: string;
  /** True once `RESEND_API_KEY` is present - i.e. mail actually leaves. */
  hasProvider: boolean;
}

/**
 * Who the mail comes from, in priority order:
 *
 *   1. Ayarlar → "E-posta gönderimi" - changeable from the panel, no deploy
 *   2. `EMAIL_FROM` - the escape hatch for a deployment with no database
 *   3. `L'Affogato <siparis@laffogato.net>`
 *
 * Resend only delivers from a domain verified on the account (SPF + DKIM),
 * so the address has to follow whichever domain is verified at the time.
 * Compiling it in would mean an app release every time that moves, which is
 * exactly what the panel exists to avoid.
 *
 * The store is pulled in dynamically because it imports this module for order
 * mail; a static import both ways is a cycle.
 */
export async function emailIdentity(): Promise<EmailIdentity> {
  const hasProvider = Boolean(process.env.RESEND_API_KEY);
  let fromName = "";
  let fromAddress = "";
  let replyTo = "";
  try {
    const { getPublicSettings } = await import("@/lib/admin/store");
    const s = await getPublicSettings();
    fromName = s.emailFromName?.trim() ?? "";
    fromAddress = s.emailFromAddress?.trim() ?? "";
    replyTo = s.emailReplyTo?.trim() || s.email?.trim() || "";
  } catch {
    // Database down: fall through to the env/default identity rather than
    // dropping a password-reset mail over a settings read.
  }
  if (fromAddress) {
    return {
      from: formatFrom(fromName || DEFAULT_FROM_NAME, fromAddress),
      replyTo,
      hasProvider,
    };
  }
  const env = process.env.EMAIL_FROM?.trim();
  return {
    from: env || formatFrom(DEFAULT_FROM_NAME, DEFAULT_FROM_ADDRESS),
    replyTo,
    hasProvider,
  };
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Set on commercial messages only. Transactional mail (order confirmation,
   * shipping, password reset) must NOT carry it - those are not subject to
   * consent and offering to unsubscribe from them is misleading.
   */
  unsubscribeUrl?: string;
  /**
   * Resend's `Idempotency-Key`: the provider answers a repeat of the same key
   * with the first result for 24 hours instead of sending again. The order
   * notices pass `order-<id>-<kind>`, so a retry after a timeout that did in
   * fact reach the provider cannot put a second copy in the inbox.
   */
  idempotencyKey?: string;
  /**
   * Overrides the panel's reply-to for this one message. Only the operator
   * notices use it: their reader answers the MEMBER, not the köşk's own
   * inbox.
   */
  replyTo?: string;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * One delivery attempt, with the provider's own words on failure.
 *
 * `sendTemplate()` throws them away and returns a boolean, which is right for the
 * order path - a customer must not lose an order because mail bounced - but
 * useless to an operator asking why nothing arrives. "The laffogato.net
 * domain is not verified" is the answer, and it only exists here.
 */
async function deliver({
  to,
  subject,
  html,
  text,
  unsubscribeUrl,
  idempotencyKey,
  replyTo: replyToOverride,
}: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const identity = await emailIdentity();
  const from = identity.from;
  const replyTo = replyToOverride?.trim() || identity.replyTo;
  if (!key) {
    // No provider configured. The body is worth logging in development -
    // without it a verification link is unrecoverable and the flow untestable
    // - but it carries a single-use token URL and the recipient is a customer
    // address, so neither goes to a production log (CLAUDE.md §9).
    if (process.env.NODE_ENV === "production") {
      console.info(`[email] (no provider) → ${maskEmail(to)} · ${subject}`);
    } else {
      console.info(
        `[email] (no provider) → ${maskEmail(to)} · ${subject}\n${text ?? html}`,
      );
    }
    return { ok: false, error: "RESEND_API_KEY tanımlı değil." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        // Ticari ileti için tek tıkla çıkış: hem mail istemcisinin kendi
        // "abonelikten çık" düğmesi bunu okur, hem de 6563'ün aradığı
        // "kolayca reddetme imkânı" bu başlıkla karşılanır.
        ...(unsubscribeUrl
          ? {
              headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[email] Resend failed (${res.status}): ${maskAddressesIn(body)}`,
      );
      return { ok: false, error: resendMessage(res.status, body) };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send error", err);
    return { ok: false, error: "Sağlayıcıya ulaşılamadı." };
  }
}

/** Resend answers with `{"message": "..."}`; the raw body is the fallback. */
function resendMessage(status: number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const m = (parsed as { message?: unknown }).message;
      if (typeof m === "string" && m) return m;
    }
  } catch {
    // Not JSON - fall through.
  }
  return `${status}: ${body.slice(0, 200)}`;
}

/**
 * Ayarlar → "Test e-postası gönder". Proves the whole chain - key, verified
 * domain, sender address - in one click, and says what broke when it breaks.
 */
export async function sendTestEmail(to: string): Promise<SendResult> {
  const { from } = await emailIdentity();
  return sendOperatorNotice({
    to,
    subject: "L'Affogato - e-posta ayarları testi",
    summary: "Bu mesaj ulaştıysa sipariş ve doğrulama e-postaları da ulaşacak.",
    label: "E-POSTA AYARLARI",
    title: "Test e-postası",
    subtitle: "Bu mesaj ulaştıysa gönderim çalışıyor",
    rows: [
      { label: "Gönderen", value: from },
      { label: "Alıcı", value: to },
    ],
    button: { label: "AYARLARA DÖN", url: `${SITE.url}/admin/ayarlar` },
    footnote:
      "Sipariş, doğrulama ve şifre sıfırlama e-postaları da aynı adresten, aynı yoldan çıkar.",
  });
}

/**
 * A message to the team, in the customer mails' design
 * (`templates/operasyon-bildirim.html`): eyebrow, title, a white card of
 * label/value rows, an optional note, one button. Every internal notice goes
 * through here, so the köşk's inbox reads like the brand rather than a log.
 */
export interface OperatorNotice {
  to: string;
  subject: string;
  /** Inbox preview line. */
  summary: string;
  /** Upper-case eyebrow, e.g. "KARAOKE · YENİ TALEP". */
  label: string;
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
  note?: { label: string; text: string };
  button: { label: string; url: string };
  footnote: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export function renderOperatorNotice(n: OperatorNotice): RenderedEmail {
  const rows = n.rows.filter((r) => r.value.trim() !== "");
  return renderEmail("operasyon-bildirim", {
    vars: {
      BILDIRIM_KONU: n.subject,
      BILDIRIM_OZET: n.summary,
      BILDIRIM_ETIKET: n.label,
      BILDIRIM_BASLIK: n.title,
      BILDIRIM_ALT: n.subtitle,
      SATIRLAR_METIN: rows.map((r) => `${r.label}: ${r.value}`).join("\n"),
      NOT_ETIKET: n.note?.label ?? "",
      NOT: n.note?.text ?? "",
      BUTON_METIN: n.button.label,
      BUTON_URL: n.button.url,
      BILDIRIM_DIPNOT: n.footnote,
    },
    loops: {
      SATIRLAR: rows.map((r) => ({
        ETIKET: r.label.toLocaleUpperCase("tr-TR"),
        DEGER: r.value,
      })),
    },
    flags: { NOT: Boolean(n.note?.text.trim()) },
    text: EMAIL_TEXT["operasyon-bildirim"],
  });
}

export async function sendOperatorNotice(
  n: OperatorNotice,
): Promise<SendResult> {
  if (!n.to) return { ok: false, error: "Alıcı adresi boş." };
  let r: RenderedEmail;
  try {
    r = renderOperatorNotice(n);
  } catch (err) {
    console.error("[email] operasyon-bildirim hazırlanamadı", err);
    return { ok: false, error: "Şablon hazırlanamadı." };
  }
  return deliver({
    to: n.to,
    subject: r.subject,
    html: r.html,
    text: r.text,
    ...(n.replyTo ? { replyTo: n.replyTo } : {}),
    ...(n.idempotencyKey ? { idempotencyKey: n.idempotencyKey } : {}),
  });
}

// ── Şablon tabanlı gönderim ────────────────────────────────────────────────
//
// Her mesaj `src/lib/email/templates/*.html` içindeki tasarımdan çıkar.
// Buradaki fonksiyonların işi yalnızca alanları doldurmak: hangi değerin
// nereden geldiği `docs/EMAIL-RESEND.md` §5'te.

/**
 * Render + deliver, with the render failure contained.
 *
 * `renderEmail` throws on an unfilled `[FIELD]` - which is what we want, a
 * half-written message must not leave - but this is also the path a customer's
 * order confirmation takes, and an order must not fail because a template did.
 * So it is logged loudly and swallowed, exactly as a provider outage is.
 */
async function sendTemplate(
  name: EmailTemplateName,
  to: string,
  input: Omit<RenderInput, "text">,
): Promise<boolean> {
  return (await sendTemplateResult(name, to, input)).ok;
}

/**
 * `sendTemplate` with the verdict kept, for a caller that records it: the
 * order notices release their claim on a failure so the next trigger may
 * try again, and they must be able to tell a send from a failure to do so.
 */
async function sendTemplateResult(
  name: EmailTemplateName,
  to: string,
  input: Omit<RenderInput, "text">,
  idempotencyKey?: string,
): Promise<SendResult> {
  if (!to) return { ok: false, error: "Alıcı adresi boş." };
  let r: RenderedEmail;
  try {
    r = renderEmail(name, { ...input, text: EMAIL_TEXT[name] });
  } catch (err) {
    console.error(`[email] ${name} hazırlanamadı`, err);
    return { ok: false, error: "Şablon hazırlanamadı." };
  }
  return deliver({
    to,
    subject: r.subject,
    html: r.html,
    text: r.text,
    ...(r.unsubscribeUrl ? { unsubscribeUrl: r.unsubscribeUrl } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string,
): Promise<boolean> {
  return sendTemplate("eposta-dogrulama", to, {
    vars: { AD: name.trim(), DOGRULAMA_URL: verifyUrl },
  });
}

/**
 * Double opt-in (6563): the footer form's request, confirmed from the owner's
 * inbox. Transactional - it asks, it does not advertise - so it carries no
 * unsubscribe link; nothing commercial is sent until it is confirmed.
 */
export async function sendNewsletterConfirmEmail(
  to: string,
  confirmUrl: string,
): Promise<boolean> {
  return sendTemplate("bulten-onay", to, {
    vars: { AD: "", ONAY_URL: confirmUrl },
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string,
): Promise<boolean> {
  return sendTemplate("sifre-sifirlama", to, {
    vars: { AD: name.trim(), SIFIRLAMA_URL: resetUrl },
  });
}

// ── Order notifications ────────────────────────────────────────────────────

export interface OrderEmailData {
  to: string;
  customerName: string;
  orderNo: number;
  items: { productName: string; qty: number; unitPriceMinor: number }[];
  /**
   * Line total before shipping. Optional so an older caller still compiles;
   * when absent it is summed from `items`, which is the same number for every
   * order that carries no discount.
   */
  subtotalMinor?: number;
  shippingMinor?: number;
  totalMinor: number;
  /**
   * A table order (`fulfillment: "table"`): served in the köşk, so the mail
   * carries no cargo row and no free-shipping line. Absent = as before.
   */
  servedAtTable?: boolean;
}

/** One `<!--EACH:ITEMS-->` pass per line. */
function itemRows(items: OrderEmailData["items"]) {
  return items.map((it) => ({
    URUN_AD: it.productName,
    URUN_ADET: String(it.qty),
    URUN_TUTAR: formatTRYMinor(it.unitPriceMinor * it.qty),
  }));
}

function orderLinesText(items: OrderEmailData["items"]): string {
  return items
    .map(
      (it) =>
        `  • ${it.productName} × ${it.qty} - ${formatTRYMinor(it.unitPriceMinor * it.qty)}`,
    )
    .join("\n");
}

/**
 * The contracts the buyer confirmed at checkout. Mesafeli Sözleşmeler
 * Yönetmeliği requires them to reach the consumer on a durable medium, so the
 * order e-mail carries a permanent link to each. The HTML templates hard-code
 * the same three; this list feeds the plain-text half.
 */
const CONSENT_DOC_LINKS = [
  { label: "Ön Bilgilendirme Formu", slug: "on-bilgilendirme-formu" },
  { label: "Mesafeli Satış Sözleşmesi", slug: "mesafeli-satis-sozlesmesi" },
  { label: "İptal, İade ve Cayma Hakkı", slug: "iade-ve-cayma" },
].map((d) => ({ ...d, url: `${SITE.url}/hukuk/${d.slug}` }));

const CONSENT_DOCS_TEXT = CONSENT_DOC_LINKS.map(
  (d) => `- ${d.label}: ${d.url}`,
).join("\n");

function orderVars(o: OrderEmailData) {
  const subtotal =
    o.subtotalMinor ??
    o.items.reduce((sum, it) => sum + it.unitPriceMinor * it.qty, 0);
  const shipping = o.shippingMinor ?? Math.max(0, o.totalMinor - subtotal);
  return {
    AD: o.customerName.trim(),
    SIPARIS_NO: String(o.orderNo),
    // The list page is the fallback in `commonVars`; an order mail can do
    // better and link the order it is actually about.
    SIPARIS_URL: `${SITE.url}/uye/hesap/siparislerim/${o.orderNo}`,
    ARA_TOPLAM: formatTRYMinor(subtotal),
    // "" drops the cargo row (`KARGO_SATIRI`, render.ts) on a table order.
    KARGO: o.servedAtTable
      ? ""
      : shipping === 0
        ? "Ücretsiz"
        : formatTRYMinor(shipping),
    TOPLAM: formatTRYMinor(o.totalMinor),
    KALEMLER: orderLinesText(o.items),
    BELGELER: CONSENT_DOCS_TEXT,
  };
}

/**
 * The stamp target the operator has configured, for the "one more stamp" panel.
 *
 * Read through a dynamic import for the same reason `emailIdentity` does it:
 * `admin/store` imports this module for order mail, so a static import both
 * ways is a cycle. A settings read must never cost an order confirmation, so
 * the built-in default stands in when the database is unreachable.
 */
export async function stampTarget(): Promise<string> {
  try {
    const { getSettings } = await import("@/lib/admin/store");
    const s = await getSettings();
    return String(s.mobileApp.loyalty.stampTarget);
  } catch {
    const { DEFAULT_MOBILE_APP_CONFIG } =
      await import("@/lib/mobile/app-config");
    return String(DEFAULT_MOBILE_APP_CONFIG.loyalty.stampTarget);
  }
}

/**
 * The one order mail a customer gets before the parcel leaves: sent once,
 * when the payment is confirmed and the order moves to `paid` (a zero-total
 * order counts as paid). It carries the lines, the total and the links to
 * the confirmed Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi and
 * cayma text - the durable copy Mesafeli Sözleşmeler Yönetmeliği asks for.
 *
 * There is no "siparişin alındı" mail before the payment any more (operator,
 * 16 Eki 2026: "sipariş maili ödeme tam alınmadan gitmesin"): a declined
 * card used to leave the customer one "order received" mail per attempt for
 * orders that never existed for them. Who gets it, and exactly once, is
 * decided by `notifyOrderPaid` (`order-notices.ts`).
 *
 * `stampsEarned` is what the order earns on the stamp card (an app cafe
 * order: one per started 320 TL of goods from 140 TL); the stamp panel is
 * left out when it is 0 or absent, so a shop order is never promised a stamp.
 */
export async function sendOrderPaidEmail(
  o: OrderEmailData & { stampsEarned?: number },
  idempotencyKey?: string,
): Promise<SendResult> {
  const stamps = Math.max(0, Math.round(Number(o.stampsEarned ?? 0)) || 0);
  return sendTemplateResult(
    "odeme-onaylandi",
    o.to,
    {
      vars: {
        ...orderVars(o),
        DAMGA_HEDEFI: await stampTarget(),
        DAMGA_SAYISI: stamps > 0 ? String(stamps) : "",
      },
      loops: { ITEMS: itemRows(o.items) },
    },
    idempotencyKey,
  );
}

// ── Order notices ──────────────────────────────────────────────────────────
//
// The three mails the legal texts promise after an order is paid: the
// tracking number when the parcel is handed over, word when the seller
// cancels, word when money goes back. Each returns the provider's verdict
// rather than a boolean, because `order-notices.ts` settles its once-only
// claim on it. Who is due one, and when, is decided there, not here.

export interface OrderShippedEmailData {
  to: string;
  customerName: string;
  orderNo: number;
  trackingNumber: string;
  /** The panel's carrier field; "" when nobody typed one. */
  carrier: string;
  /** The carrier's own page (Geliver), https only; "" when there is none. */
  trackingUrl: string;
}

/** The member's own order page, which shows the tracking number too. */
function orderUrl(orderNo: number): string {
  return `${SITE.url}/uye/hesap/siparislerim/${orderNo}`;
}

/** Sent once per tracking number, when a shop parcel is handed to the carrier. */
export async function sendOrderShippedEmail(
  d: OrderShippedEmailData,
  idempotencyKey?: string,
): Promise<SendResult> {
  const url = d.trackingUrl.trim();
  return sendTemplateResult(
    "siparis-kargoda",
    d.to,
    {
      vars: {
        AD: d.customerName.trim(),
        SIPARIS_NO: String(d.orderNo),
        SIPARIS_URL: orderUrl(d.orderNo),
        TAKIP_NO: d.trackingNumber.trim(),
        KARGO_FIRMASI: d.carrier.trim(),
        // Whole or not at all, and https only: this lands in an href.
        TAKIP_URL: url.startsWith("https://") ? url : "",
      },
    },
    idempotencyKey,
  );
}

export interface OrderCancelledEmailData extends OrderEmailData {
  /**
   * Was money taken for the order? `true` promises the refund, `false` says
   * the records show no payment, and `null` (the lookup failed) says
   * neither: a mail must not guess about somebody's card.
   */
  collected: boolean | null;
}

/** Sent once, when the shop cancels a shop order. */
export async function sendOrderCancelledEmail(
  o: OrderCancelledEmailData,
  idempotencyKey?: string,
): Promise<SendResult> {
  return sendTemplateResult(
    "siparis-iptal",
    o.to,
    {
      vars: orderVars(o),
      loops: { ITEMS: itemRows(o.items) },
      flags: {
        ODEME_ALINDI: o.collected === true,
        ODEME_YOK: o.collected === false,
      },
    },
    idempotencyKey,
  );
}

export interface OrderRefundedEmailData {
  to: string;
  customerName: string;
  orderNo: number;
  /** This refund. */
  refundMinor: number;
  /** Every refund on the order so far, this one included. */
  refundedTotalMinor: number;
  totalMinor: number;
  /**
   * The money went back through the POS to the card it came from. A refund
   * recorded without a POS (an order paid at the counter) says nothing
   * about a card.
   */
  viaCard: boolean;
}

/** Sent once per refund entry, after the money has moved. */
export async function sendOrderRefundedEmail(
  d: OrderRefundedEmailData,
  idempotencyKey?: string,
): Promise<SendResult> {
  return sendTemplateResult(
    "siparis-iade",
    d.to,
    {
      vars: {
        AD: d.customerName.trim(),
        SIPARIS_NO: String(d.orderNo),
        SIPARIS_URL: orderUrl(d.orderNo),
        IADE_TUTARI: formatTRYMinor(d.refundMinor),
        TOPLAM_IADE: formatTRYMinor(d.refundedTotalMinor),
        TOPLAM: formatTRYMinor(d.totalMinor),
      },
      flags: { KARTA_IADE: d.viaCard },
    },
    idempotencyKey,
  );
}

// ── Relationship & loyalty ─────────────────────────────────────────────────

/** Sent once, after the address is verified and the account is usable. */
export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<boolean> {
  return sendTemplate("hos-geldin", to, { vars: { AD: name.trim() } });
}

export interface KaraokeEmailData {
  to: string;
  name: string;
  /** Already formatted for a reader: "12 Eylül 2026", "20:00 - 22:00". */
  date: string;
  time: string;
  guests: number;
  /**
   * The reservation id - `krk-00042` - which is what the member is asked for
   * at the door. There is no separate "reservation code" column and none is
   * needed: the id is already unique, sequential and readable, and it is the
   * string both halves of the message print.
   */
  code: string;
}

function karaokeVars(k: KaraokeEmailData) {
  return {
    AD: k.name.trim(),
    KARAOKE_TARIH: k.date,
    KARAOKE_SAAT: k.time,
    KARAOKE_KISI: `${k.guests} kişi`,
    // `toUpperCase` rather than the Turkish-locale one on purpose: the id is
    // ASCII (`krk-00042`), and tr-TR would turn an "i" into "İ" if one ever
    // appeared in it.
    KARAOKE_KOD: k.code.toUpperCase(),
  };
}

/**
 * Sent when staff confirm a karaoke block (`setReservationStatus`).
 *
 * Transactional: the member asked for the evening and is being told whether
 * they have it. No consent gate, no unsubscribe link - `renderEmail` refuses
 * to put one on this template.
 */
export async function sendKaraokeConfirmationEmail(
  k: KaraokeEmailData,
): Promise<boolean> {
  return sendTemplate("karaoke-rezervasyon", k.to, { vars: karaokeVars(k) });
}

/**
 * Sent when staff cancel a karaoke block. Transactional for the same reason
 * as the confirmation, and more urgently: without it the member finds out at
 * the door.
 */
export async function sendKaraokeCancellationEmail(
  k: KaraokeEmailData,
): Promise<boolean> {
  return sendTemplate("karaoke-iptal", k.to, { vars: karaokeVars(k) });
}

/**
 * What the counter needs to know about a booking that was just taken.
 *
 * Deliberately not `KaraokeEmailData`: that one is the MEMBER's confirmation
 * and its template says "Saatiniz ayrıldı". A reservation arrives with
 * `status: "requested"`, so telling the member it is confirmed would be a
 * promise the staff have not made yet. This is the other direction - the room
 * is booked by hand, and nobody was being told.
 */
export interface KaraokeOperatorNotice {
  /** `krk-00042`, so the row is findable in /admin/mobil/karaoke. */
  id: string;
  /** Which surface took the booking: the phone or the web `/karaoke` form. */
  source: "app" | "web";
  customerName: string;
  customerEmail: string;
  /** Contact phone from the web form, "+905321234567"; "" from the app. */
  phone?: string;
  /** Already formatted for a reader: "12 Eylül 2026", "20:00 - 22:00". */
  date: string;
  time: string;
  guests: number;
  totalMinor: number;
  /** The member's own note, or "" - printed as-is, never interpreted. */
  note: string;
}

/**
 * Where karaoke requests go: the panel's karaoke address
 * (`settings.karaokeNotifyEmail`, Ayarlar → Karaoke), else the operator
 * address in Ayarlar (`settings.email`). "" when neither is set.
 */
export function karaokeNoticeRecipient(s: {
  karaokeNotifyEmail?: string;
  email?: string;
}): string {
  return s.karaokeNotifyEmail?.trim() || s.email?.trim() || "";
}

/**
 * Tells the köşk that a karaoke hour was just requested, from the app or
 * from the web.
 *
 * INTERNAL mail: it goes to the karaoke address in Ayarlar
 * (`karaokeNoticeRecipient`), carries no unsubscribe header (it is not a
 * commercial message and offering to unsubscribe from it would be misleading
 * - see `SendArgs.unsubscribeUrl`), and is written as plain text because its
 * reader is a person behind a counter deciding whether to confirm, not a
 * customer being courted. Reply-to is the member, so answering the mail
 * reaches the person who asked.
 *
 * The member's address IS printed in full here, unlike everywhere else in this
 * module: the operator has to be able to reply to them, and this message goes
 * to the business's own inbox rather than to a customer.
 *
 * Failure is swallowed by the caller, not here - a booking must never be lost
 * because mail bounced, and the row is in the panel either way.
 */
export async function sendKaraokeOperatorEmail(
  k: KaraokeOperatorNotice,
): Promise<SendResult> {
  // Dynamic, for the cycle `emailIdentity` documents: admin/store imports
  // this module for order mail.
  const { getSettings } = await import("@/lib/admin/store");
  const to = karaokeNoticeRecipient(await getSettings());
  if (!to)
    return { ok: false, error: "Ayarlar'da bildirim adresi tanımlı değil." };

  const origin = k.source === "web" ? "Web sitesinden" : "Uygulamadan";
  return sendOperatorNotice({
    to,
    subject: `Karaoke talebi · ${k.date} ${k.time} · ${k.guests} kişi (${k.id})`,
    summary: `${origin} yeni talep: ${k.date} · ${k.time} · ${k.guests} kişi`,
    label: "KARAOKE · YENİ TALEP",
    title: "Yeni karaoke talebi",
    subtitle: `${origin} geldi · onayını bekliyor`,
    rows: [
      { label: "Rezervasyon", value: k.id },
      { label: "Tarih", value: k.date },
      { label: "Saat", value: k.time },
      { label: "Kişi", value: String(k.guests) },
      { label: "Tutar", value: formatTRYMinor(k.totalMinor) },
      { label: "Üye", value: k.customerName.trim() || "-" },
      { label: "E-posta", value: k.customerEmail },
      { label: "Telefon", value: k.phone ?? "" },
    ],
    ...(k.note.trim()
      ? { note: { label: "ÜYENİN NOTU", text: k.note.trim() } }
      : {}),
    button: {
      label: "PANELDE ONAYLA",
      url: `${SITE.url}/admin/mobil/karaoke`,
    },
    footnote:
      "Onaylanana kadar oda tutulmuş sayılmaz. Bu e-postayı yanıtlarsan doğrudan üyeye yazarsın.",
    // Answering the mail reaches the person who asked.
    replyTo: k.customerEmail,
    // A retried request for the same row must not mail twice.
    idempotencyKey: `karaoke-${k.id}-requested`,
  });
}

export interface LoyaltyRewardEmailData {
  to: string;
  name: string;
  /** The coupon `grantFreeDrinkCoupon` just wrote. */
  couponCode: string;
  /** Already formatted: "30 Eylül 2026". */
  expiresAt: string;
  rewardTitle: string;
}

/** Sent when the stamp card fills and the free-drink coupon is granted. */
export async function sendLoyaltyRewardEmail(
  d: LoyaltyRewardEmailData,
): Promise<boolean> {
  return sendTemplate("sadakat-ikram", d.to, {
    vars: {
      AD: d.name.trim(),
      DAMGA_HEDEFI: await stampTarget(),
      ODUL_BASLIGI: d.rewardTitle,
      KUPON_KODU: d.couponCode,
      SON_KULLANIM: d.expiresAt,
    },
  });
}

// ── Commercial (6563) ──────────────────────────────────────────────────────
//
// The commercial templates - the three below and the `kampanya-*` family at
// the end of this file - carry an unsubscribe link and only go to an address
// that has consented. `renderEmail` refuses to build them without
// `unsubscribeUrl`, and refuses to put one on any of the transactional
// templates above.

/**
 * `${SITE.url}/api/bulten/cikis?token=…` - the token is on the subscriber
 * (or, for a member, the customer) row.
 *
 * The route handler is what makes the `List-Unsubscribe-Post` header honest:
 * a mail client's RFC 8058 POST spends the token without ever loading a
 * page, and a person following the same link is redirected to the
 * `/bulten/cikis` page they always got.
 */
export function unsubscribeUrlFor(unsubToken: string): string {
  return `${SITE.url}/api/bulten/cikis?token=${encodeURIComponent(unsubToken)}`;
}

/**
 * The app launch announcement.
 *
 * Unlike the other nine, this one has nothing left to say without the store
 * links - the strip is the message - so it is not sent at all until both
 * listings exist.
 */
export async function sendAppAnnouncementEmail(
  to: string,
  name: string,
  unsubToken: string,
): Promise<boolean> {
  if (!hasAppLinks()) {
    console.error(
      "[email] mobil-uygulama: NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL tanımlı değil, gönderilmedi",
    );
    return false;
  }
  return sendTemplate("mobil-uygulama", to, {
    unsubscribeUrl: unsubscribeUrlFor(unsubToken),
    vars: {
      AD: name.trim(),
      // The "neler var" list quotes the stamp target; without it the render
      // fell over an unfilled [DAMGA_HEDEFI] and the mail never left.
      DAMGA_HEDEFI: await stampTarget(),
    },
  });
}

export interface BirthdayEmailData {
  to: string;
  name: string;
  unsubToken: string;
  /**
   * From `grantBirthdayCouponToday` - and only when it actually WROTE a row.
   * That single fact is the run's idempotency key: a member already greeted
   * this year gets `null` back and no message.
   */
  couponCode: string;
  /**
   * Already formatted: "23 Eylül 2026". Seven days from the grant, which is
   * what both halves of the template promise - see `BIRTHDAY.ttlDays`.
   */
  expiresAt: string;
}

/**
 * The birthday greeting, from the daily cron (`/api/cron/birthday`).
 *
 * COMMERCIAL (6563): a celebration wrapped around a %20 offer is still an
 * offer, so it only goes to a member whose `marketing` preference is on and
 * who has a consent record, and it carries `List-Unsubscribe`. The coupon
 * itself is not a message and is granted without that gate - a member who
 * declined commercial mail still finds their gift in the app.
 */
export async function sendBirthdayEmail(
  b: BirthdayEmailData,
): Promise<boolean> {
  return sendTemplate("dogum-gunu", b.to, {
    unsubscribeUrl: unsubscribeUrlFor(b.unsubToken),
    vars: {
      AD: b.name.trim(),
      KUPON_KODU: b.couponCode,
      SON_KULLANIM: b.expiresAt,
    },
  });
}

// ── Kampanya e-postaları ───────────────────────────────────────────────────
//
// The operator-composed family: seven `kampanya-*` layouts plus the older
// three-pick newsletter. Every one is commercial, so `renderEmail` insists on
// the unsubscribe URL; every one takes its copy from the admin form as a flat
// `Record<string, string>`, and the optional blocks - image, code, date,
// footnote, highlight - follow the presence of their field (`render.ts`).

export type CampaignTemplateName =
  | "kampanya-duyuru"
  | "kampanya-bonus-damga"
  | "kampanya-happy-hour"
  | "kampanya-ikram"
  | "kampanya-etkinlik"
  | "kampanya-yeni-urun"
  | "kampanya-indirim"
  | "bulten-kampanya"
  | "mobil-uygulama";

/**
 * `mobil-uygulama` is the app launch announcement: fixed copy, no form
 * fields, and nothing to say without the two store links - the panel offers
 * it only once both exist (`campaignMailTemplateAvailable`) and the render
 * below refuses it otherwise.
 */
export const CAMPAIGN_TEMPLATES: readonly CampaignTemplateName[] = [
  "kampanya-duyuru",
  "kampanya-bonus-damga",
  "kampanya-happy-hour",
  "kampanya-ikram",
  "kampanya-etkinlik",
  "kampanya-yeni-urun",
  "kampanya-indirim",
  "bulten-kampanya",
  "mobil-uygulama",
];

/**
 * Template + form values → the three strings, synchronously.
 *
 * Shared by the admin preview, the test send and the batch runner so all three
 * see the same message. Throws on an unfilled field, exactly as `renderEmail`
 * does - a campaign with a hole in it must fail before the queue, not in it.
 *
 * A hero image without alt text falls back to the campaign title rather than
 * failing the whole send over a field the form left blank; the code box has no
 * such mercy, because a code with no expiry is a promise nobody can keep.
 */
export function renderCampaignMail(
  template: CampaignTemplateName,
  vars: Record<string, string>,
  unsubscribeUrl: string,
): RenderedEmail {
  if (!campaignMailTemplateAvailable(template, hasAppLinks())) {
    throw new Error(CAMPAIGN_MAIL_APP_LINKS_MISSING);
  }
  const filled = { ...vars };
  if (filled.KAMPANYA_GORSEL_URL && !filled.KAMPANYA_GORSEL_ALT) {
    filled.KAMPANYA_GORSEL_ALT = filled.KAMPANYA_BASLIK ?? "";
  }
  return renderEmail(template, {
    vars: filled,
    text: EMAIL_TEXT[template],
    unsubscribeUrl,
  });
}

/**
 * One campaign message to one address, with the provider's verdict kept.
 *
 * Unlike the transactional wrappers this does NOT collapse to a boolean: a
 * campaign runner has to write "domain not verified" or "rate limited" next
 * to the recipient, and a test send has to show it to the operator.
 */
export async function sendCampaignMail(
  template: CampaignTemplateName,
  to: string,
  vars: Record<string, string>,
  unsubscribeUrl: string,
): Promise<SendResult> {
  if (!to) return { ok: false, error: "Alıcı adresi boş." };
  let rendered: RenderedEmail;
  try {
    rendered = renderCampaignMail(template, vars, unsubscribeUrl);
  } catch (err) {
    console.error(`[email] ${template} hazırlanamadı`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Şablon hazırlanamadı.",
    };
  }
  return deliver({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl,
  });
}

// ── Toplu gönderim - Resend batch ──────────────────────────────────────────

export interface BatchMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Commercial mail only - becomes the List-Unsubscribe pair, as in `deliver`. */
  unsubscribeUrl?: string;
}

export type BatchDeliveryResult =
  | { ok: true; ids: string[] }
  | {
      ok: false;
      error: string;
      /** The HTTP status, or 0 when no request was made (no key, too many, network). */
      status: number;
      /** Parsed from `Retry-After` on a 429, when the provider sent one. */
      retryAfterMs?: number;
    };

/** Resend's batch endpoint takes at most this many messages per call. */
export const BATCH_LIMIT = 100;

/** Every address-shaped substring, masked - for logging a provider error body. */
function maskAddressesIn(text: string): string {
  return text.replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, (m) => maskEmail(m));
}

/** `Retry-After: 2` → 2000; an HTTP-date is honoured too; garbage → undefined. */
function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw.trim());
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.round(seconds * 1000);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

/** `{"data":[{"id":"…"},…]}` - the ids in message order; an odd body yields none. */
async function batchIds(res: Response): Promise<string[]> {
  try {
    const parsed: unknown = await res.json();
    const data =
      parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as { data?: unknown }).data
        : undefined;
    if (!Array.isArray(data)) return [];
    return data.map((row: unknown) =>
      row &&
      typeof row === "object" &&
      typeof (row as { id?: unknown }).id === "string"
        ? (row as { id: string }).id
        : "",
    );
  } catch {
    return [];
  }
}

/**
 * Up to 100 messages in one request - `POST /emails/batch`.
 *
 * Same sender, reply-to and unsubscribe headers as `deliver()`, but the
 * identity is resolved once per call rather than once per message; the
 * settings read behind `emailIdentity` would otherwise run a hundred times
 * per batch.
 *
 * `idempotencyKey` goes out as Resend's `Idempotency-Key`: a retry with the
 * same key and the same messages is deduplicated by the provider for 24 h, so
 * a runner that times out mid-campaign can send the same batch again without
 * doubling anyone's inbox. The caller owns the key (`cmp-<campaign>-b<batch>`)
 * because only the caller knows what "the same batch" means.
 *
 * On success the ids come back in message order. On failure the whole batch
 * failed as one - Resend accepts or rejects the array atomically - and the
 * status is kept so a 429 can be told from a 403. Addresses are logged masked
 * only, and never more than the first.
 */
export async function deliverBatch(
  messages: BatchMessage[],
  idempotencyKey: string,
): Promise<BatchDeliveryResult> {
  if (messages.length === 0) return { ok: true, ids: [] };
  if (messages.length > BATCH_LIMIT) {
    return {
      ok: false,
      error: `Bir toplu gönderim en fazla ${BATCH_LIMIT} ileti taşır (verilen: ${messages.length}).`,
      status: 0,
    };
  }
  const key = process.env.RESEND_API_KEY;
  const preview = `${messages.length} alıcı, ilki ${maskEmail(messages[0]?.to ?? "")}`;
  if (!key) {
    console.info(`[email] (no provider) batch ${idempotencyKey} → ${preview}`);
    return { ok: false, error: "RESEND_API_KEY tanımlı değil.", status: 0 };
  }
  const { from, replyTo } = await emailIdentity();
  const body = messages.map((m) => ({
    from,
    to: m.to,
    subject: m.subject,
    html: m.html,
    ...(m.text ? { text: m.text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(m.unsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  }));
  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[email] Resend batch ${idempotencyKey} failed (${res.status}): ${maskAddressesIn(text).slice(0, 300)}`,
      );
      const retryAfterMs = parseRetryAfter(res);
      return {
        ok: false,
        error: resendMessage(res.status, text),
        status: res.status,
        ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
      };
    }
    const ids = await batchIds(res);
    console.info(
      `[email] batch ${idempotencyKey} → ${preview} (${ids.length} id)`,
    );
    return { ok: true, ids };
  } catch (err) {
    console.error(`[email] batch ${idempotencyKey} send error`, err);
    return { ok: false, error: "Sağlayıcıya ulaşılamadı.", status: 0 };
  }
}
