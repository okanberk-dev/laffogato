#!/usr/bin/env node
/**
 * Stops a Vercel PRODUCTION build that has no `DATABASE_URL`.
 *
 * A deployment without it does not fall over: the public pages serve their
 * bundled content, the app's API answers 503, and the logs say
 * `[db] DATABASE_URL tanımlı değil` (src/lib/db/database-url.mjs,
 * docs/DATABASE.md). That is right for an outage, and it is how a build
 * with no connection string served degraded pages between 15 and 17 Oct
 * 2026 with only log lines to show for it (the message of the time: "...
 * DATABASE_URL (veya POSTGRES_URL) set edilmeli", so neither was set). On
 * production the missing variable is a deployment mistake, so the build
 * goes red instead and the previous deployment keeps serving.
 *
 * Only `VERCEL_ENV=production`. Previews, local builds and CI (which sets
 * no `VERCEL_ENV`) build without a database as before: the static pages'
 * prerender reads degrade to the bundled content. With the variable set,
 * a production build does query the database while prerendering (and so
 * applies bundled migrations, `ensureSchemaFresh`). The rule for
 * what counts as set is the app's own (`databaseUrlFrom`: unset, empty or
 * blank is missing; POSTGRES_URL is never read), and nothing here prints a
 * value.
 *
 * Run by vercel.json `buildCommand` (Vercel runs that, not `npm run build`,
 * so `prebuild` would never see it) and by `prebuild` for the same
 * behaviour under `npm run build`.
 */

import { pathToFileURL } from "node:url";

import {
  databaseUrlFrom,
  isDatabaseUrlMissing,
} from "../src/lib/db/database-url.mjs";

/**
 * Why this build must stop, or null to go on.
 *
 * @param {Record<string, string | undefined>} env usually `process.env`
 * @returns {string | null}
 */
export function buildEnvProblem(env) {
  if (env.VERCEL_ENV !== "production") return null;
  try {
    databaseUrlFrom(env);
    return null;
  } catch (err) {
    if (!isDatabaseUrlMissing(err)) throw err;
    return [
      `[build-env] ${/** @type {Error} */ (err).message}`,
      "Üretim derlemesi durduruldu: Vercel'de Production ortamına DATABASE_URL ekleyip yeniden dağıt.",
      "Production build stopped: DATABASE_URL is not set for VERCEL_ENV=production (only DATABASE_URL is read).",
    ].join("\n");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const problem = buildEnvProblem(process.env);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
}
