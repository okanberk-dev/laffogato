import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import { signedHeaders } from "@/lib/panel/karaoke-sync-core";

/**
 * The menu link reads only the eight columns the panel's shape is made of
 * (src/lib/panel/menu-link-core.ts `toPanelMenuItem`), never the photos:
 * `menu_items.image` holds data URLs of up to 2 MB each, and the panel's
 * read gives up after 8 s. The store runs on the real query builder with a
 * fake executor that answers like Postgres, with the selected columns only,
 * so a column the shape needs and the query leaves out shows in the body.
 */

const STORED = {
  id: "mnu-0011",
  categoryKey: "espresso",
  name: "Espresso Macchiato",
  desc: "Bir dokunuş süt köpüğü.",
  priceMinor: 14000,
  priceMinorL: 0,
  hue: "crema",
  image: `data:image/webp;base64,${"A".repeat(4096)}`,
  tags: ["signature"],
  taxRatePct: null,
  allergens: ["milk"],
  isActive: true,
  sortOrder: 6,
  updatedAt: "2026-10-20T08:00:00.000Z",
};

const seen: string[] = [];

/** The row with only the columns a SELECT or RETURNING list names. */
function project(list: string): Record<string, unknown> {
  if (list.trim() === "*") return { ...STORED };
  const names = [...list.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  return Object.fromEntries(
    names.map((n) => [n, (STORED as Record<string, unknown>)[n]]),
  );
}

const exec: Executor = async ({ text }) => {
  // Seeding is decided: every table already has rows.
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 3 }], rowCount: 1 };
  if (!/"menu_items"/.test(text)) return { rows: [], rowCount: 0 };
  seen.push(text);
  const select = /^SELECT (.+) FROM "menu_items"/.exec(text);
  const returning = / RETURNING (.+)$/.exec(text);
  const list = select?.[1] ?? returning?.[1];
  if (list === undefined) return { rows: [], rowCount: 0 };
  return { rows: [project(list)], rowCount: 1 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});
const safeAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));

const store = await import("@/lib/admin/store");
const { GET, POST } = await import("@/app/api/panel/menu/route");

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const BASE = "https://laffogato.net/api/panel/menu";

/** What the panel has always received for STORED. */
const PANEL_ITEM = {
  id: "mnu-0011",
  name: "Espresso Macchiato",
  categoryKey: "espresso",
  categoryLabel: "Espresso",
  priceMinor: 14000,
  priceMinorL: 0,
  isActive: true,
  sortOrder: 6,
  updatedAt: "2026-10-20T08:00:00.000Z",
};

const COLUMNS =
  '"id", "name", "categoryKey", "priceMinor", "priceMinorL", "isActive", "sortOrder", "updatedAt"';

beforeEach(() => {
  vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
  seen.length = 0;
  safeAudit.mockReset();
  safeAudit.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the panel's menu reads (store)", () => {
  it("select the eight columns of the panel's shape, never the photo", async () => {
    expect(await store.listMenuItemsForPanel()).toEqual([
      {
        id: "mnu-0011",
        name: "Espresso Macchiato",
        categoryKey: "espresso",
        priceMinor: 14000,
        priceMinorL: 0,
        isActive: true,
        sortOrder: 6,
        updatedAt: "2026-10-20T08:00:00.000Z",
      },
    ]);
    expect(await store.getMenuItemForPanel("mnu-0011")).toMatchObject({
      id: "mnu-0011",
    });
    await store.setMenuItemSaleFields("mnu-0011", { isActive: false });
    expect(seen).toEqual([
      `SELECT ${COLUMNS} FROM "menu_items"`,
      `SELECT ${COLUMNS} FROM "menu_items" WHERE "id" = $1`,
      `UPDATE "menu_items" SET "isActive" = $1, "updatedAt" = $2 WHERE "id" = $3 RETURNING ${COLUMNS}`,
    ]);
  });
});

describe("/api/panel/menu on the narrow reads", () => {
  it("GET answers the same body without reading a photo", async () => {
    const url = new URL(BASE);
    const res = await GET(
      new Request(url, { headers: signedHeaders(SECRET, "GET", url, "") }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      version: 1,
      now: body.now,
      items: [PANEL_ITEM],
      writes: { expect: true },
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const text of seen) {
      expect(text).not.toMatch(/\*|"image"/);
    }
  });

  it("POST writes and answers the same item, its audit row named", async () => {
    const url = new URL(BASE);
    const text = JSON.stringify({
      id: "mnu-0011",
      isActive: false,
      actor: "Selin",
    });
    const res = await POST(
      new Request(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...signedHeaders(SECRET, "POST", url, text),
        },
        body: text,
      }),
    );
    expect(res.status).toBe(200);
    // The fake answers the stored row; the shape is what the panel stores.
    expect(await res.json()).toEqual({ item: PANEL_ITEM });
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { name: "Espresso Macchiato", isActive: false, via: "panel" },
      }),
    );
    expect(seen).toHaveLength(2);
    for (const q of seen) expect(q).not.toMatch(/\*|"image"/);
  });
});
