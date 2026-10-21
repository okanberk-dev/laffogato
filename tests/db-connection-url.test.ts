import { spawn } from "node:child_process";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DATABASE_URL_MISSING,
  DatabaseUrlMissingError,
  databaseUrlFrom,
  IGNORED_DATABASE_URL_VARS,
  isDatabaseUrlMissing,
} from "@/lib/db/database-url.mjs";

/**
 * Where the database connection string comes from: DATABASE_URL, and nothing
 * else (src/lib/db/database-url.mjs, docs/DATABASE.md).
 *
 * The app read DATABASE_URL, then POSTGRES_URL, then SUPABASE_DB_URL, and
 * the two scripts that open the same database read DATABASE_URL, then
 * POSTGRES_URL. Supabase's Vercel integration writes POSTGRES_URL into
 * Production: a site that lost DATABASE_URL would have connected to that
 * empty database without a word and bootstrapped a schema in it. A missing
 * DATABASE_URL now dials nothing at all: it degrades exactly like an
 * unreachable database (bundled content, 503 on the app's API), names the
 * missing variable, and /api/health reports it as `unconfigured`.
 *
 * The same cases run against the shared rule, the app's data layer and both
 * scripts (spawned for real, against throwaway TCP listeners that count who
 * dialled them).
 */

/** A password that must never reach a log line or an error. */
const SECRET = "pw-must-never-print";

const pg = vi.hoisted(() => ({ pools: [] as string[] }));

vi.mock("pg", () => {
  // Records which connection string the app built its pool from, and answers
  // like a database that is not there, so nothing real is dialled.
  const refused = () =>
    Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9"), {
      code: "ECONNREFUSED",
    });
  class Pool {
    constructor(config: { connectionString: string }) {
      pg.pools.push(config.connectionString);
    }
    on(): void {}
    async connect(): Promise<never> {
      throw refused();
    }
    async query(): Promise<never> {
      throw refused();
    }
  }
  return { Pool, default: { Pool } };
});

type Env = Partial<Record<"DATABASE_URL" | "POSTGRES_URL" | "SUPABASE_DB_URL", string>>;

interface Case {
  name: string;
  env: Env;
  /** Which variable's connection string must be used; null: none at all. */
  picks: "DATABASE_URL" | null;
  /** Ignored names the error must mention. */
  mentions?: string[];
}

/** URLs per variable; each test fills in its own hosts. */
function caseEnv(
  c: Case,
  urls: Record<"DATABASE_URL" | "POSTGRES_URL" | "SUPABASE_DB_URL", string>,
): Env {
  const env: Env = {};
  for (const [name, value] of Object.entries(c.env) as [keyof Env, string][]) {
    // "" and blanks stay as they are: they are the case under test.
    env[name] = value === "set" ? urls[name] : value;
  }
  return env;
}

const CASES: Case[] = [
  { name: "only DATABASE_URL", env: { DATABASE_URL: "set" }, picks: "DATABASE_URL" },
  {
    name: "DATABASE_URL and POSTGRES_URL",
    env: { DATABASE_URL: "set", POSTGRES_URL: "set" },
    picks: "DATABASE_URL",
  },
  {
    name: "DATABASE_URL and SUPABASE_DB_URL",
    env: { DATABASE_URL: "set", SUPABASE_DB_URL: "set" },
    picks: "DATABASE_URL",
  },
  {
    name: "all three",
    env: { DATABASE_URL: "set", POSTGRES_URL: "set", SUPABASE_DB_URL: "set" },
    picks: "DATABASE_URL",
  },
  {
    name: "only POSTGRES_URL",
    env: { POSTGRES_URL: "set" },
    picks: null,
    mentions: ["POSTGRES_URL"],
  },
  {
    name: "only SUPABASE_DB_URL",
    env: { SUPABASE_DB_URL: "set" },
    picks: null,
    mentions: ["SUPABASE_DB_URL"],
  },
  {
    name: "POSTGRES_URL and SUPABASE_DB_URL",
    env: { POSTGRES_URL: "set", SUPABASE_DB_URL: "set" },
    picks: null,
    mentions: ["POSTGRES_URL", "SUPABASE_DB_URL"],
  },
  {
    name: "an empty DATABASE_URL beside POSTGRES_URL",
    env: { DATABASE_URL: "", POSTGRES_URL: "set" },
    picks: null,
    mentions: ["POSTGRES_URL"],
  },
  {
    name: "a blank DATABASE_URL beside SUPABASE_DB_URL",
    env: { DATABASE_URL: "   ", SUPABASE_DB_URL: "set" },
    picks: null,
    mentions: ["SUPABASE_DB_URL"],
  },
  { name: "nothing at all", env: {}, picks: null },
];

