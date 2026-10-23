import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TAG_MENU, tagsForWrite } from "@/lib/cache/tags";
import { menuPricesDateStale } from "@/lib/menu/price-list";
import {
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/panel/karaoke-sync-core";
import {
  changedSaleFields,
  changesPrice,
  opensLargeSize,
  PANEL_MENU_MAX_BODY_BYTES,
  panelAuditActor,
  parsePanelMenuChange,
  sortForPanelMenu,
  toPanelMenuItem,
  type MenuItemForPanel,
} from "@/lib/panel/menu-link-core";

/**
 * The menu link with the köşk's panel (docs/PANEL-MENU.md): the site is the
 * one source of each item's sale price and on-menu state; the panel reads
 * them (`GET /api/panel/menu`), writes them (`POST`, by the menu form's
 * rules) and hears of every change (a ping on `pub:menu`). The route's only
 * gate is the shared-secret signature, so every way of failing it is
 * pinned, before the store is ever asked.
 */

const store = vi.hoisted(() => ({
  getMenuItemForPanel: vi.fn(),
  listMenuItemsForPanel: vi.fn(),
  setMenuItemSaleFields: vi.fn(),
  markMenuPricesChanged: vi.fn(),
}));
const safeAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/store", () => ({
  ...store,
  MENU_CATEGORY_KEYS: ["matcha", "espresso", "dessert"],
  MENU_CATEGORY_LABELS: {
    matcha: "Matcha Bar",
    espresso: "Espresso",
    dessert: "Tatlılar",
  },
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));

const h = vi.hoisted(() => ({ tasks: [] as (() => unknown)[] }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    h.tasks.push(task);
  },
}));

const { GET, POST } = await import("@/app/api/panel/menu/route");

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const BASE = "https://laffogato.net/api/panel/menu";

function item(over: Partial<MenuItemForPanel> = {}) {
  return {
    id: "mnu-0011",
    name: "Espresso Macchiato",
    categoryKey: "espresso",
    desc: "Bir dokunuş süt köpüğü.",
    priceMinor: 14000,
    priceMinorL: 0,
    hue: "crema",
    image: "/menu/macchiato.webp",
    tags: ["signature"],
    allergens: ["milk"],
    isActive: true,
    sortOrder: 6,
    updatedAt: "2026-10-20T08:00:00.000Z",
    ...over,
  };
}

function signedGet(at = Date.now(), secret = SECRET): Request {
  const url = new URL(BASE);
  return new Request(url, {
    headers: signedHeaders(secret, "GET", url, "", at),
  });
}

function signedPost(body: unknown, at = Date.now(), secret = SECRET): Request {
  const url = new URL(BASE);
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...signedHeaders(secret, "POST", url, text, at),
    },
    body: text,
  });
}

beforeEach(() => {
  vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
  for (const fn of [...Object.values(store), safeAudit]) fn.mockReset();
  store.listMenuItemsForPanel.mockResolvedValue([]);
  store.markMenuPricesChanged.mockResolvedValue(undefined);
  safeAudit.mockResolvedValue(true);
  h.tasks.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the shape the panel reads (menu-link-core)", () => {
  it("is a whitelist: no description, photo, tags or allergens leave", () => {
    const out = toPanelMenuItem(item({ priceMinorL: -5 }), "Espresso");
    expect(out).toEqual({
      id: "mnu-0011",
      name: "Espresso Macchiato",
      categoryKey: "espresso",
      categoryLabel: "Espresso",
      priceMinor: 14000,
      priceMinorL: 0,
      isActive: true,
      sortOrder: 6,
      updatedAt: "2026-10-20T08:00:00.000Z",
    });
  });

  it("is in the menu's order: category, Sıra, name, id", () => {
    const shape = (over: Partial<MenuItemForPanel>) =>
      toPanelMenuItem(item(over), "");
    const sorted = sortForPanelMenu(
      [
        shape({ id: "mnu-4", categoryKey: "dessert", sortOrder: 0 }),
        shape({ id: "mnu-3", categoryKey: "espresso", sortOrder: 2 }),
        shape({ id: "mnu-2", categoryKey: "espresso", sortOrder: 1 }),
        shape({ id: "mnu-1", categoryKey: "matcha", sortOrder: 9 }),
        shape({ id: "mnu-5", categoryKey: "unknown", sortOrder: 0 }),
      ],
      ["matcha", "espresso", "dessert"],
    );
    expect(sorted.map((i) => i.id)).toEqual([
      "mnu-1",
      "mnu-2",
      "mnu-3",
      "mnu-4",
      "mnu-5",
    ]);
  });
});

