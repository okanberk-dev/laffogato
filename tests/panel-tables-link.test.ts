import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CafeTable } from "@/lib/admin/cafe-tables";
import {
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/panel/karaoke-sync-core";
import { signedCaller } from "@/lib/panel/signed-callers";
import {
  PANEL_TABLES_ACTOR_MAX,
  PANEL_TABLES_MAX,
  PANEL_TABLES_MAX_BODY_BYTES,
  panelTablesActor,
  parsePanelTablesSync,
  planPanelTables,
} from "@/lib/panel/tables-link-core";

/**
 * The table link with LafPOS (src/lib/panel/tables-link-core.ts,
 * src/app/api/panel/tables/route.ts, docs/LAFPOS.md "Masa kodları"): the
 * till prints the table cards itself and sends their codes, so the QR it
 * made names a table here. What is pinned: the list's rules and the field
 * a refusal names, the plan (add, bring up to date with only what differs,
 * leave the rest alone), and the route's gates: LafPOS's key alone opens
 * it (the panel's gets 401, no key 503), the body limit, 400 before
 * anything is written, the answer's counts and the audit rows.
 */

const store = vi.hoisted(() => ({ importCafeTables: vi.fn() }));
const safeAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/cafe-tables", () => store);
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));

const { PUT } = await import("@/app/api/panel/tables/route");

const PANEL = "panel-secret-0123456789-abcdefghijklmnop";
const LAFPOS = "lafpos-secret-0123456789-abcdefghijklmno";
const BASE = "https://laffogato.net/api/panel/tables";

const CODE_A = "K7Q2M9X4TB";
const CODE_B = "ABCDEFGH23";
const CODE_C = "0123456789";

function table(over: Partial<CafeTable> = {}): CafeTable {
  return {
    id: "tbl-0007",
    code: CODE_A,
    name: "Bahçe 3",
    sortOrder: 7,
    isActive: true,
    createdAt: "2026-10-28T08:00:00.000Z",
    updatedAt: "2026-10-28T08:00:00.000Z",
    rotatedAt: "",
    ...over,
  };
}

function list(over: Record<string, unknown> = {}) {
  return {
    tables: [
      { code: CODE_A, name: "Bahçe 3", active: true },
      { code: CODE_B, name: "Eski kart", active: false },
    ],
    actor: "LafPOS",
    ...over,
  };
}

function signedPut(
  body: unknown,
  secret = LAFPOS,
  at = Date.now(),
  method = "PUT",
): Request {
  const url = new URL(BASE);
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...signedHeaders(secret, method, url, text, at),
    },
    body: text,
  });
}

