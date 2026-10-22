import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// An applied run writes its destruction record through safeAudit; the spy
// stands in for the audit log here (the real row is written in
// tests/db-integration-karaoke-retention.test.ts).
const safeAudit = vi.hoisted(() => vi.fn(async (_input: unknown) => true));
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));

import { RETENTION_RULE_LABELS } from "@/lib/admin/audit-view";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import {
  destructionEnabled,
  RETENTION_RULES,
  retentionLogLine,
} from "@/lib/retention";

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

/** The texts shown today: none, so the legal-versions rule runs too. */
const KEEP = { "legal-doc-versions": [] as string[] };

beforeEach(() => {
  safeAudit.mockReset();
  safeAudit.mockImplementation(async () => true);
});

interface FakeDb {
  db: unknown;
  /** `select:<table>`, `delete:<table>`, `count:<fn>`, `delete:<fn>`. */
  seen: string[];
  /** Tables something was destroyed in. */
  deleted: string[];
  /** The p_cutoff each SQL function was handed. */
  rpcCutoffs: Record<string, string>;
}

/**
 * A database where every rule matches `count` rows: a column rule's count
 * query answers `count`, its delete hands back that many rows, and a SQL
 * function answers `count` (or the error given for it).
 */
function fakeDb(opts: {
  count: number;
  rpcError?: Record<string, string>;
}): FakeDb {
  const seen: string[] = [];
  const deleted: string[] = [];
  const rpcCutoffs: Record<string, string> = {};
  const db = {
    from(table: string) {
      let deleting = false;
      return {
        select() {
          return this;
        },
        delete() {
          deleting = true;
          seen.push(`delete:${table}`);
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
          if (!deleting) seen.push(`select:${table}`);
          resolve({
            data: deleting
              ? Array.from({ length: opts.count }, (_, i) => ({ id: i }))
              : null,
            error: null,
            status: 200,
            count: opts.count,
          });
        },
      };
    },
    rpc(fn: string, args: { p_apply: boolean; p_cutoff: string }) {
      seen.push(args.p_apply ? `delete:${fn}` : `count:${fn}`);
      rpcCutoffs[fn] = args.p_cutoff;
      const message = opts.rpcError?.[fn];
      if (message) {
        return Promise.resolve({
          data: null,
          error: { message, code: "23505", details: "", hint: "" },
        });
      }
      if (args.p_apply && opts.count > 0) {
        deleted.push(RETENTION_RULES.find((r) => r.rpc === fn)!.table);
      }
      return Promise.resolve({ data: opts.count, error: null });
    },
  };
  return { db, seen, deleted, rpcCutoffs };
}

/** `@/lib/retention`, loaded again over `fake`. */
async function withDb(fake: FakeDb) {
  vi.doMock("@/lib/db", async () => ({
    ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
    getDb: () => fake.db,
  }));
  vi.resetModules();
  return import("@/lib/retention");
}

