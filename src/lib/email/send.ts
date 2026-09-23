import "server-only";

import { hasAppLinks } from "@/lib/mobile/app-store";
import { SITE } from "@/lib/seo/site";
import { formatTRYMinor } from "@/lib/utils/commerce";

import { escapeHtml } from "./fill";
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

/** `ed**@example.com` — enough to recognise a row, not enough to be one. */
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
  /** True once `RESEND_API_KEY` is present — i.e. mail actually leaves. */
  hasProvider: boolean;
}

/**
 * Who the mail comes from, in priority order:
 *
 *   1. Ayarlar → "E-posta gönderimi" — changeable from the panel, no deploy
 *   2. `EMAIL_FROM` — the escape hatch for a deployment with no database
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
   * shipping, password reset) must NOT carry it — those are not subject to
   * consent and offering to unsubscribe from them is misleading.
   */
  unsubscribeUrl?: string;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * One delivery attempt, with the provider's own words on failure.
 *
 * `send()` throws them away and returns a boolean, which is right for the
 * order path — a customer must not lose an order because mail bounced — but
 * useless to an operator asking why nothing arrives. "The laffogato.net
 * domain is not verified" is the answer, and it only exists here.
 */
async function deliver({
  to,
  subject,
  html,
  text,
  unsubscribeUrl,
}: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const { from, replyTo } = await emailIdentity();
  if (!key) {
    // No provider configured. The body is worth logging in development —
    // without it a verification link is unrecoverable and the flow untestable
    // — but it carries a single-use token URL and the recipient is a customer
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
    // Not JSON — fall through.
  }
  return `${status}: ${body.slice(0, 200)}`;
}

async function send(args: SendArgs): Promise<boolean> {
  return (await deliver(args)).ok;
}

/**
 * Ayarlar → "Test e-postası gönder". Proves the whole chain — key, verified
 * domain, sender address — in one click, and says what broke when it breaks.
 */
