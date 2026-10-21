import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompiledQuery } from "@/lib/db/sql";

/**
 * The panel's search (lib/admin/search.ts, P2b decision D36): which
 * sections a role may search, what the box's text is read as, and the SQL
 * each section sends: folded on both sides, LIMIT one past the five shown,
 * and nothing at all for a section the role may not open (orders carry a
 * customer's name and e-mail, members a phone).
 *
 * The database is a stub that records each compiled query and answers it
 * by table; the SQL itself runs in tests/db-integration-admin-search.test.ts.
 */

const sent: CompiledQuery[] = [];
let answers: Record<string, Record<string, unknown>[]> = {};
let unreachable = false;

vi.mock("@/lib/db", async () => {
  const { createDb } = await import("@/lib/db/client");
  const { TABLES } =
    await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  const db = createDb(async (q) => {
    sent.push(q);
    if (unreachable) {
      throw Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      });
    }
    const table = /FROM "([a-z_]+)"/.exec(q.text)?.[1] ?? "";
    const rows = answers[table] ?? [];
    return { rows, rowCount: rows.length };
  });
  return { TABLES, getDb: () => db };
});

// The action's session (tests below): who is signed in, or nobody.
const auth = vi.hoisted(() => ({
  session: null as null | { email: string; role: string; expiresAt: number },
  throws: null as unknown,
}));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: async () => {
    if (auth.throws) throw auth.throws;
    return auth.session;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), {
      digest: `NEXT_REDIRECT;replace;${to};307;`,
    });
  },
  // Next's own: a redirect is passed on, anything else is the caller's.
  unstable_rethrow: (err: unknown) => {
    if (String((err as { digest?: unknown })?.digest).startsWith("NEXT_")) {
      throw err;
    }
  },
}));

const { parseSearch, searchAdmin, searchSectionsFor, SEARCH_LIMIT } =
  await import("@/lib/admin/search");
const { adminSearchAction } = await import("@/app/admin/ara/actions");
const { INITIAL_SEARCH_STATE } = await import("@/lib/admin/search-core");

const tablesQueried = () =>
  sent.map((q) => /FROM "([a-z_]+)"/.exec(q.text)?.[1]).sort();

beforeEach(() => {
  sent.length = 0;
  answers = {};
  unreachable = false;
  auth.session = null;
  auth.throws = null;
});

describe("who searches what", () => {
  it("follows the role matrix, section by section", () => {
    expect(searchSectionsFor("owner")).toEqual([
      "orders",
      "customers",
      "karaoke",
      "products",
      "menu",
    ]);
    expect(searchSectionsFor("manager")).toEqual(searchSectionsFor("owner"));
    // Personel: orders and karaoke, as in their nav; no member records,
    // no catalogue.
    expect(searchSectionsFor("staff")).toEqual(["orders", "karaoke"]);
    // Kasiyer: the till only.
    expect(searchSectionsFor("cashier")).toEqual([]);
  });

  it("a staff search never reads the members table", async () => {
    const q = parseSearch("ayşe")!;
    await searchAdmin(q, "staff");
    expect(tablesQueried()).toEqual(["orders"]);
    await searchAdmin(parseSearch("KRK-00042")!, "staff");
    expect(tablesQueried()).not.toContain("customers");
    expect(tablesQueried()).not.toContain("products");
  });

  it("a cashier's search sends no query at all", async () => {
    expect(await searchAdmin(parseSearch("10234")!, "cashier")).toEqual([]);
    expect(sent).toHaveLength(0);
  });
});

describe("reading the box", () => {
  it("needs two characters and caps a long paste", () => {
    expect(parseSearch("")).toBeNull();
    expect(parseSearch("  a ")).toBeNull();
    expect(parseSearch(undefined)).toBeNull();
    expect(parseSearch(["ab"])).toBeNull();
    expect(parseSearch("x".repeat(500))!.text).toHaveLength(80);
  });

  it("reads an order number with or without #", () => {
    expect(parseSearch("10234")!.orderNo).toBe(10234);
    expect(parseSearch("#10234")!.orderNo).toBe(10234);
    expect(parseSearch("# 10234")!.orderNo).toBe(10234);
    expect(parseSearch("ayşe")!.orderNo).toBeNull();
  });

  it("reads a phone in any spelling as its national digits, not an order number", () => {
    expect(parseSearch("0532 123 45 67")!.phone).toBe("5321234567");
    expect(parseSearch("+90 (532) 123-45-67")!.phone).toBe("5321234567");
    // Five digits is an order number, not a phone.
    expect(parseSearch("10234")!.phone).toBeNull();
    expect(parseSearch("ayşe 0532")!.phone).toBeNull();
  });

  it("reads a karaoke code the way the booking page does", () => {
    expect(parseSearch("KRK-00042")!.karaokeId).toBe("krk-00042");
    expect(parseSearch("krk42")!.karaokeId).toBe("krk-00042");
    expect(parseSearch("42")!.karaokeId).toBe("krk-00042");
    expect(parseSearch("krk-100000")!.karaokeId).toBe("krk-100000");
    expect(parseSearch("ayşe")!.karaokeId).toBeNull();
  });

  it("escapes LIKE's wildcards in the pattern", () => {
    expect(parseSearch("50%_x")!.pattern).toBe("%50\\%\\_x%");
  });
});

