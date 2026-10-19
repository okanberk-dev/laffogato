import { describe, expect, it, vi } from "vitest";

import { createDb, toDbError, type Executor } from "@/lib/db/client";
import type { CompiledQuery } from "@/lib/db/sql";

/** Records the SQL it was handed and replays a canned result. */
function fakeExecutor(
  result: { rows?: Record<string, unknown>[]; rowCount?: number } = {},
) {
  const calls: CompiledQuery[] = [];
  const exec: Executor = async (query) => {
    calls.push(query);
    return { rows: result.rows ?? [], rowCount: result.rowCount ?? 0 };
  };
  return { exec, calls };
}

function throwingExecutor(err: unknown) {
  const exec: Executor = async () => {
    throw err;
  };
  return exec;
}

/** Shape of a Postgres error as the driver surfaces it. */
function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code, detail: "", hint: "" });
}

describe("result shape", () => {
  it("returns rows on a select", async () => {
    const { exec } = fakeExecutor({ rows: [{ id: "prd-1" }], rowCount: 1 });
    const db = createDb(exec);
    const res = await db.from("products").select("*");
    expect(res.error).toBeNull();
    expect(res.data).toEqual([{ id: "prd-1" }]);
    expect(res.status).toBe(200);
  });

  it("reports count for the head probe without returning rows", async () => {
    const { exec, calls } = fakeExecutor({ rows: [{ count: 7 }], rowCount: 1 });
    const db = createDb(exec);
    const res = await db
      .from("products")
      .select("*", { count: "exact", head: true });
    expect(res.count).toBe(7);
    expect(res.data).toBeNull();
    expect(calls[0].text).toContain("count(*)::int");
  });

  it("treats a zero count as zero, not as a missing value", async () => {
    const { exec } = fakeExecutor({ rows: [{ count: 0 }], rowCount: 1 });
    const res = await createDb(exec)
      .from("products")
      .select("*", { count: "exact", head: true });
    expect(res.count).toBe(0);
    expect(res.error).toBeNull();
  });
});

describe("maybeSingle", () => {
  it("returns the row when exactly one matches", async () => {
    const { exec } = fakeExecutor({ rows: [{ id: "a" }], rowCount: 1 });
    const res = await createDb(exec)
      .from("products")
      .select("*")
      .eq("id", "a")
      .maybeSingle();
    expect(res.data).toEqual({ id: "a" });
    expect(res.error).toBeNull();
  });

  it("returns null without an error when nothing matches", async () => {
    const { exec } = fakeExecutor({ rows: [], rowCount: 0 });
    const res = await createDb(exec)
      .from("products")
      .select("*")
      .eq("id", "nope")
      .maybeSingle();
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
  });

  it("errors when more than one row matches", async () => {
    const { exec } = fakeExecutor({ rows: [{ id: "a" }, { id: "b" }] });
    const res = await createDb(exec).from("products").select("*").maybeSingle();
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe("PGRST116");
  });
});