beforeEach(() => {
  vi.stubEnv("KARAOKE_SYNC_SECRET", PANEL);
  vi.stubEnv("LAFPOS_SYNC_SECRET", LAFPOS);
  vi.stubEnv("PANEL_URL", "");
  store.importCafeTables.mockReset();
  safeAudit.mockReset();
  safeAudit.mockResolvedValue(true);
  store.importCafeTables.mockResolvedValue({
    count: 2,
    created: [],
    updated: [],
    unchanged: 2,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the list's rules (tables-link-core)", () => {
  it("takes a list of code, name and state, normalised as the panel's form would", () => {
    expect(
      parsePanelTablesSync({
        tables: [
          { code: " k7q2-m9x4 tb ", name: "  Bahçe   3 ", active: true },
          { code: "abcdefgh23", name: "Eski kart", active: false },
        ],
        actor: " LafPOS ",
      }),
    ).toEqual({
      ok: true,
      sync: {
        tables: [
          { code: CODE_A, name: "Bahçe 3", active: true },
          { code: CODE_B, name: "Eski kart", active: false },
        ],
        actor: "LafPOS",
      },
    });
    // An empty list is a list: nothing to add, nothing to change.
    expect(parsePanelTablesSync({ tables: [], actor: "LafPOS" })).toEqual({
      ok: true,
      sync: { tables: [], actor: "LafPOS" },
    });
  });

  it("names the field that broke a rule", () => {
    const field = (raw: unknown) => {
      const r = parsePanelTablesSync(raw);
      return r.ok ? null : r.field;
    };
    const ok = { code: CODE_A, name: "Bahçe 3", active: true };
    // Not a code: nine symbols, a letter outside the alphabet, a path.
    expect(field(list({ tables: [{ ...ok, code: "ABCDEFGH2" }] }))).toBe(
      "tables[0].code",
    );
    expect(field(list({ tables: [ok, { ...ok, code: "ABCDEFGHU2" }] }))).toBe(
      "tables[1].code",
    );
    expect(field(list({ tables: [{ ...ok, code: "../../etc1" }] }))).toBe(
      "tables[0].code",
    );
    expect(field(list({ tables: [{ ...ok, code: 42 }] }))).toBe(
      "tables[0].code",
    );
    // The same code twice, however it is spelt.
    expect(
      field(list({ tables: [ok, { ...ok, code: CODE_A.toLowerCase() }] })),
    ).toBe("tables[1].code");
    // The panel's form would refuse the name too.
    expect(field(list({ tables: [{ ...ok, name: "  " }] }))).toBe(
      "tables[0].name",
    );
    expect(field(list({ tables: [{ ...ok, name: "x".repeat(41) }] }))).toBe(
      "tables[0].name",
    );
    expect(field(list({ tables: [{ ...ok, active: "true" }] }))).toBe(
      "tables[0].active",
    );
    // Nothing else rides along.
    expect(field(list({ tables: [{ ...ok, sortOrder: 3 }] }))).toBe(
      "tables[0]",
    );
    expect(field(list({ extra: 1 }))).toBe("body");
    expect(field([])).toBe("body");
    expect(field(null)).toBe("body");
    expect(field(list({ tables: undefined }))).toBe("tables");
    expect(field(list({ actor: " " }))).toBe("actor");
    expect(field(list({ actor: "x".repeat(PANEL_TABLES_ACTOR_MAX + 1) }))).toBe(
      "actor",
    );
  });

  it("takes 200 tables and refuses 201", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        code: `${String(i).padStart(3, "0")}${"A".repeat(7)}`,
        name: `Masa ${i}`,
        active: true,
      }));
    expect(PANEL_TABLES_MAX).toBe(200);
    expect(parsePanelTablesSync(list({ tables: many(200) })).ok).toBe(true);
    expect(parsePanelTablesSync(list({ tables: many(201) }))).toEqual({
      ok: false,
      field: "tables",
    });
  });

  it("fits a full list of the longest names under the body limit", () => {
    const widest = JSON.stringify({
      tables: Array.from({ length: PANEL_TABLES_MAX }, (_, i) => ({
        code: `${String(i).padStart(3, "0")}${"A".repeat(7)}`,
        name: "😀".repeat(40),
        active: false,
      })),
      actor: "x".repeat(PANEL_TABLES_ACTOR_MAX),
    });
    expect(Buffer.byteLength(widest, "utf8")).toBeLessThan(
      PANEL_TABLES_MAX_BODY_BYTES,
    );
  });

  it("plans: add what is new, bring up to date only what differs, leave the rest", () => {
    const existing = [
      { code: CODE_A, name: "Bahçe 3", isActive: true },
      { code: CODE_B, name: "Pencere", isActive: true },
      // A table of the site's the list does not name.
      { code: "ZZZZZZZZZZ", name: "Teras", isActive: true },
    ];
    expect(
      planPanelTables(existing, [
        { code: CODE_A, name: "Bahçe 3", active: true },
        { code: CODE_B, name: "Eski kart", active: false },
        { code: CODE_C, name: "Yeni", active: true },
      ]),
    ).toEqual({
      create: [{ code: CODE_C, name: "Yeni", active: true }],
      update: [
        { code: CODE_B, fields: { name: "Eski kart", isActive: false } },
      ],
      unchanged: 1,
    });
    expect(
      planPanelTables(existing, [
        { code: CODE_A, name: "Bahçe 4", active: true },
      ]).update,
    ).toEqual([{ code: CODE_A, fields: { name: "Bahçe 4" } }]);
    expect(
      planPanelTables(existing, [
        { code: CODE_A, name: "Bahçe 3", active: false },
      ]).update,
    ).toEqual([{ code: CODE_A, fields: { isActive: false } }]);
    expect(planPanelTables(existing, [])).toEqual({
      create: [],
      update: [],
      unchanged: 0,
    });
  });

  it("writes the audit actor as lafpos:<name>, cut to the limit", () => {
    expect(panelTablesActor(" LafPOS ")).toBe("lafpos:LafPOS");
    expect(panelTablesActor("x".repeat(80))).toBe(
      `lafpos:${"x".repeat(PANEL_TABLES_ACTOR_MAX)}`,
    );
  });
});

