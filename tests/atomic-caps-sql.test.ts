import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { KARAOKE_OPEN_CAP } from "@/lib/mobile/karaoke-core";

/**
 * The cap triggers repeat the TypeScript constants as SQL literals (a trigger
 * cannot import them). Each literal sits next to the name it mirrors; this
 * fails the moment one side changes without the other.
 */
const sql = readFileSync(
  "db/migrations/20260923110000_atomic_caps_and_refunds.sql",
  "utf8",
);
const ordersTs = readFileSync("src/lib/mobile/orders.ts", "utf8");
const storeTs = readFileSync("src/lib/admin/store.ts", "utf8");
const counterTs = readFileSync("src/lib/mobile/counter.ts", "utf8");

function tsConst(src: string, name: string): number {
  const m = new RegExp(`const ${name} = ([0-9_]+)`).exec(src);
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1].replace(/_/g, ""));
}

describe("cap literals in SQL match the TypeScript constants", () => {
  it("MAX_OPEN_ORDERS and the 45-minute pending window", () => {
    expect(sql).toContain(
      `if open_count >= ${tsConst(ordersTs, "MAX_OPEN_ORDERS")} then  -- MAX_OPEN_ORDERS`,
    );
    expect(sql).toContain(
      `interval '${tsConst(storeTs, "PENDING_ORDER_TTL_MINUTES")} minutes'`,
    );
  });

  it("KARAOKE_OPEN_CAP", () => {
    expect(sql).toContain(
      `if open_count >= ${KARAOKE_OPEN_CAP} then  -- KARAOKE_OPEN_CAP`,
    );
  });

  it("MAX_ISSUES_PER_WINDOW per ISSUE_WINDOW_MS", () => {
    expect(sql).toContain(
      `if issued >= ${tsConst(counterTs, "MAX_ISSUES_PER_WINDOW")} then  -- MAX_ISSUES_PER_WINDOW`,
    );
    expect(sql).toContain(
      `interval '${tsConst(counterTs, "ISSUE_WINDOW_MS") / 1000} seconds'`,
    );
  });

  it("the application maps each trigger's error to its existing answer", () => {
    expect(ordersTs).toContain("/TOO_MANY_PENDING_ORDERS/");
    expect(readFileSync("src/lib/mobile/karaoke.ts", "utf8")).toContain(
      "/TOO_MANY_OPEN_RESERVATIONS/",
    );
    expect(counterTs).toContain("/COUNTER_RATE_LIMITED/");
  });
});
