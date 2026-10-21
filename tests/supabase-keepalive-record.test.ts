import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseUrlMissingError } from "@/lib/db/database-url.mjs";
import { createDb, type Executor } from "@/lib/db/client";
import type { AdminRole } from "@/lib/admin/roles";

/**
 * The record of the daily Supabase keep-alive ping and the owner's line
 * about it (db/migrations/20261021050600_supabase_keepalive.sql,
 * src/lib/admin/supabase-keepalive{,-core}.ts,
 * src/components/admin/dashboard/keepalive-status.tsx).
 *
 * Nobody can call /api/cron/daily by hand (CRON_SECRET is "sensitive" on
 * Vercel), so whether the ping that keeps the free-plan project from pausing
 * still gets through was visible nowhere. Pinned here: the one-statement
 * write and what it may hold, a write that fails or hangs, the read, who may
 * see it (and that nobody else's request reads it), the three-day line on
 * the Istanbul calendar (CLAUDE.md rule 22) and the line's colour.
 */

const db = vi.hoisted(() => ({
  sent: [] as { text: string; params: readonly unknown[] }[],
  answer: null as
    | null
    | ((text: string) => Promise<{ rows: Record<string, unknown>[] }>),
  getDbThrows: false,
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const exec: Executor = async (q) => {
    db.sent.push({ text: q.text, params: q.params });
    const rows = db.answer ? (await db.answer(q.text)).rows : [];
    return { rows, rowCount: rows.length || 1 };
  };
  const stub = createDb(exec);
  return {
    ...real,
    getDb: () => {
      if (db.getDbThrows) throw new Error("pool exploded at db.internal:5432");
      return stub;
    },
  };
});

const core = await import("@/lib/admin/supabase-keepalive-core");
const store = await import("@/lib/admin/supabase-keepalive");
const { KeepaliveStatusLine } = await import(
  "@/components/admin/dashboard/keepalive-status"
);
const { formatDateTime } = await import("@/components/admin/forms");
const { TONE_RULE, TONE_SOFT } = await import("@/components/admin/ui/tone");

const NEW_KEY = "sb_secret_TESTONLYnotArealKey00000_c0ffee00";
const LEGACY_KEY = "eyJhbGciOiJIUzI1NiJ9.test-legacy-not-real.sig";
const NOW = new Date("2026-10-20T06:00:01.234Z");

let logged: string[];

beforeEach(() => {
  db.sent.length = 0;
  db.answer = null;
  db.getDbThrows = false;
  logged = [];
  const capture = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "error").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
  vi.stubEnv("SUPABASE_SECRET_KEY", NEW_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", LEGACY_KEY);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("recordSupabaseKeepalive: one statement, an outcome and an instant", () => {
  it("writes ok as the latest attempt and the latest success", async () => {
    await expect(store.recordSupabaseKeepalive("ok", NOW)).resolves.toBe(true);
    expect(db.sent).toHaveLength(1);
    expect(db.sent[0].text).toMatch(
      /^INSERT INTO "supabase_keepalive" \("id", "lastStatus", "lastAttemptAt", "lastSuccessAt"\) VALUES .* ON CONFLICT \("id"\) DO UPDATE SET "lastStatus" = EXCLUDED\."lastStatus", "lastAttemptAt" = EXCLUDED\."lastAttemptAt", "lastSuccessAt" = EXCLUDED\."lastSuccessAt"$/,
    );
    expect(db.sent[0].params).toEqual([
      "supabase",
      "ok",
      NOW.toISOString(),
      NOW.toISOString(),
    ]);
  });

  for (const status of ["failed", "skipped"] as const) {
    it(`writes ${status} as the latest attempt and leaves the last success alone`, async () => {
      await expect(store.recordSupabaseKeepalive(status, NOW)).resolves.toBe(
        true,
      );
      expect(db.sent).toHaveLength(1);
      expect(db.sent[0].text).not.toContain("lastSuccessAt");
      expect(db.sent[0].text).toMatch(
        /DO UPDATE SET "lastStatus" = EXCLUDED\."lastStatus", "lastAttemptAt" = EXCLUDED\."lastAttemptAt"$/,
      );
      expect(db.sent[0].params).toEqual(["supabase", status, NOW.toISOString()]);
    });
  }

  it("holds nothing but the outcome and the instants: no key, in either format", async () => {
    for (const status of ["ok", "failed", "skipped"] as const) {
      const row = core.keepaliveRow(status, NOW);
      expect(Object.keys(row).sort()).toEqual(
        status === "ok"
          ? ["id", "lastAttemptAt", "lastStatus", "lastSuccessAt"]
          : ["id", "lastAttemptAt", "lastStatus"],
      );
      await store.recordSupabaseKeepalive(status, NOW);
    }
    const stored = JSON.stringify(db.sent);
    expect(stored).not.toContain(NEW_KEY);
    expect(stored).not.toContain(LEGACY_KEY);
  });

  it("answers false for a rejected write and logs its class, never the driver's words", async () => {
    db.answer = async () => {
      throw Object.assign(
        new Error('new row violates check constraint near "sb_secret_x" on host db.internal'),
        { code: "23514" },
      );
    };
    await expect(store.recordSupabaseKeepalive("ok", NOW)).resolves.toBe(false);
    expect(logged).toEqual([
      "[cron/daily] keep-alive not recorded: SQLSTATE 23514",
    ]);
  });

  it("answers false for an unreachable database", async () => {
    db.answer = async () => {
      throw Object.assign(new Error("connect ECONNREFUSED 10.0.0.9:5432"), {
        code: "ECONNREFUSED",
      });
    };
    await expect(store.recordSupabaseKeepalive("ok", NOW)).resolves.toBe(false);
    expect(logged).toEqual([
      "[cron/daily] keep-alive not recorded: database unreachable",
    ]);
  });

  it("answers false for a deployment without DATABASE_URL", async () => {
    db.answer = async () => {
      throw new DatabaseUrlMissingError(["POSTGRES_URL"]);
    };
    await expect(store.recordSupabaseKeepalive("ok", NOW)).resolves.toBe(false);
    expect(logged).toEqual([
      "[cron/daily] keep-alive not recorded: DATABASE_URL is not set",
    ]);
  });

  it("stops waiting at its deadline", async () => {
    db.answer = () => new Promise(() => {});
    const started = Date.now();
    await expect(store.recordSupabaseKeepalive("ok", NOW, 20)).resolves.toBe(
      false,
    );
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(logged).toEqual([
      "[cron/daily] keep-alive not recorded: no answer in 20 ms",
    ]);
    expect(store.KEEPALIVE_RECORD_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  it("never throws, even when the data layer does", async () => {
    db.getDbThrows = true;
    await expect(store.recordSupabaseKeepalive("ok", NOW)).resolves.toBe(false);
    expect(logged).toEqual(["[cron/daily] keep-alive not recorded: Error"]);
  });
});

describe("loadSupabaseKeepalive", () => {
  it("reads the one row, live", async () => {
    db.answer = async () => ({
      rows: [
        {
          lastStatus: "failed",
          lastAttemptAt: "2026-10-20T06:00:01.234Z",
          lastSuccessAt: "2026-10-19T06:00:00.500Z",
        },
      ],
    });
    await expect(store.loadSupabaseKeepalive()).resolves.toEqual({
      kind: "record",
      record: {
        lastStatus: "failed",
        lastAttemptAt: "2026-10-20T06:00:01.234Z",
        lastSuccessAt: "2026-10-19T06:00:00.500Z",
      },
    });
    expect(db.sent).toHaveLength(1);
    expect(db.sent[0].text).toMatch(
      /^SELECT "lastStatus", "lastAttemptAt", "lastSuccessAt" FROM "supabase_keepalive" WHERE "id" = \$1/,
    );
    expect(db.sent[0].params).toEqual(["supabase"]);
  });

  it("says none when nothing was recorded yet, and unreadable on a failure or a strange row", async () => {
    await expect(store.loadSupabaseKeepalive()).resolves.toEqual({
      kind: "none",
    });
    db.answer = async () => ({ rows: [{ lastStatus: "maybe" }] });
    await expect(store.loadSupabaseKeepalive()).resolves.toEqual({
      kind: "unreadable",
    });
    db.answer = async () => {
      throw Object.assign(new Error("boom"), { code: "42P01" });
    };
    await expect(store.loadSupabaseKeepalive()).resolves.toEqual({
      kind: "unreadable",
    });
    db.getDbThrows = true;
    await expect(store.loadSupabaseKeepalive()).resolves.toEqual({
      kind: "unreadable",
    });
  });
});

describe("who sees it: the owner, and nobody else's request reads it", () => {
  const ROLES: AdminRole[] = ["owner", "manager", "staff", "cashier"];

  it("is visible to the owner alone", () => {
    expect(ROLES.filter(core.keepaliveVisibleTo)).toEqual(["owner"]);
  });

  it("runs the read for the owner and never for the others", async () => {
    for (const role of ROLES) {
      const read = vi.fn(async () => ({ kind: "none" as const }));
      const result = core.readKeepaliveFor(role, read);
      if (role === "owner") {
        await expect(result).resolves.toEqual({ kind: "none" });
        expect(read).toHaveBeenCalledTimes(1);
      } else {
        expect(result).toBeNull();
        expect(read).not.toHaveBeenCalled();
      }
    }
  });
});

describe("three days on the Istanbul calendar (rule 22)", () => {
  const record = (
    lastSuccessAt: string,
    lastStatus: "ok" | "failed" | "skipped" = "ok",
    lastAttemptAt = lastSuccessAt || "2026-10-20T06:00:00.000Z",
  ) => ({
    kind: "record" as const,
    record: { lastStatus, lastAttemptAt, lastSuccessAt },
  });

  it("counts Istanbul days, not UTC days: 00:00 in Tuzla is already the next day", () => {
    // Success Sat 17 Oct 09:00 in Tuzla.
    const success = record("2026-10-17T06:00:05.000Z");
    // Tue 20 Oct 23:59 in Tuzla: three days, fine.
    expect(
      core.keepaliveView(success, new Date("2026-10-20T20:59:59.000Z")).state,
    ).toBe("fresh");
    // Wed 21 Oct 00:00 in Tuzla, still Tue 20 Oct 21:00 on the server's UTC
    // clock: four days, amber.
    expect(
      core.keepaliveView(success, new Date("2026-10-20T21:00:00.000Z")).state,
    ).toBe("stale");
  });

  it("and the other way: a success just after midnight in Tuzla is that Tuzla day", () => {
    // Sat 17 Oct 00:30 in Tuzla is still Fri 16 Oct in UTC.
    const success = record("2026-10-16T21:30:00.000Z");
    expect(
      core.keepaliveView(success, new Date("2026-10-20T12:00:00.000Z")).state,
    ).toBe("fresh");
    expect(
      core.keepaliveView(success, new Date("2026-10-21T12:00:00.000Z")).state,
    ).toBe("stale");
  });

  it("is calendar days, not 72 hours", () => {
    // 86 hours, still the third Tuzla day.
    expect(
      core.keepaliveView(
        record("2026-10-17T06:00:00.000Z"),
        new Date("2026-10-20T20:00:00.000Z"),
      ).state,
    ).toBe("fresh");
    expect(core.KEEPALIVE_STALE_DAYS).toBe(3);
  });

  it("turns amber on a failed latest attempt, however recent the last success", () => {
    const view = core.keepaliveView(
      record("2026-10-19T06:00:00.000Z", "failed", "2026-10-20T06:00:00.000Z"),
      NOW,
    );
    expect(view).toMatchObject({ state: "failed", tone: "warning" });
  });

  it("is amber with no success ever, plain with no record at all", () => {
    expect(
      core.keepaliveView(
        record("", "skipped", "2026-10-20T06:00:00.000Z"),
        NOW,
      ),
    ).toMatchObject({ state: "stale", tone: "warning" });
    expect(core.keepaliveView({ kind: "none" }, NOW)).toEqual({
      state: "none",
      tone: "neutral",
      lastSuccessAt: "",
    });
    expect(core.keepaliveView({ kind: "unreadable" }, NOW)).toMatchObject({
      state: "unreadable",
      tone: "warning",
    });
  });

  it("stays plain after a skip while the last success is recent", () => {
    expect(
      core.keepaliveView(
        record("2026-10-19T06:00:00.000Z", "skipped", "2026-10-20T06:00:00.000Z"),
        NOW,
      ),
    ).toMatchObject({ state: "fresh", tone: "neutral" });
  });
});

describe("the dashboard line", () => {
  function line(read: Parameters<typeof core.keepaliveView>[0], now = NOW) {
    const html = renderToStaticMarkup(
      createElement(KeepaliveStatusLine, { view: core.keepaliveView(read, now) }),
    );
    return {
      html,
      text: html.replace(/<[^>]+>/g, "").replace(/\s+/g, " "),
      className: /class="([^"]*)"/.exec(html)?.[1] ?? "",
    };
  }
  const warning = [TONE_SOFT.warning, TONE_RULE.warning];
  const neutral = [TONE_SOFT.neutral, TONE_RULE.neutral];

  it("names the last successful ping in the dashboard's Istanbul format, in the plain tone", () => {
    const at = "2026-10-20T06:00:01.234Z";
    const { text, className, html } = line({
      kind: "record",
      record: { lastStatus: "ok", lastAttemptAt: at, lastSuccessAt: at },
    });
    expect(formatDateTime(at)).toContain("09:00");
    expect(text).toContain(
      `Supabase uyanık tutma: son başarılı ping ${formatDateTime(at)}.`,
    );
    for (const c of neutral) expect(className).toContain(c);
    for (const c of warning) expect(className).not.toContain(c);
    expect(html).toContain('data-state="fresh"');
  });

  it("turns to the warning tokens when the last success is more than three days old", () => {
    const { text, className } = line({
      kind: "record",
      record: {
        lastStatus: "ok",
        lastAttemptAt: "2026-10-15T06:00:00.000Z",
        lastSuccessAt: "2026-10-15T06:00:00.000Z",
      },
    });
    for (const c of warning) expect(className).toContain(c);
    expect(text).toContain("3 günden eski");
    expect(text).toContain("Geliştiriciye ilet.");
  });

  it("turns to the warning tokens when the latest attempt failed", () => {
    const { text, className } = line({
      kind: "record",
      record: {
        lastStatus: "failed",
        lastAttemptAt: "2026-10-20T06:00:00.000Z",
        lastSuccessAt: "2026-10-19T06:00:00.000Z",
      },
    });
    for (const c of warning) expect(className).toContain(c);
    expect(text).toContain(
      `son başarılı ping ${formatDateTime("2026-10-19T06:00:00.000Z")}; son deneme başarısız (${formatDateTime("2026-10-20T06:00:00.000Z")}).`,
    );
  });

  it("says plainly that there is no record yet", () => {
    const { text, className } = line({ kind: "none" });
    expect(text).toContain("Supabase uyanık tutma: henüz kayıt yok");
    for (const c of neutral) expect(className).toContain(c);
    expect(text).not.toContain("Geliştiriciye ilet");
  });

  it("names a skip for what it is: no key", () => {
    const { text, className } = line({
      kind: "record",
      record: {
        lastStatus: "skipped",
        lastAttemptAt: "2026-10-20T06:00:00.000Z",
        lastSuccessAt: "",
      },
    });
    expect(text).toContain("henüz başarılı ping yok");
    expect(text).toContain("servis anahtarı tanımlı değil");
    for (const c of warning) expect(className).toContain(c);
  });
});
