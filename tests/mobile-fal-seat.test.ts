import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fA'L quota seat (src/lib/mobile/fal.ts `reserveFalReading`), over an
 * in-memory table that behaves like `fal_readings`: a bigserial id handed out
 * in insert order, and the four calls the seat makes (insert + returning,
 * select with eq/eq/lt, delete by id, update by id).
 *
 * The point it locks: the cap is held by RANK, not by a count read before the
 * model is asked. Two callers racing for the last seat get one seat between
 * them, never two and never zero.
 */

type Row = { id: number; customerEmail: string; day: string; createdAt: string; model: string; cupSeen: boolean };
let rows: Row[] = [];
let nextId = 1;

function query(table: string) {
  const filters: [string, "eq" | "lt", unknown][] = [];
  let op: "select" | "insert" | "delete" | "update" = "select";
  let payload: Partial<Row> = {};
  let returning = false;
  const match = (r: Row) =>
    filters.every(([col, how, v]) => {
      const cell = (r as Record<string, unknown>)[col];
      return how === "eq" ? cell === v : Number(cell) < Number(v);
    });
  const api = {
    select() {
      if (op !== "select") returning = true;
      return api;
    },
    insert(row: Partial<Row>) {
      op = "insert";
      payload = row;
      return api;
    },
    delete() {
      op = "delete";
      return api;
    },
    update(patch: Partial<Row>) {
      op = "update";
      payload = patch;
      return api;
    },
    eq(col: string, v: unknown) {
      filters.push([col, "eq", v]);
      return api;
    },
    lt(col: string, v: unknown) {
      filters.push([col, "lt", v]);
      return api;
    },
    then(resolve: (r: { data: unknown; error: null }) => void) {
      expect(table).toBe("fal_readings");
      if (op === "insert") {
        // bigserial comes back from node-pg as a string.
        const row = { ...(payload as Row), id: nextId++ };
        rows.push(row);
        resolve({ data: returning ? [{ id: String(row.id) }] : null, error: null });
      } else if (op === "delete") {
        rows = rows.filter((r) => !match(r));
        resolve({ data: null, error: null });
      } else if (op === "update") {
        rows = rows.map((r) => (match(r) ? { ...r, ...payload } : r));
        resolve({ data: null, error: null });
      } else {
        resolve({ data: rows.filter(match).map((r) => ({ id: r.id })), error: null });
      }
    },
  };
  return api;
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({ from: (t: string) => query(t) }),
  TABLES: { falReadings: "fal_readings", featureConsents: "feature_consents" },
}));

const { reserveFalReading, releaseFalReading, completeFalReading } = await import("@/lib/mobile/fal");

const EDA = "eda@ornek.com";
const NOON = new Date("2026-10-13T09:00:00Z");

describe("reserveFalReading - the daily cap is a seat, not a count", () => {
  beforeEach(() => {
    rows = [];
    nextId = 1;
  });

  it("hands out seats in order and refuses the one past the limit", async () => {
    const seats = [];
    for (let i = 0; i < 4; i += 1) seats.push(await reserveFalReading(EDA, 3, NOON));
    expect(seats.map((s) => s.ok)).toEqual([true, true, true, false]);
    expect(seats.slice(0, 3).map((s) => (s.ok ? s.used : -1))).toEqual([0, 1, 2]);
    // The refused seat took its own row back out.
    expect(rows).toHaveLength(3);
  });

  it("gives exactly one of two racing callers the last seat", async () => {
    await reserveFalReading(EDA, 3, NOON);
    await reserveFalReading(EDA, 3, NOON);
    const [a, b] = await Promise.all([reserveFalReading(EDA, 3, NOON), reserveFalReading(EDA, 3, NOON)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(rows).toHaveLength(3);
  });

  it("counts only this member's rows on this Istanbul day", async () => {
    await reserveFalReading("baska@ornek.com", 1, NOON);
    await reserveFalReading(EDA, 1, new Date("2026-10-12T09:00:00Z"));
    const seat = await reserveFalReading(EDA, 1, NOON);
    expect(seat).toMatchObject({ ok: true, used: 0 });
  });

  it("a released seat stops counting; a completed one records only cup and model", async () => {
    const first = await reserveFalReading(EDA, 1, NOON);
    if (!first.ok) throw new Error("first seat refused");
    await releaseFalReading(first.id);
    const second = await reserveFalReading(EDA, 1, NOON);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    await completeFalReading(second.id, true, "gpt-5.4-mini");
    expect(rows).toEqual([expect.objectContaining({ id: second.id, cupSeen: true, model: "gpt-5.4-mini" })]);
  });
});
