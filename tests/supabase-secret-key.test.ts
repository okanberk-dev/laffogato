import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which Supabase key the service jobs use (src/lib/supabase/admin.ts).
 *
 * Supabase deprecates the legacy `service_role` JWT by the end of 2026 and
 * replaces it with secret keys (`sb_secret_...`,
 * https://supabase.com/docs/guides/api/api-keys). SUPABASE_SECRET_KEY is
 * read first; the legacy SUPABASE_SERVICE_ROLE_KEY only when the new one is
 * absent. A secret key is not a JWT and travels on `apikey` only ("Send
 * publishable and secret keys on the apikey header, not on Authorization:
 * Bearer"); the legacy key keeps the bearer GoTrue reads its role from.
 * Whatever the format, neither value ever reaches a log line or a result.
 * Everything runs against a stubbed `fetch` and a stubbed supabase-js.
 */

const deleteUser = vi.fn();
const updateUserById = vi.fn();
const createClient = vi.fn((url: string, key: string, options: unknown) => {
  void url;
  void key;
  void options;
  return { auth: { admin: { deleteUser, updateUserById } } };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const admin = await import("@/lib/supabase/admin");
const { SUPABASE_URL } = await import("@/lib/supabase/config");

/** Shaped like the real ones, valid for nothing. */
const NEW_KEY = "sb_secret_TESTONLYnotArealKey00000_c0ffee00";
const LEGACY_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test-only-not-a-signature";

const fetchMock = vi.fn();
let logged: string[];
const ORIGINAL = {
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function setKeys(keys: { secret?: string; legacy?: string }): void {
  if (keys.secret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = keys.secret;
  if (keys.legacy === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = keys.legacy;
}

function resetClient(): void {
  (globalThis as { __laffogatoSupabaseAdmin?: unknown }).__laffogatoSupabaseAdmin =
    undefined;
}

/** The headers of the n-th direct call to the auth admin API. */
function headersOf(call = 0): Record<string, string> {
  return (fetchMock.mock.calls[call] as [string, RequestInit])[1]
    .headers as Record<string, string>;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetClient();
  setKeys({});
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json({ users: [] }));
  vi.stubGlobal("fetch", fetchMock);
  deleteUser.mockResolvedValue({ error: null });
  updateUserById.mockResolvedValue({ error: null });
  logged = [];
  const capture = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "error").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
  vi.spyOn(console, "log").mockImplementation(capture);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetClient();
  setKeys({
    secret: ORIGINAL.SUPABASE_SECRET_KEY,
    legacy: ORIGINAL.SUPABASE_SERVICE_ROLE_KEY,
  });
  // Whatever the case: no key, in either format, in any log line.
  for (const line of logged) {
    expect(line).not.toContain(NEW_KEY);
    expect(line).not.toContain(LEGACY_KEY);
  }
});

const ALL_JOBS = async () => [
  await admin.keepSupabaseAwake(),
  await admin.findSupabaseIdentityByEmail("eda@example.com"),
  await admin.deleteSupabaseIdentity("u-0001"),
  await admin.updateSupabasePassword("u-0001", "yeni-sifre-123"),
];

describe("which key", () => {
  it("only SUPABASE_SECRET_KEY: uses it, on apikey alone", async () => {
    setKeys({ secret: NEW_KEY });
    expect(admin.hasServiceRole()).toBe(true);
    await expect(admin.keepSupabaseAwake()).resolves.toBe("ok");
    await expect(
      admin.findSupabaseIdentityByEmail("eda@example.com"),
    ).resolves.toEqual({ status: "none" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of [0, 1]) {
      expect(headersOf(call)).toEqual({ apikey: NEW_KEY });
      expect(headersOf(call)).not.toHaveProperty("Authorization");
    }
    await expect(admin.deleteSupabaseIdentity("u-0001")).resolves.toBe(
      "deleted",
    );
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(SUPABASE_URL, NEW_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  });

  it("only SUPABASE_SERVICE_ROLE_KEY: uses the legacy JWT, with its bearer, as before", async () => {
    setKeys({ legacy: LEGACY_KEY });
    expect(admin.hasServiceRole()).toBe(true);
    await expect(admin.keepSupabaseAwake()).resolves.toBe("ok");
    await admin.findSupabaseIdentityByEmail("eda@example.com");
    for (const call of [0, 1]) {
      expect(headersOf(call)).toEqual({
        apikey: LEGACY_KEY,
        Authorization: `Bearer ${LEGACY_KEY}`,
      });
    }
    await expect(
      admin.updateSupabasePassword("u-0001", "yeni-sifre-123"),
    ).resolves.toBe("updated");
    expect(createClient).toHaveBeenCalledWith(
      SUPABASE_URL,
      LEGACY_KEY,
      expect.anything(),
    );
  });

  it("both: the new secret key wins everywhere", async () => {
    setKeys({ secret: NEW_KEY, legacy: LEGACY_KEY });
    await ALL_JOBS();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of [0, 1]) {
      expect(headersOf(call)).toEqual({ apikey: NEW_KEY });
    }
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0][1]).toBe(NEW_KEY);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(LEGACY_KEY);
  });

  it("a blank or empty SUPABASE_SECRET_KEY counts as absent", async () => {
    for (const blank of ["", "   "]) {
      vi.clearAllMocks();
      resetClient();
      setKeys({ secret: blank, legacy: LEGACY_KEY });
      await admin.keepSupabaseAwake();
      expect(headersOf()).toEqual({
        apikey: LEGACY_KEY,
        Authorization: `Bearer ${LEGACY_KEY}`,
      });
    }
  });

  it("trims a pasted key before using it", async () => {
    setKeys({ secret: `  ${NEW_KEY}\n` });
    await admin.keepSupabaseAwake();
    expect(headersOf()).toEqual({ apikey: NEW_KEY });
  });

  it("neither: every job skips as it did before, and says which names it looked for", async () => {
    for (const keys of [{}, { secret: "", legacy: "" }, { secret: " ", legacy: " " }]) {
      vi.clearAllMocks();
      resetClient();
      logged = [];
      setKeys(keys);
      expect(admin.hasServiceRole()).toBe(false);
      expect(await ALL_JOBS()).toEqual([
        "skipped",
        { status: "skipped" },
        "skipped",
        "skipped",
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(createClient).not.toHaveBeenCalled();
      // The keep-alive and the password sync say why (the other two are
      // logged by their callers).
      const reasons = logged.filter((l) => l.includes("skipped"));
      expect(reasons).toHaveLength(2);
      for (const line of reasons) {
        expect(line).toContain(admin.NO_SECRET_KEY);
        expect(line).toContain("SUPABASE_SECRET_KEY");
        expect(line).toContain("SUPABASE_SERVICE_ROLE_KEY");
      }
    }
  });

  it("builds a new client when the key changes, never reusing one built with the other", async () => {
    setKeys({ legacy: LEGACY_KEY });
    await admin.deleteSupabaseIdentity("u-0001");
    setKeys({ secret: NEW_KEY, legacy: LEGACY_KEY });
    await admin.deleteSupabaseIdentity("u-0002");
    await admin.deleteSupabaseIdentity("u-0003");
    expect(createClient.mock.calls.map((c) => c[1])).toEqual([
      LEGACY_KEY,
      NEW_KEY,
    ]);
  });
});

describe("the key never leaves the module", () => {
  for (const [label, keys] of [
    ["new", { secret: NEW_KEY }],
    ["legacy", { legacy: LEGACY_KEY }],
  ] as const) {
    it(`${label} key: not in a failure's log line or in any result`, async () => {
      setKeys(keys);
      // Every way of failing: an HTTP error, a network error, an SDK error
      // and an SDK throw.
      fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      deleteUser.mockResolvedValueOnce({ error: { message: "Invalid API key" } });
      updateUserById.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));
      const results = await ALL_JOBS();
      expect(results).toEqual(["failed", { status: "failed" }, "failed", "failed"]);
      expect(JSON.stringify(results)).not.toContain(
        label === "new" ? NEW_KEY : LEGACY_KEY,
      );
      expect(logged.length).toBeGreaterThanOrEqual(4);
      expect(typeof admin.hasServiceRole()).toBe("boolean");
    });
  }
});
