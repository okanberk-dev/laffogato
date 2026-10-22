import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParasutConfig } from "@/lib/invoice/config";
import {
  openToken,
  ParasutAuthError,
  ParasutClient,
  ParasutDeadlineError,
  ParasutError,
  sealToken,
  type TokenStore,
} from "@/lib/invoice/parasut-client";

/**
 * The Paraşüt client (src/lib/invoice/parasut-client.ts) against a mocked
 * `fetch`: the password grant and the refresh with rotation, the token
 * sealed at rest, 429 with Retry-After, 401 refreshed once, 5xx backed off
 * on reads and never repeated on a POST, JSON:API bodies, 1.1 s between
 * calls, the run's deadline, and the PDF that answers 204 until it is ready.
 */

const CFG: ParasutConfig = {
  clientId: "cid",
  clientSecret: "csecret",
  username: "site@laffogato.net",
  password: "pw",
  companyId: "123",
  baseUrl: "https://api.parasut.test",
};

let clock = 1_800_000_000_000;
const waits: number[] = [];
const sleep = vi.fn(async (ms: number) => {
  waits.push(ms);
  clock += ms;
});

function memoryTokens(): TokenStore & {
  data: Map<string, string>;
  leases: string[];
} {
  const data = new Map<string, string>();
  const leases: string[] = [];
  return {
    data,
    leases,
    async read(key) {
      return data.get(key) ?? null;
    },
    async write(key, sealed) {
      data.set(key, sealed);
    },
    async lease(key, owner) {
      leases.push(`${key}:${owner}`);
      return true;
    },
  };
}

type Call = {
  method: string;
  url: string;
  body: string;
  headers: Record<string, string>;
};
let calls: Call[];
let routes: Array<(c: Call) => Response | undefined>;

const fetchMock = vi.fn(
  async (input: string | URL | Request, init?: RequestInit) => {
    const c: Call = {
      method: String(init?.method ?? "GET"),
      url: String(input),
      body:
        typeof init?.body === "string"
          ? init.body
          : init?.body
            ? String(init.body)
            : "",
      headers: Object.fromEntries(
        Object.entries((init?.headers as Record<string, string>) ?? {}),
      ),
    };
    calls.push(c);
    for (const route of routes) {
      const res = route(c);
      if (res) return res;
    }
    throw new Error(`unrouted ${c.method} ${c.url}`);
  },
);

function tokenResponse(access: string, refresh: string, expiresIn = 7200) {
  return Response.json({
    access_token: access,
    refresh_token: refresh,
    expires_in: expiresIn,
    created_at: Math.floor(clock / 1000),
  });
}

function client(tokens = memoryTokens()) {
  return {
    tokens,
    c: new ParasutClient(CFG, {
      tokens,
      fetch: fetchMock as unknown as typeof fetch,
      sleep,
      now: () => clock,
    }),
  };
}

const oauth = (c: Call) => c.url.endsWith("/oauth/token");

beforeEach(() => {
  calls = [];
  routes = [];
  waits.length = 0;
  sleep.mockClear();
  fetchMock.mockClear();
  clock = 1_800_000_000_000;
});

