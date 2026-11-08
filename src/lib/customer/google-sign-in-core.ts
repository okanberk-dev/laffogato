import { sameSitePath } from "@/lib/http/same-site-path";

/**
 * Google sign-in on the website: the pure half (docs/AUTH-BRIDGE.md §7).
 *
 * Supabase Auth is the identity provider for the site and the app alike, so
 * "Google ile devam et" is a Supabase OAuth flow and nothing else: the start
 * route asks Supabase for Google's address (PKCE, the verifier in a cookie),
 * Google hands the member back to Supabase, Supabase hands them back to the
 * return route with a one-time code, and the return route exchanges it for a
 * session and signs the member in with the site's own cookie - exactly what
 * `loginAction` does after a Supabase password sign-in.
 *
 * No I/O here: the routes, the consent page and the bridge decide with these
 * functions, and tests/google-sign-in.test.ts pins them down.
 */

/** The link on /uye/giris and /uye/kayit; a plain `<a>`, see `googleStartHref`. */
export const GOOGLE_START_PATH = "/uye/google";

/**
 * Where Supabase sends the browser back with `?code=`.
 *
 * Same host as the project's Site URL (`https://laffogato.net`), which
 * Supabase accepts without an entry in its Redirect URLs list; the setup
 * guide adds it anyway (lafmobil `docs/GOOGLE-GIRIS.md`), so a Site URL that
 * ever changes does not silently send members back to the home page.
 */
export const GOOGLE_RETURN_PATH = "/uye/google/donus";

/** A new member stops here once, to accept the membership agreement. */
export const GOOGLE_CONSENT_PATH = "/uye/google/onay";

/**
 * What the sign-in page says under `?google=`. Every way the flow can end
 * without signing someone in has a sentence, and none of them says whether
 * an address is registered here.
 */
export const GOOGLE_NOTICES = {
  /** The panel switch is off (Mobil → Ayarlar → Giriş yöntemleri). */
  kapali:
    "Google ile giriş şu an kapalı. E-posta ve şifrenle giriş yapabilirsin.",
  /** The member closed Google's page or said no there. */
  iptal: "Google ile giriş tamamlanmadı. İstersen yeniden dene.",
  /** Supabase or Google refused, or could not be reached. */
  hata: "Google ile giriş şu an yapılamadı. Biraz sonra yeniden dene ya da e-posta ve şifrenle giriş yap.",
  /** The one-time code was spent or the browser lost its verifier cookie. */
  sure: "Google ile girişin süresi doldu. Yeniden dene.",
  /** The Google account shared no e-mail address; a member here is one. */
  eposta:
    "Google hesabın bir e-posta adresi paylaşmadı. E-posta ve şifrenle giriş yapabilirsin.",
  /** The account was closed or deactivated by an admin. */
  devredisi: "Hesabın devre dışı bırakılmış. Lütfen bizimle iletişime geç.",
  /** The sign-in budget of this connection is spent (`customer-login-ip`). */
  cok: "Çok fazla giriş denemesi. Biraz sonra yeniden dene.",
} as const;

export type GoogleNotice = keyof typeof GOOGLE_NOTICES;

/** `?google=` → its sentence, or null for anything this page did not write. */
export function googleNotice(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  return Object.hasOwn(GOOGLE_NOTICES, value)
    ? GOOGLE_NOTICES[value as GoogleNotice]
    : null;
}

/** `?next=` kept only as a path on this site (CLAUDE.md rule 26). */
function withNext(path: string, next: unknown): string {
  const target = sameSitePath(next);
  return target ? `${path}?next=${encodeURIComponent(target)}` : path;
}

/**
 * The start link. A plain `<a href>`, never a `<form>`: the site's CSP sets
 * `form-action 'self'`, and browsers apply it to the redirect a form
 * submission follows - the hop to Supabase and on to Google would be
 * blocked. A navigation by link is not subject to it.
 */
export function googleStartHref(next?: unknown): string {
  return withNext(GOOGLE_START_PATH, next);
}

/** The absolute return URL handed to Supabase as `redirectTo`. */
export function googleReturnUrl(siteUrl: string, next?: unknown): string {
  return `${siteUrl.replace(/\/$/, "")}${withNext(GOOGLE_RETURN_PATH, next)}`;
}

/** The consent page, carrying `next` on. */
export function googleConsentHref(next?: unknown): string {
  return withNext(GOOGLE_CONSENT_PATH, next);
}

/** The sign-in page with a notice, carrying `next` on. */
export function signInWithNotice(notice: GoogleNotice, next?: unknown): string {
  const target = sameSitePath(next);
  const query = `google=${notice}`;
  return target
    ? `/uye/giris?${query}&next=${encodeURIComponent(target)}`
    : `/uye/giris?${query}`;
}

/**
 * The notice for a return that carries Supabase's (or Google's) refusal
 * instead of a code.
 *
 * `access_denied` is the member saying no on Google's page or closing it;
 * that is not an error to apologise for. Anything else is.
 */
export function googleCallbackNotice(input: {
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}): GoogleNotice {
  const text =
    `${input.error ?? ""} ${input.errorCode ?? ""} ${input.errorDescription ?? ""}`.toLowerCase();
  if (text.includes("access_denied") || text.includes("cancel")) return "iptal";
  if (text.includes("expired")) return "sure";
  return "hata";
}

/**
 * GoTrue's codes for a flow that can no longer finish (its own error
 * catalogue, `internal/api/apierrors/errorcode.go`).
 */
const SPENT_FLOW_CODES: ReadonlySet<string> = new Set([
  "flow_state_not_found",
  "flow_state_expired",
  "flow_state_already_used",
  "bad_code_verifier",
  "bad_oauth_state",
]);

/**
 * The notice for a code Supabase would not exchange.
 *
 * A missing verifier (another browser, cleared cookies, a link opened
 * twice) and a spent or expired code both mean "start again"; a transport
 * failure means "later".
 */
export function googleExchangeNotice(error: {
  name?: string;
  code?: string;
  status?: number;
}): GoogleNotice {
  if (error.name === "AuthPKCECodeVerifierMissingError") return "sure";
  if (error.code && SPENT_FLOW_CODES.has(error.code)) return "sure";
  return "hata";
}

/**
 * Whether a Google sign-in has to stop at the consent page first.
 *
 * Only a brand-new member does: nobody under this address in `customers`,
 * and no consent instant in the Supabase user's metadata (the app writes
 * `terms_accepted_at` there when its own consent panel is accepted, and so
 * does this site's consent page). Opening an account takes the membership
 * agreement's tick - `registerAction` and the app's sign-up refuse without
 * it - and Google's consent screen is Google's, not ours.
 *
 * An existing member (a row under the address) accepted the agreement when
 * they opened it, on the site or in the app, and goes straight in. A closed
 * account's identity (`identityRevoked`) does not get a consent page either:
 * the bridge refuses it (`account_disabled`), and asking first would invite
 * a member to accept an agreement for an account that cannot open.
 */
export function googleNeedsConsent(input: {
  termsAcceptedAt: string;
  rowExists: boolean;
  identityRevoked: boolean;
}): boolean {
  return !input.termsAcceptedAt && !input.rowExists && !input.identityRevoked;
}
