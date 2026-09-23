import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `findSupabaseIdentityByEmail`: the address lookup a site password reset
 * needs for a row that was never linked to its Supabase identity.
 *
 * GoTrue's `GET /admin/users?filter=` is a SUBSTRING match on the address (and
 * on `full_name`), with `_` as a LIKE wildcard, so the one property that
 * matters is that nothing but an exact, case-insensitive address match is ever
 * reported as "found". Everything here runs against a stubbed `fetch`; nothing
 * reaches a real Supabase project.
 */

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const { findSupabaseIdentityByEmail } = await import("@/lib/supabase/admin");
const { SUPABASE_URL } = await import("@/lib/supabase/config");

const ORIGINAL = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAKE_KEY = "test-service-role-key-not-a-real-one";
const ADDRESS = "eda@example.com";

type Page = { users: Record<string, unknown>[] } | "http-500" | "garbage";

const fetchMock = vi.fn();

function serve(...pages: Page[]): void {
  fetchMock.mockReset();
  for (const page of pages) {
    fetchMock.mockImplementationOnce(async () => {
      if (page === "http-500") return new Response("{}", { status: 500 });
      if (page === "garbage") return Response.json({ nope: true });
      return Response.json({ aud: "authenticated", ...page });
    });
  }
}

function user(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "u-eda",
    email: ADDRESS,
    email_confirmed_at: "2026-09-01T10:00:00Z",
    is_sso_user: false,
    is_anonymous: false,
    ...overrides,
  };
}

let logged: string[];
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_KEY;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  logged = [];
  const capture = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  errorSpy = vi.spyOn(console, "error").mockImplementation(capture);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(capture);
});

afterEach(() => {
  vi.unstubAllGlobals();
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  if (ORIGINAL === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL;
  // PII rule, for every case: the address never reaches the log.
  for (const line of logged) expect(line).not.toContain(ADDRESS);
});

describe("findSupabaseIdentityByEmail", () => {
  it("does nothing at all without the service-role key", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toEqual({
      status: "skipped",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks GoTrue's admin endpoint with a filter, authenticated like supabase-js", async () => {
    serve({ users: [user()] });
    await expect(findSupabaseIdentityByEmail(" Eda@Example.com ")).resolves.toEqual({
      status: "found",
      id: "u-eda",
      confirmed: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `${SUPABASE_URL}/auth/v1/admin/users`,
    );
    expect(parsed.searchParams.get("filter")).toBe(ADDRESS);
    expect(parsed.searchParams.get("page")).toBe("1");
    expect(parsed.searchParams.get("per_page")).toBe("100");
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe(FAKE_KEY);
    expect(headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    // The key travels in the headers only, never in the URL.
    expect(url).not.toContain(FAKE_KEY);
  });

  it("reports an unconfirmed identity as found but not confirmed", async () => {
    serve({ users: [user({ email_confirmed_at: null })] });
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toEqual({
      status: "found",
      id: "u-eda",
      confirmed: false,
    });
  });

  it("ignores substring and name matches: the filter is LIKE, not equality", async () => {
    serve({
      users: [
        user({ id: "u-veda", email: "veda@example.com" }),
        user({ id: "u-eda-co", email: "eda@example.com.tr" }),
        user({ id: "u-name", email: "someone@else.com", user_metadata: { full_name: ADDRESS } }),
      ],
    });
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toEqual({
      status: "none",
    });
  });

  it("treats `_` as a literal, not a wildcard", async () => {
    serve({ users: [user({ id: "u-wild", email: "a-b@example.com" })] });
    await expect(findSupabaseIdentityByEmail("a_b@example.com")).resolves.toEqual({
      status: "none",
    });
  });

  it("skips SSO and anonymous identities that share the address", async () => {
    serve({
      users: [
        user({ id: "u-sso", is_sso_user: true }),
        user({ id: "u-anon", is_anonymous: true }),
        user({ id: "u-eda" }),
      ],
    });
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toMatchObject({
      status: "found",
      id: "u-eda",
    });
  });

  it("refuses to guess between two password identities for one address", async () => {
    serve({ users: [user({ id: "u-1" }), user({ id: "u-2" })] });
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toEqual({
      status: "ambiguous",
    });
  });

  it("reads the next page when a page comes back full", async () => {
    const filler = Array.from({ length: 100 }, (_, i) =>
      user({ id: `u-f${i}`, email: `x${i}eda@example.com` }),
    );
    serve({ users: filler }, { users: [user()] });
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toMatchObject({
      status: "found",
      id: "u-eda",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = new URL((fetchMock.mock.calls[1] as [string])[0]);
    expect(second.searchParams.get("page")).toBe("2");
  });

  it("says failed, not none, when Supabase does not answer usefully", async () => {
    serve("http-500");
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toEqual({
      status: "failed",
    });
    serve("garbage");
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toEqual({
      status: "failed",
    });
    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(findSupabaseIdentityByEmail(ADDRESS)).resolves.toEqual({
      status: "failed",
    });
  });

  it("answers none for something that is not an address, without a request", async () => {
    await expect(findSupabaseIdentityByEmail("  ")).resolves.toEqual({
      status: "none",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
