import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fA'L quota seat (src/lib/mobile/fal.ts `reserveFalReading`) over an
 * in-memory `fal_readings` and a `reserve_fal_reading` that keeps the SQL
 * function's contract: count the member's rows for the day, insert only under
 * the limit, answer {id, used} or null. bigserial ids come back from node-pg
 * as strings, and so do they here.
 *
 * What this file locks is the TypeScript side: which member and which
 * Istanbul day the seat is asked for, how the answer is read, and that a
 * released seat stops counting. Whether the lock holds a burst of parallel
 * requests can only be shown by a real Postgres:
 * tests/db-integration-fal-seat.test.ts.
 */

type Row = {
  id: number;
  customerEmail: string;
  day: string;
  createdAt: string;
  model: string;
  cupSeen: boolean;
};
let rows: Row[] = [];
let nextId = 1;
let rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcError: { message: string } | null = null;

function reserve(args: Record<string, unknown>) {
  const used = rows.filter(
    (r) => r.customerEmail === args.p_email && r.day === args.p_day,
  ).length;
  if (used >= Number(args.p_limit)) return null;
  const row: Row = {
    id: nextId++,
    customerEmail: String(args.p_email),
    day: String(args.p_day),
    createdAt: String(args.p_created_at),
    model: "",
    cupSeen: false,
  };
  rows.push(row);
  return { id: String(row.id), used };
}

function byId(op: "delete" | "update", patch: Partial<Row> = {}) {
  return {
    eq(col: string, v: unknown) {
      expect(col).toBe("id");
      return Promise.resolve().then(() => {
        rows =
          op === "delete"
            ? rows.filter((r) => r.id !== v)
            : rows.map((r) => (r.id === v ? { ...r, ...patch } : r));
        return { data: null, error: null };
      });
    },
  };
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(
        rpcError
          ? { data: null, error: rpcError }
          : { data: reserve(args), error: null },
      );
    },
    from: (table: string) => {
      expect(table).toBe("fal_readings");
      return {
        delete: () => byId("delete"),
        update: (patch: Partial<Row>) => byId("update", patch),
      };
    },
  }),
  TABLES: { falReadings: "fal_readings", featureConsents: "feature_consents" },
}));

const { reserveFalReading, releaseFalReading, completeFalReading } =
  await import("@/lib/mobile/fal");

const EDA = "eda@ornek.com";
const NOON = new Date("2026-10-13T09:00:00Z");

describe("reserveFalReading - the daily cap is a seat taken in SQL", () => {
  beforeEach(() => {
    rows = [];
    nextId = 1;
    rpcCalls = [];
    rpcError = null;
  });

  it("hands out seats in order and refuses the one past the limit", async () => {
    const seats = [];
    for (let i = 0; i < 4; i += 1)
      seats.push(await reserveFalReading(EDA, 3, NOON));
    expect(seats.map((s) => s.ok)).toEqual([true, true, true, false]);
    expect(
      seats.slice(0, 3).map((s) => (s.ok ? [s.id, s.used] : null)),
    ).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
    expect(rows).toHaveLength(3);
  });

  it("asks for the member's own address and the Istanbul day, not the UTC one", async () => {
    // 22:30 UTC on the 12th is 01:30 on the 13th in the köşk.
    await reserveFalReading(
      " Eda@Ornek.com ",
      3,
      new Date("2026-10-12T22:30:00Z"),
    );
    expect(rpcCalls).toEqual([
      {
        fn: "reserve_fal_reading",
        args: {
          p_email: EDA,
          p_day: "2026-10-13",
          p_limit: 3,
          p_created_at: "2026-10-12T22:30:00.000Z",
        },
      },
    ]);
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
    expect(rows).toEqual([
      expect.objectContaining({
        id: second.id,
        cupSeen: true,
        model: "gpt-5.4-mini",
      }),
    ]);
  });

  it("throws on a database error instead of reading it as a refusal", async () => {
    rpcError = { message: "connection reset" };
    await expect(reserveFalReading(EDA, 3, NOON)).rejects.toThrow();
  });
});
