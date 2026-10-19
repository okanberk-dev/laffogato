/**
 * A PostgREST-shaped query builder over plain SQL.
 *
 * The data layer was written against `@supabase/supabase-js` and calls
 * `.from(t).select(...).eq(...)` in ~122 places, including the money- and
 * stock-critical paths. Rather than rewrite those call sites by hand - where a
 * transcription slip surfaces as a runtime error inside a server action - this
 * reproduces the small slice of the PostgREST client they actually use, backed
 * by parameterised SQL.
 *
 * Supported surface (everything the codebase uses, nothing more):
 *   .from().select()/.insert()/.update()/.upsert()/.delete()
 *   .eq() .neq() .in() .gte() .ilike() .ieq() .anyOf() .order() .limit()
 *   .offset() .maybeSingle()
 *   .select("*", { count: "exact", head: true })
 *   .rpc(fn, namedArgs)
 *
 * Semantics preserved from PostgREST because callers depend on them:
 *   - errors are RETURNED on the result, never thrown;
 *   - `error.code` carries the Postgres SQLSTATE, so the `23505` duplicate
 *     branches in the payment webhook and customer/coupon inserts still work;
 *   - a mutation returns rows only when `.select()` is chained onto it;
 *   - a transport failure reports `status: 0` with an empty `code`, which is
 *     what distinguishes "database unreachable" from "query rejected".
 */

import {
  compile,
  type AnyOfCondition,
  type CompiledQuery,
  type Filter,
  type OrderBy,
  type QuerySpec,
  type Row,
} from "./sql";

export interface DbError {
  message: string;
  code: string;
  details: string;
  hint: string;
}

export interface DbResult<T> {
  data: T | null;
  error: DbError | null;
  status: number;
  count: number | null;
}

/**
 * Values handed to insert/update/upsert. The previous Supabase client was
 * instantiated without a schema generic, so call sites pass plain domain
 * interfaces (which have no index signature). Accepting `object` keeps those
 * ~40 call sites compiling unchanged; the compiler in `./sql` validates every
 * key as an identifier before it reaches SQL.
 */
export type RowInput = object;

export interface ExecutorResult {
  rows: Row[];
  rowCount: number;
}

/** Runs compiled SQL. Injected so the builder is testable without a database. */
export type Executor = (query: CompiledQuery) => Promise<ExecutorResult>;

/** What a successful write touched: a table, or the SQL function it called. */
export type WriteTarget = { table: string } | { fn: string };

export interface DbOptions {
  /**
   * Called once after each write the database accepted: an insert, upsert,
   * update or delete (`{ table }`), or an rpc (`{ fn }`). Never after a
   * select, a failed statement or a write that sent nothing (an empty
   * upsert). `getDb()` uses it to expire the cached reads the write made
   * stale (src/lib/cache/tags.ts). It cannot fail the write: a throw is
   * swallowed.
   */
  onWrite?: (target: WriteTarget) => void;
}

/** The executor for a write: the same SQL, then `onWrite` once it succeeded. */
function writingExecutor(
  execute: Executor,
  target: WriteTarget,
  onWrite: DbOptions["onWrite"],
): Executor {
  if (!onWrite) return execute;
  return async (query) => {
    const result = await execute(query);
    try {
      onWrite(target);
    } catch {
      // The row is written; a cache that could not be told is not an error
      // the caller can do anything about.
    }
    return result;
  };
}

/**
 * Normalises a driver error into the PostgREST error shape.
 *
 * A Postgres-originated error always carries a SQLSTATE; a DNS/TCP/TLS failure
 * does not. That distinction is the only reliable way to tell "the database
 * said no" from "the database was not reachable", so it is preserved here as
 * `status: 0` + empty `code` rather than being flattened into a string.
 */
