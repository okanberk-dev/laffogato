import "server-only";

import {
  CAMPAIGN_MAIL_APP_LINKS_MISSING,
  campaignMailTemplateAvailable,
} from "@/lib/admin/campaign-mail-schema";
import { hasAppLinks } from "@/lib/mobile/app-store";
import {
  isBusinessCause,
  KARAOKE_CAUSE_MAIL,
  type KaraokeCancelCause,
} from "@/lib/mobile/karaoke-cancel-cause";
import {
  DEFAULT_KARAOKE_CANCEL_POLICY,
  KARAOKE_NO_REFUND_RULE,
  KARAOKE_REFUND_RULE,
  karaokeVenueCancelUntil,
} from "@/lib/mobile/karaoke-time";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import { SITE } from "@/lib/seo/site";
import { formatTRYMinor } from "@/lib/utils/commerce";
import type { InvoiceMail } from "@/lib/invoice/run";

import { renderEmail, type RenderedEmail, type RenderInput } from "./render";
import type { EmailTemplateName } from "./templates.generated";
import { EMAIL_TEXT } from "./text";
import { loadVenueVars } from "./venue";

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

/** `ed**@<domain>` - enough to recognise a row, not enough to be one. */
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
  /**
   * One more attempt, in this request, when the provider answers 429 or 5xx
   * or cannot be reached - with the SAME idempotency key, so an attempt that
   * did reach the provider is answered from its record, not sent twice. The
   * wait is short on purpose (`RETRY_WAIT_MS`): the caller is a payment
   * return that must answer within its function's time budget. Only the
   * customer's one order mail asks for it; everything else keeps trying once.
   */
  retryOnce?: boolean;
  /**
   * Files sent with this one message (Resend: `attachments`, base64
   * `content`). Single sends only: the campaign batch (`deliverBatch`,
   * `/emails/batch`) builds its messages field by field and never carries
   * one. Today only the confirmed contract (ASK-DURABLE).
   */
  attachments?: readonly MailAttachment[];
  /**
   * The caller's time budget, as an instant (epoch ms): no attempt starts
   * with less than `MIN_ATTEMPT_MS` left, each one is cut at what is left,
   * and the retry is skipped when it would not fit. The order and karaoke
   * confirmations are awaited inside a payment return and pass one
   * (./budget.ts `MAIL_BUDGET`); everything else keeps the per-request bound
   * only.
   */
  deadline?: number;
}

/** One attached file: its name and its bytes as base64. */
export interface MailAttachment {
  filename: string;
  content: string;
}

/** An HTML document as an attachment (UTF-8, base64). */
export function htmlAttachment(filename: string, html: string): MailAttachment {
  return { filename, content: Buffer.from(html, "utf8").toString("base64") };
}

/** Upper bound for one Resend request (ms). */
const MAIL_REQUEST_TIMEOUT_MS = 4_000;

/** The longest pause before the one retry; `Retry-After` is honoured up to it. */
const RETRY_WAIT_MS = 1_500;

/** No attempt starts with less than this left before the caller's deadline. */
const MIN_ATTEMPT_MS = 1_000;

function msLeft(deadline: number | undefined): number {
  return deadline === undefined ? Number.POSITIVE_INFINITY : deadline - Date.now();
}

/**
 * `fetch`, aborted after `ms` by a plain timer (the caller's budget can be
 * shorter than the 4 s bound, and a test's clock can drive it).
 */
async function postWithin(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(
    () =>
      ctrl.abort(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      ),
    ms,
  );
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type SendResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /**
       * The provider's HTTP status when it answered with a refusal; absent
       * when no request was answered (no key, unreachable, a template that
       * did not render). A 4xx other than 429 means nothing was sent.
       */
      status?: number;
    };

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
  retryOnce,
  attachments,
  deadline,
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
  const payload = JSON.stringify({
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
    ...(attachments && attachments.length > 0
      ? {
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        }
      : {}),
  });
  for (let attempt = 0; ; attempt++) {
    const again = retryOnce === true && attempt === 0;
    const left = msLeft(deadline);
    if (left < MIN_ATTEMPT_MS) {
      return { ok: false, error: "E-posta zamanında gönderilemedi." };
    }
    try {
      const res = await postWithin(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: payload,
        },
        // The mail is awaited inside the payment return; a hung provider
        // must not hold the customer on the bank's redirect: 4 s at most,
        // less when the caller's budget has less left.
        Math.min(MAIL_REQUEST_TIMEOUT_MS, left),
      );
      if (res.ok) return { ok: true };
      const body = await res.text();
      console.error(
        `[email] Resend failed (${res.status}): ${maskAddressesIn(body)}`,
      );
      // The key was used, within its 24 hours, for a request of this same
      // mail whose body differed (the confirmed contract attached one time
      // and not the other): Resend took that request, and the message is
      // out. Sending it again under another key would be a second copy.
      if (
        res.status === 409 &&
        idempotencyKey &&
        body.includes("invalid_idempotent_request")
      ) {
        console.info(
          `[email] ${idempotencyKey}: already sent under this key, not sent again`,
        );
        return { ok: true };
      }
      if (again && (res.status === 429 || res.status >= 500)) {
        const asked = Number(res.headers.get("retry-after")) * 1000;
        const wait = Math.min(
          Number.isFinite(asked) && asked > 0 ? asked : RETRY_WAIT_MS,
          RETRY_WAIT_MS,
        );
        if (msLeft(deadline) - wait >= MIN_ATTEMPT_MS) {
          await pause(wait);
          continue;
        }
      }
      return {
        ok: false,
        error: resendErrorText(res.status, body),
        status: res.status,
      };
    } catch (err) {
      console.error("[email] send error", err);
      if (again && msLeft(deadline) - RETRY_WAIT_MS >= MIN_ATTEMPT_MS) {
        await pause(RETRY_WAIT_MS);
        continue;
      }
      return { ok: false, error: "Sağlayıcıya ulaşılamadı." };
    }
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.min(ms, RETRY_WAIT_MS)),
  );
}

