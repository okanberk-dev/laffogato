/**
 * Pure SQL compiler for the PostgREST-compatible query layer.
 *
 * Deliberately free of any driver import so the whole surface is unit-testable
 * without a database: `compile()` turns a QuerySpec into parameterised SQL and
 * nothing else. The driver lives in `./index.ts`, the chainable API in
 * `./client.ts`.
 *
 * Identifier safety: table/column/function names can never be parameterised in
 * SQL, so every identifier is validated against a strict pattern and quoted.
 * Anything that is not a plain unquoted-safe identifier is rejected outright
 * rather than escaped - this schema only ever uses simple camelCase and
 * snake_case names, so a rejection means a bug, not a limitation.
 */

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class UnsafeIdentifierError extends Error {
  constructor(kind: string, value: string) {
    super(`unsafe ${kind} identifier: ${JSON.stringify(value)}`);
    this.name = "UnsafeIdentifierError";
  }
}

/** Quote a single identifier, rejecting anything unexpected. */
export function quoteIdent(value: string, kind = "column"): string {
  if (!IDENTIFIER.test(value)) throw new UnsafeIdentifierError(kind, value);
  return `"${value}"`;
}

/** `"*"` stays `*`; `"a, b"` becomes `"a", "b"`. No embedded-relation syntax. */
function quoteColumnList(columns: string): string {
  const trimmed = columns.trim();
  if (trimmed === "*" || trimmed === "") return "*";
  return trimmed
    .split(",")
    .map((c) => quoteIdent(c.trim()))
    .join(", ");
}

export type FilterOp =
  "eq" | "neq" | "ieq" | "in" | "gte" | "lt" | "ilike" | "foldLike" | "any";

export interface Filter {
  op: FilterOp;
  /** Ignored for `any`, whose conditions carry their own columns. */
  column: string;
  /** For `any`: the AnyOfCondition[] of which at least one must hold. */
  value: unknown;
}

/**
 * One alternative of an `any` filter. Deliberately a short list of ops and
 * no nesting: one search box matching an order number, a name or an e-mail,
 * and "due since" across two timestamps (the bar screen's open orders,
 * `listPanelOpenOrderRows`).
 */
export interface AnyOfCondition {
  column: string;
  op: "eq" | "ieq" | "ilike" | "foldLike" | "gte";
  value: unknown;
}

/**
 * The value of a `foldLike` filter: a LIKE pattern matched after both the
 * column and the pattern go through `lower(translate(…, from, to))`. The
 * panel's search passes the Turkish fold (`TR_FOLD_SQL_FROM/TO`,
 * lib/admin/text-fold.ts: ILIKE does not fold İ, I and ı) or a phone's
 * punctuation to delete. All three are parameters, never SQL text.
 */
export interface FoldLikeValue {
  pattern: string;
  from: string;
  to: string;
}

export interface OrderBy {
  column: string;
  ascending: boolean;
}

export type Row = Record<string, unknown>;

export type QuerySpec =
  | {
      kind: "select";
      table: string;
      columns: string;
      filters: Filter[];
      orders: OrderBy[];
      limit: number | null;
      /** Rows to skip before the first one returned (numbered pages). */
      offset?: number | null;
      count: "exact" | null;
      head: boolean;
    }
  | { kind: "insert"; table: string; rows: Row[]; returning: string | null }
  | {
      kind: "update";
      table: string;
      patch: Row;
      filters: Filter[];
      returning: string | null;
    }
  | {
      kind: "upsert";
      table: string;
      rows: Row[];
      onConflict: string;
      ignoreDuplicates: boolean;
      returning: string | null;
    }
  | {
      kind: "delete";
      table: string;
      filters: Filter[];
      returning: string | null;
    }
  | {
      kind: "rpc";
      fn: string;
      args: Row;
      /**
       * "scalar" (default): `SELECT fn(…) AS result`, one cell.
       * "table": `SELECT * FROM fn(…)`, every row - for `RETURNS TABLE` /
       * `SETOF` functions, whose rows the scalar form hands back as one
       * unparsed record string like `"(a@b.com,Ali,t)"`.
       */
      returns?: "scalar" | "table";
    };

export interface CompiledQuery {
  text: string;
  params: unknown[];
}

/**
 * JS objects and arrays are bound as JSON text. Postgres infers the parameter
 * type from the target column, so a JSON string lands in a `jsonb` column
 * correctly - whereas handing the driver a JS array would be serialised as a
 * Postgres array literal and rejected.
 */
