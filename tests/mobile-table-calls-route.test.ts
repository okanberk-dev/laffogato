import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";

/**
 * `POST /api/mobile/v1/tables/{code}/calls` and
 * `GET /api/mobile/v1/tables/{code}/calls/{id}` (docs/API-MOBILE.md §22.1):
 * "Garson çağır" from the table, behind the table's miss counter and the
 * member's one-a-minute, ten-an-hour budget.
 */

const requireMobileCustomer = vi.fn();
const getSettings = vi.fn();
const resolveActiveTable = vi.fn();
const checkLoginLimit = vi.fn();
const reserveLoginAttempt = vi.fn();
const findOpenTableCall = vi.fn();
const insertTableCall = vi.fn();
const getTableCall = vi.fn();

vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/admin/store", () => ({ getSettings }));
vi.mock("@/lib/admin/cafe-tables", () => ({ resolveActiveTable }));
vi.mock("@/lib/admin/table-calls", () => ({
  findOpenTableCall,
  insertTableCall,
  getTableCall,
}));
vi.mock("@/lib/admin/rate-limit", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/rate-limit")>();
  return {
    clientIpFrom: real.clientIpFrom,
    checkLoginLimit,
    reserveLoginAttempt,
  };
});

const { POST } = await import("@/app/api/mobile/v1/tables/[code]/calls/route");
const { GET } = await import(
  "@/app/api/mobile/v1/tables/[code]/calls/[id]/route"
);

const OPEN = { blocked: false, retryAfterSeconds: 0, remaining: 1 };
const TABLE = { code: "K7Q2M9X4TB", name: "Bahçe 3" };
const MEMBER = { id: "cst-1", email: "Ayse@Example.com" };

function settings(ordering: Partial<typeof DEFAULT_MOBILE_APP_CONFIG.ordering> = {}) {
  return {
    mobileApp: {
      ...DEFAULT_MOBILE_APP_CONFIG,
      ordering: { ...DEFAULT_MOBILE_APP_CONFIG.ordering, ...ordering },
    },
  };
}

function post(code: string, body: unknown, bearer = "tok") {
  const req = new Request(
    `https://laffogato.net/api/mobile/v1/tables/${code}/calls`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.7",
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
  return POST(req as never, { params: Promise.resolve({ code }) });
}

function get(code: string, id: string) {
  const req = new Request(
    `https://laffogato.net/api/mobile/v1/tables/${code}/calls/${id}`,
    { headers: { authorization: "Bearer tok" } },
  );
  return GET(req as never, { params: Promise.resolve({ code, id }) });
}

beforeEach(() => {
  for (const fn of [
    requireMobileCustomer,
    getSettings,
    resolveActiveTable,
    checkLoginLimit,
    reserveLoginAttempt,
    findOpenTableCall,
    insertTableCall,
    getTableCall,
  ]) {
    fn.mockReset();
  }
  requireMobileCustomer.mockResolvedValue({ ok: true, customer: MEMBER });
  getSettings.mockResolvedValue(settings());
  resolveActiveTable.mockResolvedValue(TABLE);
  checkLoginLimit.mockResolvedValue(OPEN);
  reserveLoginAttempt.mockResolvedValue(OPEN);
  findOpenTableCall.mockResolvedValue(null);
  insertTableCall.mockImplementation(async (row) => ({
    ...row,
    ackedAt: "",
    ackedBy: "",
  }));
});

describe("POST /tables/{code}/calls", () => {
  it("makes a call: 201, the table's snapshot, never cached", async () => {
    const res = await post("k7q2-m9x4tb", { reason: "water" });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const { call } = await res.json();
    expect(call).toMatchObject({
      reason: "water",
      status: "open",
      ackedAt: "",
      table: { code: "K7Q2M9X4TB", name: "Bahçe 3" },
    });
    expect(call.id).toMatch(/^tcl-[0-9a-z]{16}$/);
    expect(Date.parse(call.createdAt)).toBeGreaterThan(0);
    expect(Object.keys(call).sort()).toEqual(
      ["ackedAt", "createdAt", "id", "reason", "status", "table"].sort(),
    );
    expect(insertTableCall).toHaveBeenCalledWith(
      expect.objectContaining({
        tableCode: "K7Q2M9X4TB",
        tableName: "Bahçe 3",
        reason: "water",
        customerEmail: "ayse@example.com",
      }),
    );
    // The member's two budgets, keyed on the member at any address.
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "table-call",
      "*",
      "ayse@example.com",
    );
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "table-call-hour",
      "*",
      "ayse@example.com",
    );
  });

  it("answers an open call of the table for the same reason with 200, nothing new", async () => {
    findOpenTableCall.mockResolvedValue({
      id: "tcl-aaaaaaaaaaaaaaaa",
      tableCode: "K7Q2M9X4TB",
      tableName: "Bahçe 3",
      reason: "water",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      ackedAt: "",
    });
    const res = await post("K7Q2M9X4TB", { reason: "water" });
    expect(res.status).toBe(200);
    expect((await res.json()).call.id).toBe("tcl-aaaaaaaaaaaaaaaa");
    expect(insertTableCall).not.toHaveBeenCalled();
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("requires a member", async () => {
    const { NextResponse } = await import("next/server");
    requireMobileCustomer.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", message: "Giriş yapman gerekiyor." },
        { status: 401 },
      ),
    });
    const res = await post("K7Q2M9X4TB", { reason: "water" }, "");
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
    expect(insertTableCall).not.toHaveBeenCalled();
  });

  it("refuses anything but exactly a known reason with 400 invalid_body", async () => {
    for (const body of [
      { reason: "coffee" },
      { reason: "water", note: "x" },
      {},
    ]) {
      const res = await post("K7Q2M9X4TB", body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error).toBe("invalid_body");
    }
    expect((await post("K7Q2M9X4TB", "{nope")).status).toBe(400);
    expect(insertTableCall).not.toHaveBeenCalled();
  });

  it("answers 404 and 410 like GET /tables, the miss counted on the same counter", async () => {
    resolveActiveTable.mockResolvedValue(null);
    const missing = await post("ZZZZZZZZZZ", { reason: "waiter" });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: "table_not_found",
      message: "Masa bulunamadı. Masadaki QR kodunu yeniden okut.",
    });
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "table-lookup",
      "10.0.0.7",
      "member:cst-1",
    );

    resolveActiveTable.mockResolvedValue("inactive");
    const inactive = await post("K7Q2M9X4TB", { reason: "waiter" });
    expect(inactive.status).toBe(410);
    expect((await inactive.json()).error).toBe("table_inactive");
    expect(insertTableCall).not.toHaveBeenCalled();
  });

  it("answers 409 calls_unavailable while either switch is off, before any lookup", async () => {
    for (const off of [{ tableEnabled: false }, { tableCallsEnabled: false }]) {
      getSettings.mockResolvedValue(settings(off));
      const res = await post("K7Q2M9X4TB", { reason: "napkin" });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        error: "calls_unavailable",
        message: "Masadan çağrı şu an kapalı. Bir görevliye el sallayabilirsin.",
      });
    }
    expect(resolveActiveTable).not.toHaveBeenCalled();
    expect(insertTableCall).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After when the member called a moment ago", async () => {
    reserveLoginAttempt.mockImplementation(async (purpose: string) =>
      purpose === "table-call"
        ? { blocked: true, retryAfterSeconds: 42, remaining: 0 }
        : OPEN,
    );
    const res = await post("K7Q2M9X4TB", { reason: "waiter" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(body.message).toContain("42 saniye");
    expect(insertTableCall).not.toHaveBeenCalled();
  });

  it("answers 429 for the hour's budget too", async () => {
    reserveLoginAttempt.mockImplementation(async (purpose: string) =>
      purpose === "table-call-hour"
        ? { blocked: true, retryAfterSeconds: 1800, remaining: 0 }
        : OPEN,
    );
    const res = await post("K7Q2M9X4TB", { reason: "waiter" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("1800");
    expect((await res.json()).message).toContain("30 dakika");
  });
});

