import { cache } from "react";

import { DATABASE_URL_MISSING } from "./database-url.mjs";

/**
 * Telling "the database is unreachable" apart from "the database said no".
 *
 * These are different failures and must be handled differently. A rejected
 * query - a bad column, a constraint violation, a missing table - is a bug, and
 * hiding it behind a fallback would make the bug invisible. A host that never
 * answered is an outage: the marketing site can still render from the seed data
 * it ships with, and should, rather than returning HTTP 500 on every page.
 *
 * `src/lib/db/client.ts` reports the second case as `status: 0` with an empty
 * `code`, because a request that never reached Postgres cannot carry a SQLSTATE.
 * That is the only signal used here - no string matching on error messages.
 */

/** A query the database rejected. Always fatal; never degrades. */
export class DbQueryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(ctx: string, message: string, code: string, status: number) {
    super(`${ctx} [${status}]: ${message}`);
    this.name = "DbQueryError";
    this.code = code;
    this.status = status;
  }
}

/** The database could not be reached at all. Eligible for degradation. */
export class DbUnreachableError extends Error {
  constructor(ctx: string, message: string) {
    super(`${ctx}: ${message}`);
    this.name = "DbUnreachableError";
    // A non-enumerable brand rather than `instanceof`: Next may instantiate a
    // module once per bundle layer, which breaks prototype identity across the
    // RSC / server-action boundary.
    Object.defineProperty(this, "__dbUnreachable", {
      value: true,
      enumerable: false,
    });
  }
}

export function isDbUnreachable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { __dbUnreachable?: boolean }).__dbUnreachable === true
  );
}

/**
 * Raises the right error type for a failed query result. `status === 0` with an
 * empty code is the transport signature; anything else carries a SQLSTATE and
 * is a real query failure.
 *
 * A deployment without DATABASE_URL (`DATABASE_URL_MISSING`,
 * ./database-url.mjs) degrades exactly like an unreachable database: no
 * query ever reached a Postgres, the public pages serve their bundled
 * content and the app's API answers 503. What differs is what it says: the
 * message names the missing variable, `/api/health` answers `unconfigured`
 * (`dbHealth`), and nothing is dialled, least of all POSTGRES_URL. Checked
 * by code, not status: some callers rebuild the status from the code.
 */
export function raiseDbError(
  ctx: string,
  error: { message: string; code: string },
  status: number,
): never {
  const message = error.message || "request failed";
  if (error.code === DATABASE_URL_MISSING) {
    throw new DbUnreachableError(ctx, message);
  }
  if (status === 0 && error.code === "") {
    throw new DbUnreachableError(ctx, message);
  }
  throw new DbQueryError(ctx, message, error.code, status);
}

/**
 * Memoises an async function, but drops the memo when it rejects.
 *
 * The seed helpers previously cached their promise unconditionally, so a single
 * failure was cached forever: once one request hit an unreachable database, that
 * serverless instance kept replaying the same rejection even after the database
 * came back. Recovery required a redeploy. Clearing on rejection makes the next
 * request retry.
 */
export function memoizeUntilRejected<T>(
  fn: () => Promise<T>,
): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (pending) return pending;
    const run = fn().catch((err) => {
      pending = null;
      throw err;
    });
    pending = run;
    return run;
  };
}

/** Request-scoped flag: did any public read fall back during this render? */
const degradedBox = cache(() => ({ hit: false }));

export function markDegraded(): void {
  try {
    degradedBox().hit = true;
  } catch {
    // Outside a request scope (a script, a test) there is nothing to mark.
  }
}

export function isDegradedRequest(): boolean {
  try {
    return degradedBox().hit;
  } catch {
    return false;
  }
}

/**
 * Runs a public, read-only query and falls back to bundled data when - and only
 * when - the database is unreachable.
 *
 * Never use this for a mutation, an authorisation check, an admin view, or
 * anything that decides a price, a stock level or whether an order may be
 * placed. A fabricated answer on those paths is worse than an error page.
 */
export async function publicRead<T>(
  label: string,
  fallback: T,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isDbUnreachable(err)) throw err;
    markDegraded();
    // Keep the outage visible in the platform logs; a degraded page that is
    // silent in production is how an outage lasts a month.
    console.error(
      `[db-degraded] ${label}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return fallback;
  }
}