describe("the SQL", () => {
  it("folds the column and the pattern the Turkish way, LIMIT six", async () => {
    await searchAdmin(parseSearch("İsmail")!, "owner");
    const orders = sent.find((q) => q.text.includes('FROM "orders"'))!;
    expect(orders.text).toContain(
      'lower(translate("customerName", $1, $2)) LIKE lower(translate($3, $1, $2))',
    );
    expect(orders.text).toContain('lower(translate("customerEmail"');
    expect(orders.params.slice(0, 3)).toEqual([
      "İIıÇŞĞÖÜÂÎÛ̇",
      "iiiçşğöüâîû",
      "%İsmail%",
    ]);
    expect(orders.text).toMatch(/LIMIT \$\d+$/);
    expect(orders.params.at(-1)).toBe(SEARCH_LIMIT + 1);
    // Read-only: nothing but SELECTs.
    for (const q of sent) expect(q.text).toMatch(/^SELECT /);
  });

  it("matches an order number exactly and a phone as digits", async () => {
    await searchAdmin(parseSearch("0532 123 45 67")!, "staff");
    const orders = sent.find((q) => q.text.includes('FROM "orders"'))!;
    expect(orders.text).toContain(
      'lower(translate("customerPhone", $7, $8)) LIKE lower(translate($9, $7, $8))',
    );
    expect(orders.params.slice(6, 9)).toEqual([" ()+.-", "", "%5321234567%"]);

    sent.length = 0;
    await searchAdmin(parseSearch("#10234")!, "staff");
    const byNo = sent.find((q) => q.text.includes('FROM "orders"'))!;
    expect(byNo.text).toContain('("orderNo" = $1 OR');
    expect(byNo.params[0]).toBe(10234);
  });

  it("looks a karaoke booking up by its code only", async () => {
    await searchAdmin(parseSearch("ayşe")!, "owner");
    expect(tablesQueried()).not.toContain("karaoke_reservations");
    const groups = await searchAdmin(parseSearch("krk-42")!, "owner");
    const krk = sent.find((q) => q.text.includes("karaoke_reservations"))!;
    expect(krk.text).toContain('WHERE "id" = $1');
    expect(krk.params[0]).toBe("krk-00042");
    expect(groups.map((g) => g.section)).toContain("karaoke");
  });
});

describe("the answer", () => {
  const order = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `ord-${n}`,
    orderNo: n,
    customerName: "Ayşe Yılmaz",
    customerEmail: "ayse@example.com",
    status: "paid",
    fulfillment: "table",
    totalMinor: 18500,
    createdAt: "2026-10-17T10:00:00.000Z",
    ...extra,
  });

  it("shows five, says there are more, and puts the named order first", async () => {
    answers.orders = [10001, 10002, 10003, 10004, 10005, 10006].map((n) =>
      order(n),
    );
    const [orders] = await searchAdmin(parseSearch("10004")!, "staff");
    expect(orders.section).toBe("orders");
    expect(orders.hits).toHaveLength(SEARCH_LIMIT);
    expect(orders.more).toBe(true);
    expect(orders.hits[0]).toMatchObject({
      href: "/admin/siparisler/ord-10004",
      title: "#10004 · Ayşe Yılmaz",
      meta: ["Ödendi"],
      amountMinor: 18500,
    });
    // The list, not the list searching the text: no query in an address.
    expect(orders.listHref).toBe("/admin/siparisler");
  });

  it("puts what was typed in no link at all", async () => {
    answers.orders = [order(10001)];
    answers.customers = [{ email: "ayse@example.com", name: "Ayşe" }];
    answers.products = [
      { id: "prd-1", name: "Ayşe", sku: "", isActive: true, priceMinor: 1 },
    ];
    answers.menu_items = [
      { id: "mnu-1", name: "Ayşe", isActive: true, priceMinor: 1 },
    ];
    for (const text of ["ayse@example.com", "0532 123 45 67", "Ayşe"]) {
      const groups = await searchAdmin(parseSearch(text)!, "owner");
      for (const g of groups) {
        expect(g.listHref).not.toContain("?");
        // A record's own page only. (A member's page is keyed by their
        // e-mail, the route as it stands: decision D14, PEO-25.)
        for (const hit of g.hits) expect(hit.href).not.toContain("?");
      }
    }
  });

  it("keeps a section that found nothing, with no hits", async () => {
    const groups = await searchAdmin(parseSearch("zzz")!, "owner");
    expect(groups.map((g) => [g.section, g.hits.length, g.more])).toEqual([
      ["orders", 0, false],
      ["customers", 0, false],
      ["products", 0, false],
      ["menu", 0, false],
    ]);
  });

  it("drops a closed account and links members by encoded e-mail", async () => {
    answers.customers = [
      { email: "deleted-c1@anon.local", name: "" },
      { email: "ali+kahve@example.com", name: "Ali" },
    ];
    const groups = await searchAdmin(parseSearch("ali")!, "manager");
    const customers = groups.find((g) => g.section === "customers")!;
    expect(customers.hits).toEqual([
      {
        href: "/admin/musteriler/ali%2Bkahve%40example.com",
        title: "Ali",
        meta: ["ali+kahve@example.com"],
      },
    ]);
  });

  it("links products and menu items to their edit pages", async () => {
    answers.products = [
      {
        id: "prd-0001",
        name: "Fındık",
        sku: "FND-1",
        isActive: false,
        priceMinor: 1000,
      },
    ];
    answers.menu_items = [
      { id: "mnu-1", name: "Affogato", isActive: true, priceMinor: 9000 },
    ];
    const groups = await searchAdmin(parseSearch("findik")!, "owner");
    expect(groups.find((g) => g.section === "products")!.hits[0]).toEqual({
      href: "/admin/urunler/prd-0001/duzenle",
      title: "Fındık",
      meta: ["SKU FND-1", "Pasif"],
      amountMinor: 1000,
    });
    expect(groups.find((g) => g.section === "menu")!.hits[0]).toMatchObject({
      href: "/admin/menu/mnu-1/duzenle",
      meta: [],
    });
  });

  it("a database that does not answer is an error, not an empty result", async () => {
    unreachable = true;
    await expect(searchAdmin(parseSearch("ayşe")!, "staff")).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });
});

