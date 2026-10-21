import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The write side of the site's data cache (src/lib/cache/tags.ts): every
 * write sent to the database (a failed one too) expires the cached reads it
 * made stale. The cached entries have no short time limit, so a table or a
 * SQL function that nobody classified could leave the shop showing
 * yesterday's price until the next deploy. These tests make a new one fail
 * CI until someone decides.
 */

const h = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  after: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("next/server", () => ({ after: h.after }));

const tags = await import("@/lib/cache/tags");
const { TABLES } = await import("@/lib/db");

const SCHEMA = readFileSync("db/schema.sql", "utf8");

/** Every function the schema creates. */
function schemaFunctions(): string[] {
  const names = new Set<string>();
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)/gi;
  for (const m of SCHEMA.matchAll(re)) names.add(m[1].toLowerCase());
  return [...names].sort();
}

/** Every table the schema still has (created and not dropped later). */
function schemaTables(): string[] {
  const created = new Set<string>();
  for (const m of SCHEMA.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_0-9]+)/gi,
  )) {
    created.add(m[1].toLowerCase());
  }
  for (const m of SCHEMA.matchAll(
    /^\s*drop\s+table\s+(?:if\s+exists\s+)?public\.([a-z_0-9]+)/gim,
  )) {
    created.delete(m[1].toLowerCase());
  }
  return [...created].sort();
}

/** Tables only SQL functions write: the client never names them. */
const SQL_ONLY_TABLES = ["_migrations", "product_form_saves"];

