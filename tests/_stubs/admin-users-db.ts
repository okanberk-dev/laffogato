/**
 * An in-memory stand-in for the slice of the query builder `admin_users` uses.
 * Enough to exercise the real module — bcrypt hashing, the duplicate-email
 * race, the last-owner count — without a database.
 */

export type FakeRow = Record<string, unknown>;

let rows: FakeRow[] = [];

export function seedRows(next: FakeRow[] = []): void {
  rows = next.map((r) => ({ ...r }));
}

export function allRows(): FakeRow[] {
  return rows.map((r) => ({ ...r }));
}

type Op = "select" | "insert" | "update" | "delete";

class FakeQuery implements PromiseLike<unknown> {
  private readonly filters: Array<[string, "eq" | "neq", unknown]> = [];
  private limitValue: number | null = null;
  private single = false;

  constructor(
    private readonly op: Op,
    private readonly payload?: FakeRow,
  ) {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, "eq", value]);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push([column, "neq", value]);
    return this;
  }
  order() {
    return this;
  }
  limit(count: number) {
    this.limitValue = count;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }

  private matched(): FakeRow[] {
    return rows.filter((row) =>
      this.filters.every(([column, op, value]) =>
        op === "eq" ? row[column] === value : row[column] !== value,
      ),
    );
  }

  then<R1, R2 = never>(
    onOk?: ((v: unknown) => R1 | PromiseLike<R1>) | null,
    onErr?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let data: unknown = null;

    if (this.op === "select") {
      let found = this.matched();
      if (this.limitValue !== null) found = found.slice(0, this.limitValue);
      data = this.single ? (found[0] ?? null) : found;
    } else if (this.op === "insert") {
      const incoming = this.payload as FakeRow;
      if (rows.some((r) => r.email === incoming.email)) {
        return Promise.resolve({
          data: null,
          error: { code: "23505", message: "duplicate key" },
          status: 400,
        }).then(onOk, onErr);
      }
      rows.push({ ...incoming });
    } else if (this.op === "update") {
      for (const row of this.matched()) Object.assign(row, this.payload);
    } else if (this.op === "delete") {
      const doomed = new Set(this.matched());
      rows = rows.filter((row) => !doomed.has(row));
    }

    return Promise.resolve({ data, error: null, status: 200 }).then(
      onOk,
      onErr,
    );
  }
}

export function fakeDb() {
  return {
    TABLES: { adminUsers: "admin_users" },
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