function bind(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

class ParamBag {
  readonly params: unknown[] = [];

  add(value: unknown): string {
    this.params.push(bind(value));
    return `$${this.params.length}`;
  }
}

function whereClause(filters: Filter[], bag: ParamBag): string {
  if (filters.length === 0) return "";
  return ` WHERE ${filters.map((f) => condition(f, bag)).join(" AND ")}`;
}

function condition(f: Filter, bag: ParamBag): string {
  if (f.op === "any") {
    // OR across the alternatives, in parentheses so it ANDs with the rest.
    // An empty list matches nothing, like an empty IN.
    const alternatives = (Array.isArray(f.value) ? f.value : []).map(
      (c: AnyOfCondition) => {
        if (
          c.op !== "eq" &&
          c.op !== "ieq" &&
          c.op !== "ilike" &&
          c.op !== "foldLike" &&
          c.op !== "gte"
        ) {
          throw new Error(`unsupported any-of op: ${String(c.op)}`);
        }
        return condition({ op: c.op, column: c.column, value: c.value }, bag);
      },
    );
    return alternatives.length === 0 ? "false" : `(${alternatives.join(" OR ")})`;
  }
  const col = quoteIdent(f.column);
  switch (f.op) {
    case "eq":
      // `col = NULL` is never true in SQL; PostgREST treats eq(null) as IS NULL.
      return f.value === null
        ? `${col} IS NULL`
        : `${col} = ${bag.add(f.value)}`;
    case "neq":
      return f.value === null
        ? `${col} IS NOT NULL`
        : `${col} <> ${bag.add(f.value)}`;
    case "gte":
      return `${col} >= ${bag.add(f.value)}`;
    case "lt":
      return `${col} < ${bag.add(f.value)}`;
    case "ieq":
      // Case-insensitive EQUALITY, not a pattern match. `ILIKE` with no
      // wildcard reads the same but is an `~~*` operator, and Postgres has
      // no btree opclass for it: the `lower(col)` expression indexes this
      // schema carries (orders, counter_tokens, the order idempotency key)
      // can never be chosen for one, so every such lookup was a sequential
      // scan. `lower(col) = lower($1)` matches the index expression exactly.
      return `lower(${col}) = lower(${bag.add(f.value)})`;
    case "ilike":
      return `${col} ILIKE ${bag.add(f.value)}`;
    case "foldLike": {
      // A substring search reads every row anyway, so no index is lost by
      // wrapping the column. Folded on both sides by the same expression.
      const v = f.value as Partial<FoldLikeValue> | null;
      if (
        !v ||
        typeof v.pattern !== "string" ||
        typeof v.from !== "string" ||
        typeof v.to !== "string"
      ) {
        throw new Error("foldLike needs { pattern, from, to } strings");
      }
      const from = bag.add(v.from);
      const to = bag.add(v.to);
      return (
        `lower(translate(${col}, ${from}, ${to})) LIKE ` +
        `lower(translate(${bag.add(v.pattern)}, ${from}, ${to}))`
      );
    }
    case "in": {
      const list = Array.isArray(f.value) ? f.value : [f.value];
      // An empty IN list is a contradiction, not a syntax error.
      if (list.length === 0) return "false";
      return `${col} IN (${list.map((v) => bag.add(v)).join(", ")})`;
    }
    default: {
      const exhaustive: never = f.op;
      throw new Error(`unsupported filter op: ${String(exhaustive)}`);
    }
  }
}

function orderClause(orders: OrderBy[]): string {
  if (orders.length === 0) return "";
  const parts = orders.map(
    (o) => `${quoteIdent(o.column)} ${o.ascending ? "ASC" : "DESC"}`,
  );
  return ` ORDER BY ${parts.join(", ")}`;
}

function returningClause(returning: string | null): string {
  return returning === null ? "" : ` RETURNING ${quoteColumnList(returning)}`;
}

/** Column union across rows, preserving first-seen order. */
function unionColumns(rows: Row[]): string[] {
  const seen: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

function valuesClause(rows: Row[], columns: string[], bag: ParamBag): string {
  const tuples = rows.map((row) => {
    const cells = columns.map((col) =>
      // A row missing a column takes the column DEFAULT rather than NULL, so a
      // partial row cannot null out a NOT NULL column that has a default.
      Object.prototype.hasOwnProperty.call(row, col)
        ? bag.add(row[col])
        : "DEFAULT",
    );
    return `(${cells.join(", ")})`;
  });
  return tuples.join(", ");
}

export function compile(spec: QuerySpec): CompiledQuery {
  const bag = new ParamBag();

  switch (spec.kind) {
    case "select": {
      const table = quoteIdent(spec.table, "table");
      if (spec.head && spec.count === "exact") {
        const where = whereClause(spec.filters, bag);
        return {
          text: `SELECT count(*)::int AS count FROM ${table}${where}`,
          params: bag.params,
        };
      }
      const cols = quoteColumnList(spec.columns);
      const where = whereClause(spec.filters, bag);
      const order = orderClause(spec.orders);
      const limit = spec.limit === null ? "" : ` LIMIT ${bag.add(spec.limit)}`;
      const offset =
        spec.offset === null || spec.offset === undefined
          ? ""
          : ` OFFSET ${bag.add(spec.offset)}`;
      return {
        text: `SELECT ${cols} FROM ${table}${where}${order}${limit}${offset}`,
        params: bag.params,
      };
    }

    case "insert": {
      const table = quoteIdent(spec.table, "table");
      const columns = unionColumns(spec.rows);
      if (columns.length === 0) {
        return {
          text: `INSERT INTO ${table} DEFAULT VALUES${returningClause(spec.returning)}`,
          params: bag.params,
        };
      }
      const cols = columns.map((c) => quoteIdent(c)).join(", ");
      const values = valuesClause(spec.rows, columns, bag);
      return {
        text: `INSERT INTO ${table} (${cols}) VALUES ${values}${returningClause(spec.returning)}`,
        params: bag.params,
      };
    }

    case "upsert": {
      const table = quoteIdent(spec.table, "table");
      const columns = unionColumns(spec.rows);
      const cols = columns.map((c) => quoteIdent(c)).join(", ");
      const values = valuesClause(spec.rows, columns, bag);
      const conflictCols = spec.onConflict
        .split(",")
        .map((c) => quoteIdent(c.trim()))
        .join(", ");
      const updatable = columns.filter(
        (c) =>
          !spec.onConflict
            .split(",")
            .map((k) => k.trim())
            .includes(c),
      );
      const action =
        spec.ignoreDuplicates || updatable.length === 0
          ? "DO NOTHING"
          : `DO UPDATE SET ${updatable
              .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
              .join(", ")}`;
      return {
        text: `INSERT INTO ${table} (${cols}) VALUES ${values} ON CONFLICT (${conflictCols}) ${action}${returningClause(spec.returning)}`,
        params: bag.params,
      };
    }

    case "update": {
      const table = quoteIdent(spec.table, "table");
      const entries = Object.entries(spec.patch);
      if (entries.length === 0) throw new Error("update() with no columns");
      const sets = entries
        .map(([col, value]) => `${quoteIdent(col)} = ${bag.add(value)}`)
        .join(", ");
      const where = whereClause(spec.filters, bag);
      return {
        text: `UPDATE ${table} SET ${sets}${where}${returningClause(spec.returning)}`,
        params: bag.params,
      };
    }

    case "delete": {
      const table = quoteIdent(spec.table, "table");
      const where = whereClause(spec.filters, bag);
      return {
        text: `DELETE FROM ${table}${where}${returningClause(spec.returning)}`,
        params: bag.params,
      };
    }

    case "rpc": {
      const fn = quoteIdent(spec.fn, "function");
      const args = Object.entries(spec.args).map(([name, value]) => {
        const placeholder = bag.add(value);
        // Object/array args are bound as JSON text, so they need an explicit
        // cast: unlike a column target there is no type to infer from.
        const cast =
          value !== null &&
          typeof value === "object" &&
          !(value instanceof Date)
            ? "::jsonb"
            : "";
        return `${quoteIdent(name, "argument")} => ${placeholder}${cast}`;
      });
      return {
        text:
          spec.returns === "table"
            ? `SELECT * FROM ${fn}(${args.join(", ")})`
            : `SELECT ${fn}(${args.join(", ")}) AS result`,
        params: bag.params,
      };
    }

    default: {
      const exhaustive: never = spec;
      throw new Error(`unsupported query: ${JSON.stringify(exhaustive)}`);
    }
  }
}