describe("the token", () => {
  it("signs in with the password once, seals the token and reuses it across clients", async () => {
    routes.push((c) => (oauth(c) ? tokenResponse("A1", "R1") : undefined));
    routes.push((c) =>
      c.url.includes("/v4/123/products")
        ? Response.json({ data: [] })
        : undefined,
    );
    const { c, tokens } = client();
    await c.get("products");
    const grant = new URLSearchParams(calls[0].body);
    expect(grant.get("grant_type")).toBe("password");
    expect(grant.get("username")).toBe("site@laffogato.net");
    expect(grant.get("client_id")).toBe("cid");
    expect(calls[1].headers.Authorization).toBe("Bearer A1");
    // Sealed: the database never holds the token or the refresh token in clear.
    const sealed = tokens.data.get("parasut.token")!;
    expect(sealed).not.toContain("A1");
    expect(sealed).not.toContain("R1");
    expect(openToken(CFG, sealed)?.access).toBe("A1");
    expect(openToken({ ...CFG, password: "other" }, sealed)).toBeNull();
    // A second client (another request) reads it instead of signing in again.
    calls = [];
    const again = new ParasutClient(CFG, {
      tokens,
      fetch: fetchMock as unknown as typeof fetch,
      sleep,
      now: () => clock,
    });
    await again.get("products");
    expect(calls.filter(oauth)).toHaveLength(0);
  });

  it("refreshes an expiring token and stores the rotated refresh token at once", async () => {
    const tokens = memoryTokens();
    tokens.data.set(
      "parasut.token",
      sealToken(CFG, {
        access: "OLD",
        refresh: "R1",
        expiresAt: clock + 60_000,
        clientId: "cid",
        username: CFG.username,
      }),
    );
    routes.push((c) => (oauth(c) ? tokenResponse("A2", "R2") : undefined));
    routes.push(() => Response.json({ data: [] }));
    const { c } = client(tokens);
    await c.get("products");
    expect(new URLSearchParams(calls[0].body).get("grant_type")).toBe(
      "refresh_token",
    );
    expect(new URLSearchParams(calls[0].body).get("refresh_token")).toBe("R1");
    expect(openToken(CFG, tokens.data.get("parasut.token")!)).toMatchObject({
      access: "A2",
      refresh: "R2",
    });
    expect(tokens.leases.length).toBeGreaterThan(0);
  });

  it("falls back to the password when the refresh is refused", async () => {
    const tokens = memoryTokens();
    tokens.data.set(
      "parasut.token",
      sealToken(CFG, {
        access: "OLD",
        refresh: "SPENT",
        expiresAt: clock - 1,
        clientId: "cid",
        username: CFG.username,
      }),
    );
    routes.push((c) =>
      oauth(c) && c.body.includes("grant_type=refresh_token")
        ? Response.json({ error: "invalid_grant" }, { status: 400 })
        : undefined,
    );
    routes.push((c) => (oauth(c) ? tokenResponse("A3", "R3") : undefined));
    routes.push(() => Response.json({ data: [] }));
    const { c } = client(tokens);
    await c.get("products");
    expect(
      calls
        .filter(oauth)
        .map((x) => new URLSearchParams(x.body).get("grant_type")),
    ).toEqual(["refresh_token", "password"]);
  });

  it("refuses wrong credentials as an auth error, not a retry", async () => {
    routes.push((c) =>
      oauth(c)
        ? Response.json(
            { error: "invalid_grant", error_description: "bad" },
            { status: 401 },
          )
        : undefined,
    );
    const { c } = client();
    await expect(c.get("products")).rejects.toBeInstanceOf(ParasutAuthError);
  });

  it("refreshes once on a 401 and repeats the request", async () => {
    let tokensIssued = 0;
    routes.push((c) =>
      oauth(c)
        ? tokenResponse(`A${++tokensIssued}`, `R${tokensIssued}`)
        : undefined,
    );
    let first = true;
    routes.push(() => {
      if (first) {
        first = false;
        return new Response("{}", { status: 401 });
      }
      return Response.json({ data: [] });
    });
    const { c } = client();
    await c.get("contacts");
    const api = calls.filter((x) => !oauth(x));
    expect(api).toHaveLength(2);
    expect(api[1].headers.Authorization).toBe("Bearer A2");
  });
});

