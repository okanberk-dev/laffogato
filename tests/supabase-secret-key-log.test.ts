import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "No key value in any log line" with errors that really carry the key
 * (independent security review of the db-safety-and-keys change, finding
 * F2). Fixed error strings ("fetch failed", "Invalid API key") prove little:
 * a real one can repeat the key itself.
 *
 * Node's fetch (undici) validates header values and throws
 *   TypeError: Headers.append: "<the whole value>" is an invalid header value.
 * for a value with an interior CR/LF or NUL, e.g. a key pasted across two
 * lines into Vercel (trim() only removes the ends), and the SDK hands the same
 * message back as `error.message` (auth-js `_getErrorMessage`). admin.ts now
 * treats such a value as unset before any call, and logs an error's class,
 * never its message.
 *
 * The stub below runs exactly that validation (`new Headers(init.headers)`)
 * and never touches the network. supabase-js is the real one.
 */

const PART_A = "sb_secret_TESTONLYfirstHalf";
const PART_B = "secondHalf00000_c0ffee00";
const NEW_KEY_TWO_LINES = `${PART_A}\n${PART_B}`;
const LEGACY_A = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0";
const LEGACY_B = "test-only-not-a-signature";
const LEGACY_TWO_LINES = `${LEGACY_A}\n.${LEGACY_B}`;

let logged: string[];

function resetClient(): void {
  (globalThis as { __laffogatoSupabaseAdmin?: unknown }).__laffogatoSupabaseAdmin =
    undefined;
}

beforeEach(() => {
  resetClient();
  logged = [];
  const capture = (...args: unknown[]) => {
    logged.push(
      args
        .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a)))
        .join(" "),
    );
  };
  vi.spyOn(console, "error").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
  vi.spyOn(console, "log").mockImplementation(capture);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      // The validation undici runs before it opens any socket.
      new Headers(init?.headers);
      return Response.json({ users: [] });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetClient();
});

async function runAllJobs() {
  vi.resetModules();
  const admin = await import("@/lib/supabase/admin");
  return [
    await admin.keepSupabaseAwake(),
    await admin.findSupabaseIdentityByEmail("eda@example.com"),
    await admin.deleteSupabaseIdentity("00000000-0000-4000-8000-000000000001"),
    await admin.updateSupabasePassword("00000000-0000-4000-8000-000000000001", "yeni-sifre-123"),
  ];
}

describe("a service key pasted across two lines never reaches a log line", () => {
  it("SUPABASE_SECRET_KEY (new key): treated as unset, every job skips", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", NEW_KEY_TWO_LINES);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const results = await runAllJobs();
    expect(results).toEqual([
      "skipped",
      { status: "skipped" },
      "skipped",
      "skipped",
    ]);
    expect(logged.filter((l) => l.includes("SUPABASE_SECRET_KEY ignored"))).toHaveLength(1);
    for (const line of logged) {
      expect(line).not.toContain(PART_A);
      expect(line).not.toContain(PART_B);
    }
  });

  it("SUPABASE_SERVICE_ROLE_KEY (legacy key): treated as unset too", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", LEGACY_TWO_LINES);
    const results = await runAllJobs();
    expect(results).toEqual([
      "skipped",
      { status: "skipped" },
      "skipped",
      "skipped",
    ]);
    for (const line of logged) {
      expect(line).not.toContain(LEGACY_A);
      expect(line).not.toContain(LEGACY_B);
    }
  });

  it("an unusable new key falls back to a usable legacy one, as an unset one does", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", NEW_KEY_TWO_LINES);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", `${LEGACY_A}.${LEGACY_B}`);
    const results = await runAllJobs();
    expect(results[0]).toBe("ok");
    const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } })
      .mock.calls;
    expect(calls[0][1].headers).toEqual({
      apikey: `${LEGACY_A}.${LEGACY_B}`,
      Authorization: `Bearer ${LEGACY_A}.${LEGACY_B}`,
    });
    for (const line of logged) {
      expect(line).not.toContain(PART_A);
      expect(line).not.toContain(PART_B);
    }
  });

  it("logs a failure's class, never a message that repeats the key", async () => {
    const KEY = "sb_secret_TESTONLYwholeKey000000_c0ffee00";
    vi.stubEnv("SUPABASE_SECRET_KEY", KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(`Headers.append: "${KEY}" is an invalid header value.`);
      }),
    );
    const results = await runAllJobs();
    expect(results).toEqual(["failed", { status: "failed" }, "failed", "failed"]);
    expect(logged.length).toBeGreaterThanOrEqual(4);
    for (const line of logged) expect(line).not.toContain(KEY);
    expect(logged).toContain("[supabase] keep-alive threw: TypeError");
  });
});