async function dropDb(): Promise<void> {
  vi.doUnmock("@/lib/db");
  vi.resetModules();
}

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
      // Karaoke (ASK-RETENTION): the guest's identity, every booking's
      // contact details and the consent's IP and user agent go after three
      // years; the booking itself after eleven.
      "karaoke_reservations",
      "karaoke_reservations",
      // Every legal text shown, by hash: what a consent's textHashes points
      // at, as long as that consent record lives (D-VERSIONS-TABLE).
      "legal_doc_versions",
      // The panel's earlier legal texts: what an order's consent version
      // points at, as long as that consent record lives.
      "legal_override_history",
      // The app's push tokens: at once on sign-out, closure and
      // DeviceNotRegistered; 180 days without a refresh at the latest.
      "customer_devices",
    ].sort());
  });

  it("finds both karaoke periods in the Veri Saklama row, word for word", () => {
    const by = (id: string) => RETENTION_RULES.find((r) => r.id === id)!;
    const doc = LEGAL_CONTENT.find(
      (d) => d.slug === "veri-saklama-ve-imha-politikasi",
    )!;
    const karaoke = doc.sections
      .flatMap((s) => s.table ?? [])
      .find((r) => r.key.startsWith("Karaoke rezervasyon kayıtları"))!;
    expect(karaoke.value).toContain(by("karaoke-guest-data").basis);
    expect(karaoke.value).toContain(by("karaoke-reservations").basis);
    expect(by("karaoke-guest-data").basis).toBe(
      "rezervasyon tarihinden itibaren 3 yıl sonra, takip eden ilk periyodik imha döneminde silinir",
    );
    expect(by("karaoke-reservations").basis).toBe(
      "ödeme işlem kayıtlarının saklama süresince (10 yıl) tutulur ve bu sürenin sonunda rezervasyon kaydı tümüyle silinir",
    );
  });

  it("names every rule in Turkish on the Olay kaydı page", () => {
    for (const rule of RETENTION_RULES) {
      expect(RETENTION_RULE_LABELS[rule.id], rule.id).toBeTruthy();
    }
  });

  it("calls only SQL functions that answer one integer, through rpc()", () => {
    // rpc() reads one cell; a function returning a table would hand back a
    // record string and the count would silently be NaN (CLAUDE.md rule 23).
    const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
    const withRpc = RETENTION_RULES.filter((r) => r.rpc);
    expect(withRpc.map((r) => r.rpc)).toEqual([
      "customer_consents_retention",
      "legal_doc_versions_retention",
      "karaoke_guest_retention",
      "karaoke_reservation_retention",
    ]);
    for (const rule of withRpc) {
      const heads = [
        ...schema.matchAll(
          new RegExp(
            String.raw`create\s+or\s+replace\s+function\s+public\.${rule.rpc}\s*\(\s*p_cutoff\s+text,\s*p_apply\s+boolean(?:,\s*p_keep\s+jsonb)?\s*\)\s*returns\s+(\w+)`,
            "gi",
          ),
        ),
      ];
      expect(heads.length, rule.id).toBeGreaterThan(0);
      expect(heads.at(-1)![1].toLowerCase(), rule.id).toBe("integer");
    }
    expect(retention).toContain("getDb().rpc<number>(rule.rpc");
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
    // Ten years from the contract's performance, which comes after the
    // text was archived: never less than a decade and a year from then.
    expect(by("legal-override-history").days).toBeGreaterThanOrEqual(
      11 * 365 + 2,
    );
    // Karaoke: three years from the booking day (MSY m.20 keeps the consent
    // record that long), and payment records ten years from the END of their
    // calendar year (TTK m.82/6), which eleven 366-day years always cover.
    expect(by("karaoke-guest-data").days).toBeGreaterThanOrEqual(3 * 365 + 1);
    expect(by("karaoke-reservations").days).toBeGreaterThanOrEqual(
      11 * 365 + 3,
    );
    // The stored texts the consents name: as long, for the same reason, and
    // only through the function that keeps what a recent consent names.
    expect(by("legal-doc-versions").days).toBeGreaterThanOrEqual(11 * 365 + 2);
    expect(by("legal-doc-versions").rpc).toBe("legal_doc_versions_retention");
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

  it("issues no delete when it is only counting, and records nothing", async () => {
    const fake = fakeDb({ count: 4 });
    const mod = await withDb(fake);
    const report = await mod.runRetention({
      now: new Date("2026-09-16T04:00:00.000Z"),
      keep: { "legal-doc-versions": [] },
    });
    expect(report.applied).toBe(false);
    expect(report.totalDestroyed).toBe(0);
    expect(report.totalMatched).toBe(4 * mod.RETENTION_RULES.length);
    expect(fake.seen.some((s) => s.startsWith("delete:"))).toBe(false);
    // Every SQL-function rule was asked to count, not to apply.
    expect(fake.seen.filter((s) => s.startsWith("count:")).sort()).toEqual([
      "count:customer_consents_retention",
      "count:karaoke_guest_retention",
      "count:karaoke_reservation_retention",
      "count:legal_doc_versions_retention",
    ]);
    // Report mode writes nothing at all: no destruction record either.
    expect(safeAudit).not.toHaveBeenCalled();
    expect(report.recorded).toBe(false);
    await dropDb();
  });

  it("measures each rule from its own period, and destroys on request", async () => {
    const fake = fakeDb({ count: 2 });
    const mod = await withDb(fake);
    const now = new Date("2026-09-16T04:00:00.000Z");
    const report = await mod.runRetention({
      now,
      apply: true,
      keep: { "legal-doc-versions": [] },
    });
    expect(report.applied).toBe(true);
    expect(fake.deleted.sort()).toEqual(
      mod.RETENTION_RULES.map((r) => r.table).sort(),
    );
    for (const result of report.results) {
      const rule = mod.RETENTION_RULES.find((r) => r.id === result.id)!;
      const at = now.getTime() - rule.days * 86_400_000;
      // A day column is cut on the köşk's clock (+03:00, CLAUDE.md rule 22);
      // an instant column in UTC, as before.
      expect(result.cutoff).toBe(
        rule.istanbulDay
          ? new Date(at + 3 * 3_600_000).toISOString().replace("Z", "+03:00")
          : new Date(at).toISOString(),
      );
      expect(result.destroyed).toBe(2);
    }
    await dropDb();
  });

  it("writes exactly one destruction record for an applied run, counts only", async () => {
    const fake = fakeDb({ count: 2 });
    const mod = await withDb(fake);
    const now = new Date("2026-10-21T06:00:00.000Z");
    const report = await mod.runRetention({ now, apply: true, keep: KEEP });
    expect(safeAudit).toHaveBeenCalledTimes(1);
    expect(safeAudit).toHaveBeenCalledWith({
      actor: "system",
      action: "bulk_delete",
      entity: "retention",
      entityId: "2026-10-21T06:00:00.000Z",
      payload: {
        at: "2026-10-21T06:00:00.000Z",
        results: report.results.map((r) => ({
          id: r.id,
          table: r.table,
          // Fields emptied or rows deleted (R1).
          method: r.id === "karaoke-guest-data" ? "clear" : "delete",
          cutoff: r.cutoff,
          matched: r.matched,
          destroyed: r.destroyed,
        })),
      },
    });
    const [input] = safeAudit.mock.calls[0] as [
      { payload: { results: Record<string, unknown>[] } },
    ];
    // Nothing but the six fields per rule: no row, no key, no address.
    for (const row of input.payload.results) {
      expect(Object.keys(row).sort()).toEqual(
        ["cutoff", "destroyed", "id", "matched", "method", "table"].sort(),
      );
    }
    expect(input.payload.results).toHaveLength(mod.RETENTION_RULES.length);
    expect(report.recorded).toBe(true);
    await dropDb();
  });

  it("keeps the destruction when the record cannot be written, and says so", async () => {
    safeAudit.mockResolvedValueOnce(false);
    const fake = fakeDb({ count: 2 });
    const mod = await withDb(fake);
    const report = await mod.runRetention({
      now: new Date("2026-10-21T06:00:00.000Z"),
      apply: true,
      keep: KEEP,
    });
    expect(report.totalDestroyed).toBeGreaterThan(0);
    expect(report.recorded).toBe(false);
    await dropDb();
  });

  it("marks a rule that failed in the record, without its error text", async () => {
    // A database error can quote the very value it refused.
    const fake = fakeDb({
      count: 2,
      rpcError: {
        karaoke_guest_retention:
          "duplicate key value violates unique constraint (email)=(misafir@ornek.com)",
      },
    });
    const mod = await withDb(fake);
    const report = await mod.runRetention({
      now: new Date("2026-10-21T06:00:00.000Z"),
      apply: true,
      keep: KEEP,
    });
    const failed = report.results.find((r) => r.id === "karaoke-guest-data")!;
    expect(failed.error).toMatch(/misafir@ornek\.com/);
    const [input] = safeAudit.mock.calls[0] as [
      { payload: { results: Record<string, unknown>[] } },
    ];
    const row = input.payload.results.find(
      (r) => r.id === "karaoke-guest-data",
    );
    expect(row).toMatchObject({ matched: 0, destroyed: 0, failed: true });
    expect(JSON.stringify(input.payload)).not.toContain("misafir@ornek.com");
    expect(JSON.stringify(input.payload)).not.toContain("duplicate key");
    // The rules that worked are recorded as usual.
    expect(input.payload.results.filter((r) => r.failed === true)).toHaveLength(
      1,
    );
    await dropDb();
  });

  it("cuts a karaoke day on the köşk's clock, not on UTC's", async () => {
    // 00:30 on 21 Ekim 2026 in Tuzla is still 20 Ekim in UTC. Three 366-day
    // years before that instant is 19 Ekim 2023 on the köşk's clock and 18
    // Ekim in UTC: `toISOString().slice(0, 10)` would name the wrong day.
    const fake = fakeDb({ count: 0 });
    const mod = await withDb(fake);
    const now = new Date("2026-10-20T21:30:00.000Z");
    const report = await mod.runRetention({ now, keep: KEEP });
    const guest = report.results.find((r) => r.id === "karaoke-guest-data")!;
    expect(guest.cutoff).toBe("2023-10-19T00:30:00.000+03:00");
    expect(fake.rpcCutoffs.karaoke_guest_retention.slice(0, 10)).toBe(
      "2023-10-19",
    );
    expect(Date.parse(guest.cutoff)).toBe(now.getTime() - 1098 * 86_400_000);
    const booking = report.results.find(
      (r) => r.id === "karaoke-reservations",
    )!;
    // Eleven 366-day years: 13 Ekim 2015 on the köşk's clock (12 in UTC).
    expect(booking.cutoff).toBe("2015-10-13T00:30:00.000+03:00");
    // Instant columns are untouched: still UTC.
    const audit = report.results.find((r) => r.id === "audit-logs")!;
    expect(audit.cutoff.endsWith("Z")).toBe(true);
    await dropDb();
  });
});

