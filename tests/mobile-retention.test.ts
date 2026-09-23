import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { destructionEnabled, RETENTION_RULES } from "@/lib/retention";

/**
 * Periodic destruction - the published policy against the job that runs it.
 *
 * The Veri Saklama ve İmha Politikası is a binding undertaking: a retention
 * period per data category, and destruction in the last work week of June and
 * December. None of it existed in code, so `auth_attempts` - whose primary key
 * is `<purpose>::<IP>::<e-mail>` - grew without a ceiling for a counter whose
 * window is five minutes.
 *
 * Two failure modes this locks down. Periods must be READ from the policy, so
 * every rule quotes the sentence it comes from and the quote has to still be
 * there. And destruction is irreversible, so the default must stay report-only.
 */

const policy = JSON.stringify(LEGAL_CONTENT);
const retention = readFileSync(
  join(process.cwd(), "src/lib/retention.ts"),
  "utf8",
);
const cron = readFileSync(
  join(process.cwd(), "src/app/api/cron/retention/route.ts"),
  "utf8",
);
const vercel = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as { crons: { path: string; schedule: string }[] };

describe("every retention period is quoted from the published policy", () => {
  it("covers the four tables the audit found unswept, and fA'L's usage record", () => {
    expect(RETENTION_RULES.map((r) => r.table).sort()).toEqual([
      "audit_logs",
      "auth_attempts",
      "campaign_email_sends",
      "counter_tokens",
      // The member's consent history: three years after the consent stopped
      // being valid (a withdrawal record, for as long).
      "customer_consents",
      // Resend bounces and complaints: part of the commercial send record,
      // three years from the latest event.
      "email_suppressions",
      // Karar 177: ninety days, as Açık Rıza Metni R12 publishes, and the
      // consent's proof three years after it is withdrawn.
      "fal_readings",
      // "Bu yorumu bildir": the reported words, ninety days.
      "fal_reports",
      "feature_consents",
    ]);
  });

  for (const rule of RETENTION_RULES) {
    it(`${rule.id}: its basis sentence is still in the policy`, () => {
      // A policy edit that moves a period must break this, not drift past it.
      expect(policy.includes(rule.basis), rule.basis).toBe(true);
    });
  }

  it("never destroys a mandatory-minimum record early", () => {
    // 3 years and 10 years are floors the regulation sets, not ceilings. A
    // 365-day year would shave a decade of leap days off the audit log.
    const by = (id: string) => RETENTION_RULES.find((r) => r.id === id)!;
    expect(by("campaign-email-sends").days).toBeGreaterThanOrEqual(3 * 365 + 1);
    expect(by("audit-logs").days).toBeGreaterThanOrEqual(10 * 365 + 2);
  });

  it("keeps the security counter far inside its one-year ceiling", () => {
    // The published period is a CEILING for security logs; KVKK m.4/2-d wants
    // the shortest that serves the purpose, and the purpose is five minutes.
    const auth = RETENTION_RULES.find((r) => r.id === "auth-attempts")!;
    expect(auth.days).toBeLessThan(365);
    expect(auth.days).toBeGreaterThanOrEqual(1);
  });

  it("still promises June and December, which the daily job satisfies", () => {
    expect(policy).toContain(
      "periyodik imha işlemleri her yıl Haziran ve Aralık aylarının son iş haftasında gerçekleştirilir",
    );
  });
});

