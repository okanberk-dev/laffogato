import "server-only";

import { getSupabaseAdmin, TABLES } from "@/lib/supabase/server";

export type NewsletterSource = "footer" | "register" | "account";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  source: NewsletterSource;
  isActive: boolean;
  createdAt: string;
  unsubscribedAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
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
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Geçerli bir e-posta gir." };
  }
  const sb = getSupabaseAdmin();
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
  const sb = getSupabaseAdmin();
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
  const sb = getSupabaseAdmin();
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
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`deleteNewsletterSubscriber: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

/** Unsubscribe by e-mail (used by the public unsubscribe flow). */
export async function unsubscribeNewsletterByEmail(
  rawEmail: string,
): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.newsletterSubscribers)
    .update({ isActive: false, unsubscribedAt: new Date().toISOString() })
    .eq("email", email)
    .eq("isActive", true)
    .select("id");
  if (error) throw new Error(`unsubscribeNewsletterByEmail: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}
