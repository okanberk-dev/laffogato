import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The two reads behind the new-order alert, driven through the real query
 * builder so what is asserted is the SQL that would run: the alert's own
 * read (narrow, filtered in SQL) and the order list's count narrowed to
 * shop orders, which the list beeps for while the alert rings for the cafe.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 2 }], rowCount: 1 };
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");

beforeEach(() => {
  seen.length = 0;
});

describe("listOrderAlertRows", () => {
  it("is one narrow query: paid cafe orders not typed in the panel, newest paid first", async () => {
    await store.listOrderAlertRows("2026-10-18T14:00:00.000Z", 20);
    expect(seen).toHaveLength(1);
    const [{ text, params }] = seen;
    expect(text).toMatch(
      /^SELECT "id", "orderNo", "status", "kind", "source", "fulfillment", "tableCode", "tableName", "paidAt", "totalMinor", "items" FROM "orders"/,
    );
    for (const pii of [
      "customerName",
      "customerEmail",
      "customerPhone",
      "shippingAddress",
      "legalConsent",
      "internalNote",
      "deliveryNote",
    ]) {
      expect(text).not.toContain(pii);
    }
    expect(text).toMatch(/"status" = \$\d+/);
    expect(text).toMatch(/"kind" = \$\d+/);
    expect(text).toMatch(/"source" (?:<>|!=) \$\d+/);
    expect(text).toMatch(/"paidAt" >= \$\d+/);
    expect(text).toMatch(/ORDER BY "paidAt" DESC LIMIT \$\d+$/);
    expect(params).toEqual(
      expect.arrayContaining([
        "paid",
        "cafe",
        "manual",
        "2026-10-18T14:00:00.000Z",
        20,
      ]),
    );
  });

  it("caps the limit a caller passes", async () => {
    await store.listOrderAlertRows("2026-10-18T14:00:00.000Z", 10_000);
    expect(seen[0].params).toContain(100);
  });
});

describe("countOrdersAfter", () => {
  it("narrows to shop orders when asked, and to nothing more when not", async () => {
    await expect(
      store.countOrdersAfter(10_100, ["paid"], "shop"),
    ).resolves.toBe(2);
    expect(seen[0].text).toMatch(/"kind" = \$\d+/);
    expect(seen[0].params).toEqual(expect.arrayContaining(["shop", 10_101]));
    seen.length = 0;
    await store.countOrdersAfter(10_100);
    expect(seen[0].text).not.toContain('"kind"');
  });
});
