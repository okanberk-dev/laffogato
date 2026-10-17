import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * saveSiteContent's SQL: changed keys are upserted, keys back on their
 * default lose their row, unknown keys never reach the database, and a
 * refused query throws the classified DbQueryError (not a message string).
 */

const queries: { text: string; params: unknown[] }[] = [];
let fail: { message: string; code: string } | null = null;
const execute: Executor = async (q) => {
  queries.push({ text: q.text, params: q.params });
  if (fail) throw Object.assign(new Error(fail.message), { code: fail.code });
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});

const { saveSiteContent } = await import("@/lib/admin/site-content");

beforeEach(() => {
  queries.length = 0;
  fail = null;
});

describe("saveSiteContent", () => {
  it("upserts the changed keys and deletes the ones back on default", async () => {
    await saveSiteContent({
      upserts: { "home.hero.lede": "Yeni.", "not.a.key": "x" },
      deletes: ["story.founder.role", "nope"],
    });
    expect(queries).toHaveLength(2);
    expect(queries[0].text).toMatch(/^INSERT INTO "site_content"/);
    expect(queries[0].text).toMatch(/ON CONFLICT \("key"\) DO UPDATE/);
    expect(queries[0].params).toContain("home.hero.lede");
    expect(queries[0].params).not.toContain("not.a.key");
    expect(queries[1].text).toMatch(/^DELETE FROM "site_content"/);
    expect(queries[1].params).toEqual(["story.founder.role"]);
  });

  it("writes nothing for an empty plan", async () => {
    await saveSiteContent({ upserts: {}, deletes: [] });
    expect(queries).toEqual([]);
  });

  it("throws the classified query error", async () => {
    fail = { message: "permission denied", code: "42501" };
    await expect(
      saveSiteContent({ upserts: { "home.hero.lede": "x" }, deletes: [] }),
    ).rejects.toMatchObject({ name: "DbQueryError", code: "42501" });
  });
});