describe("GET /tables/{code}/calls/{id}", () => {
  const ID = "tcl-0123456789abcdef";

  it("answers the call under its table, never cached", async () => {
    getTableCall.mockResolvedValue({
      id: ID,
      tableCode: "K7Q2M9X4TB",
      tableName: "Bahçe 3",
      reason: "waiter",
      customerEmail: "ayse@example.com",
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      ackedAt: new Date(Date.now() - 60_000).toISOString(),
      ackedBy: "panel:Selin",
    });
    const res = await get("k7q2m9x4tb", ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const { call } = await res.json();
    expect(call.status).toBe("acked");
    expect(Date.parse(call.ackedAt)).toBeGreaterThan(0);
    expect(JSON.stringify(call)).not.toMatch(/ayse|Selin/);
  });

  it("reads an unanswered call older than fifteen minutes as expired", async () => {
    getTableCall.mockResolvedValue({
      id: ID,
      tableCode: "K7Q2M9X4TB",
      tableName: "Bahçe 3",
      reason: "waiter",
      createdAt: new Date(Date.now() - 16 * 60_000).toISOString(),
      ackedAt: "",
    });
    const { call } = await (await get("K7Q2M9X4TB", ID)).json();
    expect(call).toMatchObject({ status: "expired", ackedAt: "" });
  });

  it("answers 404 call_not_found for another table, an unknown or a malformed id", async () => {
    getTableCall.mockResolvedValue({
      id: ID,
      tableCode: "AAAAAAAAAA",
      tableName: "Masa 1",
      reason: "water",
      createdAt: new Date().toISOString(),
      ackedAt: "",
    });
    const other = await get("K7Q2M9X4TB", ID);
    expect(other.status).toBe(404);
    expect((await other.json()).error).toBe("call_not_found");

    getTableCall.mockResolvedValue(null);
    expect((await get("K7Q2M9X4TB", ID)).status).toBe(404);

    getTableCall.mockClear();
    expect((await get("K7Q2M9X4TB", "ord-0042")).status).toBe(404);
    expect(getTableCall).not.toHaveBeenCalled();
  });
});
