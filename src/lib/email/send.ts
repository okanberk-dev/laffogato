import "server-only";

import { SITE } from "@/lib/seo/site";
import { formatTRYMinor } from "@/lib/utils/commerce";

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
    // No provider configured — log so the link is recoverable in dev/staging.
    console.info(`[email] (no provider) → ${to} · ${subject}\n${text ?? html}`);
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
      console.error(`[email] Resend failed (${res.status}): ${body}`);
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

export async function sendVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string,
): Promise<boolean> {
  const greeting = name ? `Merhaba ${name},` : "Merhaba,";
  const subject = "L'Affogato — e-posta adresini doğrula";
  const text = `${greeting}

L'Affogato hesabını oluşturduğun için teşekkürler. Sipariş verebilmek için
e-posta adresini doğrulaman gerekiyor:

${verifyUrl}

Bu bağlantı 24 saat geçerlidir. Bu hesabı sen oluşturmadıysan bu e-postayı
yok sayabilirsin.

— L'Affogato`;
  const html = `<div style="font-family:'Montserrat',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#201c17">
  <p style="font-size:16px">${greeting}</p>
  <p style="font-size:15px;line-height:1.6">L'Affogato hesabını oluşturduğun için teşekkürler. Sipariş verebilmek için e-posta adresini doğrulaman gerekiyor.</p>
  <p style="margin:28px 0">
    <a href="${verifyUrl}" style="background:#143d2b;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;letter-spacing:0.04em">E-postamı doğrula</a>
  </p>
  <p style="font-size:13px;color:#5f594e;line-height:1.6">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br><a href="${verifyUrl}" style="color:#8a6526">${verifyUrl}</a></p>
  <p style="font-size:12px;color:#746b5d">Bağlantı 24 saat geçerlidir. Bu hesabı sen oluşturmadıysan e-postayı yok say.</p>
  <p style="font-size:13px;color:#201c17;margin-top:24px">— L'Affogato · Coffee Italiano</p>
</div>`;
  return send({ to, subject, html, text });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string,
): Promise<boolean> {
  const greeting = name ? `Merhaba ${name},` : "Merhaba,";
  const subject = "L'Affogato — şifre sıfırlama";
  const text = `${greeting}

L'Affogato hesabın için şifre sıfırlama talebi aldık. Yeni şifreni belirlemek
için aşağıdaki bağlantıya tıkla:

${resetUrl}

Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu talebi sen
yapmadıysan hiçbir şey yapmana gerek yok — mevcut şifren değişmez.

— L'Affogato`;
  const html = `<div style="font-family:'Montserrat',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#201c17">
  <p style="font-size:16px">${greeting}</p>
  <p style="font-size:15px;line-height:1.6">L'Affogato hesabın için şifre sıfırlama talebi aldık. Yeni şifreni belirlemek için aşağıdaki butona tıkla.</p>
  <p style="margin:28px 0">
    <a href="${resetUrl}" style="background:#143d2b;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;letter-spacing:0.04em">Yeni şifre belirle</a>
  </p>
  <p style="font-size:13px;color:#5f594e;line-height:1.6">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br><a href="${resetUrl}" style="color:#8a6526">${resetUrl}</a></p>
  <p style="font-size:12px;color:#746b5d">Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir. Bu talebi sen yapmadıysan hiçbir şey yapmana gerek yok; mevcut şifren değişmez.</p>
  <p style="font-size:13px;color:#201c17;margin-top:24px">— L'Affogato · Coffee Italiano</p>
</div>`;
  return send({ to, subject, html, text });
}

// ── Order notifications ────────────────────────────────────────────────────

export interface OrderEmailData {
  to: string;
  customerName: string;
  orderNo: number;
  items: { productName: string; qty: number; unitPriceMinor: number }[];
  totalMinor: number;
}

function orderLinesText(items: OrderEmailData["items"]): string {
  return items
    .map(
      (it) =>
        `  • ${it.productName} × ${it.qty} — ${formatTRYMinor(it.unitPriceMinor * it.qty)}`,
    )
    .join("\n");
}

