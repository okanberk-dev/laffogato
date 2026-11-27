import {
  MIN_SECRET_LENGTH,
  panelSyncConfig,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from "./karaoke-sync-core";

/**
 * Who may sign a request to this site's server-to-server routes, and with
 * which key (docs/LAFPOS.md):
 *
 * - `panel`: the köşk's back-office panel (ladmin.laffogato.net), with
 *   `KARAOKE_SYNC_SECRET`, the key it shares with this site
 *   (docs/PANEL-KARAOKE.md);
 * - `lafpos`: LafPOS, the till server inside the café, with its own
 *   `LAFPOS_SYNC_SECRET`, so the panel's key never sits on the café's
 *   machine and each key is rotated on its own. While that key is being
 *   rotated, `LAFPOS_SYNC_SECRET_ONCEKI` holds the value it replaced, and
 *   a request signed with either is LafPOS's (docs/LAFPOS.md "Anahtarı
 *   değiştirmek"): the till takes the new value at its day close, not at
 *   the moment this site is redeployed, and must not be refused in between.
 *   Every 2xx answer names the value that signed (`SIGNED_KEY_HEADER`), so
 *   ladmin can tell "taken as today's" from "taken as the previous one".
 *
 * Both sign the same way (karaoke-sync-core.ts); only the key differs. A
 * route names the callers it takes: the menu routes, the bar screen's two
 * order routes and the karaoke read take both (LafPOS's room box shows the
 * site's bookings, the panel's whitelist and nothing more, from yesterday
 * to tomorrow only), `/api/pos/orders/version` and the table list
 * (`PUT /api/panel/tables`, the codes LafPOS prints) take LafPOS only. The
 * sales route does not use this module: it stays the panel's alone.
 *
 * Pure (no `server-only`, no database): the routes and the tests share it.
 */

export type SignedCaller = "panel" | "lafpos";

/** The order a tie is settled in: two keys of the same value are the panel's. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

/**
 * Which of the caller's values signed: `simdiki` (today's) or `onceki`
 * (LafPOS's previous value, `LAFPOS_SYNC_SECRET_ONCEKI`). The panel's key
 * has one value only, so a panel request is always `simdiki`.
 */
export type SignedKey = "simdiki" | "onceki";

/** Who signed a request, and with which of its values. */
export interface SignedBy {
  caller: SignedCaller;
  key: SignedKey;
}

/**
 * The answer header that says which value signed (27 Kas 2026): every 2xx
 * answer of a route that takes these keys carries it, the panel's too
 * (always `simdiki`). ladmin checks the value it hands the till against
 * `/api/pos/orders/version` and reads this: a 200 with `onceki` means the
 * site takes that value only as the previous one (ladmin still hands out
 * the old value), so deleting `LAFPOS_SYNC_SECRET_ONCEKI` then would cut
 * the till off. A 2xx without it is an older site that cannot tell. It
 * names the value, never carries it: only a caller holding a valid key
 * gets a 2xx, and it knows which value it signed with.
 */
export const SIGNED_KEY_HEADER = "x-laf-anahtar";

/**
 * The secrets of each caller a route takes that this deployment has: one
 * per caller, two for LafPOS while its key is being rotated (the current
 * value first, then the previous one).
 */
export type SignedCallerKeys = Partial<Record<SignedCaller, readonly string[]>>;

/**
 * `LAFPOS_SYNC_SECRET`, trimmed, or null when it is unset or shorter than
 * 32 characters: too short to be a secret, so LafPOS's key is off.
 */
export function lafposSyncSecret(
  env: Record<string, string | undefined>,
): string | null {
  const secret = env.LAFPOS_SYNC_SECRET?.trim() ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/**
 * `LAFPOS_SYNC_SECRET_ONCEKI` ("previous"), LafPOS's old key kept for the
 * length of a rotation, trimmed, or null when it is unset or shorter than
 * 32 characters. It counts only next to a `LAFPOS_SYNC_SECRET` that counts
 * (`signedCallerKeys`): deleting the current value still turns LafPOS off.
 */
export function lafposPreviousSyncSecret(
  env: Record<string, string | undefined>,
): string | null {
  const secret = env.LAFPOS_SYNC_SECRET_ONCEKI?.trim() ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/**
 * The keys a route that takes `accept` checks, or null when this
 * deployment has none of them (the route answers 503 `not_configured`).
 * The panel's key counts exactly as it always has (`panelSyncConfig`: a
 * secret under 32 characters, or a `PANEL_URL` that is not https, turns the
 * panel's link off); LafPOS's counts by `lafposSyncSecret`, and not at all
 * when it is the same value as `KARAOKE_SYNC_SECRET`. LafPOS's previous
 * value (`lafposPreviousSyncSecret`) is added under the same rules, and
 * only when the current one counts and differs from it.
 */
export function signedCallerKeys(
  env: Record<string, string | undefined>,
  accept: readonly SignedCaller[],
): SignedCallerKeys | null {
  const keys: SignedCallerKeys = {};
  if (accept.includes("panel")) {
    const panel = panelSyncConfig(env);
    if (panel) keys.panel = [panel.secret];
  }
  if (accept.includes("lafpos")) {
    const lafpos = lafposSyncSecret(env);
    // The panel's value pasted in as LafPOS's (docs/LAFPOS.md "Anahtarı
    // değiştirmek") is a mistake, not a second key: LafPOS's key then counts
    // as unset, so `/api/pos/orders/version` answers 503 and the mix-up shows
    // instead of LafPOS's writes being audited as the panel's. The previous
    // value is held to the same rule: the panel's key never opens LafPOS's
    // routes, `/api/pos/orders/version` included.
    const panelValue = env.KARAOKE_SYNC_SECRET?.trim() ?? "";
    if (lafpos && lafpos !== panelValue) {
      const previous = lafposPreviousSyncSecret(env);
      keys.lafpos =
        previous && previous !== lafpos && previous !== panelValue
          ? [lafpos, previous]
          : [lafpos];
    }
  }
  return keys.panel || keys.lafpos ? keys : null;
}

/**
 * Who signed `request`, or null for an unsigned, forged, retargeted or
 * stale one (401). Every key is checked whichever one matches, LafPOS's
 * previous value too, so the time the answer takes does not tell which key
 * signed; each comparison is constant-time (`verifySignature`, CLAUDE.md
 * rule 7). Either LafPOS value makes the caller `lafpos`, with the same
 * rights. One value set as both keys is the panel's: such a deployment
 * cannot tell the two apart (docs/LAFPOS.md keeps them different). `key`
 * says which of the caller's values signed (`SignedKey`).
 */
export function signedBy(
  keys: SignedCallerKeys,
  request: { headers: Headers },
  method: "GET" | "POST" | "PUT",
  url: URL,
  body: string,
): SignedBy | null {
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);
  let found: SignedBy | null = null;
  for (const name of CALLERS) {
    const secrets = keys[name] ?? [];
    for (let index = 0; index < secrets.length; index += 1) {
      const signed = verifySignature(secrets[index], {
        method,
        url,
        body,
        timestamp,
        signature,
      });
      // The current value is listed first (`signedCallerKeys`).
      if (signed && found === null) {
        found = { caller: name, key: index === 0 ? "simdiki" : "onceki" };
      }
    }
  }
  return found;
}

/** `signedBy` without the value: who signed `request`, or null (401). */
export function signedCaller(
  keys: SignedCallerKeys,
  request: { headers: Headers },
  method: "GET" | "POST" | "PUT",
  url: URL,
  body: string,
): SignedCaller | null {
  return signedBy(keys, request, method, url, body)?.caller ?? null;
}

/** `SIGNED_KEY_HEADER` for a 2xx answer to a request `by` signed. */
export function signedKeyHeader(by: SignedBy): Record<string, string> {
  return { [SIGNED_KEY_HEADER]: by.key };
}
