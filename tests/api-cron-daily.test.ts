import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * `/api/cron/daily` - the day's scheduled work in one request. Each job runs
 * inside its own try and reports its own outcome, so the property pinned here
 * is that one job going wrong never swallows the others. The Supabase
 * keep-alive is the real `keepSupabaseAwake` against a stubbed `fetch`, and
 * its record the real `recordSupabaseKeepalive` against a stubbed data layer
 * (every statement it sends is captured); the other four jobs are stubs,
 * since each has its own tests.
 */

const resumePendingCampaigns = vi.fn();
const runBirthdayGreetings = vi.fn();
const expireUnpaidReservations = vi.fn();
const chargeSettledResales = vi.fn();
const expireStalePendingOrders = vi.fn();
const runRetention = vi.fn();
const destructionEnabled = vi.fn();
const recordShownLegalVersions = vi.fn();
const checkPushReceipts = vi.fn();
const reconcileIys = vi.fn();
const runInvoices = vi.fn();

/** What the route sent to the database, and in what order the jobs ran. */
const db = vi.hoisted(() => ({
  sent: [] as { text: string; params: readonly unknown[] }[],
  order: [] as string[],
  answer: null as null | ((text: string) => Promise<unknown>),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const exec: Executor = async (q) => {
    db.sent.push({ text: q.text, params: q.params });
    db.order.push("db");
    if (db.answer) await db.answer(q.text);
    return { rows: [], rowCount: 1 };
  };
  const stub = createDb(exec);
  return { ...real, getDb: () => stub };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/email/campaigns", () => ({ resumePendingCampaigns }));
vi.mock("@/app/api/cron/_birthday", () => ({ runBirthdayGreetings }));
vi.mock("@/lib/mobile/karaoke-payment", () => ({ expireUnpaidReservations }));
vi.mock("@/lib/mobile/karaoke", () => ({ chargeSettledResales }));
// The unpaid-order sweep has its own tests (tests/db-integration-payment-sweep.test.ts).
vi.mock("@/lib/admin/store", () => ({ expireStalePendingOrders }));
// The log line is the real one (tests/api-cron-retention-record.test.ts
// pins it against /api/cron/retention's).
vi.mock("@/lib/retention", async (importOriginal) => ({
  destructionEnabled,
  runRetention,
  retentionLogLine: (await importOriginal<typeof import("@/lib/retention")>())
    .retentionLogLine,
}));
vi.mock("@/lib/legal/store", () => ({ recordShownLegalVersions }));
vi.mock("@/lib/push/order-push", () => ({ checkPushReceipts }));
vi.mock("@/lib/iys/store", () => ({ reconcileIys }));
// The e-Arşiv run has its own tests (tests/invoice-run.test.ts).
vi.mock("@/lib/invoice/run", () => ({ runInvoices }));

const { GET } = await import("@/app/api/cron/daily/route");
const { KEEPALIVE_RECORD_TIMEOUT_MS } = await import(
  "@/lib/admin/supabase-keepalive"
);

/** The keep-alive record's statements (the only ones the stubs leave). */
function records() {
  return db.sent.filter((s) => s.text.includes('"supabase_keepalive"'));
}

const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAKE_KEY = "test-service-role-key-not-a-real-one";
const BIRTHDAY = {
  days: ["10-17"],
  candidates: 0,
  granted: 0,
  mailed: 0,
  skippedNoConsent: 0,
  skippedIysCheck: 0,
};
const RETENTION = {
  at: "2026-10-21T06:00:00.000Z",
  applied: false,
  results: [],
  totalMatched: 0,
  totalDestroyed: 0,
  recorded: false,
};

/** What the e-Arşiv run answers while EARSIV_MODE is off. */
const INVOICES = {
  at: "2026-10-22T06:00:00.000Z",
  reason: "cron",
  mode: "off",
  errors: [],
  created: 0,
  updated: 0,
  processed: 0,
  issued: 0,
  drafts: 0,
  failed: 0,
  manual: 0,
  emailed: 0,
  more: false,
};

const fetchMock = vi.fn();
let logged: string[];

function get(authorization = "Bearer s3cret"): Request {
  return new Request("https://laffogato.net/api/cron/daily", {
    headers: { authorization },
  });
}

function expectOtherJobsRan(): void {
  expect(resumePendingCampaigns).toHaveBeenCalledTimes(1);
  expect(runBirthdayGreetings).toHaveBeenCalledTimes(1);
  expect(expireUnpaidReservations).toHaveBeenCalledTimes(1);
  expect(chargeSettledResales).toHaveBeenCalledTimes(1);
  expect(expireStalePendingOrders).toHaveBeenCalledTimes(1);
  expect(recordShownLegalVersions).toHaveBeenCalledTimes(1);
  expect(runRetention).toHaveBeenCalledTimes(1);
  expect(reconcileIys).toHaveBeenCalledTimes(1);
  expect(runInvoices).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
  process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_KEY;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ users: [] }));
  resumePendingCampaigns.mockResolvedValue([]);
  runBirthdayGreetings.mockResolvedValue(BIRTHDAY);
  expireUnpaidReservations.mockResolvedValue(0);
  chargeSettledResales.mockResolvedValue({ days: 0 });
  expireStalePendingOrders.mockResolvedValue(0);
  checkPushReceipts.mockResolvedValue({ read: 0, forgotten: 0, cleared: 0 });
  reconcileIys.mockResolvedValue({ onay: 0, ret: 0, superseded: 0 });
  destructionEnabled.mockReturnValue(false);
  runRetention.mockImplementation(async () => {
    db.order.push("retention");
    return RETENTION;
  });
  recordShownLegalVersions.mockResolvedValue({
    documents: 27,
    hashes: ["a".repeat(64), "b".repeat(64)],
  });
  runInvoices.mockResolvedValue(INVOICES);
  db.sent.length = 0;
  db.order.length = 0;
  db.answer = null;
  logged = [];
  const capture = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "error").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (ORIGINAL_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
  for (const line of logged) expect(line).not.toContain(FAKE_KEY);
});

