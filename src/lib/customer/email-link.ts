// Client-safe and edge-safe: imported by src/proxy.ts, the page and its action.

/**
 * The sign-up mail's confirmation link (Supabase "Confirm signup" template,
 * docs/email/supabase-confirm-signup.html):
 * `/uygulama/dogrula?token_hash=<{{ .TokenHash }}>&type=email`.
 *
 * The SAME address the app's `uygulama/dogrula` screen renders: an iPhone
 * with the app opens the app once the association claims `/uygulama/*`
 * (src/lib/mobile/app-links.ts), and anywhere else this page confirms on a
 * button press. Called from mail already sent: the path never changes.
 */
export const EMAIL_LINK_PATH = "/uygulama/dogrula";

/**
 * The cookie the link's token moves into before the page renders, as the
 * password reset and newsletter tokens do: the page loads the site's tags,
 * and GTM's (GA4's page_location, any pixel's `dl`) report the full URL with
 * its query string. httpOnly, scoped to this path, and a day (the mail says
 * the link lives 24 hours; Supabase refuses an older token itself).
 */
export const EMAIL_LINK_COOKIE = "laffogato_email_link";
export const EMAIL_LINK_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

/** The two names Supabase's verify accepts for a sign-up confirmation. */
export type EmailLinkType = "email" | "signup";

export interface EmailLink {
  tokenHash: string;
  type: EmailLinkType;
}

/**
 * A link's token, or null. A Supabase token hash is hex (56 characters
 * today), optionally prefixed `pkce_`; anything else is a mangled or foreign
 * link and costs no request.
 */
export function parseEmailLink(
  tokenHash: string | null | undefined,
  type: string | null | undefined,
): EmailLink | null {
  const hash = (tokenHash ?? "").trim();
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(hash)) return null;
  const kind = (type ?? "email").trim() || "email";
  if (kind !== "email" && kind !== "signup") return null;
  return { tokenHash: hash, type: kind };
}

/** "email:<hash>": what the cookie holds. */
export function encodeEmailLink(link: EmailLink): string {
  return `${link.type}:${link.tokenHash}`;
}

export function decodeEmailLink(
  value: string | null | undefined,
): EmailLink | null {
  const raw = value ?? "";
  const at = raw.indexOf(":");
  if (at === -1) return null;
  return parseEmailLink(raw.slice(at + 1), raw.slice(0, at));
}
