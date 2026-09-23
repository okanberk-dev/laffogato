import { describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import { createDb, type Executor } from "@/lib/db/client";

/**
 * A provider refund webhook and an admin cancel can reverse the same order at
 * the same moment. Both read "no reversal yet", both insert — and the unique
 * index only covers `kind = 'earn'`, so a card of 6 used to drop to 4. The
 * reversal's id is now derived from the order, so the primary key refuses
 * the second row exactly as it would in Postgres.
 */
const inserted: { id: string; kind: string }[] = [];

const exec: Executor = async ({ text, params }) => {
  if (/^SELECT .* FROM "loyalty_stamps"/.test(text)) {
    // Both concurrent calls read before either writes.
    return {
      rows: [
        {
          id: "stamp-000001",
          customerEmail: "eda@example.com",
          kind: "earn",
          delta: 1,
          source: "order",
          orderId: "ord-0007",
          note: "",
          actor: "",
          createdAt: "2026-09-20T10:00:00.000Z",
        },
      ],
      rowCount: 1,
    };
  }
  if (/^INSERT INTO "loyalty_stamps"/.test(text)) {
    const id = String(params[0]);
    if (inserted.some((r) => r.id === id)) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    inserted.push({ id, kind: "reversal" });
    return { rows: [], rowCount: 1 };
  }
  if (/next_seq/.test(text)) {
    return { rows: [{ result: inserted.length + 100 }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const { onOrderReversed } = await import("@/lib/mobile/loyalty");

describe("reversing an order's stamp", () => {
  it("writes one reversal even when two callers race", async () => {
    const order = {
      id: "ord-0007",
      orderNo: 10007,
      customerEmail: "eda@example.com",
    } as AdminOrder;
    await Promise.all([onOrderReversed(order), onOrderReversed(order)]);
    expect(inserted).toEqual([{ id: "stamp-rev-ord-0007", kind: "reversal" }]);
  });
});