describe("/api/cron/daily", () => {
  it("runs nothing, the ping included, for a wrong bearer", async () => {
    const res = await GET(get("Bearer wrong!"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resumePendingCampaigns).not.toHaveBeenCalled();
    expect(runRetention).not.toHaveBeenCalled();
  });

  it("pings Supabase first, then runs every job, and reports each outcome", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      ok: true,
      keepalive: { ok: true, ping: "ok", recorded: true },
      campaigns: { ok: true, campaigns: [] },
      birthday: { ok: true, ...BIRTHDAY },
      iys: { ok: true, reconcile: { onay: 0, ret: 0, superseded: 0 } },
      karaoke: { ok: true, expired: 0 },
      karaokeResale: { ok: true, days: 0 },
      orders: { ok: true, expired: 0 },
      pushReceipts: { ok: true, read: 0, forgotten: 0, cleared: 0 },
      legalVersions: { ok: true, documents: 27 },
      retention: { ok: true, ...RETENTION },
      // Counts only (docs/EARSIV.md): mode, numbers, never a row.
      invoices: {
        ok: true,
        mode: "off",
        errors: 0,
        created: 0,
        processed: 0,
        issued: 0,
        drafts: 0,
        failed: 0,
        manual: 0,
        emailed: 0,
        more: false,
      },
    });
    // The e-Arşiv step runs after retention, with at most 120 s.
    expect(runRetention.mock.invocationCallOrder[0]).toBeLessThan(
      runInvoices.mock.invocationCallOrder[0],
    );
    expect(runInvoices).toHaveBeenCalledWith({
      budgetMs: expect.any(Number),
      reason: "cron",
    });
    expect(runInvoices.mock.calls[0][0].budgetMs).toBeLessThanOrEqual(120_000);
    // Every legal text as shown today is stored before the one step that
    // deletes (D-VERSIONS-TABLE).
    expect(recordShownLegalVersions.mock.invocationCallOrder[0]).toBeLessThan(
      runRetention.mock.invocationCallOrder[0],
    );
    // And retention keeps those texts whatever their age (review R1); the
    // response counts them, never lists them.
    expect(runRetention).toHaveBeenCalledWith(
      expect.objectContaining({
        keep: { "legal-doc-versions": ["a".repeat(64), "b".repeat(64)] },
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/auth/v1/admin/users?page=1&per_page=1",
    );
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
      resumePendingCampaigns.mock.invocationCallOrder[0],
    );
    expectOtherJobsRan();
  });

  it("still runs every other job when Supabase answers 5xx", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keepalive).toEqual({ ok: true, ping: "failed", recorded: true });
    expect(body.campaigns).toEqual({ ok: true, campaigns: [] });
    expect(body.retention).toEqual({ ok: true, ...RETENTION });
    expectOtherJobsRan();
  });

  it("still runs every other job when Supabase cannot be reached", async () => {
    fetchMock.mockRejectedValue(
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
    );
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect((await res.json()).keepalive).toEqual({
      ok: true,
      ping: "failed",
      recorded: true,
    });
    expectOtherJobsRan();
  });

  it("reports the ping as skipped, and runs the rest, without a service-role key", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect((await res.json()).keepalive).toEqual({
      ok: true,
      ping: "skipped",
      recorded: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectOtherJobsRan();
  });

  it("reports a failed legal-version step on its own and still runs retention", async () => {
    recordShownLegalVersions.mockRejectedValue(new Error("db down"));
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.legalVersions).toEqual({ ok: false, error: "internal" });
    expect(body.retention).toEqual({ ok: true, ...RETENTION });
    // Without the texts shown today that rule removes nothing.
    expect(runRetention).toHaveBeenCalledWith(
      expect.objectContaining({ keep: {} }),
    );
    expectOtherJobsRan();
  });

  it("closes the orders nobody paid for within their window, before the e-Arşiv step", async () => {
    // Handoff (g) 2: an unpaid order closes when its window passes even on a
    // day with no checkout to run the sweep, so a dead checkout does not sit
    // in the app as an order in progress.
    expireStalePendingOrders.mockResolvedValue(2);
    const res = await GET(get());
    expect((await res.json()).orders).toEqual({ ok: true, expired: 2 });
    expect(expireStalePendingOrders).toHaveBeenCalledTimes(1);
    expect(expireStalePendingOrders).toHaveBeenCalledWith();
    // A payment the sweep finds at the POS is booked, and the invoice run
    // after it then sees that order.
    expect(expireStalePendingOrders.mock.invocationCallOrder[0]).toBeLessThan(
      runInvoices.mock.invocationCallOrder[0],
    );
  });

  it("reports a failed order sweep on its own and still runs the rest", async () => {
    expireStalePendingOrders.mockRejectedValue(new Error("db down"));
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toEqual({ ok: false, error: "internal" });
    expect(body.retention).toEqual({ ok: true, ...RETENTION });
    expectOtherJobsRan();
  });

  it("reports a throwing job on its own and still runs the rest", async () => {
    resumePendingCampaigns.mockRejectedValue(new Error("db down"));
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaigns).toEqual({ ok: false, error: "internal" });
    expect(body.keepalive).toEqual({ ok: true, ping: "ok", recorded: true });
    expectOtherJobsRan();
  });
});