/**
 * Review R1 (21 Eki 2026): legal_doc_versions_retention could remove a text
 * shown today - one replaced long ago and shown again (a reset to the coded
 * text) keeps its first "createdAt". The texts shown today now go to the
 * function as `p_keep`; a caller that cannot say which those are removes
 * nothing under that rule.
 */
describe("the legal texts shown today are kept whatever their age", () => {
  async function run(keep?: Record<string, string[]>) {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const db = {
      from() {
        const api = {
          select: () => api,
          delete: () => api,
          lt: () => api,
          neq: () => api,
          then: (resolve: (r: unknown) => void) =>
            resolve({ data: null, error: null, status: 200, count: 0 }),
        };
        return api;
      },
      rpc(fn: string, args: Record<string, unknown>) {
        calls.push({ fn, args });
        return Promise.resolve({ data: 0, error: null });
      },
    };
    vi.doMock("@/lib/db", () => ({
      getDb: () => db,
      TABLES: new Proxy({}, { get: (_t, k) => String(k) }),
    }));
    vi.resetModules();
    const mod = await import("@/lib/retention");
    const report = await mod.runRetention({ apply: true, keep });
    vi.doUnmock("@/lib/db");
    vi.resetModules();
    return {
      report,
      legal: calls.filter((c) => c.fn === "legal_doc_versions_retention"),
      others: calls.filter((c) => c.fn !== "legal_doc_versions_retention"),
    };
  }

  it("hands the function the hashes shown today", async () => {
    const live = ["a".repeat(64), "b".repeat(64)];
    const { legal, others } = await run({ "legal-doc-versions": live });
    expect(legal).toHaveLength(1);
    expect(legal[0].args).toMatchObject({ p_apply: true, p_keep: live });
    // The other functions keep their two arguments.
    for (const c of others) expect(c.args).not.toHaveProperty("p_keep");
  });

  it("removes nothing under that rule without the list, and says so", async () => {
    const { report, legal } = await run();
    expect(legal).toEqual([]);
    const r = report.results.find((x) => x.id === "legal-doc-versions")!;
    expect(r).toMatchObject({ matched: 0, destroyed: 0 });
    expect(r.error).toMatch(/keep list/);
  });

  it("the function itself keeps them, and refuses to act without a list", () => {
    const sql = readFileSync(
      join(process.cwd(), "db/migrations/20261020180000_legal_doc_versions.sql"),
      "utf8",
    );
    expect(sql).toContain("p_keep   jsonb");
    expect(sql.match(/and not \(p_keep \? v\.hash\)/g)).toHaveLength(2);
    expect(sql).toContain(
      "if p_keep is null or jsonb_typeof(p_keep) <> 'array' then\n    return 0;",
    );
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
    // `auth_attempts.key` is all three at once. Both routes log the one line
    // `retentionLogLine` writes, and it carries nothing but the mode and
    // two counts.
    const daily = readFileSync(
      join(process.cwd(), "src/app/api/cron/daily/route.ts"),
      "utf8",
    );
    for (const src of [cron, daily]) {
      expect(src).not.toMatch(
        /console\.(info|log|error)\([^)]*\b(email|key|ip)\b/,
      );
      expect(src).toContain("console.info(retentionLogLine(report));");
    }
    expect(
      retentionLogLine({ applied: true, totalMatched: 7, totalDestroyed: 5 }),
    ).toBe("[cron/retention] destroy matched=7 destroyed=5");
    expect(
      retentionLogLine({ applied: false, totalMatched: 7, totalDestroyed: 0 }),
    ).toBe("[cron/retention] report matched=7 destroyed=0");
  });
});
