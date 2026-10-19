import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The write side of the site's data cache (src/lib/cache/tags.ts): every
 * write the database accepts expires the cached reads it made stale. The
 * cached entries have no short time limit, so a table or a SQL function that
 * nobody classified could leave the shop showing yesterday's price until the
 * next deploy. These tests make a new one fail CI until someone decides.
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

  it("only the four tags are used", () => {
    const used = new Set([
      ...Object.values(tags.TABLE_TAGS).flat(),
      ...Object.values(tags.RPC_TAGS).flat(),
    ]);
    expect([...used].sort()).toEqual([...tags.ALL_CACHE_TAGS].sort());
  });
});

describe("tagsForWrite", () => {
  it.each([
    ["products", ["pub:catalog"]],
    ["categories", ["pub:catalog"]],
    ["menu_items", ["pub:catalog"]],
    ["settings", ["pub:site"]],
    ["legal_docs", ["pub:site"]],
    ["venue_status", ["pub:site"]],
    ["home_hero_slides", ["pub:site"]],
    ["orders", ["live:orders"]],
    ["karaoke_reservations", ["live:karaoke"]],
    ["customers", []],
    ["auth_attempts", []],
    ["payment_transactions", []],
  ])("a write to %s expires %j", (table, expected) => {
    expect([...tags.tagsForWrite({ table })]).toEqual(expected);
  });

  it("stock and order functions expire the catalog and the orders", () => {
    for (const fn of [
      "claim_order_stock",
      "release_order_stock",
      "adjust_product_stock",
      "adjust_variant_stock",
      "save_product_variants",
      "set_order_item_status",
      "reserve_order_refund_once",
      "drop_order_refund",
      "wallet_place_order",
    ]) {
      expect([...tags.tagsForWrite({ fn })].sort(), fn).toEqual([
        "live:orders",
        "pub:catalog",
      ]);
    }
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
  it("expires each tag at once with { expire: 0 }", () => {
    tags.expireTags(["pub:catalog", "live:orders"]);
    expect(h.revalidateTag.mock.calls).toEqual([
      ["pub:catalog", { expire: 0 }],
      ["live:orders", { expire: 0 }],
    ]);
    expect(h.after).not.toHaveBeenCalled();
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
      ["pub:site", { expire: 0 }],
      ["live:orders", { expire: 0 }],
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

describe("getDb wires the hook", () => {
  it("index.ts hands every write to tagsForWrite and expireTags", () => {
    const src = readFileSync("src/lib/db/index.ts", "utf8");
    expect(src).toMatch(
      /createDb\(createExecutor\(\), \{[\s\S]*onWrite: \(target\) => expireTags\(tagsForWrite\(target\)\)/,
    );
  });
});