describe("/api/cron/daily records the ping for the owner's dashboard", () => {
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const UPSERT_HEAD =
    /^INSERT INTO "supabase_keepalive" \("id", "lastStatus", "lastAttemptAt"(, "lastSuccessAt")?\) VALUES /;

  it("writes one statement, after every job; an ok sets the last success too", async () => {
    const res = await GET(get());
    expect((await res.json()).keepalive.recorded).toBe(true);
    const sent = records();
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toMatch(UPSERT_HEAD);
    expect(sent[0].text).toMatch(
      /ON CONFLICT \("id"\) DO UPDATE SET "lastStatus" = EXCLUDED\."lastStatus", "lastAttemptAt" = EXCLUDED\."lastAttemptAt", "lastSuccessAt" = EXCLUDED\."lastSuccessAt"$/,
    );
    const [id, status, attemptAt, successAt] = sent[0].params;
    expect([id, status]).toEqual(["supabase", "ok"]);
    expect(attemptAt).toMatch(ISO);
    expect(successAt).toBe(attemptAt);
    // Bookkeeping comes last: retention ran, then the record.
    expect(db.order).toEqual(["retention", "db"]);
  });

  it("a failed ping and a skipped one leave the last success where it was", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    await GET(get());
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await GET(get());
    const sent = records();
    expect(sent.map((s) => s.params[1])).toEqual(["failed", "skipped"]);
    for (const s of sent) {
      expect(s.text).toMatch(UPSERT_HEAD);
      // Not in the insert, so not in the update: the old success stays.
      expect(s.text).not.toContain("lastSuccessAt");
      expect(s.params).toHaveLength(3);
      expect(s.params[2]).toMatch(ISO);
    }
  });

  it("stores no key and nothing from the response", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ users: [{ id: "u-eda", email: "eda@example.com" }] }),
    );
    await GET(get());
    const stored = JSON.stringify(records());
    expect(stored).not.toContain(FAKE_KEY);
    expect(stored).not.toContain("eda@example.com");
    expect(stored).not.toContain("u-eda");
  });

  it("an unreachable database neither fails the run nor turns a good ping into an error", async () => {
    db.answer = async (text) => {
      if (text.includes('"supabase_keepalive"')) {
        throw Object.assign(
          new Error("connect ECONNREFUSED 10.1.2.3:5432 as neondb_owner"),
          { code: "ECONNREFUSED" },
        );
      }
    };
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keepalive).toEqual({ ok: true, ping: "ok", recorded: false });
    expect(body.retention).toEqual({ ok: true, ...RETENTION });
    expectOtherJobsRan();
    // Logged by class, masked: not the driver's message.
    const line = logged.find((l) => l.includes("keep-alive not recorded"));
    expect(line).toContain("database unreachable");
    expect(line).not.toContain("10.1.2.3");
    expect(line).not.toContain("neondb_owner");
  });

  it(`a database that never answers holds the run ${KEEPALIVE_RECORD_TIMEOUT_MS} ms at most`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      db.answer = (text) =>
        text.includes('"supabase_keepalive"')
          ? new Promise(() => {})
          : Promise.resolve();
      const pending = GET(get());
      await vi.advanceTimersByTimeAsync(KEEPALIVE_RECORD_TIMEOUT_MS);
      const res = await pending;
      expect(res.status).toBe(200);
      expect((await res.json()).keepalive).toEqual({
        ok: true,
        ping: "ok",
        recorded: false,
      });
      expect(logged.join("\n")).toContain(
        `keep-alive not recorded: no answer in ${KEEPALIVE_RECORD_TIMEOUT_MS} ms`,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