describe("requests", () => {
  beforeEach(() => {
    routes.push((c) => (oauth(c) ? tokenResponse("A", "R") : undefined));
  });

  it("sends JSON:API bodies to /v4/{company}/ with the bearer token", async () => {
    routes.push((c) =>
      c.method === "POST"
        ? Response.json(
            { data: { id: "9", type: "contacts", attributes: {} } },
            { status: 201 },
          )
        : undefined,
    );
    const { c } = client();
    const res = await c.post<{ data: { id: string } }>("contacts", {
      data: { type: "contacts", attributes: { name: "Eda" } },
    });
    expect(res?.data.id).toBe("9");
    const post = calls.find((x) => x.method === "POST" && !oauth(x))!;
    expect(post.url).toBe("https://api.parasut.test/v4/123/contacts");
    expect(post.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(post.body)).toEqual({
      data: { type: "contacts", attributes: { name: "Eda" } },
    });
  });

  it("keeps 1.1 s between calls", async () => {
    routes.push(() => Response.json({ data: [] }));
    const { c } = client();
    await c.get("products");
    await c.get("products");
    expect(waits.some((w) => w >= 1_000 && w <= 1_100)).toBe(true);
  });

  it("waits for Retry-After on a 429, at most 60 s", async () => {
    let n = 0;
    routes.push(() =>
      ++n === 1
        ? new Response("{}", { status: 429, headers: { "retry-after": "8" } })
        : Response.json({ data: [] }),
    );
    const { c } = client();
    await c.get("products");
    expect(waits).toContain(8_000);
    n = 0;
    waits.length = 0;
    routes.splice(1, 1, () =>
      ++n === 1
        ? new Response("{}", { status: 429, headers: { "retry-after": "600" } })
        : Response.json({ data: [] }),
    );
    await c.get("products");
    expect(waits).toContain(60_000);
  });

  it("backs off 2/4/8 s on a read's 5xx, then gives up with a Turkish error", async () => {
    routes.push(() => new Response("oops", { status: 503 }));
    const { c } = client();
    const err = await c.get("products").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ParasutError);
    expect((err as ParasutError).status).toBe(503);
    expect((err as Error).message).toContain("yanıt vermiyor");
    expect(waits.filter((w) => w >= 2_000)).toEqual([2_000, 4_000, 8_000]);
  });

  it("never repeats a POST after a 5xx: it may have landed (ambiguous)", async () => {
    routes.push((c) =>
      c.method === "POST" ? new Response("{}", { status: 502 }) : undefined,
    );
    const { c } = client();
    const err = (await c
      .post("sales_invoices", {})
      .catch((e: unknown) => e)) as ParasutError;
    expect(err.ambiguous).toBe(true);
    expect(calls.filter((x) => x.method === "POST" && !oauth(x))).toHaveLength(
      1,
    );
  });

  it("reads Paraşüt's own error lines on a 422, masked", async () => {
    routes.push(() =>
      Response.json(
        {
          errors: [
            {
              title: "Geçersiz",
              detail: "Ürün/hizmet doldurulmalı eda@example.com",
            },
          ],
        },
        { status: 422, headers: { "x-request-id": "req-1" } },
      ),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { c } = client();
    const err = (await c
      .post("sales_invoices", {})
      .catch((e: unknown) => e)) as ParasutError;
    expect(err.message).toContain("Ürün/hizmet doldurulmalı");
    expect(err.message).not.toContain("eda@example.com");
    expect(err.options.requestId).toBe("req-1");
    expect(warn.mock.calls.join(" ")).toContain("x-request-id=req-1");
    expect(warn.mock.calls.join(" ")).not.toContain("eda@example.com");
    warn.mockRestore();
  });

  it("starts nothing that could end after the run's deadline", async () => {
    routes.push(() => Response.json({ data: [] }));
    const { c } = client();
    c.setDeadline(clock + 5_000);
    await expect(c.get("products")).rejects.toBeInstanceOf(
      ParasutDeadlineError,
    );
    expect(calls).toHaveLength(0);
  });

  it("treats a DELETE of something already gone as done", async () => {
    routes.push((c) =>
      c.method === "DELETE" ? new Response("{}", { status: 404 }) : undefined,
    );
    const { c } = client();
    await expect(c.del("sales_invoices/9")).resolves.toBeUndefined();
  });
});

describe("the PDF", () => {
  beforeEach(() => {
    routes.push((c) => (oauth(c) ? tokenResponse("A", "R") : undefined));
  });

  it("asks again while Paraşüt answers 204, then downloads the https URL and checks it is a PDF", async () => {
    let n = 0;
    routes.push((c) =>
      c.url.endsWith("/e_archives/77/pdf")
        ? ++n < 3
          ? new Response(null, { status: 204 })
          : Response.json({
              data: {
                attributes: {
                  url: "https://files.parasut.test/x.pdf",
                  expires_at: "x",
                },
              },
            })
        : undefined,
    );
    routes.push((c) =>
      c.url === "https://files.parasut.test/x.pdf"
        ? new Response("%PDF-1.7 body")
        : undefined,
    );
    const { c } = client();
    const url = await c.pdfUrl("e_archives", "77");
    expect(url).toBe("https://files.parasut.test/x.pdf");
    expect(waits.filter((w) => w === 2_000)).toHaveLength(2);
    const pdf = await c.downloadPdf(url!);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    // The file's own request carries no Paraşüt token.
    expect(calls.at(-1)?.headers.Authorization).toBeUndefined();
  });

  it("gives up after its tries, refuses http and anything that is not a PDF", async () => {
    routes.push((c) =>
      c.url.includes("/pdf") ? new Response(null, { status: 204 }) : undefined,
    );
    routes.push((c) =>
      c.url === "https://files.parasut.test/x.html"
        ? new Response("<html>")
        : undefined,
    );
    const { c } = client();
    expect(await c.pdfUrl("e_archives", "77", 2)).toBeNull();
    await expect(
      c.downloadPdf("http://files.parasut.test/x.pdf"),
    ).rejects.toThrow(/https/);
    await expect(
      c.downloadPdf("https://files.parasut.test/x.html"),
    ).rejects.toThrow(/PDF değil/);
  });
});
