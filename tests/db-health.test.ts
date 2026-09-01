import { describe, expect, it, vi } from "vitest";

import {
  DbQueryError,
  DbUnreachableError,
  isDbUnreachable,
  memoizeUntilRejected,
  publicRead,
  raiseDbError,
} from "@/lib/db/health";

describe("raiseDbError", () => {
  it("treats status 0 with no SQLSTATE as unreachable", () => {
    // This is the exact production signature: the request never reached
    // Postgres, so there is no SQLSTATE to report.
    expect(() =>
      raiseDbError("count(products)", { message: "fetch failed", code: "" }, 0),
    ).toThrow(DbUnreachableError);
  });

  it("treats a SQLSTATE as a real query failure, never as an outage", () => {
    for (const code of ["23505", "42P01", "42703", "23514", "PGRST116"]) {
      let thrown: unknown;
      try {
        raiseDbError("q", { message: "nope", code }, 400);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(DbQueryError);
      expect(isDbUnreachable(thrown)).toBe(false);
    }
  });

  it("does not treat an authentication rejection as an outage", () => {
    // A wrong password is a real, reportable failure — degrading here would
    // hide a misconfigured deployment behind a working-looking site.
    let thrown: unknown;
    try {
      raiseDbError(
        "q",
        { message: "password authentication failed", code: "28P01" },
        400,
      );
    } catch (err) {
      thrown = err;
    }
    expect(isDbUnreachable(thrown)).toBe(false);
  });

  it("keeps the context and message in the thrown error", () => {
    expect(() =>
      raiseDbError("count(products)", { message: "fetch failed", code: "" }, 0),
    ).toThrow(/count\(products\): fetch failed/);
  });
});

describe("isDbUnreachable", () => {
  it("recognises the brand rather than the prototype", () => {
    const err = new DbUnreachableError("ctx", "down");
    // Next can load a module once per bundle layer, so `instanceof` is not
    // reliable across the RSC / server-action boundary; the brand is.
    expect(isDbUnreachable(JSON.parse(JSON.stringify(err)))).toBe(false);
    expect(isDbUnreachable(err)).toBe(true);
  });

  it("rejects unrelated values", () => {
    for (const v of [null, undefined, "fetch failed", new Error("boom"), {}]) {
      expect(isDbUnreachable(v)).toBe(false);
    }
  });
});

describe("memoizeUntilRejected", () => {
  it("runs the function once while it succeeds", async () => {
    const fn = vi.fn(async () => "ok");
    const memo = memoizeUntilRejected(fn);
    await Promise.all([memo(), memo(), memo()]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries after a rejection instead of replaying it forever", async () => {
    // The bug this exists to prevent: the seed helpers cached their rejected
    // promise, so one unreachable-database blip bricked the instance until a
    // redeploy — even after the database came back.
    let attempt = 0;
    const memo = memoizeUntilRejected(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("db down");
      return "recovered";
    });

    await expect(memo()).rejects.toThrow("db down");
    await expect(memo()).resolves.toBe("recovered");
    expect(attempt).toBe(2);
  });

  it("gives every concurrent caller the rejection", async () => {
    const memo = memoizeUntilRejected(async () => {
      throw new Error("db down");
    });
    const results = await Promise.allSettled([memo(), memo()]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
  });
});

describe("publicRead", () => {
  it("returns the live value when the read succeeds", async () => {
    await expect(
      publicRead("x", ["fallback"], async () => ["live"]),
    ).resolves.toEqual(["live"]);
  });

  it("falls back when the database is unreachable", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await publicRead("listShopProducts", [], async () => {
      throw new DbUnreachableError("count(products)", "fetch failed");
    });
    expect(out).toEqual([]);
    // The outage must stay visible in the platform logs.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("RETHROWS a real query error rather than masking it", async () => {
    // The anti-masking guarantee: a bad column or a constraint violation is a
    // bug, and a fallback would make it invisible in production.
    await expect(
      publicRead("listShopProducts", [], async () => {
        throw new DbQueryError("q", "column does not exist", "42703", 400);
      }),
    ).rejects.toBeInstanceOf(DbQueryError);
  });

  it("rethrows non-database errors untouched", async () => {
    await expect(
      publicRead("x", "fallback", async () => {
        throw new TypeError("some render bug");
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
