import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The referral settlement, against a fake database.
 *
 * Three things went wrong here and none of them is visible in a pure
 * function: a cancelled checkout blocked the claim, a failed coupon grant
 * lost the reward for good, and the summary counted coupons the inviter
 * never received.
 */

interface Query {
  table: string;
  op: "select" | "insert" | "update";
  payload?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
}

const queries: Query[] = [];
let answer: (q: Query) => { data?: unknown; error?: unknown } = () => ({});

class FakeQuery implements PromiseLike<unknown> {
  readonly q: Query;
  constructor(
    table: string,
    op: Query["op"],
    payload?: Record<string, unknown>,
  ) {
    this.q = { table, op, payload, filters: [] };
    queries.push(this.q);
  }
  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.q.filters.push([column, value]);
    return this;
  }
  order() {
    return this;
  }
  in() {
    return this;
  }
  maybeSingle() {
    return this;
  }
  then<R1, R2 = never>(
    onOk?: ((v: unknown) => R1 | PromiseLike<R1>) | null,
    onErr?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const res = answer(this.q);
    return Promise.resolve({
      data: res.data ?? null,
      error: res.error ?? null,
      status: 200,
    }).then(onOk, onErr);
  }
}

const fakeDb = {
  from: (table: string) => ({
    select: () => new FakeQuery(table, "select"),
    insert: (row: Record<string, unknown>) =>
      new FakeQuery(table, "insert", row),
    update: (patch: Record<string, unknown>) =>
      new FakeQuery(table, "update", patch),
  }),
};

const customerOrdersByEmail = vi.fn();
const grantFreeDrinkCoupon = vi.fn(async () => ({}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: () => fakeDb };
});
vi.mock("@/lib/db/counters", () => ({ nextSeq: async () => 7 }));
vi.mock("@/lib/admin/store", () => ({ customerOrdersByEmail }));
vi.mock("@/lib/mobile/free-drink", () => ({ grantFreeDrinkCoupon }));

const {
  claimInvite,
  getInviteSummary,
  rewardInviteOnFirstPaidOrder,
  INVITE_REWARD_CAP,
} = await import("@/lib/mobile/invite");

const CODE = "LAF-EDA0024";

beforeEach(() => {
  queries.length = 0;
  customerOrdersByEmail.mockReset();
  grantFreeDrinkCoupon.mockReset();
  grantFreeDrinkCoupon.mockResolvedValue({} as never);
});

function claimAnswers(): (q: Query) => { data?: unknown; error?: unknown } {
  return (q) => {
    if (q.table === "customers" && q.op === "select") {
      const email = q.filters.find(([c]) => c === "email")?.[1];
      if (email) {
        return {
          data: {
            id: "cst-2",
            email,
            name: "Selin",
            inviteCode: "",
            invitedBy: "",
          },
        };
      }
      return { data: { email: "eda@example.com" } };
    }
    return {};
  };
}

describe("claimInvite - which orders close the window", () => {
  it("still lets a member claim after a cancelled checkout", async () => {
    answer = claimAnswers();
    customerOrdersByEmail.mockResolvedValue([
      { status: "cancelled" },
      { status: "pending_payment" },
    ]);
    await expect(claimInvite("selin@example.com", CODE)).resolves.toEqual({
      ok: true,
    });
  });

  it("refuses once an order has actually been paid", async () => {
    answer = claimAnswers();
    customerOrdersByEmail.mockResolvedValue([{ status: "paid" }]);
    await expect(claimInvite("selin@example.com", CODE)).resolves.toEqual({
      ok: false,
      error: "has_orders",
    });
  });
});

