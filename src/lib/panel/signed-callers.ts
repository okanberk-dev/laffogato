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
 *   machine and each key is rotated on its own.
 *
 * Both sign the same way (karaoke-sync-core.ts); only the key differs. A
 * route names the callers it takes: the menu routes and the bar screen's
 * two order routes take both, `/api/pos/orders/version` takes LafPOS only.
 * The karaoke and sales routes do not use this module: they stay the
 * panel's alone.
 *
 * Pure (no `server-only`, no database): the routes and the tests share it.
 */

export type SignedCaller = "panel" | "lafpos";

/** The order a tie is settled in: two keys of the same value are the panel's. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

/** The secret of each caller a route takes that this deployment has. */
export type SignedCallerKeys = Partial<Record<SignedCaller, string>>;

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
 * The keys a route that takes `accept` checks, or null when this
 * deployment has none of them (the route answers 503 `not_configured`).
 * The panel's key counts exactly as it always has (`panelSyncConfig`: a
 * secret under 32 characters, or a `PANEL_URL` that is not https, turns the
 * panel's link off); LafPOS's counts by `lafposSyncSecret`.
 */
export function signedCallerKeys(
  env: Record<string, string | undefined>,
  accept: readonly SignedCaller[],
): SignedCallerKeys | null {
  const keys: SignedCallerKeys = {};
  if (accept.includes("panel")) {
    const panel = panelSyncConfig(env);
    if (panel) keys.panel = panel.secret;
  }
  if (accept.includes("lafpos")) {
    const lafpos = lafposSyncSecret(env);
    if (lafpos) keys.lafpos = lafpos;
  }
  return keys.panel || keys.lafpos ? keys : null;
}

/**
 * Who signed `request`, or null for an unsigned, forged, retargeted or
 * stale one (401). Every key is checked whichever one matches, so the time
 * the answer takes does not tell which key signed; each comparison is
 * constant-time (`verifySignature`, CLAUDE.md rule 7). One value set as
 * both keys is the panel's: such a deployment cannot tell the two apart
 * (docs/LAFPOS.md keeps them different).
 */
export function signedCaller(
  keys: SignedCallerKeys,
  request: { headers: Headers },
  method: "GET" | "POST",
  url: URL,
  body: string,
): SignedCaller | null {
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);
  let caller: SignedCaller | null = null;
  for (const name of CALLERS) {
    const secret = keys[name];
    if (!secret) continue;
    const signed = verifySignature(secret, {
      method,
      url,
      body,
      timestamp,
      signature,
    });
    if (signed && caller === null) caller = name;
  }
  return caller;
}
