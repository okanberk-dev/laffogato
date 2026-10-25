/**
 * Cookie consent state.
 *
 * KVKK treats analytics and marketing cookies as requiring explicit consent,
 * and the site's own Çerez Politikası promises a banner and a preference centre
 * that can be reopened. Strictly necessary cookies (session, cart, CSRF) are
 * out of scope - they carry no consent switch because the site cannot work
 * without them.
 *
 * Client-safe: no server imports, so both the banner and the layout script can
 * use it.
 */

import {
  GOOGLE_TAGS_IN_LEGAL_TEXTS,
  META_PIXEL_IN_LEGAL_TEXTS,
} from "@/lib/legal/meta";

export const CONSENT_COOKIE = "laffogato_cookie_consent";

/** How long a recorded choice stands before we ask again. */
export const CONSENT_MAX_AGE_DAYS = 180;

/**
 * The version a stored choice must carry to stand; any other is discarded
 * and the banner asks again.
 *
 * It moves with the tags the legal texts describe: `GOOGLE_TAGS_IN_LEGAL_TEXTS`
 * and `META_PIXEL_IN_LEGAL_TEXTS`. A yes stored before 19 Ekim 2026 was given
 * to texts that described Google's tags, and one stored since to a panel that
 * showed no tag switch at all; neither is a choice about the Meta Pixel (25
 * Ekim 2026), and the cookie lives 180 days, so turning a tag on discards
 * every stored choice instead of letting it grant from an answer given to
 * other texts. Each shape has a number of its own: 1 no tags, 2 the Meta
 * Pixel, 3 Google's tags, 4 both. Never reuse one for another shape.
 */
export function consentVersionFor(
  googleTags: boolean,
  metaPixel: boolean,
): number {
  return 1 + (metaPixel ? 1 : 0) + (googleTags ? 2 : 0);
}

export const CONSENT_VERSION = consentVersionFor(
  GOOGLE_TAGS_IN_LEGAL_TEXTS,
  META_PIXEL_IN_LEGAL_TEXTS,
);

export interface ConsentState {
  version: number;
  /** ISO-8601 instant the choice was made - evidence the consent was given. */
  decidedAt: string;
  /** Preferences: language, theme, remembered filters. */
  preferences: boolean;
  /** Google Analytics 4 and equivalents. */
  analytics: boolean;
  /** Ad networks, conversion tracking, remarketing. */
  marketing: boolean;
}

/** Nothing granted - what a visitor gets before they choose. */
export const CONSENT_DENIED: Omit<ConsentState, "decidedAt"> = {
  version: CONSENT_VERSION,
  preferences: false,
  analytics: false,
  marketing: false,
};

export function parseConsent(
  raw: string | undefined,
  current: number = CONSENT_VERSION,
): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    // A stored choice from an older shape is not a choice about the current
    // categories, so it is discarded and the banner asks again.
    if (parsed.version !== current) return null;
    if (typeof parsed.decidedAt !== "string") return null;
    return {
      version: current,
      decidedAt: parsed.decidedAt,
      preferences: parsed.preferences === true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return null;
  }
}

/**
 * Whether a raw consent cookie value grants the marketing category. The same
 * validity test as `readConsent`, for code that has the cookie header but no
 * `document` (a Server Action).
 */
export function marketingConsentGranted(raw: string | undefined): boolean {
  return parseConsent(raw)?.marketing === true;
}

export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}

export function writeConsent(
  state: Omit<ConsentState, "decidedAt">,
): ConsentState {
  const full: ConsentState = { ...state, decidedAt: new Date().toISOString() };
  const value = encodeURIComponent(JSON.stringify(full));
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  // Not httpOnly: the banner has to read it back. It carries no personal data,
  // only the three booleans and the timestamp.
  const secure =
    typeof location !== "undefined" && location.protocol === "https:";
  document.cookie =
    `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; samesite=lax` +
    (secure ? "; secure" : "");
  return full;
}

/**
 * Google Consent Mode v2 signal names, mapped from our categories.
 *
 * `security_storage` is always granted: it covers the session and CSRF cookies
 * the site cannot operate without, and consent is not sought for those.
 */
export function toGoogleConsent(state: Omit<ConsentState, "decidedAt"> | null) {
  const granted = (on: boolean | undefined) => (on ? "granted" : "denied");
  return {
    ad_storage: granted(state?.marketing),
    ad_user_data: granted(state?.marketing),
    ad_personalization: granted(state?.marketing),
    analytics_storage: granted(state?.analytics),
    functionality_storage: granted(state?.preferences),
    personalization_storage: granted(state?.preferences),
    security_storage: "granted" as const,
  };
}
