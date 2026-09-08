import "server-only";

import { randomBytes } from "node:crypto";

import { disableCustomerMarketingByEmail } from "@/lib/customer/unsubscribe";
import { getDb, TABLES } from "@/lib/db";

export type NewsletterSource = "footer" | "register" | "account";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  source: NewsletterSource;
  isActive: boolean;
  createdAt: string;
  unsubscribedAt: string;
  /**
   * 6563 sayılı kanunun aradığı onay kaydı: ne zaman, nereden, hangi metne.
   * Şikâyet hâlinde onayın varlığını ispat yükümlülüğü hizmet sağlayıcıdadır.
   */
  consentAt: string;
  consentIp: string;
  consentText: string;
  /** Tek tıkla çıkış bağlantısının taşıdığı jeton. */
  unsubToken: string;
}

/**
 * Onay kutusunun yanında görünen metin, kayda birebir yazılır — hangi ifadeye
 * onay verildiği, onayın kendisi kadar önemli.
 */
export const NEWSLETTER_CONSENT_TEXT =
  "L'Affogato'dan kampanya, yeni ürün ve etkinlik duyurularını e-posta ile almak istiyorum. Onayımı istediğim zaman geri çekebileceğimi biliyorum.";

export interface ConsentRecord {
  /** ISO-8601; boş bırakılamaz — onaysız kayıt açılmaz. */
  at: string;
  ip: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function newUnsubToken(): string {
  return randomBytes(24).toString("hex");
}

export type SubscribeResult =
  | { ok: true; already: boolean }
  | { ok: false; error: string };

/**
 * Idempotent newsletter signup. New e-mail → insert; previously-unsubscribed →
 * reactivate; already-active → no-op (already=true). Safe to call from anywhere
 * (footer, registration, account toggle).
 */
export async function subscribeNewsletter(
  rawEmail: string,
  name = "",
  source: NewsletterSource = "footer",
  consent?: ConsentRecord,
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Geçerli bir e-posta gir." };
  }
  // Onay olmadan ticari elektronik ileti listesine kayıt yapılmaz.
  if (!consent?.at) {
    return { ok: false, error: "Devam etmek için onay kutusunu işaretle." };
  }
  const sb = getDb();
  const { data: existing, error: selErr } = await sb
    .from(TABLES.newsletterSubscribers)
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (selErr) throw new Error(`subscribeNewsletter.select: ${selErr.message}`);

  const now = new Date().toISOString();
  if (existing) {
    const row = existing as NewsletterSubscriber;
    if (row.isActive) return { ok: true, already: true };
    const { error } = await sb
      .from(TABLES.newsletterSubscribers)
      .update({
        isActive: true,
        unsubscribedAt: "",
        name: name.trim() || row.name,
        // Yeniden abonelik yeni bir onaydır; eskisinin üstüne yazılır.
        consentAt: consent.at,
        consentIp: consent.ip,
        consentText: NEWSLETTER_CONSENT_TEXT,
        unsubToken: row.unsubToken || newUnsubToken(),
      })
      .eq("id", row.id);
    if (error)
      throw new Error(`subscribeNewsletter.reactivate: ${error.message}`);
    return { ok: true, already: false };
  }

  const subscriber: NewsletterSubscriber = {
    id: `nws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email,
    name: name.trim().slice(0, 100),
    source,
    isActive: true,
    createdAt: now,
    unsubscribedAt: "",
    consentAt: consent.at,
    consentIp: consent.ip,
    consentText: NEWSLETTER_CONSENT_TEXT,
    unsubToken: newUnsubToken(),
  };
  const { error } = await sb
    .from(TABLES.newsletterSubscribers)
    .insert(subscriber);
  if (error) {
    // Unique violation = race on email → treat as already subscribed.
    if ((error as { code?: string }).code === "23505") {
      return { ok: true, already: true };
    }
    throw new Error(`subscribeNewsletter.insert: ${error.message}`);
  }
  return { ok: true, already: false };
}

export async function listNewsletterSubscribers(): Promise<
  NewsletterSubscriber[]
> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .select("*")
    .order("createdAt", { ascending: false });
  if (error) throw new Error(`listNewsletterSubscribers: ${error.message}`);
  return (data as NewsletterSubscriber[] | null) ?? [];
}

export async function setNewsletterSubscriberActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.newsletterSubscribers)
    .update({
      isActive,
      unsubscribedAt: isActive ? "" : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`setNewsletterSubscriberActive: ${error.message}`);
}

export async function deleteNewsletterSubscriber(id: string): Promise<boolean> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`deleteNewsletterSubscriber: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

/**
 * Unsubscribe by the token carried in the link.
 *
 * No login and no e-mail entry: the whole point is that withdrawing consent
 * must be at least as easy as giving it. The token is cleared with the same
 * write, so a link is spent once and a shared or leaked one is inert
 * afterwards.
 *
 * Returns the address that was unsubscribed, so the page can confirm which
 * one it was; `null` when the token is unknown or already spent.
 *
 * The same address may also be a member with `marketing` / `newsletter` on.
 * That account is switched off too: the two consent stores used to drift
 * here, and a person who clicked "çıkış" and kept getting campaign mail
 * through the other list is exactly the complaint 6563 exists for.
 */
export async function unsubscribeByToken(
  rawToken: string,
): Promise<string | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .update({
      isActive: false,
      unsubscribedAt: new Date().toISOString(),
      unsubToken: "",
    })
    .eq("unsubToken", token)
    .select("email");
  if (error) throw new Error(`unsubscribeByToken: ${error.message}`);
  const rows = (data as { email: string }[] | null) ?? [];
  const email = rows[0]?.email ?? null;
  if (email) {
    try {
      await disableCustomerMarketingByEmail(email);
    } catch (err) {
      // The subscription itself is already off; the member row is best-effort.
      console.error("[unsubscribeByToken] üye tercihleri kapatılamadı", err);
    }
  }
  return email;
}

/** Unsubscribe by e-mail (used by the public unsubscribe flow). */
export async function unsubscribeNewsletterByEmail(
  rawEmail: string,
): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .update({ isActive: false, unsubscribedAt: new Date().toISOString() })
    .eq("email", email)
    .eq("isActive", true)
    .select("id");
  if (error) throw new Error(`unsubscribeNewsletterByEmail: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}