/**
 * What a Resend refusal means, in the operator's language. Resend answers
 * `{"message": "..."}` in English ("The laffogato.net domain is not
 * verified..."), and the test button showed that, or "403: {json}", to a
 * Turkish café owner. The common refusals get a sentence that says what to
 * do; anything else says it was refused and keeps the provider's words
 * after it, for whoever fixes it. The raw body is logged above, masked.
 */
export function resendErrorText(status: number, body: string): string {
  let message = "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const m = (parsed as { message?: unknown }).message;
      if (typeof m === "string") message = m.trim();
    }
  } catch {
    // Not JSON - fall through with the raw text.
  }
  if (!message) message = body.trim().slice(0, 200);
  const m = message.toLowerCase();
  const domain = /the (\S+) domain is not verified/i.exec(message)?.[1];
  if (domain) {
    return `${domain} alan adı Resend'de doğrulanmamış; bu adresten e-posta çıkmaz. Alan adını Resend'de doğrula ya da doğrulanmış bir gönderen adresi yaz.`;
  }
  if (m.includes("only send testing emails")) {
    return "Resend hesabı deneme modunda: yalnız hesabın kendi adresine gönderebiliyor. Gönderen alan adını Resend'de doğrula.";
  }
  if (m.includes("api key")) {
    return "E-posta sağlayıcısının anahtarı geçersiz ya da bu işe yetkisiz. Geliştiriciye ilet.";
  }
  if (m.includes("`from`") || m.includes("from field")) {
    return "Gönderen adresi sağlayıcının kabul ettiği biçimde değil (ad@alanadi.com).";
  }
  if (m.includes("`to`") || m.includes("to field")) {
    return "Alıcı adresi sağlayıcının kabul ettiği biçimde değil.";
  }
  if (m.includes("quota")) {
    return "Sağlayıcının gönderim kotası doldu; kota yenilenince yeniden dene.";
  }
  if (status === 429) {
    return "Sağlayıcı şu an çok fazla istek alıyor; biraz sonra yeniden dene.";
  }
  if (status >= 500) {
    return "E-posta sağlayıcısı şu an yanıt vermiyor; biraz sonra yeniden dene.";
  }
  return message
    ? `E-posta sağlayıcısı iletiyi kabul etmedi (HTTP ${status}). Sağlayıcının yanıtı: ${message}`
    : `E-posta sağlayıcısı iletiyi kabul etmedi (HTTP ${status}).`;
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
    button: {
      label: "AYARLARA DÖN",
      url: `${SITE.url}/admin/ayarlar?sekme=email`,
    },
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
  {
    retryOnce,
    attachments,
    deadline,
  }: {
    retryOnce?: boolean;
    attachments?: readonly MailAttachment[];
    deadline?: number;
  } = {},
): Promise<SendResult> {
  if (!to) return { ok: false, error: "Alıcı adresi boş." };
  // Ayarlar's phone, address and hours for the footer; the caller's own
  // fields still win.
  const venue = await loadVenueVars();
  let r: RenderedEmail;
  try {
    r = renderEmail(name, {
      ...input,
      vars: { ...venue, ...input.vars },
      text: EMAIL_TEXT[name],
    });
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
    ...(retryOnce ? { retryOnce } : {}),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    ...(deadline !== undefined ? { deadline } : {}),
  });
}

/**
 * The confirmed contract that rides with a confirmation mail
 * (src/lib/legal/durable-copy-load.ts `DurableCopy`): the file, and each
 * document's version page for the sentence under it.
 */
export interface MailDurableCopy {
  filename: string;
  html: string;
  links: readonly { slug: string; title: string; url: string }[];
}

/**
 * A refusal that proves nothing was sent: a 4xx other than 429 and 409. A
 * 409 is about the idempotency key, not the message: another request under
 * it is still being processed, or one with another body was taken. Either
 * way a message under that key exists, and a second one under another key
 * would be a second copy in the inbox.
 */
