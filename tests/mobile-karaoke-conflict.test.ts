import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";

/**
 * The room cannot be sold twice.
 *
 * The overlap check reads the day's bookings and then inserts, so two members
 * tapping the same free hour in the same second both used to get a 201. The
 * database now refuses the second write (`karaoke_reservations_no_overlap`);
 * this asserts the API turns that refusal into the same 409 the read-side
 * check produces, rather than a 500.
 */

let insertError: { code: string; message: string } | null = null;

class FakeQuery implements PromiseLike<unknown> {
  constructor(private readonly op: "select" | "insert") {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  ilike() {
    return this;
  }
  // listMine matches the member with the indexed `ieq` (WP1).
  ieq() {
    return this;
  }
  order() {
    return this;
  }
  then<R1, R2 = never>(
    onOk?: ((v: unknown) => R1 | PromiseLike<R1>) | null,
    onErr?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const error = this.op === "insert" ? insertError : null;
    return Promise.resolve({
      data: this.op === "select" ? [] : null,
      error,
      status: error ? 400 : 200,
    }).then(onOk, onErr);
  }
}

const settings = {
  karaokeHourlyMinor: 50_000,
  karaokeCapacity: 8,
  weeklyHours: {},
  mobileApp: DEFAULT_MOBILE_APP_CONFIG,
};

vi.mock("@/lib/admin/store", () => ({
  getSettings: async () => settings,
  // The loyalty tier lookup reaches for this; an ORO discount is not what
  // this file is about, so the member has no orders.
  customerOrdersByEmail: async () => [],
}));
vi.mock("@/lib/db/counters", () => ({ nextSeq: async () => 1 }));
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    getDb: () => ({
      from: () => ({
        select: () => new FakeQuery("select"),
        insert: () => new FakeQuery("insert"),
      }),
    }),
  };
});

const { createReservation } = await import("@/lib/mobile/karaoke");

const NOW = new Date("2026-09-10T09:00:00.000Z");
const customer = { email: "eda@example.com", name: "Eda" };
const request = { date: "2026-09-12", startHour: 20, hours: 2, guests: 4 };

beforeEach(() => {
  insertError = null;
});

describe("createReservation under a race", () => {
  it("books the room when nothing else holds the hour", async () => {
    const res = await createReservation(customer, request, NOW);
    expect(res.ok).toBe(true);
  });

  it("answers 409 slot_taken when the exclusion constraint refuses the write", async () => {
    insertError = { code: "23P01", message: "conflicting key value" };
    const res = await createReservation(customer, request, NOW);
    expect(res).toMatchObject({
      ok: false,
      status: 409,
      error: "slot_taken",
    });
  });

  it("still surfaces any other database failure as a throw", async () => {
    insertError = { code: "42703", message: "column does not exist" };
    await expect(createReservation(customer, request, NOW)).rejects.toThrow();
  });
});