const FIXED_URLS = {
  DATABASE_URL: `postgres://app:${SECRET}@db.example.test:5432/laffogato`,
  POSTGRES_URL: `postgres://postgres.ref:${SECRET}@aws-0-eu.pooler.supabase.com:6543/postgres`,
  SUPABASE_DB_URL: `postgres://postgres:${SECRET}@db.ref.supabase.co:5432/postgres`,
};

describe("the shared rule (database-url.mjs)", () => {
  for (const c of CASES) {
    it(`${c.name}: ${c.picks ?? "configuration error"}`, () => {
      const env = caseEnv(c, FIXED_URLS);
      if (c.picks) {
        expect(databaseUrlFrom(env)).toBe(FIXED_URLS.DATABASE_URL);
        return;
      }
      let thrown: unknown;
      try {
        databaseUrlFrom(env);
      } catch (err) {
        thrown = err;
      }
      expect(isDatabaseUrlMissing(thrown)).toBe(true);
      const message = (thrown as Error).message;
      expect(message).toContain("DATABASE_URL tanımlı değil");
      expect((thrown as { code?: string }).code).toBe(DATABASE_URL_MISSING);
      for (const name of c.mentions ?? []) expect(message).toContain(name);
      for (const name of IGNORED_DATABASE_URL_VARS) {
        if (!(c.mentions ?? []).includes(name)) {
          expect(message).not.toContain(name);
        }
      }
      expect(message).not.toContain(SECRET);
    });
  }

  it("trims what it returns", () => {
    expect(databaseUrlFrom({ DATABASE_URL: "  postgres://a@h/db\n" })).toBe(
      "postgres://a@h/db",
    );
  });

  it("is a code of its own, never a SQLSTATE and never the empty transport code", () => {
    expect(DATABASE_URL_MISSING).not.toMatch(/^[0-9A-Z]{5}$/);
    expect(DATABASE_URL_MISSING).not.toBe("");
    expect(isDatabaseUrlMissing(new Error("x"))).toBe(false);
    expect(isDatabaseUrlMissing(null)).toBe(false);
  });
});