function refusedOutright(result: SendResult): boolean {
  return (
    !result.ok &&
    typeof result.status === "number" &&
    result.status >= 400 &&
    result.status < 500 &&
    result.status !== 429 &&
    result.status !== 409
  );
}

/**
 * Sends a confirmation with its contract attached, and, when the provider
 * refuses that message outright (a 4xx: the attachment's size or type, say),
 * the same confirmation without it, saying the old sentence (`plain`). The
 * copy must never cost the customer the mail itself (ASK-DURABLE). Nothing
 * is resent after a timeout or a 5xx: that request may have been delivered,
 * and the caller's own retry (with the same key) settles it. The second
 * message gets a key of its own: the first one's was refused, not used.
 */
async function sendWithCopy(
  label: string,
  copy: MailDurableCopy,
  send: (
    attachments: readonly MailAttachment[] | null,
    keySuffix: string,
  ) => Promise<SendResult>,
  deadline?: number,
): Promise<SendResult> {
  const first = await send([htmlAttachment(copy.filename, copy.html)], "");
  if (first.ok || !refusedOutright(first)) return first;
  if (msLeft(deadline) < MIN_ATTEMPT_MS) return first;
  console.warn(
    `[email] ${label}: refused with the contract attached (HTTP ${first.ok ? "" : first.status}); sent without it`,
  );
  return send(null, "-ek-yok");
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

// ── Account deletion (18 Eki 2026) ────────────────────────────────────────
//
// On the web an account is deleted by the team on the member's request
// (/uye/hesap/sil); the app keeps its own immediate deletion. Both mails
// are transactional - the answer to a KVKK application (m.13, Silme
// Yönetmeliği m.12: "ilgili kişiye bilgi verir") - so neither carries an
// unsubscribe link (rule 19).

/** "Talebin bize ulaştı": the member's request is on record. */
export async function sendDeletionRequestReceivedEmail(
  to: string,
  d: {
    /** Already formatted: "18 Ekim 2026". */
    requestedOn: string;
    /** The last day of the thirty, formatted the same way. */
    deadline: string;
    /** Where the member sees (and can take back) the request. */
    requestUrl: string;
    /** `account-deletion-<id>-<stamp>`: a repeated send mails once. */
    idempotencyKey: string;
  },
): Promise<SendResult> {
  return sendTemplateResult(
    "hesap-silme-talebi",
    to,
    {
      vars: {
        TALEP_TARIHI: d.requestedOn,
        SON_GUN: d.deadline,
        TALEP_URL: d.requestUrl,
      },
    },
    d.idempotencyKey,
  );
}

/**
 * "Hesabın silindi" once the team closed the account from the panel. Sent
 * to the address the account had, read before the closure erased it.
 *
 * `complete` is false when the sign-in identity (e-mail and name at the
 * auth provider) is still there: the mail then says "kapatıldı", not
 * "silindi", and that the team finishes the rest - the same rule the site
 * and the app follow for their own closure notice (`accountClosureParam`).
 */
export async function sendAccountDeletedEmail(
  to: string,
  d: { complete: boolean; idempotencyKey: string },
): Promise<SendResult> {
  return sendTemplateResult(
    "hesap-silindi",
    to,
    {
      vars: {
        SONUC: d.complete ? "hesabın silindi" : "hesabın kapatıldı",
        SONUC_BASLIK: d.complete ? "Hesabın silindi" : "Hesabın kapatıldı",
        PROSEDUR_URL: `${SITE.url}/hukuk/hesap-silme`,
      },
      flags: { KIMLIK_KALDI: !d.complete },
    },
    d.idempotencyKey,
  );
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
  /** The code's discount, if any; lets the rows above the total add up. */
  discountMinor?: number;
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
  const discount = Math.max(0, o.discountMinor ?? 0);
  const shipping =
    o.shippingMinor ?? Math.max(0, o.totalMinor - subtotal + discount);
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
    // "" drops the discount row (`INDIRIM_SATIRI`, render.ts).
    INDIRIM: discount > 0 ? `-${formatTRYMinor(discount)}` : "",
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
  o: OrderEmailData & {
    stampsEarned?: number;
    /**
     * The confirmed Ön Bilgilendirme Formu and Mesafeli Satış Sözleşmesi,
     * filled with the order (ASK-DURABLE): attached, with each document's
     * version page under the sentence that says so. Absent or null: the
     * mail says what the links are (`BELGE_GUNCEL`), as before.
     */
    durableCopy?: MailDurableCopy | null;
  },
  idempotencyKey?: string,
  { deadline }: { deadline?: number } = {},
): Promise<SendResult> {
  const stamps = Math.max(0, Math.round(Number(o.stampsEarned ?? 0)) || 0);
  const vars = {
    ...orderVars(o),
    DAMGA_HEDEFI: await stampTarget(),
    DAMGA_SAYISI: stamps > 0 ? String(stamps) : "",
  };
  const loops = { ITEMS: itemRows(o.items) };
  const copyVars = o.durableCopy ? orderCopyVars(o.durableCopy) : null;
  const send = (
    attachments: readonly MailAttachment[] | null,
    keySuffix: string,
  ) =>
    sendTemplateResult(
      "odeme-onaylandi",
      o.to,
      // render.ts opens the copy's sentence only with this flag and both
      // links, and the old line otherwise.
      attachments && copyVars
        ? { vars: { ...vars, ...copyVars }, loops, flags: { BELGE_EKI: true } }
        : { vars, loops },
      idempotencyKey ? `${idempotencyKey}${keySuffix}` : undefined,
      // The one mail the customer gets before the parcel: worth one more
      // try, inside the caller's budget (`MAIL_BUDGET.paid`).
      {
        retryOnce: true,
        ...(attachments ? { attachments } : {}),
        ...(deadline !== undefined ? { deadline } : {}),
      },
    );
  if (!o.durableCopy || !copyVars) return send(null, "");
  return sendWithCopy(
    `odeme-onaylandi #${o.orderNo}`,
    o.durableCopy,
    send,
    deadline,
  );
}

/**
 * The version links under the paid mail's sentence: one per confirmed
 * document, both or none (a copy without either link is not offered).
 */
function orderCopyVars(copy: MailDurableCopy): Record<string, string> | null {
  const url = (slug: string) =>
    copy.links.find((l) => l.slug === slug)?.url ?? "";
  const obf = url(CHECKOUT_CONSENT_DOCS[0]);
  const mss = url(CHECKOUT_CONSENT_DOCS[1]);
  if (!obf || !mss) return null;
  return {
    BELGE_OBF_URL: obf,
    BELGE_MSS_URL: mss,
    BELGE_SURUMLERI: [
      `- Ön Bilgilendirme Formu: ${obf}`,
      `- Mesafeli Satış Sözleşmesi: ${mss}`,
    ].join("\n"),
  };
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

/**
 * "Siparişin hazır": a pickup order is at the counter and no phone
 * notification reached the member (src/lib/push/order-push.ts). Once per
 * order; transactional, so no unsubscribe link (src/lib/email/render.ts).
 */
export async function sendOrderReadyEmail(
  d: { to: string; customerName: string; orderNo: number },
  idempotencyKey?: string,
): Promise<SendResult> {
  return sendTemplateResult(
    "siparis-hazir",
    d.to,
    {
      vars: {
        AD: d.customerName.trim(),
        SIPARIS_NO: String(d.orderNo),
        SIPARIS_URL: orderUrl(d.orderNo),
      },
    },
    idempotencyKey,
  );
}

/**
 * The e-Arşiv invoice, its PDF attached (docs/EARSIV.md): sent once per
 * invoice by the e-Arşiv run (src/lib/invoice/run.ts), which keeps
 * `invoices."emailedAt"` and passes `earsiv-<invoice id>` as the
 * idempotency key, so a retry after a lost answer is not a second copy.
 * Transactional (VUK: the invoice reaches the buyer), no unsubscribe link.
 */
export async function sendInvoiceEmail(d: InvoiceMail): Promise<SendResult> {
  const order = d.kind === "order" && d.orderNo !== null;
  const amount = formatTRYMinor(d.amountMinor);
  return sendTemplateResult(
    "e-arsiv-fatura",
    d.to,
    {
      vars: {
        AD: d.customerName.trim(),
        FATURA_REF: order ? d.ref : `Karaoke, ${d.ref}`,
        FATURA_KONU: order
          ? `${d.ref} numaralı siparişiniz`
          : `${d.ref} tarihli karaoke odası rezervasyonunuz`,
        FATURA_NO: d.invoiceNo.trim() || "-",
        FATURA_TARIHI: d.invoiceDay,
        FATURA_TUTAR: amount,
        BUTON_METIN: order ? "SİPARİŞİMİ GÖRÜNTÜLE" : "KARAOKE ODASI",
        BUTON_URL: order ? orderUrl(d.orderNo as number) : `${SITE.url}/karaoke`,
      },
    },
    d.idempotencyKey,
    {
      retryOnce: true,
      attachments: [{ filename: d.filename, content: d.pdfBase64 }],
    },
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
  /**
   * How the evening is paid for (16 Eki 2026). `online`: by card when it was
   * booked, `paidMinor` collected - the confirmation is then also the
   * receipt and carries the cancellation terms (MSY m.5/2: the pre-
   * information is part of the contract, on a durable medium). `venue`: at
   * the köşk, the old flow. Absent reads as `venue`.
   */
  payment?: { kind: "online"; paidMinor: number } | { kind: "venue" };
  /**
   * Cancellation only: what went back to the card (the whole payment, or a
   * late cancel's share once the köşk refunded it). Absent on a booking
   * nothing was collected for; the message then says so.
   */
  refundedMinor?: number;
  /**
   * Cancellation only: a late cancel's share that is owed back and not
   * refunded yet (PayNkolay refunds whole payments only, so the köşk refunds
   * it by hand). The message says how much goes back, without a date.
   */
  refundOwedMinor?: number;
  /**
   * The refund (made or owed) is a late cancel's share, not the whole
   * payment: the message names the rule it comes from.
   */
  refundIsShare?: boolean;
  /**
   * Cancellation only: this refund is what an hour cancelled late and sold
   * again gave back, on top of a late share already refunded
   * (`refundedMinor` is then that part alone, karaoke-make-good-core.ts).
   */
  refundIsResaleTopUp?: boolean;
  /**
   * Cancellation only: what went back in this one refund holds both the
   * late share and the part an hour cancelled late and sold again gave
   * back (`refundedMinor` is their sum).
   */
  refundIncludesResale?: boolean;
  /**
   * Cancellation only: what went back is only what an hour cancelled late
   * and sold again gave back, the late cancel having kept the whole payment
   * (a late share of 0, 29 Eki 2026): no late share is in it.
   */
  refundIsResaleOnly?: boolean;
  /**
   * Cancellation only: a guest's late request under a late share of 0,
   * taken before the start (29 Eki 2026): cancelled with nothing refunded,
   * the hours back on sale, and an hour sold again refunds what was kept
   * for it (karaoke terms §7).
   */
  releasedForResale?: boolean;
  /**
   * Cancellation only: the köşk cancelled late for its own reason and makes
   * it good (karaoke terms §8): `minor` kuruş, as a free hour of the same
   * length booked by `until` ("19 Nisan 2027") or paid to the guest's own
   * bank account.
   */
  makeGood?: { minor: number; until: string };
  /**
   * Confirmation only: a free hour the köşk gave to make good the booking
   * with this code. Nothing is paid for it.
   */
  makeGoodHourFor?: string;
  /**
   * The booking's own cancellation rule (its snapshot, 18 Eki 2026): the two
   * sentences a paid booking's confirmation prints, and until when a booking
   * paid at the venue may still be cancelled on its page (null: it may not,
   * the member calls). Absent: the default rule, 2 hours.
   *
   * `freeUntil`: the booking's last free-cancel moment on the köşk's clock
   * ("30 Ekim 2026, 18:00"), which the karaoke terms §7 say the
   * confirmation carries (19 Eki 2026).
   */
  cancellation?: {
    rules: readonly [string, string];
    venueUntil: string | null;
    freeUntil?: string;
  };
  /**
   * Cancellation only: why the köşk cancelled a paid booking (the panel's
   * fixed list, karaoke-cancel-cause.ts). A business reason opens with it
   * and an apology (the MSY m.16/4 notice), a guest's request with "İsteğin
   * üzerine", an hour given to another guest says so. Absent: the member's
   * own cancel, an account closure, an unpaid booking - today's words.
   */
  cancelCause?: KaraokeCancelCause;
  /**
   * The booking's own page: its signed link (karaoke-link.ts), so a guest
   * without an account - and a member on a phone without the app - can see
   * and cancel it. Falls back to the karaoke page when no link can be made.
   */
  manageUrl?: string;
  /**
   * Confirmation of a booking paid online: the confirmed Karaoke Odası Ön
   * Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi, filled with the
   * booking (ASK-DURABLE), attached, with its version page. Absent or null:
   * the terms' page is linked, as before.
   */
  durableCopy?: MailDurableCopy | null;
  /**
   * The confirmation's time budget (epoch ms, `MAIL_BUDGET.karaoke` from
   * when the copy was asked for): it is awaited inside the payment return.
   */
  deadline?: number;
}

/** The default rule's pay-at-the-venue window, worded for the sentence. */
const DEFAULT_VENUE_UNTIL =
  karaokeVenueCancelUntil(DEFAULT_KARAOKE_CANCEL_POLICY) ?? "";

/** The default rule's last free moment, when no instant was given. */
const DEFAULT_FREE_UNTIL =
  "rezervasyonu yaptıktan 2 saat sonra (en geç rezervasyon saatinden bir dakika önce)";

function karaokeVars(k: KaraokeEmailData) {
  const amount =
    k.refundedMinor ??
    k.refundOwedMinor ??
    (k.payment?.kind === "online" ? k.payment.paidMinor : 0);
  const rules = k.cancellation?.rules ?? [
    KARAOKE_REFUND_RULE,
    KARAOKE_NO_REFUND_RULE,
  ];
  return {
    AD: k.name.trim(),
    KARAOKE_TARIH: k.date,
    KARAOKE_SAAT: k.time,
    KARAOKE_KISI: `${k.guests} kişi`,
    // `toUpperCase` rather than the Turkish-locale one on purpose: the id is
    // ASCII (`krk-00042`), and tr-TR would turn an "i" into "İ" if one ever
    // appeared in it.
    KARAOKE_KOD: k.code.toUpperCase(),
    KARAOKE_TUTAR: formatTRYMinor(amount),
    KARAOKE_LINK: k.manageUrl || `${SITE.url}/karaoke`,
    // The confirmation's rule: the booking's own sentences, verbatim.
    KARAOKE_IADE_KURALI: rules[0],
    KARAOKE_GEC_KURALI: rules[1],
    KARAOKE_MEKAN_SURE: k.cancellation
      ? (k.cancellation.venueUntil ?? "")
      : DEFAULT_VENUE_UNTIL,
    KARAOKE_SON_IPTAL: k.cancellation?.freeUntil || DEFAULT_FREE_UNTIL,
    // A business cancel's reason, in the guest's words; never the note the
    // staff typed (that stays in the audit row).
    KARAOKE_NEDEN: isBusinessCause(k.cancelCause)
      ? KARAOKE_CAUSE_MAIL[k.cancelCause]
      : "",
    // The make-good of a late köşk cancel, and the booking a free hour
    // makes good.
    KARAOKE_TELAFI_TUTAR: formatTRYMinor(k.makeGood?.minor ?? 0),
    KARAOKE_TELAFI_SON: k.makeGood?.until ?? "",
    KARAOKE_TELAFI_KOD: (k.makeGoodHourFor ?? "").toUpperCase(),
  };
}

/**
 * Sent when a karaoke block is confirmed: by the staff (`setReservationStatus`)
 * or, for a booking paid online, by its payment.
 *
 * Transactional: the member asked for the evening and is being told whether
 * they have it. No consent gate, no unsubscribe link - `renderEmail` refuses
 * to put one on this template.
 */
export async function sendKaraokeConfirmationEmail(
  k: KaraokeEmailData,
): Promise<boolean> {
  const online = k.payment?.kind === "online";
  const flags = karaokeConfirmationFlags(k);
  const vars = karaokeVars(k);
  // Only a booking paid online confirmed the terms (its consent is the
  // record the copy is made from); a free hour the köşk gave confirmed none.
  const copy = online ? (k.durableCopy ?? null) : null;
  const versionUrl =
    copy?.links.find((l) => l.slug === KARAOKE_CONSENT_DOCS[0])?.url ?? "";
  const send = (attachments: readonly MailAttachment[] | null) =>
    sendTemplateResult(
      "karaoke-rezervasyon",
      k.to,
      attachments && versionUrl
        ? {
            vars: { ...vars, KARAOKE_SURUM_URL: versionUrl },
            flags: { ...flags, KARAOKE_BELGE_EKI: true },
          }
        : { vars, flags },
      undefined,
      {
        ...(attachments ? { attachments } : {}),
        ...(k.deadline !== undefined ? { deadline: k.deadline } : {}),
      },
    );
  if (!copy || !versionUrl) return (await send(null)).ok;
  return (
    await sendWithCopy(
      `karaoke-rezervasyon ${k.code}`,
      copy,
      (attachments) => send(attachments),
      k.deadline,
    )
  ).ok;
}

/**
 * Which payment block a confirmation prints: exactly one. Exported for
 * tests.
 */
export function karaokeConfirmationFlags(
  k: Pick<KaraokeEmailData, "payment" | "cancellation" | "makeGoodHourFor">,
): Record<string, boolean> {
  const online = k.payment?.kind === "online";
  // A free hour the köşk gave is not paid at the köşk either.
  const makeGood = !online && Boolean(k.makeGoodHourFor);
  // A booking paid at the venue says until when its page cancels it, or -
  // under a rule with no window and no late cancel - to call instead.
  const selfCancel = k.cancellation ? k.cancellation.venueUntil !== null : true;
  return {
    KARAOKE_ODENDI: online,
    KARAOKE_TELAFI_SAATI: makeGood && selfCancel,
    KARAOKE_TELAFI_SAATI_ARA: makeGood && !selfCancel,
    KARAOKE_ODEME_MEKANDA: !online && !makeGood && selfCancel,
    KARAOKE_MEKAN_ARA: !online && !makeGood && !selfCancel,
  };
}

/**
 * Sent when a karaoke block is cancelled - by the staff, by the member, or
 * when an account closes. Transactional for the same reason as the
 * confirmation, and more urgently: without it the member finds out at the
 * door. A refund says how much went back (MSY m.16/4 asks the business to
 * tell the member when it cannot honour the booking; this is that notice).
 */
export async function sendKaraokeCancellationEmail(
  k: KaraokeEmailData,
): Promise<boolean> {
  return sendTemplate("karaoke-iptal", k.to, {
    vars: karaokeVars(k),
    flags: karaokeCancellationFlags(k),
  });
}

/**
 * Which opening and which money line a cancellation prints: exactly one of
 * each (or no money line, when nothing was paid and nothing said so).
 * Exported for tests.
 */
export function karaokeCancellationFlags(
  k: Pick<
    KaraokeEmailData,
    | "refundedMinor"
    | "refundOwedMinor"
    | "refundIsShare"
    | "refundIsResaleTopUp"
    | "refundIncludesResale"
    | "refundIsResaleOnly"
    | "releasedForResale"
    | "payment"
    | "cancelCause"
    | "makeGood"
  >,
): Record<string, boolean> {
  const refunded = k.refundedMinor !== undefined;
  const owed = !refunded && k.refundOwedMinor !== undefined;
  const share = k.refundIsShare === true;
  // Nothing went back and the hours are on sale (a late share of 0).
  const released = !refunded && !owed && k.releasedForResale === true;
  // Only the resale part went back now: the late share already had its mail.
  const resale = refunded && share && k.refundIsResaleTopUp === true;
  // The first resale part of a late cancel that kept everything.
  const resaleOnly =
    refunded && share && !resale && k.refundIsResaleOnly === true;
  // The share and the resale part went back in one refund.
  const shareAndResale =
    refunded &&
    share &&
    !resale &&
    !resaleOnly &&
    k.refundIncludesResale === true;
  const business = isBusinessCause(k.cancelCause);
  const request = k.cancelCause === "misafir";
  // The hour went to another guest: the line says so, and the whole payment
  // went back with it.
  const resold = k.cancelCause === "yeniden" && refunded && !share;
  return {
    KARAOKE_IPTAL_GENEL: !business && !request && !resold,
    KARAOKE_ISLETME: business,
    KARAOKE_ISTEK: request,
    KARAOKE_YENIDEN: resold,
    // The member's own cancel keeps its words; ours say "iade ettik".
    KARAOKE_IADE: refunded && !share && !business && !request && !resold,
    KARAOKE_TAM_IADE: refunded && !share && (business || request),
    KARAOKE_KISMI_IADE_EDILDI:
      refunded && share && !resale && !resaleOnly && !shareAndResale,
    KARAOKE_KISMI_SATIS_IADE_EDILDI: shareAndResale,
    KARAOKE_SATIS_IADE: resale,
    KARAOKE_SATIS_IADE_EDILDI: resaleOnly,
    KARAOKE_KISMI_IADE: owed,
    KARAOKE_SATISA_ACILDI: released,
    KARAOKE_ODEMESIZ:
      !refunded && !owed && !released && k.payment?.kind !== "online",
    // The make-good of a late köşk cancel (karaoke terms §8), beside the
    // money line, never instead of it.
    KARAOKE_TELAFI: (k.makeGood?.minor ?? 0) > 0 && Boolean(k.makeGood?.until),
  };
}

/**
 * A guest asked by phone or e-mail to cancel after their free moment, and
 * the booking's rule refunds nothing then (ASK-Y3-4 (c)): it is NOT
 * cancelled. This tells them so, that the booking stands in their name, that
 * they may hand the code to someone else, and that the whole payment comes
 * back if the köşk gives the hour to another guest (karaoke terms §7).
 * Transactional, like the other two.
 */
export async function sendKaraokeLateRequestEmail(
  k: KaraokeEmailData,
): Promise<boolean> {
  return sendTemplate("karaoke-iptal-istegi", k.to, {
    vars: karaokeVars(k),
  });
}

/** A booking the staff moved: where its evening was before. */
export interface KaraokeRescheduleEmailData extends KaraokeEmailData {
  /** Already formatted, as `date` and `time`: "30 Ekim 2026", "20:00 - 22:00". */
  previous: { date: string; time: string };
}

/**
 * Sent when the staff move a karaoke booking to another day or hour
 * (`rescheduleReservation`, operator 27 Eki 2026): the new evening, the old
 * one beside it, and the booking's page. Transactional - the member is told
 * where their evening now is; no consent gate, no unsubscribe link.
 */
export async function sendKaraokeRescheduleEmail(
  k: KaraokeRescheduleEmailData,
): Promise<boolean> {
  return sendTemplate("karaoke-saat-degisikligi", k.to, {
    vars: {
      ...karaokeVars(k),
      KARAOKE_ESKI_TARIH: k.previous.date,
      KARAOKE_ESKI_SAAT: k.previous.time,
    },
    flags: karaokeRescheduleFlags(k),
  });
}

/**
 * Which payment line the move prints: exactly one. Paid online: the payment
 * holds for the new evening, under the booking's own cancellation rule; a
 * free hour the köşk gave: nothing is paid; else it is paid at the köşk.
 * Exported for tests.
 */
export function karaokeRescheduleFlags(
  k: Pick<KaraokeEmailData, "payment" | "makeGoodHourFor">,
): Record<string, boolean> {
  const online = k.payment?.kind === "online";
  const makeGood = !online && Boolean(k.makeGoodHourFor);
  return {
    KARAOKE_ODENDI: online,
    KARAOKE_TELAFI_SAATI: makeGood,
    KARAOKE_ODEME_MEKANDA: !online && !makeGood,
  };
}

/**
 * What the counter needs to know about a booking that was just taken.
 *
 * Deliberately not `KaraokeEmailData`: that one is the MEMBER's confirmation
 * and its template says "Saatin ayrıldı". A reservation arrives with
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
  /** Booked without an account (the contact was typed, not verified). */
  guest?: boolean;
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
      {
        label: k.guest ? "Misafir (üyeliksiz)" : "Üye",
        value: k.customerName.trim() || "-",
      },
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

/** A booking that was just paid online and so confirmed itself. */
export interface KaraokePaidNotice {
  id: string;
  source: "app" | "web";
  customerName: string;
  customerEmail: string;
  phone?: string;
  /** Already formatted for a reader: "12 Eylül 2026", "20:00 - 22:00". */
  date: string;
  time: string;
  guests: number;
  /** What the POS collected, kuruş. */
  paidMinor: number;
  note: string;
  /** Booked without an account (the contact was typed, not verified). */
  guest?: boolean;
}

/**
 * Tells the köşk that a karaoke evening is paid for and booked.
 *
 * The other half of "member and staff get mail" (operator, 16 Eki 2026): a
 * paid booking confirms itself, so nobody has to press Onayla - but somebody
 * has to know the room is taken. No "requested" notice precedes it: an
 * unpaid hold is not a booking yet, and most of the ones that lapse are
 * somebody changing their mind at the card form. Internal mail, like
 * `sendKaraokeOperatorEmail`; reply-to is the member.
 */
export async function sendKaraokePaidOperatorEmail(
  k: KaraokePaidNotice,
): Promise<SendResult> {
  const { getSettings } = await import("@/lib/admin/store");
  const to = karaokeNoticeRecipient(await getSettings());
  if (!to)
    return { ok: false, error: "Ayarlar'da bildirim adresi tanımlı değil." };

  const origin = k.source === "web" ? "Web sitesinden" : "Uygulamadan";
  return sendOperatorNotice({
    to,
    subject: `Karaoke ödendi · ${k.date} ${k.time} · ${k.guests} kişi (${k.id})`,
    summary: `${origin} ödendi ve kesinleşti: ${k.date} · ${k.time} · ${k.guests} kişi`,
    label: "KARAOKE · ÖDENDİ",
    title: "Karaoke rezervasyonu kesinleşti",
    subtitle: `${origin} · ödeme alındı, rezervasyon kendiliğinden onaylandı`,
    rows: [
      { label: "Rezervasyon", value: k.id },
      { label: "Tarih", value: k.date },
      { label: "Saat", value: k.time },
      { label: "Kişi", value: String(k.guests) },
      { label: "Ödenen", value: formatTRYMinor(k.paidMinor) },
      {
        label: k.guest ? "Misafir (üyeliksiz)" : "Üye",
        value: k.customerName.trim() || "-",
      },
      { label: "E-posta", value: k.customerEmail },
      { label: "Telefon", value: k.phone ?? "" },
    ],
    ...(k.note.trim()
      ? { note: { label: "ÜYENİN NOTU", text: k.note.trim() } }
      : {}),
    button: { label: "PANELDE GÖR", url: `${SITE.url}/admin/mobil/karaoke` },
    footnote:
      "Ödeme PayNkolay'dan doğrulandı; ayrıca onaylaman gerekmez. İptal edilirse tutarın tamamı karta iade edilir. Bu e-postayı yanıtlarsan doğrudan üyeye yazarsın.",
    replyTo: k.customerEmail,
    // The browser return and the sweep may both book the same payment.
    idempotencyKey: `karaoke-${k.id}-paid`,
  });
}

/** Karaoke money that needs a person. */
export interface KaraokeMoneyAlert {
  /** The reservation, `krk-00042`. */
  id: string;
  /** Short and specific: what happened to which money. */
  title: string;
  summary: string;
  rows: Array<{ label: string; value: string }>;
  /** What the person should do now. */
  footnote: string;
  /**
   * Names the event in the idempotency key (`karaoke-<id>-<key>`), so the
   * same alert raised by a repeated return is mailed once.
   */
  key: string;
}

/**
 * The operator's inbox for karaoke payments that did not resolve on their
 * own: a refund the POS refused, a refund whose answer never came, a second
 * charge, a payment that arrived for a booking that no longer exists. Each
 * one is also an audit row; this is how a person hears about it the same day
 * rather than at the next audit-log read.
 */
export async function sendKaraokeMoneyAlertEmail(
  a: KaraokeMoneyAlert,
): Promise<SendResult> {
  const { getSettings } = await import("@/lib/admin/store");
  const to = karaokeNoticeRecipient(await getSettings());
  if (!to)
    return { ok: false, error: "Ayarlar'da bildirim adresi tanımlı değil." };
  return sendOperatorNotice({
    to,
    subject: `Karaoke ödeme kontrolü · ${a.title} (${a.id})`,
    summary: a.summary,
    label: "KARAOKE · ÖDEME KONTROLÜ",
    title: a.title,
    subtitle: a.summary,
    rows: [{ label: "Rezervasyon", value: a.id }, ...a.rows],
    button: { label: "PANELDE AÇ", url: `${SITE.url}/admin/mobil/karaoke` },
    footnote: a.footnote,
    idempotencyKey: `karaoke-${a.id}-${a.key}`,
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
      signal: AbortSignal.timeout(MAIL_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[email] Resend batch ${idempotencyKey} failed (${res.status}): ${maskAddressesIn(text).slice(0, 300)}`,
      );
      const retryAfterMs = parseRetryAfter(res);
      return {
        ok: false,
        error: resendErrorText(res.status, text),
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
