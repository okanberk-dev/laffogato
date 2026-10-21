import { describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * Online prepayment cannot be switched off (OP-KARAOKE-PREPAY, 18 Eki 2026):
 * the request mode it fell back to is gone from the legal texts. A row saved
 * before the lock may still hold `karaokePrepay = false`; every reader goes
 * through `getSettings`, which reads it as on, so web and app never take an
 * unpaid request the texts no longer describe.
 */

const exec: Executor = async ({ text }) => {
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 1 }], rowCount: 1 };
  if (/FROM "settings"/.test(text)) {
    return { rows: [{ id: "main", karaokePrepay: false }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");

describe("a stored karaokePrepay = false", () => {
  it("reads as on", async () => {
    expect((await store.getSettings()).karaokePrepay).toBe(true);
  });
});