describe("the app's data layer (src/lib/db)", () => {
  const ENV_NAMES = ["DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL"] as const;

  async function freshDb(env: Env) {
    for (const name of ENV_NAMES) vi.stubEnv(name, env[name]);
    const g = globalThis as {
      __laffogatoPool?: unknown;
      __laffogatoDb?: unknown;
    };
    g.__laffogatoPool = undefined;
    g.__laffogatoDb = undefined;
    pg.pools.length = 0;
    vi.resetModules();
    // Importing must not need a connection string: `next build` imports
    // every route and has none.
    const db = await import("@/lib/db");
    const health = await import("@/lib/db/health");
    return { ...db, ...health };
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    const g = globalThis as {
      __laffogatoPool?: unknown;
      __laffogatoDb?: unknown;
    };
    g.__laffogatoPool = undefined;
    g.__laffogatoDb = undefined;
  });

  for (const c of CASES) {
    it(`${c.name}: ${c.picks ? "builds its pool from DATABASE_URL" : "dials nothing, names itself and degrades like an outage"}`, async () => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        errors.push(args.map(String).join(" "));
      });
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const lib = await freshDb(caseEnv(c, FIXED_URLS));
      const res = await lib.getDb().from("products").select("*");

      if (c.picks) {
        expect(pg.pools).toHaveLength(1);
        expect(pg.pools[0]).toContain("db.example.test");
        // The stand-in database refuses: that is an outage, as before.
        expect(res.status).toBe(0);
        expect(res.error?.code).toBe("");
        return;
      }

      // No pool, so nothing was dialled: not POSTGRES_URL, not anything.
      expect(pg.pools).toEqual([]);
      // Never reached a Postgres, under a code of its own.
      expect(res.status).toBe(0);
      expect(res.error?.code).toBe(DATABASE_URL_MISSING);
      // Degrades exactly like an outage, whatever status a caller passes
      // (some rebuild it from the code), with the message that names it...
      for (const status of [res.status, 400]) {
        let raised: unknown;
        try {
          lib.raiseDbError("ctx", res.error!, status);
        } catch (err) {
          raised = err;
        }
        expect(lib.isDbUnreachable(raised)).toBe(true);
        expect((raised as Error).message).toContain("DATABASE_URL tanımlı değil");
      }
      // ...so a public page serves its bundled content, as over an outage.
      await expect(
        lib.publicRead("probe", "bundled", async () => {
          const r = await lib.getDb().from("settings").select("*");
          if (r.error) lib.raiseDbError("probe", r.error, r.status);
          return "live";
        }),
      ).resolves.toBe("bundled");
      // `/api/health` names it instead of calling it "down".
      await expect(lib.dbHealth()).resolves.toEqual({
        db: "unconfigured",
        schema: "unknown",
      });
      // Said once per instance, by name, never by value.
      const said = errors.filter((l) => l.startsWith("[db] "));
      expect(said).toHaveLength(1);
      expect(said[0]).toContain("DATABASE_URL tanımlı değil");
      for (const name of c.mentions ?? []) expect(said[0]).toContain(name);
      for (const line of errors) expect(line).not.toContain(SECRET);
    });
  }

  it("still reports an unreachable database as down, not as unconfigured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const lib = await freshDb({ DATABASE_URL: FIXED_URLS.DATABASE_URL });
    await expect(lib.dbHealth()).resolves.toEqual({
      db: "down",
      schema: "unknown",
    });
  });

  it("maps the configuration error under its own code in toDbError", async () => {
    const { toDbError } = await import("@/lib/db/client");
    expect(toDbError(new DatabaseUrlMissingError(["POSTGRES_URL"]))).toEqual({
      error: {
        message: expect.stringContaining("POSTGRES_URL"),
        code: DATABASE_URL_MISSING,
        details: "",
        hint: "",
      },
      status: 0,
    });
    // A transport failure keeps its signature.
    expect(
      toDbError(Object.assign(new Error("x"), { code: "ECONNREFUSED" })),
    ).toMatchObject({ status: 0, error: { code: "" } });
  });
});