describe("a write's rules (the menu form's)", () => {
  const ok = { id: "mnu-0011", actor: "Selin" };

  it("takes any of the three fields, at least one", () => {
    expect(parsePanelMenuChange({ ...ok, priceMinor: 14500 })).toEqual({
      ok: true,
      change: { ...ok, priceMinor: 14500 },
    });
    expect(parsePanelMenuChange({ ...ok, isActive: false }).ok).toBe(true);
    expect(parsePanelMenuChange({ ...ok, priceMinorL: 0 }).ok).toBe(true);
    expect(parsePanelMenuChange(ok)).toEqual({ ok: false, field: "fields" });
  });

  it("names the field that broke a rule", () => {
    const field = (raw: unknown) => {
      const r = parsePanelMenuChange(raw);
      return r.ok ? null : r.field;
    };
    // 0 ₺ is a free cup (CAT-05); fractions are not kuruş.
    expect(field({ ...ok, priceMinor: 0 })).toBe("priceMinor");
    expect(field({ ...ok, priceMinor: 145.5 })).toBe("priceMinor");
    expect(field({ ...ok, priceMinor: 100_000_001 })).toBe("priceMinor");
    expect(field({ ...ok, priceMinorL: -1 })).toBe("priceMinorL");
    expect(field({ ...ok, isActive: "false" })).toBe("isActive");
    expect(field({ ...ok, id: "../etc" })).toBe("id");
    expect(field({ ...ok, actor: " " })).toBe("actor");
    expect(field({ ...ok, actor: "x".repeat(81) })).toBe("actor");
    // Nothing else rides along: a name or a category is not the panel's.
    expect(field({ ...ok, priceMinor: 1, name: "Başka" })).toBe("body");
    expect(field([])).toBe("body");
  });

  it("writes only what differs, and knows a price move", () => {
    const current = { priceMinor: 14000, priceMinorL: 0, isActive: true };
    expect(
      changedSaleFields(current, {
        priceMinor: 14000,
        priceMinorL: 0,
        isActive: true,
      }),
    ).toEqual({});
    expect(changedSaleFields(current, { priceMinor: 14500 })).toEqual({
      priceMinor: 14500,
    });
    expect(changedSaleFields(current, { isActive: false })).toEqual({
      isActive: false,
    });
    expect(changesPrice({ isActive: false })).toBe(false);
    expect(changesPrice({ priceMinorL: 16000 })).toBe(true);
    expect(panelAuditActor(" Selin ")).toBe("panel:Selin");
  });

  it("lets only the site open an L size", () => {
    const single = { priceMinorL: 0 };
    expect(opensLargeSize(single, { priceMinorL: 16000 })).toBe(true);
    expect(opensLargeSize({ priceMinorL: -5 }, { priceMinorL: 1 })).toBe(true);
    // Closing L, leaving it out or keeping it 0 is no opening.
    expect(opensLargeSize(single, { priceMinorL: 0 })).toBe(false);
    expect(opensLargeSize(single, { priceMinor: 14500 })).toBe(false);
    // An L the site already sells may move or close.
    const two = { priceMinorL: 15000 };
    expect(opensLargeSize(two, { priceMinorL: 16000 })).toBe(false);
    expect(opensLargeSize(two, { priceMinorL: 0 })).toBe(false);
  });
});

describe("the price list's day (menuPricesDateStale)", () => {
  it("is stale when a price moved on a later Istanbul day", () => {
    // 22 Oct 00:30 in Tuzla is 21 Oct 21:30 UTC: already the 22nd.
    expect(menuPricesDateStale("2026-10-21", "2026-10-21T21:30:00.000Z")).toBe(
      "2026-10-22",
    );
    expect(
      menuPricesDateStale("2026-10-22", "2026-10-21T21:30:00.000Z"),
    ).toBeNull();
  });

  it("says nothing without a day or without a recorded change", () => {
    expect(menuPricesDateStale("", "2026-10-22T08:00:00.000Z")).toBeNull();
    expect(menuPricesDateStale("2026-10-01", "")).toBeNull();
    expect(menuPricesDateStale("2026-10-01", "yesterday")).toBeNull();
  });
});

