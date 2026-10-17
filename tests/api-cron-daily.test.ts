import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/cron/daily` - the day's scheduled work in one request. Each job runs
 * inside its own try and reports its own outcome, so the property pinned here
 * is that one job going wrong never swallows the others. The Supabase
 * keep-alive is the real `keepSupabaseAwake` against a stubbed `fetch`; the
 * other four jobs are stubs, since each has its own tests.
 */

const resumePendingCampaigns = vi.fn();
const runBirthdayGreetings = vi.fn();
const expireUnpaidReservations = vi.fn();
const runRetention = vi.fn();
const destructionEnabled = vi.fn();

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/email/campaigns", () => ({ resumePendingCampaigns }));
vi.mock("@/app/api/cron/_birthday", () => ({ runBirthdayGreetings }));
vi.mock("@/lib/mobile/karaoke-payment", () => ({ expireUnpaidReservations }));
vi.mock("@/lib/retention", () => ({ destructionEnabled, runRetention }));

const { GET } = await import("@/app/api/cron/daily/route");

const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAKE_KEY = "test-service-role-key-not-a-real-one";
const BIRTHDAY = {
  days: ["10-17"],
  candidates: 0,
  granted: 0,
  mailed: 0,
  skippedNoConsent: 0,
};
const RETENTION = { apply: false, results: [] };

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
  expect(runRetention).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret");
  process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_KEY;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ users: [] }));
  resumePendingCampaigns.mockResolvedValue([]);
  runBirthdayGreetings.mockResolvedValue(BIRTHDAY);
  expireUnpaidReservations.mockResolvedValue(0);
  destructionEnabled.mockReturnValue(false);
  runRetention.mockResolvedValue(RETENTION);
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
      keepalive: { ok: true, ping: "ok" },
      campaigns: { ok: true, campaigns: [] },
      birthday: { ok: true, ...BIRTHDAY },
      karaoke: { ok: true, expired: 0 },
      retention: { ok: true, ...RETENTION },
    });
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
    expect(body.keepalive).toEqual({ ok: true, ping: "failed" });
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
    expect((await res.json()).keepalive).toEqual({ ok: true, ping: "failed" });
    expectOtherJobsRan();
  });

  it("reports the ping as skipped, and runs the rest, without a service-role key", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect((await res.json()).keepalive).toEqual({ ok: true, ping: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
    expectOtherJobsRan();
  });

  it("reports a throwing job on its own and still runs the rest", async () => {
    resumePendingCampaigns.mockRejectedValue(new Error("db down"));
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaigns).toEqual({ ok: false, error: "internal" });
    expect(body.keepalive).toEqual({ ok: true, ping: "ok" });
    expectOtherJobsRan();
  });
});
