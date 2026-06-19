import "server-only";

/**
 * Minimal transactional e-mail sender.
 *
 * Provider-agnostic: if `RESEND_API_KEY` (+ optional `EMAIL_FROM`) is set the
 * message is delivered via Resend's HTTP API; otherwise the e-mail is logged
 * to the server console so the flow stays testable without a provider wired.
 * Swapping to SES/Postmark/etc. is a one-function change.
 */

const FROM = process.env.EMAIL_FROM || "L'Affogato <onboarding@resend.dev>";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function send({ to, subject, html, text }: SendArgs): Promise<boolean> {
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
