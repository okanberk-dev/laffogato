import { describe, expect, it, vi } from "vitest";

import { checkParasutConnection } from "@/lib/invoice/connection";
import type { TokenStore } from "@/lib/invoice/parasut-client";

/**
 * "Paraşüt bağlantısını sına" (src/lib/invoice/connection.ts): one login and
 * one read of the company, against a mocked `fetch`. It says what is wrong
 * in Turkish and never repeats a value it was given.
 */

const ENV = {
  PARASUT_CLIENT_ID: "cid",
  PARASUT_CLIENT_SECRET: "csecret",
  PARASUT_USERNAME: "site@laffogato.net",
  PARASUT_PASSWORD: "gizli-sifre",
  PARASUT_COMPANY_ID: "842867",
  PARASUT_BASE_URL: "https://api.parasut.test",
};

function tokens(): TokenStore {
  const data = new Map<string, string>();
  return {
    async read(key) {
      return data.get(key) ?? null;
    },
    async write(key, sealed) {
      data.set(key, sealed);
    },
    async lease() {
      return true;
    },
  };
}

function run(
  answer: (url: string) => Response,
  env: Record<string, string | undefined> = ENV,
) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return answer(url);
  });
  let clock = 1_800_000_000_000;
  const result = checkParasutConnection(env, {
    tokens: tokens(),
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  });
  return { result, calls };
}

const token = () =>
  Response.json({
    access_token: "a1",
    refresh_token: "r1",
    expires_in: 7200,
    created_at: Math.floor(1_800_000_000),
  });

describe("checkParasutConnection", () => {
  it("logs in and reads one contact of the configured company", async () => {
    const { result, calls } = run((url) =>
      url.endsWith("/oauth/token") ? token() : Response.json({ data: [] }),
    );
    expect(await result).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe(
      "https://api.parasut.test/v4/842867/contacts?page%5Bsize%5D=1",
    );
  });

  it("says the login was refused, without the password", async () => {
    const { result } = run(
      () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 401,
        }),
    );
    const r = await result;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/girişi reddedildi/);
    expect(r.error).not.toContain("gizli-sifre");
    expect(r.error).not.toContain("csecret");
  });

  it("names the company number when the login works but the company does not", async () => {
    const { result } = run((url) =>
      url.endsWith("/oauth/token")
        ? token()
        : new Response(JSON.stringify({ errors: [{ title: "Not found" }] }), {
            status: 404,
          }),
    );
    const r = await result;
    expect(r).toEqual({
      ok: false,
      error: expect.stringContaining("842867 numaralı firma okunamadı"),
    });
  });

  it("lists the missing variables by name and calls nothing", async () => {
    const { result, calls } = run(() => token(), {
      ...ENV,
      PARASUT_PASSWORD: "",
      PARASUT_COMPANY_ID: undefined,
    });
    expect(await result).toEqual({
      ok: false,
      error: "Paraşüt bilgileri eksik: PARASUT_PASSWORD, PARASUT_COMPANY_ID.",
    });
    expect(calls).toEqual([]);
  });
});
