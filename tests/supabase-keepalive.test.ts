import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `keepSupabaseAwake`: the daily ping that keeps the free-plan Supabase
 * project from pausing (Supabase pauses one after 7 days without database
 * activity). It runs inside the daily cron, so the properties that matter are
 * that it never throws, that every way of not getting through is reported as
 * `failed`, that a deployment without the key is a clean `skipped`, and that
 * neither the key nor the member record the endpoint returns reaches the log.
 * Everything runs against a stubbed `fetch`; nothing reaches a real project.
 */

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const { keepSupabaseAwake, KEEPALIVE_TIMEOUT_MS } =
  await import("@/lib/supabase/admin");
const { SUPABASE_URL } = await import("@/lib/supabase/config");

const ORIGINAL = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAKE_KEY = "test-service-role-key-not-a-real-one";
const MEMBER_EMAIL = "eda@example.com";

const realTimeout = AbortSignal.timeout.bind(AbortSignal);
const fetchMock = vi.fn();

let logged: string[];

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_KEY;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  logged = [];
  const capture = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "error").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (ORIGINAL === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL;
  // For every case: no key, no member data in the log.
  for (const line of logged) {
    expect(line).not.toContain(FAKE_KEY);
    expect(line).not.toContain(MEMBER_EMAIL);
  }
});

describe("keepSupabaseAwake", () => {
  it("reads one user from the auth admin API with the service-role key and reports ok", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        aud: "authenticated",
        users: [{ id: "u-eda", email: MEMBER_EMAIL }],
      }),
    );

    await expect(keepSupabaseAwake()).resolves.toBe("ok");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`);
    expect(init.method ?? "GET").toBe("GET");
    expect(init.headers).toEqual({
      apikey: FAKE_KEY,
      Authorization: `Bearer ${FAKE_KEY}`,
    });
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(logged).toEqual([]);
  });

  it("reports a 5xx as failed without throwing, and logs only the status", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"msg":"database unavailable"}', { status: 503 }),
    );

    await expect(keepSupabaseAwake()).resolves.toBe("failed");
    expect(logged).toEqual(["[supabase] keep-alive failed: HTTP 503"]);
  });

  it("reports a rejected key (401) as failed", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(keepSupabaseAwake()).resolves.toBe("failed");
  });

  it(`gives up after ${KEEPALIVE_TIMEOUT_MS} ms and reports failed without throwing`, async () => {
    expect(KEEPALIVE_TIMEOUT_MS).toBe(5_000);
    // Same wiring, shorter clock: the signal the ping builds is the only
    // thing that can end a Supabase that took the connection and never
    // answered.
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() => realTimeout(10));
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    await expect(keepSupabaseAwake()).resolves.toBe("failed");
    expect(timeout).toHaveBeenCalledWith(KEEPALIVE_TIMEOUT_MS);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("[supabase] keep-alive threw:");
  });

  it("reports a network error as failed without throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(keepSupabaseAwake()).resolves.toBe("failed");
    expect(logged).toEqual(["[supabase] keep-alive threw: fetch failed"]);
  });

  it("skips without a request when the service-role key is not configured, and says why", async () => {
    for (const value of [undefined, "", "   "]) {
      if (value === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = value;
      await expect(keepSupabaseAwake()).resolves.toBe("skipped");
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged).toHaveLength(3);
    for (const line of logged) {
      expect(line).toContain("keep-alive skipped");
      expect(line).toContain(
        "neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_ROLE_KEY is set",
      );
    }
  });
});