describe("GET /api/panel/menu", () => {
  it("is shut with 503 while the link is not configured", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const res = await GET(signedGet());
    expect(res.status).toBe(503);
    expect(store.listMenuItemsForPanel).not.toHaveBeenCalled();
  });

  it("answers 401 to an unsigned, forged or replayed request", async () => {
    for (const req of [
      new Request(BASE),
      signedGet(Date.now(), `${SECRET}-other`),
      signedGet(Date.now() - 6 * 60_000),
      new Request(BASE, {
        headers: {
          [TIMESTAMP_HEADER]: "1760000000",
          [SIGNATURE_HEADER]: "v1=",
        },
      }),
    ]) {
      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    expect(store.listMenuItemsForPanel).not.toHaveBeenCalled();
  });

  it("lists every item, sold-out ones too, in the whitelisted shape", async () => {
    store.listMenuItemsForPanel.mockResolvedValue([
      item({ id: "mnu-0002", isActive: false }),
      item({ id: "mnu-0001", categoryKey: "matcha", name: "Matcha Latte" }),
    ]);
    const res = await GET(signedGet());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.items.map((i: { id: string }) => i.id)).toEqual([
      "mnu-0001",
      "mnu-0002",
    ]);
    expect(body.items[0].categoryLabel).toBe("Matcha Bar");
    expect(body.items[1].isActive).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/image|desc|allergens|tags/);
  });

  it("says 503 when the menu cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    store.listMenuItemsForPanel.mockRejectedValue(new Error("down"));
    expect((await GET(signedGet())).status).toBe(503);
  });

  it("stamps `now` before the read, never after it", async () => {
    // A slow read: the clock moves on while the list is read. A `now`
    // taken after it would be later than writes the list does not hold.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-22T09:00:00.000Z"));
      let readAt = "";
      store.listMenuItemsForPanel.mockImplementation(async () => {
        readAt = new Date().toISOString();
        vi.setSystemTime(new Date("2026-10-22T09:00:02.000Z"));
        return [item()];
      });
      const res = await GET(signedGet());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(readAt).toBe("2026-10-22T09:00:00.000Z");
      expect(body.now <= readAt).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("POST /api/panel/menu", () => {
  it("is shut with 503 while the link is not configured", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const res = await POST(
      signedPost({ id: "mnu-0011", isActive: false, actor: "S" }),
    );
    expect(res.status).toBe(503);
    expect(store.getMenuItemForPanel).not.toHaveBeenCalled();
  });

  it("refuses an unsigned, forged or retargeted body with 401", async () => {
    const body = JSON.stringify({ id: "mnu-0011", priceMinor: 1, actor: "S" });
    const url = new URL(BASE);
    const forged = new Request(url, {
      method: "POST",
      headers: signedHeaders(SECRET, "POST", url, body.replace("1", "2")),
      body,
    });
    for (const req of [
      new Request(BASE, { method: "POST", body }),
      signedPost(body, Date.now(), `${SECRET}-other`),
      forged,
    ]) {
      expect((await POST(req)).status).toBe(401);
    }
    expect(store.getMenuItemForPanel).not.toHaveBeenCalled();
  });

  it("refuses a body past 4 KB before reading its signature", async () => {
    const big = JSON.stringify({
      id: "mnu-0011",
      actor: "S",
      pad: "x".repeat(PANEL_MENU_MAX_BODY_BYTES),
    });
    const res = await POST(signedPost(big));
    expect(res.status).toBe(413);
  });

  it("says which field broke a rule, or that the body is not JSON", async () => {
    let res = await POST(signedPost("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid", field: "body" });
    res = await POST(signedPost({ id: "mnu-0011", priceMinor: 0, actor: "S" }));
    expect(await res.json()).toEqual({ error: "invalid", field: "priceMinor" });
    expect(store.getMenuItemForPanel).not.toHaveBeenCalled();
  });

  it("answers 404 for an item the site no longer has", async () => {
    store.getMenuItemForPanel.mockResolvedValue(null);
    const res = await POST(
      signedPost({ id: "mnu-0099", isActive: false, actor: "S" }),
    );
    expect(res.status).toBe(404);
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
  });

  it("writes only what changed, marks the price list, and names the panel user", async () => {
    store.getMenuItemForPanel.mockResolvedValue(item());
    store.setMenuItemSaleFields.mockImplementation(async (_id, fields) => ({
      ...item(),
      ...fields,
      updatedAt: "2026-10-22T09:00:00.000Z",
    }));
    const res = await POST(
      signedPost({
        id: "mnu-0011",
        priceMinor: 14500,
        isActive: true,
        actor: "Selin",
      }),
    );
    expect(res.status).toBe(200);
    expect(store.setMenuItemSaleFields).toHaveBeenCalledWith("mnu-0011", {
      priceMinor: 14500,
    });
    expect(store.markMenuPricesChanged).toHaveBeenCalledTimes(1);
    expect(safeAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "menu_item",
      entityId: "mnu-0011",
      actor: "panel:Selin",
      payload: { name: "Espresso Macchiato", priceMinor: 14500, via: "panel" },
    });
    const body = await res.json();
    expect(body.item).toMatchObject({ id: "mnu-0011", priceMinor: 14500 });
  });

  it("writes nothing when the values are the site's already", async () => {
    store.getMenuItemForPanel.mockResolvedValue(item());
    const res = await POST(
      signedPost({ id: "mnu-0011", priceMinor: 14000, actor: "Selin" }),
    );
    expect(res.status).toBe(200);
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
    expect(store.markMenuPricesChanged).not.toHaveBeenCalled();
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("refuses with 409 an L price for an item the site keeps single-size", async () => {
    // The operator closed Latte's L here; the panel's copy still has it.
    store.getMenuItemForPanel.mockResolvedValue(item({ priceMinorL: 0 }));
    const res = await POST(
      signedPost({
        id: "mnu-0011",
        priceMinor: 14500,
        priceMinorL: 16000,
        actor: "Selin",
      }),
    );
    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "single_size" });
    // Nothing of the change is written, not even its M price.
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
    expect(store.markMenuPricesChanged).not.toHaveBeenCalled();
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("still takes an L of 0, no L, or an L the site sells", async () => {
    store.setMenuItemSaleFields.mockImplementation(async (_id, fields) => ({
      ...item(),
      ...fields,
    }));
    store.getMenuItemForPanel.mockResolvedValue(item({ priceMinorL: 0 }));
    for (const body of [
      { id: "mnu-0011", priceMinor: 14500, priceMinorL: 0, actor: "S" },
      { id: "mnu-0011", priceMinor: 14500, actor: "S" },
    ]) {
      expect((await POST(signedPost(body))).status).toBe(200);
    }
    // The operator opened L here meanwhile: the panel's L price is a move.
    store.getMenuItemForPanel.mockResolvedValue(item({ priceMinorL: 15000 }));
    const res = await POST(
      signedPost({ id: "mnu-0011", priceMinorL: 16000, actor: "S" }),
    );
    expect(res.status).toBe(200);
    expect(store.setMenuItemSaleFields).toHaveBeenLastCalledWith("mnu-0011", {
      priceMinorL: 16000,
    });
  });

  it("a sold-out switch is not a price change", async () => {
    store.getMenuItemForPanel.mockResolvedValue(item());
    store.setMenuItemSaleFields.mockResolvedValue(item({ isActive: false }));
    const res = await POST(
      signedPost({ id: "mnu-0011", isActive: false, actor: "Selin" }),
    );
    expect(res.status).toBe(200);
    expect(store.setMenuItemSaleFields).toHaveBeenCalledWith("mnu-0011", {
      isActive: false,
    });
    expect(store.markMenuPricesChanged).not.toHaveBeenCalled();
  });
});

describe("the ping (menu-ping.ts)", () => {
  async function load() {
    vi.resetModules();
    return import("@/lib/panel/menu-ping");
  }

  it("sends one signed menu.changed to the panel for a burst of writes", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const { pingPanelMenu } = await load();
    pingPanelMenu();
    pingPanelMenu();
    expect(h.tasks).toHaveLength(1);
    await h.tasks[0]();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://ladmin.laffogato.net/api/menu/ping");
    const body = String(init.body);
    expect(JSON.parse(body).event).toBe("menu.changed");
    const headers = init.headers as Record<string, string>;
    expect(
      verifySignature(SECRET, {
        method: "POST",
        url: new URL(String(url)),
        body,
        timestamp: headers[TIMESTAMP_HEADER],
        signature: headers[SIGNATURE_HEADER],
      }),
    ).toBe(true);
  });

  it("stays silent while the link is off, and never throws", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const { pingPanelMenu } = await load();
    expect(() => pingPanelMenu()).not.toThrow();
    expect(h.tasks).toHaveLength(0);
  });

  it("does not retry a 4xx: a panel without the route says 404 once", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    const { sendPanelMenuPing } = await load();
    const ok = await sendPanelMenuPing(
      { secret: SECRET, panelUrl: "https://ladmin.laffogato.net" },
      fetchMock,
    );
    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is wired in getDb's write hook, behind the menu tag", () => {
    expect(tagsForWrite({ table: "menu_items" })).toContain(TAG_MENU);
    expect(tagsForWrite({ table: "orders" })).not.toContain(TAG_MENU);
    const src = readFileSync("src/lib/db/index.ts", "utf8");
    expect(src).toContain("if (tags.includes(TAG_MENU)) pingPanelMenu();");
    expect(src.match(/pingPanelMenu\(/g)).toHaveLength(1);
  });
});