describe("the search action (posted, never an address)", () => {
  const post = (q: unknown) => {
    const fd = new FormData();
    if (q !== undefined) fd.set("q", q as string);
    return adminSearchAction(INITIAL_SEARCH_STATE, fd);
  };
  const as = (role: string) => {
    auth.session = { email: `${role}@laf.test`, role, expiresAt: 0 };
  };

  it("sends a signed-out post to the sign-in, without a query", async () => {
    await expect(post("ayşe")).rejects.toThrow("NEXT_REDIRECT /admin/giris");
    expect(sent).toHaveLength(0);
  });

  it("sends a cashier back to the till, without a query (rule 27)", async () => {
    as("cashier");
    await expect(post("10234")).rejects.toThrow(
      "NEXT_REDIRECT /admin/kasa?denied=1",
    );
    expect(sent).toHaveLength(0);
  });

  it("asks only the sections the role may open", async () => {
    as("staff");
    answers.orders = [
      {
        id: "ord-1",
        orderNo: 10001,
        customerName: "Ayşe",
        customerEmail: "ayse@example.com",
        status: "paid",
        fulfillment: "table",
        totalMinor: 100,
        createdAt: "2026-10-17T10:00:00.000Z",
      },
    ];
    const state = await post("  ayse@example.com ");
    expect(tablesQueried()).toEqual(["orders"]);
    expect(state).toMatchObject({
      text: "ayse@example.com",
      tooShort: false,
      failed: false,
    });
    expect(state.groups!.map((g) => g.section)).toEqual(["orders"]);
    expect(state.groups![0].hits[0].href).toBe("/admin/siparisler/ord-1");
  });

  it("reads only the posted box; the state it is handed is ignored", async () => {
    as("manager");
    const forged = {
      ...INITIAL_SEARCH_STATE,
      text: "x",
      groups: [
        {
          section: "customers" as const,
          label: "Müşteriler",
          hits: [{ href: "/evil", title: "forged", meta: [] }],
          more: false,
          listHref: "/evil",
        },
      ],
    };
    const fd = new FormData();
    fd.set("q", "zzz");
    const state = await adminSearchAction(forged, fd);
    expect(state.text).toBe("zzz");
    expect(JSON.stringify(state)).not.toContain("forged");
  });

  it("too short: says so and sends nothing", async () => {
    as("owner");
    expect(await post(" a ")).toEqual({
      text: "a",
      groups: null,
      tooShort: true,
      failed: false,
    });
    expect(await post(undefined)).toMatchObject({ tooShort: false });
    expect(sent).toHaveLength(0);
  });

  it("a database that does not answer: failed, the text kept, nothing typed in the log", async () => {
    as("owner");
    unreachable = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await post("ayse@example.com");
    expect(state).toEqual({
      text: "ayse@example.com",
      groups: null,
      tooShort: false,
      failed: true,
    });
    const logged = JSON.stringify(log.mock.calls);
    log.mockRestore();
    expect(logged).not.toContain("ayse");
  });

  it("a session that cannot be checked is a failed search, not a sign-out", async () => {
    auth.throws = Object.assign(new Error("panel account unreadable"), {
      code: "ADMIN_SESSION_UNAVAILABLE",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await post("ayşe")).toMatchObject({ failed: true, text: "ayşe" });
    log.mockRestore();
    expect(sent).toHaveLength(0);
  });
});
