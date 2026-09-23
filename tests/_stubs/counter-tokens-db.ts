/**
 * An in-memory stand-in for the slice of the query builder `counter_tokens`
 * uses. Enough to exercise the real module - the conditional single-use
 * UPDATE, the open-token cap, the per-minute window - without a database.
 *
 * Mutations return rows only when `.select()` is chained, exactly like
 * src/lib/db/client.ts: the single-use guard is read off that row count, so a
 * stub that always returned rows would make the race test pass for free.
 */

export type FakeRow = Record<string, unknown>;

let rows: FakeRow[] = [];

export function seedTokens(next: FakeRow[] = []): void {
  rows = next.map((r) => ({ ...r }));
}

export function allTokens(): FakeRow[] {
  return rows.map((r) => ({ ...r }));
}

type Op = "select" | "insert" | "update" | "delete";
type FilterOp = "eq" | "gte" | "lt";

class FakeQuery implements PromiseLike<unknown> {
  private readonly filters: Array<[string, FilterOp, unknown]> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private single = false;
  private returning = false;

  constructor(
    private readonly op: Op,
    private readonly payload?: FakeRow,
  ) {}

  select() {
    this.returning = true;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, "eq", value]);
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push([column, "gte", value]);
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push([column, "lt", value]);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }

  private matched(): FakeRow[] {
    const found = rows.filter((row) =>
      this.filters.every(([column, op, value]) => {
        const cell = row[column];
        if (op === "eq") return cell === value;
        return op === "gte"
          ? String(cell) >= String(value)
          : String(cell) < String(value);
      }),
    );
    if (!this.orderBy) return found;
    const { column, ascending } = this.orderBy;
    return [...found].sort((a, b) => {
      const left = String(a[column] ?? "");
      const right = String(b[column] ?? "");
      if (left === right) return 0;
      return (left < right ? -1 : 1) * (ascending ? 1 : -1);
    });
  }

  then<R1, R2 = never>(
    onOk?: ((v: unknown) => R1 | PromiseLike<R1>) | null,
    onErr?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let data: unknown = null;

    if (this.op === "select") {
      const found = this.matched();
      data = this.single ? (found[0] ?? null) : found;
    } else if (this.op === "insert") {
      const incoming = this.payload as FakeRow;
      if (rows.some((r) => r.tokenHash === incoming.tokenHash)) {
        return Promise.resolve({
          data: null,
          error: { code: "23505", message: "duplicate key" },
          status: 400,
        }).then(onOk, onErr);
      }
      rows.push({ ...incoming });
      if (this.returning) data = [{ ...incoming }];
    } else if (this.op === "update") {
      const touched = this.matched();
      for (const row of touched) Object.assign(row, this.payload);
      if (this.returning) data = touched.map((r) => ({ ...r }));
    } else if (this.op === "delete") {
      const doomed = new Set(this.matched());
      const removed = [...doomed];
      rows = rows.filter((row) => !doomed.has(row));
      if (this.returning) data = removed;
    }

    return Promise.resolve({ data, error: null, status: 200 }).then(
      onOk,
      onErr,
    );
  }
}

export function fakeTokenDb() {
  return {
    TABLES: { counterTokens: "counter_tokens" },
    getDb: () => ({
      from: () => ({
        select: () => new FakeQuery("select"),
        insert: (values: FakeRow) => new FakeQuery("insert", values),
        update: (patch: FakeRow) => new FakeQuery("update", patch),
        delete: () => new FakeQuery("delete"),
      }),
    }),
  };
}
