import { describe, expect, it } from "vitest";

import { compile, quoteIdent, UnsafeIdentifierError } from "@/lib/db/sql";

describe("identifier safety", () => {
  it("quotes plain identifiers", () => {
    expect(quoteIdent("priceMinor")).toBe('"priceMinor"');
    expect(quoteIdent("menu_items")).toBe('"menu_items"');
  });

  it("rejects anything that is not a bare identifier", () => {
    for (const bad of [
      'id"; drop table products; --',
      "id, name",
      "1abc",
      "",
      "a-b",
      "a b",
    ]) {
      expect(() => quoteIdent(bad)).toThrow(UnsafeIdentifierError);
    }
  });

  it("rejects an injected table name", () => {
    expect(() =>
      compile({
        kind: "select",
        table: 'products"; drop table orders; --',
        columns: "*",
        filters: [],
        orders: [],
        limit: null,
        count: null,
        head: false,
      }),
    ).toThrow(UnsafeIdentifierError);
  });

  it("never interpolates a value into the SQL text", () => {
    const { text, params } = compile({
      kind: "select",
      table: "products",
      columns: "*",
      filters: [{ op: "eq", column: "slug", value: "'; drop table orders; --" }],
      orders: [],
      limit: null,
      count: null,
      head: false,
    });
    expect(text).toBe('SELECT * FROM "products" WHERE "slug" = $1');
    expect(text).not.toContain("drop table");
    expect(params).toEqual(["'; drop table orders; --"]);
  });
});

describe("select", () => {
  const base = {
    kind: "select" as const,
    table: "products",
    columns: "*",
    filters: [],
    orders: [],
    limit: null,
    count: null,
    head: false,
  };

  it("compiles a bare select", () => {
    expect(compile(base).text).toBe('SELECT * FROM "products"');
  });

  it("quotes a column list", () => {
    expect(compile({ ...base, columns: "key, value" }).text).toBe(
      'SELECT "key", "value" FROM "products"',
    );
  });

  it("compiles the head+count probe used by countRows", () => {
    const q = compile({ ...base, count: "exact", head: true });
    expect(q.text).toBe('SELECT count(*)::int AS count FROM "products"');
    expect(q.params).toEqual([]);
  });

  it("compiles filters, ordering and limit together", () => {
    const q = compile({
      ...base,
      filters: [
        { op: "eq", column: "isActive", value: true },
        { op: "neq", column: "cat", value: "gear" },
        { op: "gte", column: "createdAt", value: "2026-01-01" },
        { op: "ilike", column: "name", value: "%kahve%" },
      ],
      orders: [
        { column: "sortOrder", ascending: true },
        { column: "createdAt", ascending: false },
      ],
      limit: 5,
    });
    expect(q.text).toBe(
      'SELECT * FROM "products" WHERE "isActive" = $1 AND "cat" <> $2 AND ' +
        '"createdAt" >= $3 AND "name" ILIKE $4 ORDER BY "sortOrder" ASC, ' +
        '"createdAt" DESC LIMIT $5',
    );
    expect(q.params).toEqual([true, "gear", "2026-01-01", "%kahve%", 5]);
  });

  it("expands IN into one placeholder per value", () => {
    const q = compile({
      ...base,
      filters: [{ op: "in", column: "id", value: ["a", "b", "c"] }],
    });
    expect(q.text).toBe('SELECT * FROM "products" WHERE "id" IN ($1, $2, $3)');
    expect(q.params).toEqual(["a", "b", "c"]);
  });

  it("turns an empty IN list into a contradiction, not a syntax error", () => {
    const q = compile({
      ...base,
      filters: [{ op: "in", column: "id", value: [] }],
    });
    expect(q.text).toBe('SELECT * FROM "products" WHERE false');
    expect(q.params).toEqual([]);
  });

  it("maps eq(null) to IS NULL", () => {
    const q = compile({
      ...base,
      filters: [{ op: "eq", column: "orderId", value: null }],
    });
    expect(q.text).toBe('SELECT * FROM "products" WHERE "orderId" IS NULL');
    expect(q.params).toEqual([]);
  });
});

