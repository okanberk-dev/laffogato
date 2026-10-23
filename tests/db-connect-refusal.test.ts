import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isDbUnreachable, raiseDbError } from "@/lib/db/health";

/**
 * A database that refuses the connection itself, before any query ran, is
 * an outage, whatever SQLSTATE the refusal carries. Neon answers a compute
 * over its monthly quota with an error at the connection's startup; read
 * as a rejected query, every public page returned 500 instead of its
 * bundled content and the app's API 500 instead of 503 (reproduced on a
 * local Postgres refusing with 53300, 23 Eki 2026). A wrong password or a
 * missing database is this deployment's own fault and stays loud.
 */

const pg = vi.hoisted(() => ({
  connect: null as null | (() => Promise<unknown>),
  released: [] as unknown[],
}));

vi.mock("pg", () => {
  class Pool {
    on() {}
    connect() {
      return pg.connect!();
    }
  }
  return { Pool, default: { Pool } };
});

const refusal = (code: string, message: string) =>
  Object.assign(new Error(message), { code, severity: "FATAL" });

const QUOTA =
  "Your account or project has exceeded the compute time quota. Upgrade your plan to increase limits.";

async function freshDb() {
  vi.stubEnv("DATABASE_URL", "postgres://laf:laf@db.example.test:5432/laf");
  const g = globalThis as {
    __laffogatoPool?: unknown;
    __laffogatoDb?: unknown;
  };
  g.__laffogatoPool = undefined;
  g.__laffogatoDb = undefined;
  vi.resetModules();
  return import("@/lib/db");
}

beforeEach(() => {
  pg.released = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("a connection refused at the door", () => {
  for (const [code, message] of [
    ["XX000", QUOTA],
    ["53300", 'too many connections for role "laf"'],
    ["57P03", "the database system is starting up"],
  ] as const) {
    it(`${code} is an outage: no SQLSTATE, status 0, the public pages degrade`, async () => {
      pg.connect = () => Promise.reject(refusal(code, message));
      const { getDb } = await freshDb();
      const res = await getDb().from("products").select("*");
      expect(res.status).toBe(0);
      expect(res.error?.code).toBe("");
      expect(res.error?.message).toBe(message);
      let thrown: unknown;
      try {
        raiseDbError("test", res.error!, res.status);
      } catch (err) {
        thrown = err;
      }
      expect(isDbUnreachable(thrown)).toBe(true);
    });
  }

  for (const [code, message] of [
    ["28P01", 'password authentication failed for user "laf"'],
    ["3D000", 'database "laf" does not exist'],
  ] as const) {
    it(`${code} is this deployment's own fault and stays loud`, async () => {
      pg.connect = () => Promise.reject(refusal(code, message));
      const { getDb } = await freshDb();
      const res = await getDb().from("products").select("*");
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(code);
    });
  }
});

describe("a query the database rejected", () => {
  it("keeps its SQLSTATE, and its client is not handed out again", async () => {
    const client = {
      query: vi.fn(async (text: string) => {
        // The freshness check reads _migrations; let it see an up-to-date
        // database so only the query under test reaches here.
        if (/_migrations|to_regclass/.test(text)) {
          return { rows: [{ present: true }], rowCount: 0 };
        }
        throw refusal("23505", "duplicate key value");
      }),
      release: vi.fn((err?: unknown) => pg.released.push(err ?? null)),
    };
    pg.connect = () => Promise.resolve(client);
    const { getDb } = await freshDb();
    const res = await getDb().from("products").insert({ id: "prd-0001" });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe("23505");
    // The failed query's client went back with its error (destroyed), as
    // pool.query releases it.
    expect(pg.released.at(-1)).toBeInstanceOf(Error);
  });

  it("an answered query gives its client back for reuse", async () => {
    const client = {
      query: vi.fn(async () => ({
        rows: [{ present: true, id: "x" }],
        rowCount: 1,
      })),
      release: vi.fn((err?: unknown) => pg.released.push(err ?? null)),
    };
    pg.connect = () => Promise.resolve(client);
    const { getDb } = await freshDb();
    const res = await getDb().from("products").select("id");
    expect(res.error).toBeNull();
    expect(pg.released.at(-1)).toBeNull();
  });
});
