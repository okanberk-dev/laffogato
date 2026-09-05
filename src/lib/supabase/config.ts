/**
 * Supabase project coordinates — identity only.
 *
 * Supabase is the site's and the app's shared sign-in (docs/AUTH-BRIDGE.md);
 * orders, money and the member record itself stay in this project's own
 * Postgres (docs/API-MOBILE.md §0). Nothing here touches data.
 *
 * Both values are PUBLIC by design. The publishable key is the one Supabase
 * hands to browsers and mobile apps: it can only do what an anonymous visitor
 * may do (sign in, sign up, refresh a token) and every data policy still runs
 * against it. It is therefore safe to ship in the client bundle, to write into
 * `.env.example` with its value, and to fall back to here when the variable is
 * missing — a preview deploy without the env var must still be able to sign
 * members in against the same project the app uses.
 *
 * The service-role key is a different animal — it bypasses every policy — and
 * it is deliberately NOT read here. Exactly one module reads it,
 * `./admin.ts`, for exactly one operation: deleting the sign-in identity of a
 * member who closed their account. It is optional, `server-only`, and carries
 * no `NEXT_PUBLIC_` prefix, so it never reaches a browser or the app bundle.
 * Do not read it anywhere else.
 */

const DEFAULT_SUPABASE_URL = "https://wvivcgctebyxojtyidfg.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_AZqtN6SlhsFwvye63uO0FQ_WQMfithj";

function clean(raw: string | undefined): string {
  return (raw ?? "").trim();
}

/** Project URL; env first (`NEXT_PUBLIC_SUPABASE_URL`), public default second. */
export const SUPABASE_URL: string =
  clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, "") ||
  DEFAULT_SUPABASE_URL;

/**
 * Publishable (client) key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` first; the
 * Vercel integration's legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is honoured as a
 * second source so a project wired through the marketplace keeps working.
 */
export const SUPABASE_PUBLISHABLE_KEY: string =
  clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

/** Project ref (the subdomain) — handy for cookie names and diagnostics. */
export const SUPABASE_PROJECT_REF: string =
  /^https?:\/\/([a-z0-9-]+)\./i.exec(SUPABASE_URL)?.[1] ?? "";
