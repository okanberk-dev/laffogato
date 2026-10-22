// Client-safe and edge-safe: imported by src/proxy.ts and the two pages.

/**
 * The newsletter's two links (`/bulten/onay?token=...` in the confirmation
 * mail, `/bulten/cikis?token=...` in every commercial message's footer and
 * behind `/api/bulten/cikis`). Called from mail already sent: the paths never
 * change (CLAUDE.md, "Dışarıdan çağrılan yollar").
 */
export const NEWSLETTER_LINK_PATHS = ["/bulten/onay", "/bulten/cikis"] as const;

export type NewsletterLinkPath = (typeof NEWSLETTER_LINK_PATHS)[number];

/**
 * The cookie each link's token moves into before its page renders, as the
 * password reset token does (lib/customer/reset-link.ts): both pages load
 * the site's tags, and GTM's (GA4's page_location, any pixel's `dl`) report
 * the full URL with its query string. A leaked confirm token lets someone
 * else start the subscription; a leaked unsubscribe token ends it
 * (docs/AUDIT.md §11). The cookie is httpOnly, scoped to its page, and
 * lives an hour: the page only needs it until its button is pressed.
 */
export const NEWSLETTER_LINK_COOKIES: Record<NewsletterLinkPath, string> = {
  "/bulten/onay": "laffogato_bulten_onay",
  "/bulten/cikis": "laffogato_bulten_cikis",
};

export const NEWSLETTER_LINK_COOKIE_MAX_AGE_SECONDS = 60 * 60;

/** Tokens are 48 hex characters; anything far longer is not one of ours. */
export const NEWSLETTER_LINK_TOKEN_MAX_LENGTH = 200;

export function newsletterLinkPath(path: string): NewsletterLinkPath | null {
  return (NEWSLETTER_LINK_PATHS as readonly string[]).includes(path)
    ? (path as NewsletterLinkPath)
    : null;
}
