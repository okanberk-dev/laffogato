import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the limiter counts, and how much it allows.
 *
 * The budgets are keyed by purpose + address + identity in Postgres
 * (`reserve_auth_attempt`). These tests read the key and the numbers the
 * limiter hands the SQL function, without a database.
 */
const rpc = vi.fn(async (..._args: unknown[]) => ({
  data: { allowed: true, remaining: 1, lockedUntil: "" },
  error: null,
}));

vi.mock("@/lib/db", () => ({ getDb: () => ({ rpc }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { rateLimitAddress, reserveLoginAttempt } =
  await import("@/lib/admin/rate-limit");

function lastCall() {
  return rpc.mock.calls.at(-1)![1] as {
    p_key: string;
    p_max_fails: number;
    p_lockout_ms: number;
  };
}

beforeEach(() => rpc.mockClear());

describe("rateLimitAddress", () => {
  it("keeps an IPv4 address as it is", () => {
    expect(rateLimitAddress("203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitAddress("")).toBe("");
  });

  it("cuts IPv6 to its /64, so one host cannot mint fresh budgets", () => {
    const a = rateLimitAddress("2a02:4780:10:5be0::1");
    const b = rateLimitAddress("2a02:4780:10:5be0:dead:beef:1234:5678");
    const c = rateLimitAddress("2A02:4780:0010:5BE0:0:0:0:FFFF");
    expect(a).toBe("2a02:4780:0010:5be0::/64");
    expect(b).toBe(a);
    expect(c).toBe(a);
    // A different /64 is a different subscriber.
    expect(rateLimitAddress("2a02:4780:10:5be1::1")).not.toBe(a);
  });

  it("expands '::' wherever it sits", () => {
    expect(rateLimitAddress("2001:db8::")).toBe("2001:0db8:0000:0000::/64");
    expect(rateLimitAddress("::1")).toBe("0000:0000:0000:0000::/64");
    expect(rateLimitAddress("[2001:db8:1:2::9]")).toBe(
      "2001:0db8:0001:0002::/64",
    );
    expect(rateLimitAddress("fe80::1%eth0")).toBe("fe80:0000:0000:0000::/64");
  });

  it("reads IPv4-mapped IPv6 as the IPv4 it carries", () => {
    expect(rateLimitAddress("::ffff:198.51.100.4")).toBe("198.51.100.4");
  });

  it("leaves anything it cannot parse alone", () => {
    expect(rateLimitAddress("1::2::3")).toBe("1::2::3");
    expect(rateLimitAddress("zz::1")).toBe("zz::1");
  });
});

describe("bucket keys", () => {
  it("puts every address of one /64 in the same bucket", async () => {
    await reserveLoginAttempt("admin-login", "2a02:4780:10:5be0::1", "o@x.co");
    const first = lastCall().p_key;
    await reserveLoginAttempt(
      "admin-login",
      "2a02:4780:10:5be0:ffff:1:2:3",
      "o@x.co",
    );
    expect(lastCall().p_key).toBe(first);
    expect(first).toBe("admin-login::2a02:4780:0010:5be0::/64::o@x.co");
  });
});

describe("mail-sending budgets", () => {
  const MIN = 60 * 1000;

  it.each([
    ["password-reset", 3, 30 * MIN],
    ["password-reset-ip", 10, 30 * MIN],
    ["newsletter-signup-ip", 5, 60 * MIN],
    ["register-ip", 10, 30 * MIN],
    ["verify-resend", 3, 15 * MIN],
    ["admin-login-ip", 20, 15 * MIN],
    ["customer-login-ip", 30, 15 * MIN],
  ] as const)("%s allows %i, then locks", async (purpose, max, lockout) => {
    await reserveLoginAttempt(purpose, "203.0.113.7", "*");
    expect(lastCall().p_max_fails).toBe(max);
    expect(lastCall().p_lockout_ms).toBe(lockout);
  });
});
