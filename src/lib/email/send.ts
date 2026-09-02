import "server-only";

import { SITE } from "@/lib/seo/site";
import { formatTRYMinor } from "@/lib/utils/commerce";

/**
 * Minimal transactional e-mail sender.
 *
 * Provider-agnostic: if `RESEND_API_KEY` (+ optional `EMAIL_FROM`) is set the
 * message is delivered via Resend's HTTP API; otherwise the e-mail is logged
 * to the server console so the flow stays testable without a provider wired.
 * Swapping to SES/Postmark/etc. is a one-function change.
 */

/**
 * Sender identity. Resend only delivers from a domain verified on the account
 * (SPF + DKIM records on nextgenlab.com.tr), so keep `EMAIL_FROM` overridable:
 * until that DNS verification is done, point it at a verified sandbox address.
 */
const FROM = process.env.EMAIL_FROM || "L'Affogato <info@nextgenlab.com.tr>";

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

async function send({
  to,
  subject,
  html,
  text,
  unsubscribeUrl,
}: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // No provider configured — log so the link is recoverable in dev/staging.
    console.info(`[email] (no provider) → ${to} · ${subject}\n${text ?? html}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html,
        ...(text ? { text } : {}),
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
      console.error(
        `[email] Resend failed (${res.status}): ${await res.text()}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send error", err);
    return false;
  }
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
  const html = `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#3A2A20">
  <p style="font-size:16px">${greeting}</p>
  <p style="font-size:15px;line-height:1.6">L'Affogato hesabını oluşturduğun için teşekkürler. Sipariş verebilmek için e-posta adresini doğrulaman gerekiyor.</p>
  <p style="margin:28px 0">
    <a href="${verifyUrl}" style="background:#3A2A20;color:#F6EFE4;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:14px;letter-spacing:0.04em">E-postamı doğrula</a>
  </p>
  <p style="font-size:13px;color:#8a7a6c;line-height:1.6">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br><a href="${verifyUrl}" style="color:#C49A5A">${verifyUrl}</a></p>
  <p style="font-size:12px;color:#a89a8c">Bağlantı 24 saat geçerlidir. Bu hesabı sen oluşturmadıysan e-postayı yok say.</p>
  <p style="font-size:13px;color:#3A2A20;margin-top:24px">— L'Affogato · Coffee Italiano</p>
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
  const html = `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#3A2A20">
  <p style="font-size:16px">${greeting}</p>
  <p style="font-size:15px;line-height:1.6">L'Affogato hesabın için şifre sıfırlama talebi aldık. Yeni şifreni belirlemek için aşağıdaki butona tıkla.</p>
  <p style="margin:28px 0">
    <a href="${resetUrl}" style="background:#3A2A20;color:#F6EFE4;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:14px;letter-spacing:0.04em">Yeni şifre belirle</a>
  </p>
  <p style="font-size:13px;color:#8a7a6c;line-height:1.6">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br><a href="${resetUrl}" style="color:#C49A5A">${resetUrl}</a></p>
  <p style="font-size:12px;color:#a89a8c">Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir. Bu talebi sen yapmadıysan hiçbir şey yapmana gerek yok; mevcut şifren değişmez.</p>
  <p style="font-size:13px;color:#3A2A20;margin-top:24px">— L'Affogato · Coffee Italiano</p>
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
        `<tr><td style="padding:6px 0;font-size:14px;color:#3A2A20">${it.productName} <span style="color:#a89a8c">× ${it.qty}</span></td><td style="padding:6px 0;font-size:14px;text-align:right;color:#3A2A20">${formatTRYMinor(it.unitPriceMinor * it.qty)}</td></tr>`,
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
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#3A2A20">
  <p style="font-size:16px">${greeting}</p>
  <p style="font-size:15px;line-height:1.6">${intro}</p>
  <p style="font-size:13px;color:#8a7a6c;margin:18px 0 6px">Sipariş No: <strong>#${o.orderNo}</strong></p>
  <table style="width:100%;border-collapse:collapse;border-top:1px solid #e7ddcf;border-bottom:1px solid #e7ddcf;margin:6px 0">
    ${orderLinesHtml(o.items)}
  </table>
  <p style="font-size:15px;text-align:right;margin:10px 0"><strong>Toplam: ${formatTRYMinor(o.totalMinor)}</strong></p>
  <p style="font-size:12px;line-height:1.7;color:#8a7a6c;margin:22px 0 0;padding-top:14px;border-top:1px solid #e7ddcf">
    Sipariş sırasında onayladığın belgeler — kalıcı veri saklayıcısı olarak saklaman için:<br />
    ${CONSENT_DOC_LINKS.map((d) => `<a href="${d.url}" style="color:#8a6a3c">${d.label}</a>`).join(" · ")}
  </p>
  <p style="font-size:13px;color:#3A2A20;margin-top:24px">— L'Affogato · Coffee Italiano</p>
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
