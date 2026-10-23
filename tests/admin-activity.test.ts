import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who is in the panel now (Kullanıcılar: "Şu an aktif", Innex recipe §3.9;
 * 23 Eki 2026): every signed-in request notes its address after the
 * response, once a minute at most per server instance, never in the
 * request's way; the owner's page reads the record back; a deleted user
 * leaves none behind.
 */

type Call = {
  table: string;
  op: "upsert" | "select" | "delete";
  payload?: unknown;
  options?: unknown;
  filters: Array<[string, unknown]>;
};

const h = vi.hoisted(() => ({
  afterThrows: false,
  queued: [] as Array<() => Promise<void>>,
  calls: [] as Call[],
  fail: false,
  rows: [] as Array<{ email: string; lastSeenAt: string }>,
}));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => {
    if (h.afterThrows) throw new Error("`after` was called outside a request");
    h.queued.push(fn);
  },
}));

vi.mock("@/lib/db", () => {
  class Query implements PromiseLike<unknown> {
    constructor(private readonly call: Call) {
      h.calls.push(call);
    }
    in(column: string, values: unknown) {
      this.call.filters.push([column, values]);
      return this;
    }
    eq(column: string, value: unknown) {
      this.call.filters.push([column, value]);
      return this;
    }
    then<A, B = never>(
      ok?: ((v: unknown) => A | PromiseLike<A>) | null,
      err?: ((e: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      const result = h.fail
        ? { data: null, error: { message: "boom", code: "XX000" }, status: 500 }
        : {
            data: this.call.op === "select" ? h.rows : null,
            error: null,
            status: 200,
          };
      return Promise.resolve(result).then(ok, err);
    }
  }
  return {
    TABLES: { adminActivity: "admin_activity" },
    getDb: () => ({
      from: (table: string) => ({
        upsert: (payload: unknown, options: unknown) =>
          new Query({ table, op: "upsert", payload, options, filters: [] }),
        select: (columns: string) =>
          new Query({ table, op: "select", payload: columns, filters: [] }),
        delete: () => new Query({ table, op: "delete", filters: [] }),
      }),
    }),
  };
});

const core = await import("@/lib/admin/activity-core");
const activity = await import("@/lib/admin/activity");

const T0 = new Date("2026-10-23T09:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

async function flush() {
  const jobs = h.queued.splice(0);
  for (const job of jobs) await job();
}

beforeEach(() => {
  h.afterThrows = false;
  h.queued = [];
  h.calls = [];
  h.fail = false;
  h.rows = [];
});

describe("the clock rules", () => {
  it("in the panel now: a request within the last five minutes", () => {
    expect(core.isActiveNow(T0.toISOString(), at(4 * 60_000 + 59_000))).toBe(
      true,
    );
    expect(core.isActiveNow(T0.toISOString(), at(5 * 60_000))).toBe(false);
    // Another instance's clock a little ahead is still now.
    expect(core.isActiveNow(at(30_000).toISOString(), T0)).toBe(true);
    expect(core.isActiveNow("", T0)).toBe(false);
    expect(core.isActiveNow("dün", T0)).toBe(false);
  });

  it("in the panel now: never a deactivated account, nor one changed or signed out since it was seen (review of #234)", () => {
    const seen = at(-60_000).toISOString();
    const base = {
      lastSeenAt: seen,
      isActive: true,
      changedAt: at(-86_400_000).toISOString(),
      signedOutAt: "",
    };
    expect(core.inPanelNow(base, T0)).toBe(true);
    expect(core.inPanelNow({ ...base, isActive: false }, T0)).toBe(false);
    // Password reset, role or access changed after it was seen: rule 30
    // signs it out on its next request.
    expect(
      core.inPanelNow({ ...base, changedAt: at(-30_000).toISOString() }, T0),
    ).toBe(false);
    // Çıkış after it was seen (its own request noted it just before).
    expect(
      core.inPanelNow({ ...base, signedOutAt: at(-59_000).toISOString() }, T0),
    ).toBe(false);
    // An older sign-out, then back in the panel.
    expect(
      core.inPanelNow(
        { ...base, signedOutAt: at(-3_600_000).toISOString() },
        T0,
      ),
    ).toBe(true);
    // Still five minutes at most.
    expect(
      core.inPanelNow(
        { ...base, lastSeenAt: at(-5 * 60_000).toISOString() },
        T0,
      ),
    ).toBe(false);
  });

  it("one write a minute per address, the quiet ones forgotten", () => {
    const written = new Map<string, number>();
    const t = T0.getTime();
    expect(core.shouldWriteActivity(written, "a@x.co", t)).toBe(true);
    expect(core.shouldWriteActivity(written, "a@x.co", t + 59_999)).toBe(false);
    expect(core.shouldWriteActivity(written, "b@x.co", t + 1)).toBe(true);
    expect(core.shouldWriteActivity(written, "a@x.co", t + 60_000)).toBe(true);
    // A long-lived instance does not keep every address it ever saw.
    for (let i = 0; i < 250; i++) {
      core.shouldWriteActivity(written, `u${i}@x.co`, t + i);
    }
    expect(core.shouldWriteActivity(written, "z@x.co", t + 10 * 60_000)).toBe(
      true,
    );
    expect(written.size).toBeLessThanOrEqual(2);
  });
});

describe("noting a request", () => {
  it("writes after the response, lower-cased, once a minute", async () => {
    activity.noteAdminActivity(" Mudur@Ornek.com ", T0);
    // Nothing during the request itself.
    expect(h.calls).toHaveLength(0);
    await flush();
    expect(h.calls).toEqual([
      {
        table: "admin_activity",
        op: "upsert",
        payload: { email: "mudur@ornek.com", lastSeenAt: T0.toISOString() },
        options: { onConflict: "email" },
        filters: [],
      },
    ]);
    activity.noteAdminActivity("mudur@ornek.com", at(30_000));
    await flush();
    expect(h.calls).toHaveLength(1);
    activity.noteAdminActivity("mudur@ornek.com", at(60_000));
    await flush();
    expect(h.calls).toHaveLength(2);
  });

  it("outside a request it does nothing, and the next request writes", async () => {
    h.afterThrows = true;
    expect(() =>
      activity.noteAdminActivity("kasa@ornek.com", T0),
    ).not.toThrow();
    h.afterThrows = false;
    activity.noteAdminActivity("kasa@ornek.com", at(1_000));
    await flush();
    expect(h.calls.map((c) => c.op)).toEqual(["upsert"]);
  });

  it("a failed write is logged, never thrown, and tried again the next minute, not the next request", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    h.fail = true;
    activity.noteAdminActivity("sahip@ornek.com", T0);
    await expect(flush()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      "[admin/activity] etkinlik yazılamadı",
      expect.any(Error),
    );
    // With the database down every request would otherwise queue another
    // write behind the pool's one connection (review of #234).
    activity.noteAdminActivity("sahip@ornek.com", at(1_000));
    await flush();
    expect(h.calls.filter((c) => c.op === "upsert")).toHaveLength(1);
    h.fail = false;
    activity.noteAdminActivity("sahip@ornek.com", at(60_000));
    await flush();
    expect(h.calls.filter((c) => c.op === "upsert")).toHaveLength(2);
    log.mockRestore();
  });

  it("every signed-in request notes its address", () => {
    const auth = readFileSync("src/lib/admin/auth.ts", "utf8");
    expect(auth).toMatch(
      /const session = await sessionFromToken\(token\);[\s\S]{0,200}if \(session\) noteAdminActivity\(session\.email\);\s*return session;/,
    );
  });
});

describe("reading it back and forgetting it", () => {
  it("one read for the page's addresses; none for none", async () => {
    expect(await activity.lastActivity([])).toEqual(new Map());
    expect(h.calls).toHaveLength(0);
    h.rows = [{ email: "mudur@ornek.com", lastSeenAt: T0.toISOString() }];
    const seen = await activity.lastActivity([
      "Mudur@Ornek.com",
      "mudur@ornek.com",
      "kasa@ornek.com",
    ]);
    expect(h.calls).toEqual([
      {
        table: "admin_activity",
        op: "select",
        payload: "email, lastSeenAt",
        filters: [["email", ["mudur@ornek.com", "kasa@ornek.com"]]],
      },
    ]);
    expect(seen).toEqual(new Map([["mudur@ornek.com", T0.toISOString()]]));
  });

  it("an unreadable record is an error the page catches", async () => {
    h.fail = true;
    await expect(activity.lastActivity(["a@x.co"])).rejects.toThrow();
  });

  it("a deleted user's record goes with the account", async () => {
    await activity.forgetAdminActivity(" Eski@Ornek.com ");
    expect(h.calls).toEqual([
      {
        table: "admin_activity",
        op: "delete",
        filters: [["email", "eski@ornek.com"]],
      },
    ]);
    const users = readFileSync("src/lib/admin/users.ts", "utf8");
    expect(users).toMatch(
      /checkErr\(error, "deleteAdminUser"\);[\s\S]{0,300}await forgetAdminActivity\(needle\);/,
    );
    // And a re-created address starts clean: a request finishing as the
    // old account was deleted could write its row back (review of #234).
    expect(users).toMatch(
      /throw new Error\(`createAdminUser: \$\{error\.message\}`\);\s*\}[\s\S]{0,300}await forgetAdminActivity\(email\);/,
    );
  });

  it("nothing caches it, and its writes expire no marker", () => {
    const tags = readFileSync("src/lib/cache/tags.ts", "utf8");
    expect(tags).toMatch(/\n  admin_activity: NONE,\n/);
    const migration = readFileSync(
      "db/migrations/20261023090000_admin_activity.sql",
      "utf8",
    );
    expect(migration).toMatch(
      /create table if not exists public\.admin_activity \(\s*email\s+text primary key,\s*"lastSeenAt" text not null\s*\);/,
    );
    expect(migration).toContain(
      "alter table public.admin_activity enable row level security;",
    );
    expect(readFileSync("db/schema.sql", "utf8")).toContain(
      "public.admin_activity",
    );
  });
});
