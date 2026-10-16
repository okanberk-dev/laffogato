import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/mobile/v1/tables/{code}` (docs/API-MOBILE.md §22): what a table's
 * QR names, behind a counter of misses per address.
 */

const resolveActiveTable = vi.fn();
const checkLoginLimit = vi.fn();
const reserveLoginAttempt = vi.fn();

vi.mock("@/lib/admin/cafe-tables", () => ({ resolveActiveTable }));
vi.mock("@/lib/admin/rate-limit", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/rate-limit")>();
  return {
    clientIpFrom: real.clientIpFrom,
    checkLoginLimit,
    reserveLoginAttempt,
  };
});

const { GET } = await import("@/app/api/mobile/v1/tables/[code]/route");

const OPEN = { blocked: false, retryAfterSeconds: 0, remaining: 20 };
const LOCKED = { blocked: true, retryAfterSeconds: 600, remaining: 0 };

function call(code: string) {
  const req = new Request(
    `https://laffogato.net/api/mobile/v1/tables/${encodeURIComponent(code)}`,
    { headers: { "x-forwarded-for": "10.0.0.7" } },
  );
  return GET(req as never, { params: Promise.resolve({ code }) });
}

beforeEach(() => {
  resolveActiveTable.mockReset();
  checkLoginLimit.mockReset();
  checkLoginLimit.mockResolvedValue(OPEN);
  reserveLoginAttempt.mockReset();
  reserveLoginAttempt.mockResolvedValue(OPEN);
});

describe("GET /tables/{code}", () => {
  it("answers an active table with its code and name, never cached", async () => {
    resolveActiveTable.mockResolvedValue({
      code: "ABCDEFGH23",
      name: "Bahçe 3",
    });
    const res = await call("abcd-efgh23");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      table: { code: "ABCDEFGH23", name: "Bahçe 3" },
    });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("answers with the code and the name only, whatever else the row holds", async () => {
    resolveActiveTable.mockResolvedValue({
      code: "ABCDEFGH23",
      name: "Bahçe 3",
      id: "tbl-0003",
      sortOrder: 3,
      isActive: true,
      rotatedAt: "2026-10-15T10:00:00.000Z",
    });
    const res = await call("ABCDEFGH23");
    expect(await res.json()).toEqual({
      table: { code: "ABCDEFGH23", name: "Bahçe 3" },
    });
  });

  it("answers 404 table_not_found and counts the miss for the address", async () => {
    resolveActiveTable.mockResolvedValue(null);
    const res = await call("ZZZZZZZZZZ");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("table_not_found");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "table-lookup",
      "10.0.0.7",
      "",
    );
  });

  it("answers 410 table_inactive for a table out of service, without counting it", async () => {
    resolveActiveTable.mockResolvedValue("inactive");
    const res = await call("ABCDEFGH23");
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe("table_inactive");
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After while the address is locked out, before any lookup", async () => {
    checkLoginLimit.mockResolvedValue(LOCKED);
    const res = await call("ABCDEFGH23");
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
    expect(res.headers.get("retry-after")).toBe("600");
    expect(resolveActiveTable).not.toHaveBeenCalled();
  });

  it("refuses the miss that reaches the cap", async () => {
    resolveActiveTable.mockResolvedValue(null);
    reserveLoginAttempt.mockResolvedValue(LOCKED);
    const res = await call("ZZZZZZZZZZ");
    expect(res.status).toBe(429);
  });

  it("does not tell a locked-out guesser that a code was real", async () => {
    resolveActiveTable.mockResolvedValue({
      code: "ABCDEFGH23",
      name: "Bahçe 3",
    });
    checkLoginLimit.mockResolvedValueOnce(OPEN).mockResolvedValueOnce(LOCKED);
    const res = await call("ABCDEFGH23");
    expect(res.status).toBe(429);
  });

  it("is a 503 when the database cannot be reached", async () => {
    const { DbUnreachableError } = await import("@/lib/db/health");
    resolveActiveTable.mockRejectedValue(new DbUnreachableError("x", "down"));
    const res = await call("ABCDEFGH23");
    expect(res.status).toBe(503);
  });
});