describe("a PUT's signature (signed-callers)", () => {
  it("is the method's own: a PUT signed as a POST is nobody's", () => {
    const url = new URL(BASE);
    const body = JSON.stringify(list());
    const keys = { lafpos: LAFPOS };
    const asPut = signedPut(body, LAFPOS, Date.now(), "PUT");
    expect(signedCaller(keys, asPut, "PUT", url, body)).toBe("lafpos");
    expect(signedCaller(keys, asPut, "POST", url, body)).toBeNull();
    const asPost = signedPut(body, LAFPOS, Date.now(), "POST");
    expect(signedCaller(keys, asPost, "PUT", url, body)).toBeNull();
    // The canonical string LafPOS builds (lafpos server/lib/signature.ts).
    const headers = asPut.headers;
    expect(
      verifySignature(LAFPOS, {
        method: "put",
        url,
        body,
        timestamp: headers.get(TIMESTAMP_HEADER),
        signature: headers.get(SIGNATURE_HEADER),
      }),
    ).toBe(true);
  });
});

describe("PUT /api/panel/tables", () => {
  it("is off while LafPOS's key is unset, whatever the panel's", async () => {
    vi.stubEnv("LAFPOS_SYNC_SECRET", "");
    const res = await PUT(signedPut(list()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    // The panel's value pasted in as LafPOS's is not LafPOS's key either.
    vi.stubEnv("LAFPOS_SYNC_SECRET", PANEL);
    expect((await PUT(signedPut(list(), PANEL))).status).toBe(503);
    expect(store.importCafeTables).not.toHaveBeenCalled();
  });

  it("answers 401 to an unsigned, forged, stale or panel-signed request", async () => {
    const plain = await PUT(
      new Request(BASE, { method: "PUT", body: JSON.stringify(list()) }),
    );
    expect(plain.status).toBe(401);
    expect(await plain.json()).toEqual({ error: "unauthorized" });
    expect((await PUT(signedPut(list(), `${LAFPOS}-x`))).status).toBe(401);
    expect(
      (await PUT(signedPut(list(), LAFPOS, Date.now() - 10 * 60_000))).status,
    ).toBe(401);
    // The panel does not print cards: its key opens nothing here.
    expect((await PUT(signedPut(list(), PANEL))).status).toBe(401);
    // A body changed after signing.
    const url = new URL(BASE);
    const signed = JSON.stringify(list());
    const tampered = new Request(url, {
      method: "PUT",
      headers: signedHeaders(LAFPOS, "PUT", url, signed),
      body: JSON.stringify(list({ actor: "Başkası" })),
    });
    expect((await PUT(tampered)).status).toBe(401);
    expect(store.importCafeTables).not.toHaveBeenCalled();
  });

  it("refuses a body past the limit before reading it", async () => {
    const url = new URL(BASE);
    const big = JSON.stringify(
      list({ actor: "x".repeat(PANEL_TABLES_MAX_BODY_BYTES) }),
    );
    const res = await PUT(
      new Request(url, {
        method: "PUT",
        headers: signedHeaders(LAFPOS, "PUT", url, big),
        body: big,
      }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    const declared = new Request(url, {
      method: "PUT",
      headers: {
        ...signedHeaders(LAFPOS, "PUT", url, "{}"),
        "content-length": String(PANEL_TABLES_MAX_BODY_BYTES + 1),
      },
      body: "{}",
    });
    expect((await PUT(declared)).status).toBe(413);
    expect(store.importCafeTables).not.toHaveBeenCalled();
  });

  it("refuses a bad list with 400 and the field, before writing anything", async () => {
    const broken = await PUT(signedPut("{not json"));
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ error: "invalid", field: "body" });
    const code = await PUT(
      signedPut(
        list({ tables: [{ code: "MASA-07", name: "7", active: true }] }),
      ),
    );
    expect(code.status).toBe(400);
    expect(await code.json()).toEqual({
      error: "invalid",
      field: "tables[0].code",
    });
    const many = await PUT(
      signedPut(
        list({
          tables: Array.from({ length: PANEL_TABLES_MAX + 1 }, (_, i) => ({
            code: `${String(i).padStart(3, "0")}${"A".repeat(7)}`,
            name: `Masa ${i}`,
            active: true,
          })),
        }),
      ),
    );
    expect(many.status).toBe(400);
    expect(await many.json()).toEqual({ error: "invalid", field: "tables" });
    expect(store.importCafeTables).not.toHaveBeenCalled();
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("hands the store the normalised list and answers the counts", async () => {
    store.importCafeTables.mockResolvedValue({
      count: 2,
      created: [table({ id: "tbl-0012", code: CODE_A, name: "Bahçe 3" })],
      updated: [
        table({
          id: "tbl-0003",
          code: CODE_B,
          name: "Eski kart",
          isActive: false,
        }),
      ],
      unchanged: 0,
    });
    const res = await PUT(
      signedPut(
        list({
          tables: [
            { code: " k7q2-m9x4 tb ", name: " Bahçe  3 ", active: true },
            { code: CODE_B, name: "Eski kart", active: false },
          ],
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      ok: true,
      count: 2,
      created: 1,
      updated: 1,
      unchanged: 0,
    });
    expect(store.importCafeTables).toHaveBeenCalledWith([
      { code: CODE_A, name: "Bahçe 3", active: true },
      { code: CODE_B, name: "Eski kart", active: false },
    ]);
    // One audit row per row written, as the panel's own Masalar actions.
    expect(safeAudit).toHaveBeenCalledTimes(2);
    expect(safeAudit).toHaveBeenNthCalledWith(1, {
      action: "create",
      entity: "cafe_table",
      entityId: "tbl-0012",
      actor: "lafpos:LafPOS",
      payload: { name: "Bahçe 3", code: CODE_A, isActive: true, via: "lafpos" },
    });
    expect(safeAudit).toHaveBeenNthCalledWith(2, {
      action: "update",
      entity: "cafe_table",
      entityId: "tbl-0003",
      actor: "lafpos:LafPOS",
      payload: {
        name: "Eski kart",
        code: CODE_B,
        isActive: false,
        via: "lafpos",
      },
    });
  });

  it("writes no audit row for a list the site already has", async () => {
    const res = await PUT(signedPut(list()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      count: 2,
      created: 0,
      updated: 0,
      unchanged: 2,
    });
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("takes an empty list as nothing to do", async () => {
    store.importCafeTables.mockResolvedValue({
      count: 0,
      created: [],
      updated: [],
      unchanged: 0,
    });
    const res = await PUT(signedPut(list({ tables: [] })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      count: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
    });
    expect(store.importCafeTables).toHaveBeenCalledWith([]);
  });

  it("says the database is down rather than a list taken", async () => {
    store.importCafeTables.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await PUT(signedPut(list()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("still answers 200 when an audit row cannot be written", async () => {
    store.importCafeTables.mockResolvedValue({
      count: 1,
      created: [table()],
      updated: [],
      unchanged: 0,
    });
    safeAudit.mockResolvedValue(false);
    const res = await PUT(signedPut(list()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, created: 1 });
  });
});