describe("rewardInviteOnFirstPaidOrder - the flip is reversible", () => {
  const paidCafeOrder = { kind: "cafe", totalMinor: 30000, discountMinor: 0 };

  it("re-opens the invite when a coupon grant fails, so a retry settles it", async () => {
    answer = (q) => {
      if (q.table === "invites" && q.op === "update") {
        return {
          data: [{ id: "inv-000001", inviterEmail: "eda@example.com" }],
        };
      }
      return {};
    };
    grantFreeDrinkCoupon.mockRejectedValueOnce(new Error("nextSeq down"));

    await expect(
      rewardInviteOnFirstPaidOrder("selin@example.com", paidCafeOrder),
    ).rejects.toThrow("nextSeq down");

    const undo = queries.filter(
      (q) => q.table === "invites" && q.op === "update",
    );
    expect(undo).toHaveLength(2);
    expect(undo[1].payload).toEqual({ status: "pending", rewardedAt: "" });
    expect(undo[1].filters).toContainEqual(["id", "inv-000001"]);
  });
});

describe("rewardInviteOnFirstPaidOrder - a retry grants only what is missing", () => {
  const paidCafeOrder = { kind: "cafe", totalMinor: 30000, discountMinor: 0 };

  it("records each coupon on the invite as soon as it exists", async () => {
    answer = (q) => {
      if (q.table === "invites" && q.op === "update" && q.payload?.status) {
        return {
          data: [{ id: "inv-000002", inviterEmail: "eda@example.com" }],
        };
      }
      if (q.table === "invites" && q.op === "select") {
        return { data: [{ id: "inv-000002" }] };
      }
      return {};
    };
    grantFreeDrinkCoupon
      .mockResolvedValueOnce({ id: "cpn-0100" } as never)
      .mockRejectedValueOnce(new Error("inviter grant down"));

    await expect(
      rewardInviteOnFirstPaidOrder("selin@example.com", paidCafeOrder),
    ).rejects.toThrow("inviter grant down");

    const recorded = queries.find(
      (q) =>
        q.table === "invites" &&
        q.op === "update" &&
        q.payload?.inviteeCouponId === "cpn-0100",
    );
    expect(recorded?.filters).toContainEqual(["id", "inv-000002"]);
  });

  it("does not give the invitee a second drink when only the inviter's failed", async () => {
    // The retry: the invitee's coupon is already on the row.
    answer = (q) => {
      if (q.table === "invites" && q.op === "update" && q.payload?.status) {
        return {
          data: [
            {
              id: "inv-000002",
              inviterEmail: "eda@example.com",
              inviteeCouponId: "cpn-0100",
              inviterCouponId: "",
            },
          ],
        };
      }
      if (q.table === "invites" && q.op === "select") {
        return { data: [{ id: "inv-000002" }] };
      }
      return {};
    };
    grantFreeDrinkCoupon.mockResolvedValue({ id: "cpn-0101" } as never);

    await expect(
      rewardInviteOnFirstPaidOrder("selin@example.com", paidCafeOrder),
    ).resolves.toBe(true);
    expect(grantFreeDrinkCoupon).toHaveBeenCalledTimes(1);
    expect(grantFreeDrinkCoupon).toHaveBeenCalledWith(
      "eda@example.com",
      "invite",
    );
  });
});

describe("getInviteSummary - counters say what actually happened", () => {
  const rewarded = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `inv-${i}`,
      code: CODE,
      inviterEmail: "eda@example.com",
      inviteeEmail: `f${i}@example.com`,
      status: "rewarded" as const,
      createdAt: `2026-0${i + 1}-01T00:00:00.000Z`,
      rewardedAt: `2026-0${i + 1}-02T00:00:00.000Z`,
    }));

  it("stops counting free drinks once the inviter is past the cap", async () => {
    const rows = rewarded(INVITE_REWARD_CAP + 1);
    answer = (q) => {
      if (q.table === "invites") return { data: rows };
      if (q.table === "customers") return { data: [] };
      return {};
    };
    const summary = await getInviteSummary({
      id: "cst-1",
      email: "eda@example.com",
      name: "Eda",
      inviteCode: CODE,
    });
    expect(summary.joined).toBe(INVITE_REWARD_CAP + 1);
    expect(summary.earned).toBe(INVITE_REWARD_CAP);
    // The one that was dropped is the last to settle, and its row must not
    // promise a coffee that was never granted.
    expect(summary.people.filter((p) => p.rewarded)).toHaveLength(
      INVITE_REWARD_CAP,
    );
    expect(summary.people.at(-1)?.rewarded).toBe(false);
  });
});