export async function sendTestEmail(to: string): Promise<SendResult> {
  const { from } = await emailIdentity();
  return deliver({
    to,
    subject: "L'Affogato — e-posta ayarları testi",
    text: `Bu bir testtir. Bu mesaj sana ulaştıysa L'Affogato'nun sipariş, doğrulama ve şifre sıfırlama e-postaları da ulaşacak.

Gönderen: ${from}

— L'Affogato`,
    html: `<div style="font-family:'Montserrat',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#201c17">
  <p style="font-size:15px;line-height:1.6">Bu bir testtir. Bu mesaj sana ulaştıysa L'Affogato'nun sipariş, doğrulama ve şifre sıfırlama e-postaları da ulaşacak.</p>
  <p style="font-size:13px;color:#5f594e">Gönderen: ${from.replace(/</g, "&lt;")}</p>
  <p style="font-size:13px;color:#201c17;margin-top:24px">— L'Affogato · Coffee Italiano</p>
</div>`,
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
 * `renderEmail` throws on an unfilled `[FIELD]` — which is what we want, a
 * half-written message must not leave — but this is also the path a customer's
 * order confirmation takes, and an order must not fail because a template did.
 * So it is logged loudly and swallowed, exactly as a provider outage is.
 */
async function sendTemplate(
  name: EmailTemplateName,
  to: string,
  input: Omit<RenderInput, "text">,
): Promise<boolean> {
  if (!to) return false;
  try {
    const r = renderEmail(name, { ...input, text: EMAIL_TEXT[name] });
    return await send({
      to,
      subject: r.subject,
      html: r.html,
      text: r.text,
      ...(r.unsubscribeUrl ? { unsubscribeUrl: r.unsubscribeUrl } : {}),
    });
  } catch (err) {
    console.error(`[email] ${name} hazırlanamadı`, err);
    return false;
  }
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
 * inbox. Transactional — it asks, it does not advertise — so it carries no
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
        `  • ${it.productName} × ${it.qty} — ${formatTRYMinor(it.unitPriceMinor * it.qty)}`,
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
    KARGO: shipping === 0 ? "Ücretsiz" : formatTRYMinor(shipping),
    TOPLAM: formatTRYMinor(o.totalMinor),
    KALEMLER: orderLinesText(o.items),
    BELGELER: CONSENT_DOCS_TEXT,
  };
}

/** Sent when an order is created (payment still pending). */
export async function sendOrderPlacedEmail(
  o: OrderEmailData,
): Promise<boolean> {
  return sendTemplate("siparis-alindi", o.to, {
    vars: orderVars(o),
    loops: { ITEMS: itemRows(o.items) },
  });
}

/**
 * The stamp target the operator has configured, for the "one more stamp" panel.
 *
 * Read through a dynamic import for the same reason `emailIdentity` does it:
 * `admin/store` imports this module for order mail, so a static import both
 * ways is a cycle. A settings read must never cost an order confirmation, so
 * the built-in default stands in when the database is unreachable.
 */
async function stampTarget(): Promise<string> {
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

/** Sent when an order's payment is confirmed (status → paid). */
export async function sendOrderPaidEmail(o: OrderEmailData): Promise<boolean> {
  return sendTemplate("odeme-onaylandi", o.to, {
    vars: { ...orderVars(o), DAMGA_HEDEFI: await stampTarget() },
    loops: { ITEMS: itemRows(o.items) },
  });
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
  /** Already formatted for a reader: "12 Eylül 2026", "20:00 – 22:00". */
  date: string;
  time: string;
  guests: number;
  /**
   * The reservation id — `krk-00042` — which is what the member is asked for
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
 * they have it. No consent gate, no unsubscribe link — `renderEmail` refuses
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
 * What the counter needs to know about a booking the app just took.
 *
 * Deliberately not `KaraokeEmailData`: that one is the MEMBER's confirmation
 * and its template says "Saatiniz ayrıldı". A reservation arrives with
 * `status: "requested"`, so telling the member it is confirmed would be a
 * promise the staff have not made yet. This is the other direction — the room
 * is booked by hand, and nobody was being told.
 */
export interface KaraokeOperatorNotice {
  /** `krk-00042`, so the row is findable in /admin/mobil/karaoke. */
  id: string;
  customerName: string;
  customerEmail: string;
  /** Already formatted for a reader: "12 Eylül 2026", "20:00 – 22:00". */
  date: string;
  time: string;
  guests: number;
  totalMinor: number;
  /** The member's own note, or "" — printed as-is, never interpreted. */
  note: string;
}

/**
 * Tells the köşk that a karaoke hour was just requested from the app.
 *
 * INTERNAL mail: it goes to the operator address in Ayarlar
 * (`settings.email`), carries no unsubscribe header (it is not a commercial
 * message and offering to unsubscribe from it would be misleading — see
 * `SendArgs.unsubscribeUrl`), and is written as plain text because its reader
 * is a person behind a counter deciding whether to confirm, not a customer
 * being courted.
 *
 * The member's address IS printed in full here, unlike everywhere else in this
 * module: the operator has to be able to reply to them, and this message goes
 * to the business's own inbox rather than to a customer.
 *
 * Failure is swallowed by the caller, not here — a booking must never be lost
 * because mail bounced, and the row is in the panel either way.
 */
export async function sendKaraokeOperatorEmail(
  k: KaraokeOperatorNotice,
): Promise<SendResult> {
  const { email } = await (async () => {
    // Dynamic, for the cycle `emailIdentity` documents: admin/store imports
    // this module for order mail.
    const { getSettings } = await import("@/lib/admin/store");
    return getSettings();
  })();
  const to = email.trim();
  if (!to)
    return { ok: false, error: "Ayarlar'da bildirim adresi tanımlı değil." };

  const lines = [
    `Uygulamadan yeni bir karaoke rezervasyon talebi geldi.`,
    ``,
    `Rezervasyon : ${k.id}`,
    `Tarih       : ${k.date}`,
    `Saat        : ${k.time}`,
    `Kişi        : ${k.guests}`,
    `Tutar       : ${formatTRYMinor(k.totalMinor)}`,
    ``,
    `Üye         : ${k.customerName.trim() || "—"}`,
    `E-posta     : ${k.customerEmail}`,
    ...(k.note.trim() ? [``, `Notu        : ${k.note.trim()}`] : []),
    ``,
    `Durum: TALEP EDİLDİ — onaylanana kadar oda tutulmuş sayılmaz.`,
    `Onaylamak ya da iptal etmek için: https://laffogato.net/admin/mobil/karaoke`,
  ];

  return deliver({
    to,
    subject: `Karaoke talebi · ${k.date} ${k.time} · ${k.guests} kişi (${k.id})`,
    html: `<pre style="font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace">${lines
      .map((l) => escapeHtml(l))
      .join("\n")}</pre>`,
    text: lines.join("\n"),
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
// The commercial templates — the three below and the `kampanya-*` family at
// the end of this file — carry an unsubscribe link and only go to an address
// that has consented. `renderEmail` refuses to build them without
// `unsubscribeUrl`, and refuses to put one on any of the transactional
// templates above.

/**
 * `${SITE.url}/api/bulten/cikis?token=…` — the token is on the subscriber
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

export interface CampaignEmailData {
  to: string;
  name: string;
  unsubToken: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  couponCode: string;
  expiresAt: string;
  /** Exactly three, which is what the template lays out. */
  picks: { name: string; note: string; price: string }[];
}

export async function sendCampaignEmail(
  c: CampaignEmailData,
): Promise<boolean> {
  const [p1, p2, p3] = c.picks;
  if (!p1 || !p2 || !p3) {
    console.error("[email] bulten-kampanya: üç ürün seçkisi gerekli");
    return false;
  }
  return sendTemplate("bulten-kampanya", c.to, {
    unsubscribeUrl: unsubscribeUrlFor(c.unsubToken),
    vars: {
      AD: c.name.trim(),
      KAMPANYA_BASLIK: c.title,
      KAMPANYA_METIN: c.body,
      KAMPANYA_BUTON: c.ctaLabel,
      KAMPANYA_URL: c.ctaUrl,
      KUPON_KODU: c.couponCode,
      SON_KULLANIM: c.expiresAt,
      URUN_1_AD: p1.name,
      URUN_1_NOT: p1.note,
      URUN_1_FIYAT: p1.price,
      URUN_2_AD: p2.name,
      URUN_2_NOT: p2.note,
      URUN_2_FIYAT: p2.price,
      URUN_3_AD: p3.name,
      URUN_3_NOT: p3.note,
      URUN_3_FIYAT: p3.price,
    },
  });
}

/**
 * The app launch announcement.
 *
 * Unlike the other nine, this one has nothing left to say without the store
 * links — the strip is the message — so it is not sent at all until both
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
   * From `grantBirthdayCouponToday` — and only when it actually WROTE a row.
   * That single fact is the run's idempotency key: a member already greeted
   * this year gets `null` back and no message.
   */
  couponCode: string;
  /**
   * Already formatted: "23 Eylül 2026". Seven days from the grant, which is
   * what both halves of the template promise — see `BIRTHDAY.ttlDays`.
   */
  expiresAt: string;
}

/**
 * The birthday greeting, from the daily cron (`/api/cron/birthday`).
 *
 * COMMERCIAL (6563): a celebration wrapped around a %20 offer is still an
 * offer, so it only goes to a member whose `marketing` preference is on and
 * who has a consent record, and it carries `List-Unsubscribe`. The coupon
 * itself is not a message and is granted without that gate — a member who
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
// `Record<string, string>`, and the optional blocks — image, code, date,
// footnote, highlight — follow the presence of their field (`render.ts`).

export type CampaignTemplateName =
  | "kampanya-duyuru"
  | "kampanya-bonus-damga"
  | "kampanya-happy-hour"
  | "kampanya-ikram"
  | "kampanya-etkinlik"
  | "kampanya-yeni-urun"
  | "kampanya-indirim"
  | "bulten-kampanya";

export const CAMPAIGN_TEMPLATES: readonly CampaignTemplateName[] = [
  "kampanya-duyuru",
  "kampanya-bonus-damga",
  "kampanya-happy-hour",
  "kampanya-ikram",
  "kampanya-etkinlik",
  "kampanya-yeni-urun",
  "kampanya-indirim",
  "bulten-kampanya",
];

/**
 * Template + form values → the three strings, synchronously.
 *
 * Shared by the admin preview, the test send and the batch runner so all three
 * see the same message. Throws on an unfilled field, exactly as `renderEmail`
 * does — a campaign with a hole in it must fail before the queue, not in it.
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

// ── Toplu gönderim — Resend batch ──────────────────────────────────────────

export interface BatchMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Commercial mail only — becomes the List-Unsubscribe pair, as in `deliver`. */
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

/** Every address-shaped substring, masked — for logging a provider error body. */
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

/** `{"data":[{"id":"…"},…]}` — the ids in message order; an odd body yields none. */
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
 * Up to 100 messages in one request — `POST /emails/batch`.
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
 * failed as one — Resend accepts or rejects the array atomically — and the
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