export function toDbError(err: unknown): { error: DbError; status: number } {
  const e = err as {
    message?: string;
    code?: string;
    detail?: string;
    details?: string;
    hint?: string;
  };
  // A SQLSTATE is always five alphanumerics. Anything else on `code` is a Node
  // errno - ECONNREFUSED, ETIMEDOUT, ENOTFOUND, ECONNRESET - which pg sets when
  // the socket never carried a query. Blanking it keeps the transport signature
  // below honest; otherwise an unreachable host is misread as a rejected query
  // and the degraded-mode fallback never engages.
  const raw = typeof e?.code === "string" ? e.code : "";
  const code = /^[0-9A-Za-z]{5}$/.test(raw) ? raw : "";
  const message =
    typeof e?.message === "string" && e.message ? e.message : "request failed";
  return {
    error: {
      message,
      code,
      details: e?.detail ?? e?.details ?? "",
      hint: e?.hint ?? "",
    },
    // No SQLSTATE means the request never reached Postgres.
    status: code === "" ? 0 : 400,
  };
}

interface SelectOptions {
  count?: "exact";
  head?: boolean;
}

interface UpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

interface OrderOptions {
  ascending?: boolean;
}

/**
 * Base builder: collects filters/ordering and resolves to a DbResult when
 * awaited. Every builder is a thenable, matching PostgREST's "await the chain"
 * ergonomics.
 */
abstract class QueryBuilder<T> implements PromiseLike<DbResult<T>> {
  protected readonly filters: Filter[] = [];
  protected readonly orders: OrderBy[] = [];
  protected limitValue: number | null = null;
  protected offsetValue: number | null = null;
  protected singleMode: "maybe" | null = null;

  constructor(protected readonly execute: Executor) {}

  protected abstract spec(): QuerySpec;

