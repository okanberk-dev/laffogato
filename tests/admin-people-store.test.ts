import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The store halves of the people screens (promos, members, newsletter),
 * over a fake executor that records the SQL each call sends.
 */

const PROMO = {
  id: "prm-0003",
  code: "YAZ25",
  kind: "pct",
  value: 25,
  minSubtotalMinor: 0,
  usageLimit: 100,
  usageCount: 41,
  expiresAt: "",
  isActive: true,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
};

const seen: { text: string; values: unknown[] }[] = [];
let answer: (text: string) => Record<string, unknown>[] = () => [];

const exec: Executor = async ({ text, values }) => {
  seen.push({ text, values: [...(values ?? [])] });
  // The seed checks: the tables are not empty.
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 3 }], rowCount: 1 };
  const rows = answer(text);
  return { rows, rowCount: rows.length };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");

beforeEach(() => {
  seen.length = 0;
  answer = () => [];
});

describe("updatePromo", () => {
  it("writes the form's fields only, never the usage count", async () => {
    answer = (text) => {
      if (/^SELECT \* FROM "promos"/.test(text)) return [PROMO];
      if (/^UPDATE "promos"/.test(text)) {
        // A redemption landed while the form was open: the row says 42.
        return [{ ...PROMO, usageCount: 42, value: 30 }];
      }
      return [];
    };
    const res = await store.updatePromo(PROMO.id, {
      code: "yaz25",
      kind: "pct",
      value: 30,
      minSubtotalMinor: 0,
      usageLimit: 100,
      expiresAt: "",
      isActive: true,
    });
    const update = seen.find((q) => /^UPDATE "promos"/.test(q.text));
    expect(update?.text).toBeDefined();
    // The old write sent the row it read back, usage count and all, and lost
    // the redemption that came in between.
    expect(update?.text).not.toMatch(/"usageCount"|"createdAt"/);
    expect(update?.values).not.toContain(41);
    expect(update?.text).toMatch(/RETURNING \*$/);
    // The answer is the row as the database has it now.
    expect(res).toMatchObject({ ok: true, promo: { usageCount: 42 } });
  });

  it("says so when the code went between the read and the write", async () => {
    answer = (text) => (/^SELECT \* FROM "promos"/.test(text) ? [PROMO] : []);
    const res = await store.updatePromo(PROMO.id, {
      code: "YAZ25",
      kind: "pct",
      value: 25,
      minSubtotalMinor: 0,
      usageLimit: 100,
      expiresAt: "",
      isActive: true,
    });
    expect(res).toEqual({ ok: false, error: "Kod bulunamadı." });
  });
});
