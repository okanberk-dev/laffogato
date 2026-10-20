/**
 * Where the database connection string comes from: `DATABASE_URL`, and
 * nothing else.
 *
 * Plain JavaScript so that every reader shares this one file: the app
 * (`src/lib/db/index.ts`) and the two scripts that open the same database
 * (`scripts/db-migrate.mjs`, `scripts/backfill-backdrops.mjs`), which run
 * under bare Node and cannot import TypeScript. The rule cannot drift between
 * them (`tests/db-connection-url.test.ts` runs the same cases against all
 * three).
 *
 * There is deliberately no fallback name. The chain used to go on to
 * `POSTGRES_URL` and then `SUPABASE_DB_URL`, and Supabase's Vercel
 * integration writes `POSTGRES_URL` into Production: the identity project's
 * own Postgres, which holds none of our data (docs/DATABASE.md). Had
 * `DATABASE_URL` ever gone missing, the site would have connected there
 * without a word, built an empty schema in it (`src/lib/db/bootstrap.ts`) and
 * taken orders into it. `SUPABASE_DB_URL` is no step of the move to Supabase
 * either: docs/SUPABASE-GECIS.md moves the data by changing `DATABASE_URL`.
 *
 * A missing `DATABASE_URL` is therefore a configuration error that names
 * itself. It is never "database unreachable": the public pages serve bundled
 * content over an outage (`src/lib/db/health.ts`), and a site that has lost
 * its configuration must not look like one that is only waiting for its
 * database. Nothing here reads a value back out: the error names variables,
 * never what they hold (a connection string carries a password).
 */

/** The one variable a connection string is read from. */
export const DATABASE_URL_VAR = "DATABASE_URL";

/**
 * Names that hold a Postgres connection string on some platform and are
 * deliberately NOT read. Listed only so the error can say that one of them
 * is set and ignored.
 */
export const IGNORED_DATABASE_URL_VARS = Object.freeze([
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
]);

/**
 * The code a missing connection string carries through the data layer
 * (`toDbError`). Not a SQLSTATE (those are five characters), so no caller
 * can mistake it for one, and not empty, so it is never read as the
 * transport signature of an unreachable database.
 */
export const DATABASE_URL_MISSING = "DATABASE_URL_MISSING";

const BRAND = "__databaseUrlMissing";

/** Why each ignored name is not read, said when it is set. */
const WHY_IGNORED = Object.freeze({
  POSTGRES_URL:
    "POSTGRES_URL tanımlı ama bilerek okunmuyor: onu Supabase'in Vercel entegrasyonu yazar ve verimizi taşımayan başka bir veritabanını gösterir.",
  SUPABASE_DB_URL:
    "SUPABASE_DB_URL tanımlı ama bilerek okunmuyor: Supabase'e taşıma da DATABASE_URL değiştirilerek yapılır (docs/SUPABASE-GECIS.md).",
});

/**
 * @param {readonly string[]} ignored the ignored names that are set
 * @returns {string}
 */
function missingMessage(ignored) {
  return [
    "DATABASE_URL tanımlı değil: veritabanına bağlanılmadı. Bağlantı dizesi yalnız DATABASE_URL'den okunur (docs/DATABASE.md).",
    ...ignored.map(
      (name) => /** @type {Record<string, string>} */ (WHY_IGNORED)[name] ?? "",
    ),
  ]
    .filter(Boolean)
    .join(" ");
}

export class DatabaseUrlMissingError extends Error {
  /** @param {readonly string[]} ignored the ignored names that are set */
  constructor(ignored) {
    super(missingMessage(ignored));
    this.name = "DatabaseUrlMissingError";
    /** @type {string} */
    this.code = DATABASE_URL_MISSING;
    // A non-enumerable brand rather than `instanceof`, as with
    // DbUnreachableError: Next may load a module once per bundle layer.
    Object.defineProperty(this, BRAND, { value: true, enumerable: false });
  }
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isDatabaseUrlMissing(err) {
  return (
    typeof err === "object" &&
    err !== null &&
    /** @type {Record<string, unknown>} */ (err)[BRAND] === true
  );
}

/**
 * The connection string in `env.DATABASE_URL`, trimmed. Unset, empty or
 * blank throws `DatabaseUrlMissingError`, whatever else is set.
 *
 * @param {Record<string, string | undefined>} env usually `process.env`
 * @returns {string}
 */
export function databaseUrlFrom(env) {
  const raw = env[DATABASE_URL_VAR];
  const url = typeof raw === "string" ? raw.trim() : "";
  if (url) return url;
  const ignored = IGNORED_DATABASE_URL_VARS.filter((name) => {
    const value = env[name];
    return typeof value === "string" && value.trim() !== "";
  });
  throw new DatabaseUrlMissingError(ignored);
}