  /** Success status for this operation (PostgREST uses 201 for inserts). */
  protected okStatus(): number {
    return 200;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ op: "neq", column, value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ op: "lt", column, value });
    return this;
  }

  /**
   * Case-insensitive equality - `lower(col) = lower($1)`.
   *
   * Not part of PostgREST's surface; it exists because `.ilike()` with a
   * wildcard-free needle looks like this but cannot use a `lower(col)` index
   * (see the compiler note in ./sql). Prefer it over `.ilike()` wherever the
   * needle is a whole value rather than a pattern.
   */
  ieq(column: string, value: string): this {
    this.filters.push({ op: "ieq", column, value });
    return this;
  }

  ilike(column: string, value: string): this {
    this.filters.push({ op: "ilike", column, value });
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.filters.push({ op: "in", column, value: [...values] });
    return this;
  }

  /**
   * At least one of `conditions` holds: `(a OR b OR c)`, ANDed with the
   * other filters. Not PostgREST's `.or("a.eq.1,...")` string: the
   * conditions are values, parameterised like every other filter. Built for
   * one search box across an order number, a name and an e-mail.
   */
  anyOf(conditions: readonly AnyOfCondition[]): this {
    this.filters.push({ op: "any", column: "", value: [...conditions] });
    return this;
  }

  order(column: string, options?: OrderOptions): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /** Skip this many rows (numbered pages); use with `order` and `limit`. */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /** Resolves to a single row, or null when nothing matched. */
  maybeSingle(): this {
    this.singleMode = "maybe";
    return this;
  }

  /**
   * A statement with nothing to do. PostgREST answers an upsert of zero rows
   * with an empty success; compiled here it was `INSERT INTO t () VALUES
   * ON CONFLICT …`, a syntax error (42601) - and one that publicRead rightly
   * refuses to mask, so an empty seed took every page that lists the table
   * down.
   */
  protected isNoop(): boolean {
    return false;
  }

  private async run(): Promise<DbResult<T>> {
    if (this.isNoop()) return this.shape({ rows: [], rowCount: 0 });
    let compiled: CompiledQuery;
    try {
      compiled = compile(this.spec());
    } catch (err) {
      // A malformed identifier is a programming error, not a database error -
      // surface it as a failed result so callers handle it on their normal path.
      const { error, status } = toDbError(err);
      return { data: null, error, status: status || 400, count: null };
    }

    let result: ExecutorResult;
    try {
      result = await this.execute(compiled);
    } catch (err) {
      const { error, status } = toDbError(err);
      return { data: null, error, status, count: null };
    }

    return this.shape(result);
  }

  protected shape(result: ExecutorResult): DbResult<T> {
    if (this.singleMode === "maybe") {
      if (result.rows.length > 1) {
        return {
          data: null,
          error: {
            message: "JSON object requested, multiple rows returned",
            code: "PGRST116",
            details: `results contain ${result.rows.length} rows`,
            hint: "",
          },
          status: 406,
          count: null,
        };
      }
      return {
        data: (result.rows[0] ?? null) as T | null,
        error: null,
        status: this.okStatus(),
        count: null,
      };
    }
    return {
      data: result.rows as unknown as T,
      error: null,
      status: this.okStatus(),
      count: null,
    };
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class SelectBuilder<T> extends QueryBuilder<T> {
  constructor(
    execute: Executor,
    private readonly table: string,
    private readonly columns: string,
    private readonly options: SelectOptions,
  ) {
    super(execute);
  }

  protected spec(): QuerySpec {
    return {
      kind: "select",
      table: this.table,
      columns: this.columns,
      filters: this.filters,
      orders: this.orders,
      limit: this.limitValue,
      offset: this.offsetValue,
      count: this.options.count ?? null,
      head: this.options.head === true,
    };
  }

  protected override shape(result: ExecutorResult): DbResult<T> {
    if (this.options.head === true && this.options.count === "exact") {
      const raw = result.rows[0]?.count;
      return {
        data: null,
        error: null,
        status: 200,
        count: typeof raw === "number" ? raw : Number(raw ?? 0),
      };
    }
    return super.shape(result);
  }
}

/**
 * Mutations return rows only when `.select()` is chained, mirroring
 * PostgREST's `Prefer: return=representation`.
 */
abstract class MutationBuilder<T> extends QueryBuilder<T> {
  protected returning: string | null = null;

  select(columns = "*"): this {
    this.returning = columns;
    return this;
  }

  protected override shape(result: ExecutorResult): DbResult<T> {
    if (this.returning === null) {
      return { data: null, error: null, status: this.okStatus(), count: null };
    }
    return super.shape(result);
  }
}

class InsertBuilder<T> extends MutationBuilder<T> {
  constructor(
    execute: Executor,
    private readonly table: string,
    private readonly rows: Row[],
  ) {
    super(execute);
  }

  protected override okStatus(): number {
    return 201;
  }

  protected spec(): QuerySpec {
    return {
      kind: "insert",
      table: this.table,
      rows: this.rows,
      returning: this.returning,
    };
  }
}

class UpsertBuilder<T> extends MutationBuilder<T> {
  constructor(
    execute: Executor,
    private readonly table: string,
    private readonly rows: Row[],
    private readonly options: UpsertOptions,
  ) {
    super(execute);
  }

  protected override okStatus(): number {
    return 201;
  }

  protected override isNoop(): boolean {
    return this.rows.length === 0;
  }

  protected spec(): QuerySpec {
    return {
      kind: "upsert",
      table: this.table,
      rows: this.rows,
      onConflict: this.options.onConflict ?? "id",
      ignoreDuplicates: this.options.ignoreDuplicates === true,
      returning: this.returning,
    };
  }
}

class UpdateBuilder<T> extends MutationBuilder<T> {
  constructor(
    execute: Executor,
    private readonly table: string,
    private readonly patch: Row,
  ) {
    super(execute);
  }

  protected spec(): QuerySpec {
    return {
      kind: "update",
      table: this.table,
      patch: this.patch,
      filters: this.filters,
      returning: this.returning,
    };
  }
}

class DeleteBuilder<T> extends MutationBuilder<T> {
  constructor(
    execute: Executor,
    private readonly table: string,
  ) {
    super(execute);
  }

  protected spec(): QuerySpec {
    return {
      kind: "delete",
      table: this.table,
      filters: this.filters,
      returning: this.returning,
    };
  }
}

/*
 * The generic defaults below are `any` on purpose. The client this replaces was
 * instantiated without a schema generic, so `data` was already untyped and the
 * ~122 call sites annotate the row type at the point of use instead
 * (`rows<AdminProduct>(await db.from(...).select("*"), ctx)`). Narrowing these
 * to `unknown` would require touching every one of those call sites - the
 * mechanical edit through the money and stock paths this shim exists to avoid.
 * Typing the schema properly is worth doing, but as its own change.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
class TableQuery {
  /** Runs this table's writes and reports each one that succeeded. */
  private readonly write: Executor;

  constructor(
    private readonly execute: Executor,
    private readonly table: string,
    onWrite?: DbOptions["onWrite"],
  ) {
    this.write = writingExecutor(execute, { table }, onWrite);
  }

  select<T = any>(columns = "*", options: SelectOptions = {}) {
    return new SelectBuilder<T>(this.execute, this.table, columns, options);
  }

  insert<T = any>(values: RowInput | RowInput[]) {
    return new InsertBuilder<T>(
      this.write,
      this.table,
      (Array.isArray(values) ? values : [values]) as Row[],
    );
  }

  upsert<T = any>(values: RowInput | RowInput[], options: UpsertOptions = {}) {
    return new UpsertBuilder<T>(
      this.write,
      this.table,
      (Array.isArray(values) ? values : [values]) as Row[],
      options,
    );
  }

  update<T = any>(patch: RowInput) {
    return new UpdateBuilder<T>(this.write, this.table, patch as Row);
  }

  delete<T = any>() {
    return new DeleteBuilder<T>(this.write, this.table);
  }
}

