/**
 * How a Postgres connection string becomes `pg`'s `connectionString` + `ssl`.
 *
 * Plain JavaScript, like `./database-url.mjs`, so that the app
 * (`src/lib/db/index.ts`) and the scripts that open the same database
 * (`scripts/db-migrate.mjs`, `scripts/images-to-r2.mjs`) share one rule. It
 * used to be written twice, and the script's copy had drifted: it handed
 * `pg` the URL with `sslmode` still in it, and `pg` lets the parsed URL
 * override the `ssl` object it is given, so a custom root CA never reached
 * the migration's handshake.
 *
 * The rules:
 *
 * - TLS when the URL asks for it (`sslmode` set and not `disable`), and
 *   always on a Supabase host (its endpoints accept a plaintext session;
 *   docs/SUPABASE-GECIS.md §2).
 * - Full verification, always (`rejectUnauthorized: true`). There is no
 *   "encrypted but unverified" path: the health layer would mask a failure
 *   of that kind as "database unreachable" and serve bundled data.
 * - `DATABASE_SSL_CA` (PEM), when set, is trusted on EVERY host (26 Kas
 *   2026, the move to Coolify: the server's certificate is signed by
 *   Coolify's own CA). It is added to Node's bundled Mozilla roots, not put
 *   in their place: Node's `ca` option replaces the default set, and a CA
 *   that replaced it would break the one-step rollback (DATABASE_URL back to
 *   a publicly signed host such as Neon while DATABASE_SSL_CA is still set).
 *   Until this change the CA was applied on Supabase hosts only, for that
 *   same reason.
 * - `sslmode` and `channel_binding` are taken out of the string handed to
 *   `pg`: `ssl` is configured explicitly here, and `pg-connection-string`
 *   warns about `sslmode=require` on every cold start.
 *
 * - `DATABASE_SSL_SERVERNAME`, when set, is the name the certificate is
 *   checked against instead of the URL's host. For a server reached by IP
 *   whose certificate names it otherwise (Coolify signs the database's
 *   certificate for its UUID). Verification is not relaxed: the chain must
 *   still end in a trusted root and the certificate must still carry that
 *   name; only which name is expected changes (libpq's host/hostaddr split).
 *
 * The CA's text is never logged; a value that is not PEM is named and
 * ignored.
 */

import { rootCertificates } from "node:tls";

/** The variable a custom root certificate (PEM) is read from. */
export const DATABASE_SSL_CA_VAR = "DATABASE_SSL_CA";

/** The variable naming the host the certificate must carry, when not the URL's. */
export const DATABASE_SSL_SERVERNAME_VAR = "DATABASE_SSL_SERVERNAME";

/** A DNS-style name: letters, digits, dots and hyphens only. */
const SERVERNAME = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i;

const PEM_MARKER = "-----BEGIN CERTIFICATE-----";

/**
 * @param {string} host lower-case host name
 * @returns {boolean}
 */
export function isSupabaseHost(host) {
  return host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");
}

/**
 * The custom CA when it is plainly PEM, else null. A truncated paste would
 * fail the handshake anyway, but with an error that names X.509 innards
 * instead of the actual mistake.
 *
 * @param {Record<string, string | undefined>} env
 * @param {(message: string) => void} [warn]
 * @returns {string | null}
 */
export function customCaFrom(env, warn = console.error) {
  const ca = env[DATABASE_SSL_CA_VAR];
  if (!ca || !ca.trim()) return null;
  if (ca.includes(PEM_MARKER)) return ca;
  warn(
    "[db] DATABASE_SSL_CA PEM görünmüyor (BEGIN CERTIFICATE yok) — yok sayılıyor",
  );
  return null;
}

/**
 * The expected certificate name, or null when unset or not a host name.
 *
 * @param {Record<string, string | undefined>} env
 * @param {(message: string) => void} [warn]
 * @returns {string | null}
 */
export function servernameFrom(env, warn = console.error) {
  const raw = env[DATABASE_SSL_SERVERNAME_VAR]?.trim() ?? "";
  if (!raw) return null;
  if (SERVERNAME.test(raw)) return raw.toLowerCase();
  warn("[db] DATABASE_SSL_SERVERNAME bir host adı değil — yok sayılıyor");
  return null;
}

/**
 * @typedef {{ rejectUnauthorized: true, ca?: string[], servername?: string }} SslOptions
 * @typedef {{ connectionString: string, ssl: SslOptions | undefined, host: string, sslmode: string }} SslConfig
 */

/**
 * @param {string} connectionString
 * @param {Record<string, string | undefined>} [env] usually `process.env`
 * @param {(message: string) => void} [warn]
 * @returns {SslConfig}
 */
export function sslConfigFor(connectionString, env = process.env, warn) {
  let sslmode = "";
  let cleaned = connectionString;
  let host = "";
  try {
    const url = new URL(connectionString);
    // WHATWG URL does NOT lower-case the host of a "non-special" scheme
    // (postgresql:). The Supabase check must not be case-sensitive: DNS is
    // not, and an upper-case pooler host would otherwise connect in plain text.
    host = url.hostname.toLowerCase();
    sslmode = url.searchParams.get("sslmode") ?? "";
    url.searchParams.delete("sslmode");
    url.searchParams.delete("channel_binding");
    cleaned = url.toString();
  } catch {
    // Not URL-shaped (a key=value DSN); fall back to a substring probe.
    sslmode = /sslmode=([a-z-]+)/.exec(connectionString)?.[1] ?? "";
  }
  const wantsSsl =
    (sslmode !== "" && sslmode !== "disable") || isSupabaseHost(host);
  if (!wantsSsl) {
    return { connectionString: cleaned, ssl: undefined, host, sslmode };
  }
  const ca = customCaFrom(env, warn);
  const servername = servernameFrom(env, warn);
  return {
    connectionString: cleaned,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca: [...rootCertificates, ca] } : {}),
      ...(servername ? { servername } : {}),
    },
    host,
    sslmode,
  };
}
