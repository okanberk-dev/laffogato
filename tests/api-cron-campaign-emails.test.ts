import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/cron/campaign-emails` — Vercel's daily call that carries on every
 * campaign the panel's `after()` runner could not finish. The guard is the
 * whole point of the test: anyone who can reach the route can make the site
 * send commercial mail, so it answers only to `Bearer <CRON_SECRET>`, and an
 * unset secret is a closed door (503), not an open one.
 */

const resumePendingCampaigns = vi.fn();

vi.mock("@/lib/email/campaigns", () => ({ resumePendingCampaigns }));

const { GET } = await import("@/app/api/cron/campaign-emails/route");

const URL_ = "https://laffogato.net/api/cron/campaign-emails";

function get(authorization?: string): Request {
  return new Request(URL_, {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resumePendingCampaigns.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the cron guard", () => {
  it("answers 503 while CRON_SECRET is unset, and runs nothing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(get("Bearer anything"));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "cron_secret_unset" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(resumePendingCampaigns).not.toHaveBeenCalled();
  });

  it("answers 401 to a wrong, missing, or differently long bearer, and runs nothing", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    for (const auth of [
      undefined,
      "Bearer wrong!",
      "Bearer s3cre",
      "Bearer s3cret-and-more",
      "s3cret",
      "Basic s3cret",
    ]) {
      const res = await GET(get(auth));
      expect(res.status, String(auth)).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    expect(resumePendingCampaigns).not.toHaveBeenCalled();
  });

  it("resumes the pending campaigns under the shared 240 s deadline for the right bearer", async () => {
    vi.stubEnv("CRON_SECRET", " s3cret ");
    resumePendingCampaigns.mockResolvedValue([
      { id: "cmail-1", sent: 150, failed: 0, remaining: 0 },
    ]);
    const res = await GET(get("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      campaigns: [{ id: "cmail-1", sent: 150, failed: 0, remaining: 0 }],
    });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(resumePendingCampaigns).toHaveBeenCalledTimes(1);
    expect(resumePendingCampaigns).toHaveBeenCalledWith({
      deadlineMs: 240_000,
    });
  });

  it("reports a runner crash as 500 without leaking it", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    resumePendingCampaigns.mockRejectedValue(new Error("pool exhausted"));
    const res = await GET(get("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "internal" });
    expect(console.error).toHaveBeenCalled();
  });
});