describe("insert", () => {
  it("compiles a single row without RETURNING when no select is chained", () => {
    const q = compile({
      kind: "insert",
      table: "orders",
      rows: [{ id: "ord-1", totalMinor: 500 }],
      returning: null,
    });
    expect(q.text).toBe(
      'INSERT INTO "orders" ("id", "totalMinor") VALUES ($1, $2)',
    );
    expect(q.params).toEqual(["ord-1", 500]);
  });

  it("adds RETURNING when a select is chained", () => {
    const q = compile({
      kind: "insert",
      table: "orders",
      rows: [{ id: "ord-1" }],
      returning: "*",
    });
    expect(q.text).toBe('INSERT INTO "orders" ("id") VALUES ($1) RETURNING *');
  });

  it("serialises objects and arrays as JSON for jsonb columns", () => {
    const q = compile({
      kind: "insert",
      table: "products",
      rows: [{ id: "prd-1", images: ["a.png"], variants: [{ id: "v1" }] }],
      returning: null,
    });
    expect(q.params).toEqual(["prd-1", '["a.png"]', '[{"id":"v1"}]']);
  });

  it("uses DEFAULT for a column missing from one row of a multi-row insert", () => {
    const q = compile({
      kind: "insert",
      table: "products",
      rows: [{ id: "a", stock: 1 }, { id: "b" }],
      returning: null,
    });
    expect(q.text).toBe(
      'INSERT INTO "products" ("id", "stock") VALUES ($1, $2), ($3, DEFAULT)',
    );
    expect(q.params).toEqual(["a", 1, "b"]);
  });
});

describe("upsert", () => {
  it("compiles ignoreDuplicates as DO NOTHING (the seed path)", () => {
    const q = compile({
      kind: "upsert",
      table: "products",
      rows: [{ id: "prd-1", name: "Kahve" }],
      onConflict: "id",
      ignoreDuplicates: true,
      returning: null,
    });
    expect(q.text).toBe(
      'INSERT INTO "products" ("id", "name") VALUES ($1, $2) ' +
        'ON CONFLICT ("id") DO NOTHING',
    );
  });

  it("compiles a real upsert as DO UPDATE excluding the conflict key", () => {
    const q = compile({
      kind: "upsert",
      table: "settings",
      rows: [{ id: "main", name: "L'Affogato", taxRatePct: 20 }],
      onConflict: "id",
      ignoreDuplicates: false,
      returning: null,
    });
    expect(q.text).toBe(
      'INSERT INTO "settings" ("id", "name", "taxRatePct") VALUES ($1, $2, $3) ' +
        'ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", ' +
        '"taxRatePct" = EXCLUDED."taxRatePct"',
    );
  });

  it("degrades to DO NOTHING when every column is a conflict key", () => {
    const q = compile({
      kind: "upsert",
      table: "counters",
      rows: [{ id: "prd" }],
      onConflict: "id",
      ignoreDuplicates: false,
      returning: null,
    });
    expect(q.text).toContain("DO NOTHING");
  });
});

describe("update and delete", () => {
  it("compiles update with filters and RETURNING", () => {
    const q = compile({
      kind: "update",
      table: "orders",
      patch: { status: "paid", updatedAt: "2026-08-26" },
      filters: [
        { op: "eq", column: "id", value: "ord-1" },
        { op: "eq", column: "status", value: "pending_payment" },
      ],
      returning: "*",
    });
    expect(q.text).toBe(
      'UPDATE "orders" SET "status" = $1, "updatedAt" = $2 ' +
        'WHERE "id" = $3 AND "status" = $4 RETURNING *',
    );
    expect(q.params).toEqual([
      "paid",
      "2026-08-26",
      "ord-1",
      "pending_payment",
    ]);
  });

  it("refuses an update with no columns rather than emitting invalid SQL", () => {
    expect(() =>
      compile({
        kind: "update",
        table: "orders",
        patch: {},
        filters: [],
        returning: null,
      }),
    ).toThrow(/no columns/);
  });

  it("compiles delete with filters and RETURNING", () => {
    const q = compile({
      kind: "delete",
      table: "products",
      filters: [{ op: "in", column: "id", value: ["a", "b"] }],
      returning: "*",
    });
    expect(q.text).toBe(
      'DELETE FROM "products" WHERE "id" IN ($1, $2) RETURNING *',
    );
  });
});

describe("rpc", () => {
  it("compiles next_seq with named notation", () => {
    const q = compile({
      kind: "rpc",
      fn: "next_seq",
      args: { counter_key: "prd" },
    });
    expect(q.text).toBe('SELECT "next_seq"("counter_key" => $1) AS result');
    expect(q.params).toEqual(["prd"]);
  });

  it("casts object arguments to jsonb", () => {
    const q = compile({
      kind: "rpc",
      fn: "claim_order_stock",
      args: {
        p_lines: [{ productId: "prd-1", variantId: null, qty: 2 }],
        p_now: "2026-08-26T00:00:00.000Z",
      },
    });
    expect(q.text).toBe(
      'SELECT "claim_order_stock"("p_lines" => $1::jsonb, "p_now" => $2) ' +
        "AS result",
    );
    expect(q.params).toEqual([
      '[{"productId":"prd-1","variantId":null,"qty":2}]',
      "2026-08-26T00:00:00.000Z",
    ]);
  });

  it("rejects an injected function name", () => {
    expect(() =>
      compile({ kind: "rpc", fn: "next_seq(); drop table orders; --", args: {} }),
    ).toThrow(UnsafeIdentifierError);
  });
});
