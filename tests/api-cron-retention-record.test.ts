import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The destruction record, from both doors (OP-RETENTION-APPLY; Silme
 * Yönetmeliği m.7/3: every destruction is recorded, the record kept at least
 * three years).
 *
 * Production runs the sweep from `/api/cron/daily`; the operator reads a
 * report from `/api/cron/retention` before switching `RETENTION_APPLY` on
 * (docs/DATABASE.md, "Periyodik imha"). Both run the real `runRetention`
 * here, over a stand-in database where every rule matches two rows, so what
 * is pinned is the wiring: an applied run leaves exactly one `audit_logs`
 * row through `safeAudit`, a report run leaves none and destroys nothing,
 * and both routes log the same counts-only line.
 */

const h = vi.hoisted(() => ({
  safeAudit: vi.fn(async (_input: unknown) => true),
  calls: [] as string[],
}));

vi.mock("@/lib/admin/audit", () => ({ safeAudit: h.safeAudit }));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = {
    from(table: string) {
      let deleting = false;
      return {
        select() {
          return this;
        },
        delete() {
          deleting = true;
          h.calls.push(`delete:${table}`);
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
            data: deleting ? [{ id: 1 }, { id: 2 }] : null,
            error: null,
            status: 200,
            count: 2,
          });
        },
      };
    },
    rpc(fn: string, args: { p_apply: boolean }) {
      h.calls.push(`${args.p_apply ? "apply" : "count"}:${fn}`);
      return Promise.resolve({ data: 2, error: null });
    },
  };
  return { ...real, getDb: () => db };
});

// The daily route's other steps, each with its own tests.
vi.mock("@/lib/supabase/admin", () => ({
  keepSupabaseAwake: vi.fn(async () => "ok"),
}));
vi.mock("@/lib/email/campaigns", () => ({
  resumePendingCampaigns: vi.fn(async () => []),
}));
vi.mock("@/app/api/cron/_birthday", () => ({
  runBirthdayGreetings: vi.fn(async () => ({})),
}));
vi.mock("@/lib/mobile/karaoke-payment", () => ({
  expireUnpaidReservations: vi.fn(async () => 0),
}));

const daily = await import("@/app/api/cron/daily/route");
const retention = await import("@/app/api/cron/retention/route");
const { RETENTION_RULES } = await import("@/lib/retention");

const ROUTES = [
  ["/api/cron/daily", daily.GET],
  ["/api/cron/retention", retention.GET],
] as const;

function get(path: string): Request {
  return new Request(`https://laffogato.net${path}`, {
    headers: { authorization: "Bearer s3cret" },
  });
}

let infos: string[];

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  h.safeAudit.mockReset();
  h.safeAudit.mockImplementation(async () => true);
  h.calls.length = 0;
  infos = [];
  vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    infos.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each(ROUTES)("%s", (path, GET) => {
  it("leaves one destruction record when RETENTION_APPLY=destroy", async () => {
    vi.stubEnv("RETENTION_APPLY", "destroy");
    const res = await GET(get(path));
    expect(res.status).toBe(200);
    expect(h.safeAudit).toHaveBeenCalledTimes(1);
    const [input] = h.safeAudit.mock.calls[0] as [Record<string, unknown>];
    expect(input).toMatchObject({
      actor: "system",
      action: "bulk_delete",
      entity: "retention",
    });
    const payload = input.payload as {
      at: string;
      results: Array<Record<string, unknown>>;
    };
    expect(input.entityId).toBe(payload.at);
    expect(payload.results.map((r) => r.id)).toEqual(
      RETENTION_RULES.map((r) => r.id),
    );
    for (const row of payload.results) {
      expect(row).toMatchObject({ matched: 2, destroyed: 2 });
    }
    // The line both routes log: the mode and two counts.
    const total = 2 * RETENTION_RULES.length;
    expect(infos).toContain(
      `[cron/retention] destroy matched=${total} destroyed=${total}`,
    );
  });

  it("records nothing and destroys nothing in report mode", async () => {
    vi.stubEnv("RETENTION_APPLY", "");
    const res = await GET(get(path));
    expect(res.status).toBe(200);
    expect(h.safeAudit).not.toHaveBeenCalled();
    expect(h.calls.some((c) => c.startsWith("delete:"))).toBe(false);
    expect(h.calls.some((c) => c.startsWith("apply:"))).toBe(false);
    const total = 2 * RETENTION_RULES.length;
    expect(infos).toContain(
      `[cron/retention] report matched=${total} destroyed=0`,
    );
  });

  it("does nothing at all for a caller without the secret", async () => {
    vi.stubEnv("RETENTION_APPLY", "destroy");
    const res = await GET(
      new Request(`https://laffogato.net${path}`, {
        headers: { authorization: "Bearer wrong!" },
      }),
    );
    expect(res.status).toBe(401);
    expect(h.calls).toEqual([]);
    expect(h.safeAudit).not.toHaveBeenCalled();
  });
});

describe("the two routes", () => {
  it("log the very same line for the same run", async () => {
    vi.stubEnv("RETENTION_APPLY", "destroy");
    await daily.GET(get("/api/cron/daily"));
    const fromDaily = infos.filter((l) => l.startsWith("[cron/retention]"));
    infos.length = 0;
    await retention.GET(get("/api/cron/retention"));
    const fromRetention = infos.filter((l) => l.startsWith("[cron/retention]"));
    expect(fromDaily).toHaveLength(1);
    expect(fromDaily).toEqual(fromRetention);
  });

  it("answer whether the record was written", async () => {
    vi.stubEnv("RETENTION_APPLY", "destroy");
    h.safeAudit.mockResolvedValueOnce(false);
    const body = await (await retention.GET(get("/api/cron/retention"))).json();
    expect(body).toMatchObject({ applied: true, recorded: false });
    const again = await (await daily.GET(get("/api/cron/daily"))).json();
    expect(again.retention).toMatchObject({
      ok: true,
      applied: true,
      recorded: true,
    });
  });
});