class RpcBuilder<T> implements PromiseLike<DbResult<T>> {
  constructor(
    private readonly execute: Executor,
    private readonly fn: string,
    private readonly args: Row,
    private readonly returns: "scalar" | "table" = "scalar",
  ) {}

  private async run(): Promise<DbResult<T>> {
    let compiled: CompiledQuery;
    try {
      compiled = compile({
        kind: "rpc",
        fn: this.fn,
        args: this.args,
        returns: this.returns,
      });
    } catch (err) {
      const { error, status } = toDbError(err);
      return { data: null, error, status: status || 400, count: null };
    }

    try {
      const result = await this.execute(compiled);
      // Table-returning functions come back as rows, like PostgREST does.
      // Scalar-returning functions come back as a single `result` column;
      // a `void` function yields null, matching PostgREST.
      const value = (
        this.returns === "table"
          ? result.rows
          : (result.rows[0]?.result ?? null)
      ) as T | null;
      return { data: value, error: null, status: 200, count: null };
    } catch (err) {
      const { error, status } = toDbError(err);
      return { data: null, error, status, count: null };
    }
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export class Db {
  constructor(
    private readonly execute: Executor,
    private readonly options: DbOptions = {},
  ) {}

  from(table: string): TableQuery {
    return new TableQuery(this.execute, table, this.options.onWrite);
  }

  rpc<T = any>(fn: string, args: RowInput = {}): RpcBuilder<T> {
    return new RpcBuilder<T>(this.rpcExecutor(fn), fn, args as Row);
  }

  /**
   * For `RETURNS TABLE` / `SETOF` functions: `data` is every row. `rpc()`
   * on such a function yields one record *string* - the birthday cron read
   * that as "no audience" every day and still reported success.
   */
  rpcRows<T = any>(fn: string, args: RowInput = {}): RpcBuilder<T[]> {
    return new RpcBuilder<T[]>(this.rpcExecutor(fn), fn, args as Row, "table");
  }

  /** An rpc may write, so a successful one is reported like a write. */
  private rpcExecutor(fn: string): Executor {
    return writingExecutor(this.execute, { fn }, this.options.onWrite);
  }
}

export function createDb(execute: Executor, options: DbOptions = {}): Db {
  return new Db(execute, options);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