describe("mutations", () => {
  it("returns no rows unless select() is chained", async () => {
    const { exec } = fakeExecutor({ rows: [{ id: "a" }], rowCount: 1 });
    const res = await createDb(exec).from("products").insert({ id: "a" });
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
    expect(res.status).toBe(201);
  });

  it("returns representation rows when select() is chained", async () => {
    const { exec, calls } = fakeExecutor({ rows: [{ id: "a" }], rowCount: 1 });
    const res = await createDb(exec)
      .from("products")
      .delete()
      .eq("id", "a")
      .select();
    expect(res.data).toEqual([{ id: "a" }]);
    expect(calls[0].text).toContain("RETURNING *");
  });

  it("threads update filters in call order", async () => {
    const { exec, calls } = fakeExecutor();
    await createDb(exec)
      .from("orders")
      .update({ status: "paid" })
      .in("id", ["o1", "o2"])
      .neq("status", "refunded")
      .select();
    expect(calls[0].text).toBe(
      'UPDATE "orders" SET "status" = $1 WHERE "id" IN ($2, $3) ' +
        'AND "status" <> $4 RETURNING *',
    );
  });

  it("treats an upsert of zero rows as a no-op, as PostgREST does", async () => {
    // contentResource seeds an empty table with its seed list, and PRESS
    // ships as []. Compiled, that was `INSERT INTO "press" () VALUES ON
    // CONFLICT …` - 42601 - and the story page went down with it.
    const { exec, calls } = fakeExecutor();
    const plain = await createDb(exec)
      .from("press")
      .upsert([], { onConflict: "id", ignoreDuplicates: true });
    expect(plain.error).toBeNull();
    expect(plain.status).toBe(201);
    const withRows = await createDb(exec).from("press").upsert([]).select();
    expect(withRows.error).toBeNull();
    expect(withRows.data).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("still sends an upsert that has rows", async () => {
    const { exec, calls } = fakeExecutor();
    await createDb(exec)
      .from("press")
      .upsert([{ id: "p1", name: "X" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain('INSERT INTO "press"');
  });
});

describe("error handling", () => {
  it("returns database errors instead of throwing", async () => {
    const db = createDb(throwingExecutor(pgError("23505", "duplicate key")));
    const res = await db.from("payment_transactions").insert({ id: "x" });
    expect(res.error).not.toBeNull();
    expect(res.data).toBeNull();
  });

  it("preserves SQLSTATE 23505 so duplicate branches still work", async () => {
    const db = createDb(throwingExecutor(pgError("23505", "duplicate key")));
    const { error } = await db.from("customers").insert({ email: "a@b.c" });
    // The payment webhook and the customer/coupon inserts branch on this code.
    expect(error?.code).toBe("23505");
    expect(error?.message).toBe("duplicate key");
  });

  it("preserves the undefined-column SQLSTATE rather than masking it", async () => {
    const db = createDb(throwingExecutor(pgError("42703", "column x")));
    const { error, status } = await db.from("products").select("*");
    expect(error?.code).toBe("42703");
    expect(status).toBe(400);
  });

  it("reports a transport failure as status 0 with an empty code", async () => {
    // This is the exact production signature: the host is unreachable, so the
    // request never got a SQLSTATE back. Callers use it to tell "database
    // down" apart from "query rejected".
    const db = createDb(throwingExecutor(new TypeError("fetch failed")));
    const { error, status } = await db.from("products").select("*");
    expect(status).toBe(0);
    expect(error?.code).toBe("");
    expect(error?.message).toBe("fetch failed");
  });

  it("returns an unsafe identifier as an error, not an exception", async () => {
    const { exec } = fakeExecutor();
    const res = await createDb(exec).from('bad"name').select("*");
    expect(res.error?.message).toContain("unsafe");
    expect(res.data).toBeNull();
  });
});

describe("toDbError", () => {
  it("classifies a driver error with a SQLSTATE as a query error", () => {
    expect(toDbError(pgError("23514", "check violation")).status).toBe(400);
  });

  it("classifies an error without a SQLSTATE as unreachable", () => {
    expect(toDbError(new Error("ENOTFOUND")).status).toBe(0);
  });

  it("treats a Node errno on `code` as unreachable, not a rejected query", () => {
    // pg puts the errno on `code` when the socket never carried a query. Read
    // as a SQLSTATE it looked like a rejected query, so an unreachable host
    // bypassed the degraded-mode fallback and took every page to HTTP 500.
    for (const errno of [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNRESET",
    ]) {
      const { error, status } = toDbError(pgError(errno, "connect failed"));
      expect(status).toBe(0);
      expect(error.code).toBe("");
    }
  });

  it("keeps a real SQLSTATE intact so callers can still match on it", () => {
    const { error, status } = toDbError(pgError("23505", "duplicate key"));
    expect(error.code).toBe("23505");
    expect(status).toBe(400);
  });
});

describe("rpc", () => {
  it("unwraps a scalar result", async () => {
    const { exec, calls } = fakeExecutor({ rows: [{ result: 42 }] });
    const res = await createDb(exec).rpc("next_seq", { counter_key: "prd" });
    expect(res.data).toBe(42);
    expect(calls[0].params).toEqual(["prd"]);
  });

  it("unwraps an array result", async () => {
    const { exec } = fakeExecutor({ rows: [{ result: [3, 5] }] });
    const res = await createDb(exec).rpc("claim_order_stock", {
      p_lines: [],
      p_now: "now",
    });
    expect(res.data).toEqual([3, 5]);
  });

  it("returns every row of a table-returning function", async () => {
    const rows = [
      { email: "a@b.co", name: "A", marketing: true },
      { email: "c@d.co", name: "C", marketing: false },
    ];
    const { exec, calls } = fakeExecutor({ rows });
    const res = await createDb(exec).rpcRows("birthday_greeting_audience", {
      p_month_days: ["09-23"],
    });
    expect(res.data).toEqual(rows);
    expect(calls[0].text).toMatch(
      /^SELECT \* FROM "birthday_greeting_audience"/,
    );
  });

  it("yields null for a void function", async () => {
    const { exec } = fakeExecutor({ rows: [{ result: null }] });
    const res = await createDb(exec).rpc("increment_promo_usage", {
      promo_code: "X",
      p_now: "now",
    });
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
  });

  it("surfaces the raise-exception message used for stock claims", async () => {
    const db = createDb(
      throwingExecutor(pgError("P0001", "INSUFFICIENT_STOCK:prd-0001")),
    );
    const { error } = await db.rpc("claim_order_stock", {
      p_lines: [],
      p_now: "now",
    });
    expect(/INSUFFICIENT_STOCK:(.*)$/.exec(error?.message ?? "")?.[1]).toBe(
      "prd-0001",
    );
  });
});

describe("laziness", () => {
  it("does not touch the executor until the chain is awaited", async () => {
    const exec = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const builder = createDb(exec).from("products").select("*").eq("id", "a");
    expect(exec).not.toHaveBeenCalled();
    await builder;
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe("onWrite (the cache hook getDb wires to src/lib/cache/tags.ts)", () => {
  function recordingDb(exec: Executor) {
    const seen: unknown[] = [];
    const db = createDb(exec, { onWrite: (target) => seen.push(target) });
    return { db, seen };
  }

  it("fires once after each kind of successful write, with what it touched", async () => {
    const { exec } = fakeExecutor({ rows: [{ result: 1 }], rowCount: 1 });
    const { db, seen } = recordingDb(exec);
    await db.from("products").insert({ id: "a" });
    await db.from("press").upsert([{ id: "p1" }]);
    await db.from("orders").update({ status: "paid" }).eq("id", "o1");
    await db.from("menu_items").delete().eq("id", "m1").select("id");
    await db.rpc("claim_order_stock", { p_lines: [], p_now: "now" });
    await db.rpcRows("birthday_greeting_audience", { p_month_days: [] });
    expect(seen).toEqual([
      { table: "products" },
      { table: "press" },
      { table: "orders" },
      { table: "menu_items" },
      { fn: "claim_order_stock" },
      { fn: "birthday_greeting_audience" },
    ]);
  });

  it("does not fire for a select or a count", async () => {
    const { exec } = fakeExecutor({ rows: [{ count: 3 }], rowCount: 1 });
    const { db, seen } = recordingDb(exec);
    await db.from("products").select("*").eq("id", "a");
    await db.from("orders").select("*", { count: "exact", head: true });
    await db.from("orders").select("id").maybeSingle();
    expect(seen).toEqual([]);
  });

  it("does not fire when the statement failed, or never left", async () => {
    const failing = recordingDb(
      throwingExecutor(pgError("23505", "duplicate key")),
    );
    await failing.db.from("orders").insert({ id: "o1" });
    await failing.db.rpc("claim_order_stock", { p_lines: [], p_now: "now" });
    const offline = recordingDb(
      throwingExecutor(
        Object.assign(new Error("connect"), { code: "ECONNREFUSED" }),
      ),
    );
    await offline.db.from("products").update({ stock: 1 }).eq("id", "a");
    // An empty upsert sends nothing, so nothing was written.
    const { exec } = fakeExecutor();
    const empty = recordingDb(exec);
    await empty.db.from("press").upsert([]);
    // A bad identifier is refused before any SQL runs.
    await empty.db.from('bad"name').insert({ id: 1 });
    expect(failing.seen).toEqual([]);
    expect(offline.seen).toEqual([]);
    expect(empty.seen).toEqual([]);
  });

  it("a hook that throws never fails the write", async () => {
    const { exec } = fakeExecutor({ rows: [{ id: "a" }], rowCount: 1 });
    const db = createDb(exec, {
      onWrite: () => {
        throw new Error("cache down");
      },
    });
    const res = await db.from("products").insert({ id: "a" }).select("id");
    expect(res.error).toBeNull();
    expect(res.data).toEqual([{ id: "a" }]);
  });

  it("plain createDb has no hook and behaves as before", async () => {
    const exec = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const db = createDb(exec);
    const res = await db
      .from("orders")
      .update({ status: "paid" })
      .eq("id", "o");
    expect(res.error).toBeNull();
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