describe("report mode is the default", () => {
  it("destroys nothing unless RETENTION_APPLY says so, exactly", () => {
    expect(destructionEnabled(undefined)).toBe(false);
    for (const value of ["", "0", "false", "1", "true", "yes", "apply"]) {
      expect(destructionEnabled(value), value).toBe(false);
    }
    expect(destructionEnabled("destroy")).toBe(true);
    expect(destructionEnabled(" DESTROY ")).toBe(true);
  });

  it("issues no delete when it is only counting", async () => {
    const seen: string[] = [];
    const db = {
      from(table: string) {
        return {
          select() {
            return this;
          },
          delete() {
            seen.push(`delete:${table}`);
            return this;
          },
          lt() {
            return this;
          },
          neq() {
            return this;
          },
          then(resolve: (r: unknown) => void) {
            seen.push(`select:${table}`);
            resolve({ data: null, error: null, status: 200, count: 4 });
          },
        };
      },
      // Rules whose period needs SQL (customer_consents) count through a
      // function; counting must be asked for with p_apply false.
      rpc(fn: string, args: { p_apply: boolean }) {
        seen.push(args.p_apply ? `delete:${fn}` : `count:${fn}`);
        return Promise.resolve({ data: 4, error: null });
      },
    };
    vi.doMock("@/lib/db", () => ({
      getDb: () => db,
      TABLES: {
        authAttempts: "auth_attempts",
        campaignEmailSends: "campaign_email_sends",
        auditLogs: "audit_logs",
        counterTokens: "counter_tokens",
        customerConsents: "customer_consents",
        emailSuppressions: "email_suppressions",
        featureConsents: "feature_consents",
        falReadings: "fal_readings",
        falReports: "fal_reports",
      },
    }));
    vi.resetModules();
    const mod = await import("@/lib/retention");
    const report = await mod.runRetention({
      now: new Date("2026-09-16T04:00:00.000Z"),
    });
    expect(report.applied).toBe(false);
    expect(report.totalDestroyed).toBe(0);
    expect(report.totalMatched).toBe(4 * mod.RETENTION_RULES.length);
    expect(seen.some((s) => s.startsWith("delete:"))).toBe(false);
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });

  it("measures each rule from its own period, and destroys on request", async () => {
    const deleted: string[] = [];
    const db = {
      from(table: string) {
        return {
          select() {
            return this;
          },
          delete() {
            deleted.push(table);
            return this;
          },
          lt() {
            return this;
          },
          neq() {
            return this;
          },
          then(resolve: (r: unknown) => void) {
            resolve({
              data: deleted.includes(table) ? [{ id: "a" }, { id: "b" }] : null,
              error: null,
              status: 200,
              count: 2,
            });
          },
        };
      },
      rpc(fn: string, args: { p_apply: boolean; p_cutoff: string }) {
        const rule = RETENTION_RULES.find((r) => r.rpc === fn)!;
        if (args.p_apply) deleted.push(rule.table);
        return Promise.resolve({ data: 2, error: null });
      },
    };
    vi.doMock("@/lib/db", () => ({
      getDb: () => db,
      TABLES: {
        authAttempts: "auth_attempts",
        campaignEmailSends: "campaign_email_sends",
        auditLogs: "audit_logs",
        counterTokens: "counter_tokens",
        customerConsents: "customer_consents",
        emailSuppressions: "email_suppressions",
        featureConsents: "feature_consents",
        falReadings: "fal_readings",
        falReports: "fal_reports",
      },
    }));
    vi.resetModules();
    const mod = await import("@/lib/retention");
    const now = new Date("2026-09-16T04:00:00.000Z");
    const report = await mod.runRetention({ now, apply: true });
    expect(report.applied).toBe(true);
    expect(deleted.sort()).toEqual(
      mod.RETENTION_RULES.map((r) => r.table).sort(),
    );
    for (const result of report.results) {
      const rule = mod.RETENTION_RULES.find((r) => r.id === result.id)!;
      expect(result.cutoff).toBe(
        new Date(now.getTime() - rule.days * 86_400_000).toISOString(),
      );
      expect(result.destroyed).toBe(2);
    }
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });
});

describe("the sweep is wired up and cannot destroy a blank timestamp", () => {
  it("excludes rows whose stamp was never written", () => {
    // Every timestamp column in this schema defaults to '' and '' sorts before
    // any ISO-8601 instant, so a `lt(cutoff)` alone would take them all on the
    // first run.
    expect(retention).toContain('.neq(rule.column, "")');
  });

  it("is reached by a daily cron, through /api/cron/daily", () => {
    // The sweep no longer has a cron entry of its own. Vercel's Hobby plan
    // allows two cron jobs on daily schedules, and a `vercel.json` asking for
    // three - one of them hourly - makes Vercel fail the DEPLOY: nothing
    // reached production between 16 and 22 Eyl 2026 because of exactly that
    // (docs/EMAIL-RESEND.md, "Cron sayısı deploy'u durdurabilir").
    //
    // So the route stays, and `/api/cron/daily` calls it. What is pinned here
    // is that the sweep is still REACHED daily - the thing that would
    // otherwise rot silently, because a sweep nobody runs looks exactly like
    // a sweep that found nothing.
    const paths = vercel.crons.map((c) => c.path);
    expect(paths).toContain("/api/cron/daily");
    expect(paths).toContain("/api/cron/campaign-emails");
    const daily = readFileSync(
      join(process.cwd(), "src/app/api/cron/daily/route.ts"),
      "utf8",
    );
    expect(daily).toContain("runRetention");
    expect(daily).toContain("runBirthdayGreetings");
    expect(daily).toContain("resumePendingCampaigns");
  });

  it("is behind the shared cron gate and cannot carry on past it", () => {
    // `cronGate` returns the refusal itself, so there is no boolean to forget
    // to negate: CRON_SECRET unset is a 503, a wrong bearer a 401.
    expect(cron).toContain("const denied = cronGate(request)");
    expect(cron).toContain("if (denied) return denied;");
    expect(cron).toContain("destructionEnabled()");
    const gate = readFileSync(
      join(process.cwd(), "src/app/api/cron/_auth.ts"),
      "utf8",
    );
    expect(gate).toContain("timingSafeEqual");
    expect(gate).toContain("cron_secret_unset");
  });

  it("logs counts, never a key, an address or an IP", () => {
    // `auth_attempts.key` is all three at once.
    expect(cron).not.toMatch(
      /console\.(info|log|error)\([^)]*\b(email|key|ip)\b/,
    );
    expect(cron).toContain("matched=");
  });
});