describe("the two scripts (spawned)", () => {
  /** A TCP listener that counts connections and hangs up on each one. */
  interface Listener {
    server: Server;
    port: number;
    hits: number;
  }

  async function listen(): Promise<Listener> {
    const l: Listener = { server: createServer(), port: 0, hits: 0 };
    l.server.on("connection", (socket: Socket) => {
      l.hits += 1;
      socket.destroy();
    });
    await new Promise<void>((resolve) =>
      l.server.listen(0, "127.0.0.1", () => resolve()),
    );
    l.port = (l.server.address() as { port: number }).port;
    return l;
  }

  const listeners: Record<"DATABASE_URL" | "POSTGRES_URL" | "SUPABASE_DB_URL", Listener> =
    {} as never;

  beforeAll(async () => {
    listeners.DATABASE_URL = await listen();
    listeners.POSTGRES_URL = await listen();
    listeners.SUPABASE_DB_URL = await listen();
  });

  afterAll(async () => {
    for (const l of Object.values(listeners)) {
      await new Promise((resolve) => l.server.close(resolve));
    }
  });

  function urls() {
    const at = (name: keyof typeof listeners) =>
      `postgres://u:${SECRET}@127.0.0.1:${listeners[name].port}/db`;
    return {
      DATABASE_URL: at("DATABASE_URL"),
      POSTGRES_URL: at("POSTGRES_URL"),
      SUPABASE_DB_URL: at("SUPABASE_DB_URL"),
    };
  }

  function run(
    script: string,
    env: Env,
  ): Promise<{ code: number | null; output: string }> {
    return new Promise((resolve, reject) => {
      // Real paths: backfill-backdrops.mjs runs its main() only when argv[1]
      // is its own file, and /tmp is a symlink on macOS.
      const root = realpathSync(process.cwd());
      // A clean environment: the test run's own DATABASE_URL must not leak in.
      const childEnv = {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        ...env,
      } as unknown as NodeJS.ProcessEnv;
      const child = spawn(process.execPath, [join(root, script)], {
        cwd: root,
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (d) => (output += String(d)));
      child.stderr.on("data", (d) => (output += String(d)));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, output }));
    });
  }

  const SCRIPTS = ["scripts/db-migrate.mjs", "scripts/backfill-backdrops.mjs"];

  for (const script of SCRIPTS) {
    for (const c of CASES) {
      it(
        `${script}, ${c.name}: ${c.picks ? "dials DATABASE_URL only" : "stops before dialling anything"}`,
        async () => {
          const before = Object.fromEntries(
            Object.entries(listeners).map(([k, l]) => [k, l.hits]),
          );
          const { code, output } = await run(script, caseEnv(c, urls()));
          const dialled = Object.fromEntries(
            Object.entries(listeners).map(([k, l]) => [k, l.hits - before[k]]),
          );

          // Every case ends in exit 1 here: the only listener that answers
          // hangs up at once.
          expect(code).toBe(1);
          expect(dialled.POSTGRES_URL).toBe(0);
          expect(dialled.SUPABASE_DB_URL).toBe(0);
          expect(output).not.toContain(SECRET);
          if (c.picks) {
            expect(dialled.DATABASE_URL).toBeGreaterThan(0);
            expect(output).not.toContain("DATABASE_URL tanımlı değil");
          } else {
            expect(dialled.DATABASE_URL).toBe(0);
            expect(output).toContain("DATABASE_URL tanımlı değil");
            for (const name of c.mentions ?? []) expect(output).toContain(name);
          }
        },
        30_000,
      );
    }
  }
});

describe("one rule, one place", () => {
  /** Every source file under a directory. */
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
    });
  }

  it("reads the connection string through database-url.mjs in the app and both scripts", () => {
    for (const path of [
      "src/lib/db/index.ts",
      "scripts/db-migrate.mjs",
      "scripts/backfill-backdrops.mjs",
    ]) {
      const code = readFileSync(path, "utf8");
      expect(code, path).toMatch(/database-url\.mjs"/);
      expect(code, path).toContain("databaseUrlFrom(process.env)");
      expect(code, path).not.toMatch(/process\.env\.DATABASE_URL/);
    }
  });

  it("reads POSTGRES_URL and SUPABASE_DB_URL nowhere in src/ or scripts/", () => {
    // A read is `env.NAME`, `env["NAME"]` or the name as a string; prose in
    // a comment is not. database-url.mjs lists them, to say they are ignored.
    const read =
      /\.(POSTGRES_URL|SUPABASE_DB_URL)\b|["'`](POSTGRES_URL|SUPABASE_DB_URL)["'`]/;
    const offenders = [...files("src"), ...files("scripts")].filter(
      (path) =>
        !path.endsWith(join("lib", "db", "database-url.mjs")) &&
        read.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