/** The body of the LAST definition of `fn` (a later migration replaces it). */
function functionBody(fn: string): string | null {
  const heads = [
    ...SCHEMA.matchAll(
      new RegExp(
        String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${fn}\s*\(`,
        "gi",
      ),
    ),
  ];
  const head = heads.at(-1);
  if (!head) return null;
  const rest = SCHEMA.slice(head.index + head[0].length);
  const quote = /\$[a-z_]*\$/i.exec(rest);
  if (!quote) return null;
  const start = quote.index + quote[0].length;
  const end = rest.indexOf(quote[0], start);
  return end === -1 ? null : rest.slice(start, end);
}

/**
 * The tags a function's own SQL makes stale: those of every table its body
 * inserts into, updates or deletes from (functions run with
 * `search_path = ''`, so every name is `public.`-qualified; a dynamic
 * `execute format('insert into public.orders ...')` is read too), and of
 * every function it calls.
 */
function writtenTags(fn: string, seen: string[] = []): Set<string> | null {
  const body = functionBody(fn);
  if (body === null) return null;
  const out = new Set<string>();
  for (const m of body.matchAll(
    /\b(?:insert\s+into|update|delete\s+from)\s+(?:only\s+)?public\.([a-z_0-9]+)/gi,
  )) {
    const table = m[1].toLowerCase();
    if (SQL_ONLY_TABLES.includes(table)) continue;
    const t = (tags.TABLE_TAGS as Record<string, readonly string[]>)[table];
    // A table the map does not know: let the test say so.
    for (const tag of t ?? [`unknown table ${table}`]) out.add(tag);
  }
  for (const m of body.matchAll(/\bpublic\.([a-z_0-9]+)\s*\(/gi)) {
    const called = m[1].toLowerCase();
    if (called === fn || seen.includes(called) || !(called in tags.RPC_TAGS)) {
      continue;
    }
    for (const tag of writtenTags(called, [...seen, fn]) ?? []) out.add(tag);
  }
  return out;
}

beforeEach(() => {
  h.revalidateTag.mockReset();
  h.after.mockReset();
});

describe("every table and every function is classified", () => {
  it("every TABLES entry has a decision", () => {
    const unclassified = Object.values(TABLES).filter(
      (t) => !(t in tags.TABLE_TAGS),
    );
    expect(unclassified).toEqual([]);
    expect(Object.keys(tags.TABLE_TAGS).sort()).toEqual(
      [...Object.values(TABLES)].sort(),
    );
  });

  it("every table in db/schema.sql is in TABLES or written only by SQL", () => {
    const known = new Set<string>([
      ...Object.values(TABLES),
      ...SQL_ONLY_TABLES,
    ]);
    expect(schemaTables().filter((t) => !known.has(t))).toEqual([]);
  });

  it("every function in db/schema.sql has a decision", () => {
    const fns = schemaFunctions();
    // The parse still finds the functions the app calls.
    expect(fns).toEqual(
      expect.arrayContaining([
        "claim_order_stock",
        "next_seq",
        "legal_doc_save",
        "wallet_place_order",
      ]),
    );
    expect(fns.filter((f) => !(f in tags.RPC_TAGS))).toEqual([]);
  });

  it("only the six tags are used, each by something", () => {
    const used = new Set([
      ...Object.values(tags.TABLE_TAGS).flat(),
      ...Object.values(tags.RPC_TAGS).flat(),
    ]);
    expect([...used].sort()).toEqual([...tags.ALL_CACHE_TAGS].sort());
  });
});

describe("each function's tags are what its SQL writes", () => {
  it("the parse reads bodies, dynamic SQL and nested calls", () => {
    expect([...(writtenTags("wallet_place_order") ?? [])]).toEqual([
      "live:orders",
    ]);
    // restock_order_lines writes orders and calls credit_product_stock.
    expect([...(writtenTags("restock_order_lines") ?? [])].sort()).toEqual([
      "live:orders",
      "pub:catalog",
    ]);
    expect([...(writtenTags("record_stock_move") ?? [])]).toEqual([]);
  });

  it("no function is tagged with less (stale data) or more (a wake for nothing)", () => {
    const wrong = Object.keys(tags.RPC_TAGS)
      .map((fn) => {
        const written = writtenTags(fn);
        const have = [...tags.RPC_TAGS[fn]].sort();
        const want = written === null ? null : [...written].sort();
        return { fn, have, want };
      })
      .filter(
        ({ have, want }) =>
          want === null || JSON.stringify(have) !== JSON.stringify(want),
      );
    expect(wrong).toEqual([]);
  });
});

describe("tagsForWrite", () => {
  it.each([
    ["products", ["pub:catalog"]],
    ["categories", ["pub:catalog"]],
    // Apart from the shop: a stock move does not drop the menu.
    ["menu_items", ["pub:menu"]],
    ["settings", ["pub:site"]],
    ["legal_docs", ["pub:site"]],
    ["venue_status", ["pub:site"]],
    ["home_hero_slides", ["pub:site"]],
    ["orders", ["live:orders"]],
    ["karaoke_reservations", ["live:karaoke"]],
    // A user deactivated, demoted or given a new password: the change
    // markers move and each panel poll re-reads its account (rule 30).
    ["admin_users", ["live:access"]],
    ["customers", []],
    ["auth_attempts", []],
    ["payment_transactions", []],
  ])("a write to %s expires %j", (table, expected) => {
    expect([...tags.tagsForWrite({ table })]).toEqual(expected);
  });

  it("stock functions expire the shop, order functions the orders, the ledger nothing", () => {
    const expected: Record<string, string[]> = {
      claim_order_stock: ["pub:catalog"],
      release_order_stock: ["pub:catalog"],
      adjust_product_stock: ["pub:catalog"],
      adjust_variant_stock: ["pub:catalog"],
      save_product_variants: ["pub:catalog"],
      restock_order_lines: ["live:orders", "pub:catalog"],
      release_order_inventory: ["live:orders", "pub:catalog"],
      set_order_item_status: ["live:orders"],
      reserve_order_refund_once: ["live:orders"],
      drop_order_refund: ["live:orders"],
      wallet_place_order: ["live:orders"],
      record_stock_move: [],
    };
    for (const [fn, want] of Object.entries(expected)) {
      expect([...tags.tagsForWrite({ fn })].sort(), fn).toEqual(want);
    }
  });

  it("no function writes the menu: only a menu_items write drops it", () => {
    const menu = Object.entries(tags.RPC_TAGS)
      .filter(([, t]) => t.includes("pub:menu"))
      .map(([fn]) => fn);
    expect(menu).toEqual([]);
  });

  it("the legal override functions expire the site", () => {
    expect([...tags.tagsForWrite({ fn: "legal_doc_save" })]).toEqual([
      "pub:site",
    ]);
    expect([...tags.tagsForWrite({ fn: "legal_doc_reset" })]).toEqual([
      "pub:site",
    ]);
  });

  it("auth, promo, campaign, wishlist and counter functions expire nothing", () => {
    for (const fn of [
      "next_seq",
      "reserve_auth_attempt",
      "record_auth_failure",
      "redeem_promo",
      "campaign_email_claim",
      "toggle_wishlist",
    ]) {
      expect(tags.tagsForWrite({ fn }), fn).toEqual([]);
    }
  });

  it("an unknown function or table expires everything", () => {
    expect([...tags.tagsForWrite({ fn: "brand_new_fn" })].sort()).toEqual(
      [...tags.ALL_CACHE_TAGS].sort(),
    );
    expect([...tags.tagsForWrite({ table: "brand_new_table" })].sort()).toEqual(
      [...tags.ALL_CACHE_TAGS].sort(),
    );
  });
});

describe("expireTags", () => {
  it("expires each tag at once with { expire: 0 }, then again from after()", () => {
    tags.expireTags(["pub:catalog", "live:orders"]);
    expect(h.revalidateTag.mock.calls).toEqual([
      ["pub:catalog", { expire: 0 }],
      ["live:orders", { expire: 0 }],
    ]);
    // A route handler that throws after the write never sends the first
    // batch (tests/cache-expire-retry.test.ts); the second goes out anyway.
    expect(h.after).toHaveBeenCalledTimes(1);
    const task = h.after.mock.calls[0][0] as () => void;
    task();
    expect(h.revalidateTag.mock.calls.slice(2)).toEqual([
      ["pub:catalog", tags.SECOND_EXPIRY],
      ["live:orders", tags.SECOND_EXPIRY],
    ]);
  });

  it("the second expiry is an immediate one under another profile", () => {
    expect(tags.SECOND_EXPIRY.expire).toBe(0);
    expect(JSON.stringify(tags.SECOND_EXPIRY)).not.toBe(
      JSON.stringify({ expire: 0 }),
    );
  });

  it("does nothing for a write that touches nothing cached", () => {
    tags.expireTags([]);
    expect(h.revalidateTag).not.toHaveBeenCalled();
    expect(h.after).not.toHaveBeenCalled();
  });

  it("during a render (Next refuses: E7) hands the tags to after()", () => {
    let calls = 0;
    h.revalidateTag.mockImplementation(() => {
      calls += 1;
      // The render refuses; the after() callback is outside the render.
      if (calls <= 2) throw new Error("used revalidateTag during render");
    });
    tags.expireTags(["pub:site", "live:orders"]);
    expect(h.after).toHaveBeenCalledTimes(1);
    const task = h.after.mock.calls[0][0] as () => void;
    task();
    expect(h.revalidateTag.mock.calls.slice(2)).toEqual([
      ["pub:site", tags.SECOND_EXPIRY],
      ["live:orders", tags.SECOND_EXPIRY],
    ]);
  });

  it("never throws, not even when both refuse (no request scope)", () => {
    h.revalidateTag.mockImplementation(() => {
      throw new Error("static generation store missing");
    });
    h.after.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });
    expect(() => tags.expireTags(["pub:catalog"])).not.toThrow();
  });

  it("an after() task that is refused again does not throw either", () => {
    h.revalidateTag.mockImplementation(() => {
      throw new Error("inside unstable_cache");
    });
    tags.expireTags(["pub:catalog"]);
    const task = h.after.mock.calls[0][0] as () => void;
    expect(() => task()).not.toThrow();
  });
});

describe("a write whose reply was lost still expires its tags", () => {
  it("the price save that committed and then threw expires the catalog", async () => {
    const { createDb } = await import("@/lib/db/client");
    // What getDb() wires (src/lib/db/index.ts), over a connection that
    // drops after Postgres has committed the statement.
    const db = createDb(
      async () => {
        throw Object.assign(new Error("Connection terminated unexpectedly"), {
          code: "ECONNRESET",
        });
      },
      { onWrite: (target) => tags.expireTags(tags.tagsForWrite(target)) },
    );
    const res = await db
      .from(TABLES.products)
      .update({ priceMinor: 52000 })
      .eq("id", "prd-1");
    expect(res.error).not.toBeNull();
    await db.rpc("claim_order_stock", { p_lines: [], p_now: "now" });
    expect(h.revalidateTag.mock.calls).toEqual([
      ["pub:catalog", { expire: 0 }],
      ["pub:catalog", { expire: 0 }],
    ]);
  });
});

describe("writes the hook never sees", () => {
  it("the database docs name each one and purge every tag", () => {
    const doc = readFileSync("docs/DATABASE.md", "utf8");
    const purge = /vercel cache dangerously-delete --tag (\S+) --yes/.exec(doc);
    expect(purge).not.toBeNull();
    // A fifth tag must reach the operator's command too.
    expect(purge![1].split(",").sort()).toEqual(
      [...tags.ALL_CACHE_TAGS].sort(),
    );
    for (const way of [
      "scripts/*.mjs",
      "npm run dev",
      "Instant Rollback",
      "Undo Rollback",
      "ilk deploy",
    ]) {
      expect(doc).toContain(way);
    }
  });
});

describe("getDb wires the hook", () => {
  it("index.ts hands every write to tagsForWrite and expireTags", () => {
    const src = readFileSync("src/lib/db/index.ts", "utf8");
    expect(src).toMatch(
      /createDb\(createExecutor\(\), \{[\s\S]*onWrite: \(target\) => \{\s*const tags = tagsForWrite\(target\);\s*expireTags\(tags\);/,
    );
  });
});
