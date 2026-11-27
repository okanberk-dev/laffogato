import "server-only";

import { unstable_cache } from "next/cache";

import { MIGRATION_NAMES } from "@/lib/db/schema-sql";

import type { CacheTag } from "./tags";

/**
 * Presentation reads kept in the Next Data Cache, so an anonymous page view
 * (a crawler at 04:00, mostly) does not wake the database.
 *
 * Why this exists: the database (Neon, free plan) sleeps after five idle
 * minutes and its monthly compute ran out in September; most wakes were
 * public pages read by nobody in particular (docs/DATABASE.md "Uyanmalar").
 *
 * `unstable_cache` is the Data Cache of this Next (16.4.6) without
 * `cacheComponents` and works inside `force-dynamic` pages (node_modules/
 * next/dist/docs/01-app/02-guides/caching-without-cache-components.md). On
 * Vercel it is the regional Runtime Cache, shared by every function
 * instance. An entry stays good until a write expires its tag
 * (src/lib/cache/tags.ts, from the data layer itself), so no short time
 * limit is needed; the day-long `revalidate` is only a net under a write
 * the hook did not see.
 *
 * The key names the deployment and the newest migration: a deploy, or a
 * migration that reshapes a row, starts from an empty cache rather than
 * reading entries an older build wrote. A write from code without the hook
 * expires nothing: the Neon console, scripts/*.mjs, `npm run dev` on the
 * production database, a deployment from before this cache serving after
 * an Instant Rollback (its writes never reach the entries an "Undo
 * Rollback" brings back). docs/DATABASE.md "Etiket düşürmeyen yazmalar"
 * names them and the command that purges every tag.
 *
 * Only for presentation. Prices, stock, whether something may be ordered,
 * who is signed in: never from here (CLAUDE.md "Veritabanı Kesintisinde
 * Davranış"). The caller wraps the cached read in `publicRead` from the
 * OUTSIDE, so an outage fallback is returned but never stored.
 *
 * Off under test (NODE_ENV=test) and with LAF_DATA_CACHE=off (an operator's
 * switch: every read goes to the database again, as before).
 */

/** A safety net, not the freshness rule: writes expire entries at once. */
export const PRESENTATION_REVALIDATE_S = 86_400;

export function presentationCacheEnabled(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  if (process.env.LAF_DATA_CACHE === "off") return false;
  return true;
}

/** The key parts every entry carries besides its own name. */
export function presentationCacheKey(name: string): string[] {
  return [
    name,
    process.env.VERCEL_DEPLOYMENT_ID || "local",
    MIGRATION_NAMES[MIGRATION_NAMES.length - 1] ?? "",
  ];
}

/**
 * `fn`, cached under `name` with `tags`. The arguments are part of the key.
 * The value must survive JSON (the cache stores it as JSON): plain objects,
 * strings, numbers, booleans, arrays.
 *
 * If the cache itself fails before `fn` ran (no cache in this context, a
 * cache service error), `fn` runs uncached: more database time, never a
 * wrong answer and never a failed page. An error from `fn` is `fn`'s.
 */
export function presentationCache<A extends unknown[], T>(
  name: string,
  fn: (...args: A) => Promise<T>,
  tags: readonly CacheTag[],
): (...args: A) => Promise<T> {
  return async (...args: A): Promise<T> => {
    if (!presentationCacheEnabled()) return fn(...args);
    const run = { started: false, done: false, value: undefined as T };
    const cached = unstable_cache(
      async (...a: A): Promise<T> => {
        run.started = true;
        run.value = await fn(...a);
        run.done = true;
        return run.value;
      },
      presentationCacheKey(name),
      { tags: [...tags], revalidate: PRESENTATION_REVALIDATE_S },
    );
    try {
      return await cached(...args);
    } catch (err) {
      if (run.done) return run.value;
      if (run.started) throw err;
      if (process.env.NODE_ENV === "production") {
        console.warn(
          `[data-cache] ${name} uncached: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return fn(...args);
    }
  };
}
