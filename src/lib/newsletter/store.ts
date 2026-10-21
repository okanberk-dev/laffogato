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
  /**
   * Double opt-in: set while the address owner has not confirmed yet (the row
   * is inactive until then); cleared when they do.
   */
  confirmToken?: string;
  confirmRequestedAt?: string;
  confirmRequestIp?: string;
}

/** How long a confirmation link stays good (the mail says "7 gün"). */
export const NEWSLETTER_CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Onay kutusunun yanında görünen metin, kayda birebir yazılır - hangi ifadeye
 * onay verildiği, onayın kendisi kadar önemli.
 */
export const NEWSLETTER_CONSENT_TEXT =
  "L'Affogato'dan kampanya, yeni ürün ve etkinlik duyurularını e-posta ile almak istiyorum. Onayımı istediğim zaman geri çekebileceğimi biliyorum.";

export interface ConsentRecord {
  /** ISO-8601; boş bırakılamaz - onaysız kayıt açılmaz. */
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
  | {
      ok: true;
      already: boolean;
      /**
       * Double opt-in: the request was stored but the address is not on the
       * list until its owner confirms. `confirmToken` is what the
       * confirmation link carries (footer) - the account flows activate on
       * e-mail verification instead and ignore it.
       */
      pending?: boolean;
      confirmToken?: string;
    }
  | { ok: false; error: string };

export interface SubscribeOptions {
  /**
   * The address is PROVEN to belong to the person asking - a verified member
   * account, or a Supabase-confirmed app user. Only then does the request
   * subscribe on the spot. Everything else (the footer form, an unverified
   * account) is stored pending and needs the owner's confirmation: anyone
   * can type anyone's address, and 6563 puts the burden of proving consent
   * on us.
   */
  confirmed?: boolean;
}

/**
 * Idempotent newsletter signup. Already-active → no-op (already=true).
 * Otherwise: a `confirmed` request subscribes (insert or reactivate); an
 * unconfirmed one is stored inactive with a confirmation token (double
 * opt-in) - see {@link confirmNewsletterByToken} and
 * {@link confirmPendingNewsletterForEmail}.
 */
export async function subscribeNewsletter(
  rawEmail: string,
  name = "",
  source: NewsletterSource = "footer",
  consent?: ConsentRecord,
  options: SubscribeOptions = {},
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
  if (!options.confirmed) {
    const row = existing as NewsletterSubscriber | null;
    if (row?.isActive) return { ok: true, already: true };
    return requestConfirmation(email, name, source, consent, row);
  }
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
        confirmToken: "",
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

/**
 * The pending half of double opt-in: an inactive row carrying a fresh
 * confirmation token and the request's time and address. A pending row that
 * is asked for again gets a new token (the old link stops working) - the
 * footer's rate limit bounds how often that can happen.
 */
async function requestConfirmation(
  email: string,
  name: string,
  source: NewsletterSource,
  consent: ConsentRecord,
  existing: NewsletterSubscriber | null,
): Promise<SubscribeResult> {
  const sb = getDb();
  const confirmToken = newUnsubToken();
  const requested = {
    confirmToken,
    confirmRequestedAt: consent.at,
    confirmRequestIp: consent.ip,
    consentText: NEWSLETTER_CONSENT_TEXT,
  };
  if (existing) {
    const { error } = await sb
      .from(TABLES.newsletterSubscribers)
      .update({ ...requested, name: name.trim() || existing.name })
      .eq("id", existing.id);
    if (error) throw new Error(`subscribeNewsletter.pending: ${error.message}`);
    return { ok: true, already: false, pending: true, confirmToken };
  }
  const row: NewsletterSubscriber = {
    id: `nws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email,
    name: name.trim().slice(0, 100),
    source,
    isActive: false,
    createdAt: new Date().toISOString(),
    unsubscribedAt: "",
    consentAt: "",
    consentIp: "",
    unsubToken: "",
    ...requested,
  };
  const { error } = await sb.from(TABLES.newsletterSubscribers).insert(row);
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      // Raced another request for the same address: theirs stands.
      return { ok: true, already: false, pending: true };
    }
    throw new Error(`subscribeNewsletter.pending: ${error.message}`);
  }
  return { ok: true, already: false, pending: true, confirmToken };
}

/** Turns a pending row into a subscriber; consent is dated NOW, from `ip`. */
function activation(ip: string, unsubToken: string) {
  return {
    isActive: true,
    unsubscribedAt: "",
    consentAt: new Date().toISOString(),
    consentIp: ip,
    consentText: NEWSLETTER_CONSENT_TEXT,
    unsubToken: unsubToken || newUnsubToken(),
    confirmToken: "",
  };
}

/**
 * The owner clicked "Aboneliğimi onayla". Spends the token (one use), within
 * NEWSLETTER_CONFIRM_TTL_MS of the request. Returns the address, or null for
 * an unknown, spent or expired token.
 */
export async function confirmNewsletterByToken(
  rawToken: string,
  ip: string,
): Promise<string | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .select("*")
    .eq("confirmToken", token)
    .maybeSingle();
  if (error) throw new Error(`confirmNewsletterByToken: ${error.message}`);
  const row = data as NewsletterSubscriber | null;
  if (!row) return null;
  const requestedAt = Date.parse(row.confirmRequestedAt ?? "");
  if (
    !Number.isFinite(requestedAt) ||
    Date.now() - requestedAt > NEWSLETTER_CONFIRM_TTL_MS
  ) {
    return null;
  }
  const upd = await sb
    .from(TABLES.newsletterSubscribers)
    .update(activation(ip, row.unsubToken))
    .eq("id", row.id)
    .eq("confirmToken", token)
    .select("email");
  if (upd.error)
    throw new Error(`confirmNewsletterByToken: ${upd.error.message}`);
  return ((upd.data as { email: string }[] | null) ?? [])[0]?.email ?? null;
}

/**
 * A member verified their e-mail: a request they made from the registration
 * form or the account page while unverified becomes a subscription now. Only
 * a PENDING row (confirmToken set) is touched - never one the person has
 * unsubscribed from.
 */
export async function confirmPendingNewsletterForEmail(
  rawEmail: string,
  ip: string,
): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(`confirmPendingNewsletter: ${error.message}`);
  const row = data as NewsletterSubscriber | null;
  if (!row || row.isActive || !row.confirmToken) return false;
  const upd = await sb
    .from(TABLES.newsletterSubscribers)
    .update(activation(ip, row.unsubToken))
    .eq("id", row.id)
    .neq("confirmToken", "");
  if (upd.error)
    throw new Error(`confirmPendingNewsletter: ${upd.error.message}`);
  return true;
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

/** One subscriber, for the panel's view page; null when there is none. */
export async function getNewsletterSubscriber(
  id: string,
): Promise<NewsletterSubscriber | null> {
  if (!id) return null;
  const { data, error } = await getDb()
    .from(TABLES.newsletterSubscribers)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getNewsletterSubscriber: ${error.message}`);
  return (data as NewsletterSubscriber | null) ?? null;
}

/**
 * The panel can take someone OFF the list, never put them on it. Turning a
 * withdrawn subscriber back on used to reuse their old `consentAt` - consent
 * they had taken back - and put them back in the campaign audience. Only the
 * person can subscribe again (the form, confirmed from their inbox).
 */
export async function deactivateNewsletterSubscriber(
  id: string,
): Promise<boolean> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .update({
      isActive: false,
      unsubscribedAt: new Date().toISOString(),
      confirmToken: "",
    })
    .eq("id", id)
    // An inactive row is left alone: matching it moved the withdrawal date
    // of someone who had unsubscribed by the link to the panel's later click.
    .eq("isActive", true)
    .select("id");
  if (error)
    throw new Error(`deactivateNewsletterSubscriber: ${error.message}`);
  // Whether a row changed: a subscriber deleted, or already off, used to be
  // answered "Abone pasif" all the same.
  return ((data as { id: string }[] | null) ?? []).length > 0;
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