function orderLinesHtml(items: OrderEmailData["items"]): string {
  return items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:#201c17">${it.productName} <span style="color:#746b5d">× ${it.qty}</span></td><td style="padding:6px 0;font-size:14px;text-align:right;color:#201c17">${formatTRYMinor(it.unitPriceMinor * it.qty)}</td></tr>`,
    )
    .join("");
}

/**
 * The contracts the buyer confirmed at checkout. Mesafeli Sözleşmeler
 * Yönetmeliği requires them to reach the consumer on a durable medium, so the
 * order e-mail carries a permanent link to each.
 */
const CONSENT_DOC_LINKS = [
  { label: "Ön Bilgilendirme Formu", slug: "on-bilgilendirme-formu" },
  { label: "Mesafeli Satış Sözleşmesi", slug: "mesafeli-satis-sozlesmesi" },
  { label: "İptal, İade ve Cayma Hakkı", slug: "iade-ve-cayma" },
].map((d) => ({ ...d, url: `${SITE.url}/hukuk/${d.slug}` }));

function orderShellHtml(
  greeting: string,
  intro: string,
  o: OrderEmailData,
): string {
  return `<div style="font-family:'Montserrat',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#201c17">
  <p style="font-size:16px">${greeting}</p>
  <p style="font-size:15px;line-height:1.6">${intro}</p>
  <p style="font-size:13px;color:#5f594e;margin:18px 0 6px">Sipariş No: <strong>#${o.orderNo}</strong></p>
  <table style="width:100%;border-collapse:collapse;border-top:1px solid #ebe7de;border-bottom:1px solid #ebe7de;margin:6px 0">
    ${orderLinesHtml(o.items)}
  </table>
  <p style="font-size:15px;text-align:right;margin:10px 0"><strong>Toplam: ${formatTRYMinor(o.totalMinor)}</strong></p>
  <p style="font-size:12px;line-height:1.7;color:#5f594e;margin:22px 0 0;padding-top:14px;border-top:1px solid #ebe7de">
    Sipariş sırasında onayladığın belgeler — kalıcı veri saklayıcısı olarak saklaman için:<br />
    ${CONSENT_DOC_LINKS.map((d) => `<a href="${d.url}" style="color:#6b4e1a">${d.label}</a>`).join(" · ")}
  </p>
  <p style="font-size:13px;color:#201c17;margin-top:24px">— L'Affogato · Coffee Italiano</p>
</div>`;
}

/** Sent when an order is created (payment still pending). */
export async function sendOrderPlacedEmail(
  o: OrderEmailData,
): Promise<boolean> {
  if (!o.to) return false;
  const greeting = o.customerName ? `Merhaba ${o.customerName},` : "Merhaba,";
  const subject = `L'Affogato — Siparişin alındı (#${o.orderNo})`;
  const intro =
    "Siparişini aldık. Ödemen onaylandığında siparişini hazırlamaya başlayacağız.";
  const text = `${greeting}

${intro}

Sipariş No: #${o.orderNo}
${orderLinesText(o.items)}

Toplam: ${formatTRYMinor(o.totalMinor)}

Onayladığın belgeler:
${CONSENT_DOC_LINKS.map((d) => `- ${d.label}: ${d.url}`).join("\n")}

— L'Affogato`;
  return send({
    to: o.to,
    subject,
    html: orderShellHtml(greeting, intro, o),
    text,
  });
}

/** Sent when an order's payment is confirmed (status → paid). */
export async function sendOrderPaidEmail(o: OrderEmailData): Promise<boolean> {
  if (!o.to) return false;
  const greeting = o.customerName ? `Merhaba ${o.customerName},` : "Merhaba,";
  const subject = `L'Affogato — Ödemen onaylandı (#${o.orderNo})`;
  const intro =
    "Ödemen alındı ve siparişin onaylandı. Hazırlanmaya başlandı — Tuzla köşkünde bekleniyorsun.";
  const text = `${greeting}

${intro}

Sipariş No: #${o.orderNo}
${orderLinesText(o.items)}

Toplam: ${formatTRYMinor(o.totalMinor)}

— L'Affogato`;
  return send({
    to: o.to,
    subject,
    html: orderShellHtml(greeting, intro, o),
    text,
  });
}
