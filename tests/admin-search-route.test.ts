import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { piiLike } from "@/lib/admin/pii-like";
import {
  searchSectionsFor,
  type SearchGroup,
  type SearchSection,
} from "@/lib/admin/search-core";
import { DbQueryError, DbUnreachableError } from "@/lib/db/health";

/**
 * `POST /admin/ara/sonuc` (admin UI v2, design §4.3): the palette's record
 * search. A route handler is not behind requireRole, so every gate is
 * checked here, in order: same origin, a session, a role with something to
 * search, a small JSON body. What is typed is an e-mail or a phone as often
 * as not: it never reaches an address, a cache or the log, and a text that
 * looks like a person gets no list link.
 *
 * The session and searchAdmin are stubs (the SQL is tests/admin-search.test.ts
 * and tests/db-integration-admin-search.test.ts); the role gate is the real
 * searchSectionsFor.
 */

const session = vi.hoisted(() => ({
  value: null as null | { email: string; role: string; expiresAt: number },
  throws: null as unknown,
}));
const getAdminSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession,
  isAdminSessionUnavailable: (err: unknown) =>
    (err as { code?: string } | null)?.code === "ADMIN_SESSION_UNAVAILABLE",
}));
const searchAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/search", async () => ({
  ...(await vi.importActual<typeof import("@/lib/admin/search-core")>(
    "@/lib/admin/search-core",
  )),
  searchAdmin,
}));

const route = await import("@/app/admin/ara/sonuc/route");
const { POST } = route;

const URL_ = "https://laffogato.net/admin/ara/sonuc";
const OWN = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  origin: "https://laffogato.net",
  host: "laffogato.net",
};

/** A request as the palette sends it; a header set to null is left out. */
function request(
  body: BodyInit | null,
  headers: Record<string, string | null> = {},
): Request {
  const merged = Object.entries({ ...OWN, ...headers }).filter(
    (e): e is [string, string] => e[1] !== null,
  );
  return new Request(URL_, {
    method: "POST",
    headers: merged,
    body,
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  } as RequestInit);
}

const ask = (q: unknown, headers: Record<string, string | null> = {}) =>
  POST(request(JSON.stringify({ q }), headers));

const LIST: Record<SearchSection, string> = {
  orders: "/admin/siparisler",
  customers: "/admin/musteriler",
  karaoke: "/admin/mobil/karaoke",
  products: "/admin/urunler",
  menu: "/admin/menu",
};

function group(section: SearchSection): SearchGroup {
  return {
    section,
    label: section,
    hits: [{ href: `/admin/kayit/${section}`, title: "Bulunan", meta: [] }],
    more: true,
    listHref: LIST[section],
  };
}

const signIn = (role: string) => {
  session.value = { email: `${role}@laffogato.net`, role, expiresAt: 0 };
};

let spies: { mock: { calls: unknown[][] }; mockRestore(): void }[] = [];
/** Everything any console method was handed, as one text. */
const logged = () =>
  spies
    .flatMap((s) => s.mock.calls)
    .map((args) => args.map((a: unknown) => String(a)).join(" "))
    .join("\n");

beforeEach(() => {
  session.value = null;
  session.throws = null;
  getAdminSession.mockReset();
  getAdminSession.mockImplementation(async () => {
    if (session.throws) throw session.throws;
    return session.value;
  });
  searchAdmin.mockReset();
  // Like the real one: the sections this role may open, each with a hit.
  searchAdmin.mockImplementation(async (_q: unknown, role) =>
    searchSectionsFor(role).map(group),
  );
  spies = (["log", "info", "warn", "error", "debug", "trace"] as const).map(
    (m) => vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  for (const s of spies) s.mockRestore();
});

describe("the gates, in order", () => {
  it("answers POST only: Next gives every other method a 405", () => {
    const methods = Object.keys(route).filter((k) => /^[A-Z]+$/.test(k));
    expect(methods).toEqual(["POST"]);
  });

  it("refuses another origin before it reads the session", async () => {
    signIn("owner");
    const refusals: Record<string, string | null>[] = [
      { "sec-fetch-site": "cross-site" },
      // Another subdomain is same-site, not same-origin.
      { "sec-fetch-site": "same-site" },
      { "sec-fetch-site": "none" },
      // Sec-Fetch-Site says no even when the Origin looks right.
      { "sec-fetch-site": "cross-site", origin: "https://laffogato.net" },
      // An older browser: no Sec-Fetch-Site, so the Origin decides.
      { "sec-fetch-site": null, origin: "https://evil.example" },
      { "sec-fetch-site": null, origin: "https://laffogato.net.evil.example" },
      { "sec-fetch-site": null, origin: "http://laffogato.net:8080" },
      { "sec-fetch-site": null, origin: "null" },
      { "sec-fetch-site": null, origin: null },
    ];
    for (const headers of refusals) {
      const res = await ask("latte", headers);
      expect(res.status, JSON.stringify(headers)).toBe(403);
      expect(await res.json()).toEqual({ error: "forbidden" });
    }
    expect(getAdminSession).not.toHaveBeenCalled();
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it("lets the panel's own page in: Sec-Fetch-Site, or a matching Origin", async () => {
    signIn("owner");
    expect((await ask("latte", { origin: null })).status).toBe(200);
    expect(
      (await ask("latte", { "sec-fetch-site": null, host: "LAFFOGATO.net" }))
        .status,
    ).toBe(200);
    expect(
      (
        await ask("latte", {
          "sec-fetch-site": null,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        })
      ).status,
    ).toBe(200);
  });

  it("401 without a session, and nothing is searched", async () => {
    const res = await ask("latte");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it("503 when the account cannot be read: that is not a sign-out", async () => {
    session.throws = Object.assign(new Error("db"), {
      code: "ADMIN_SESSION_UNAVAILABLE",
    });
    let res = await ask("latte");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    session.throws = new DbUnreachableError("auth", "ECONNREFUSED");
    res = await ask("latte");
    expect(res.status).toBe(503);
  });

  it("a session error of another kind is not hidden", async () => {
    session.throws = new TypeError("bug");
    await expect(ask("latte")).rejects.toThrow("bug");
  });

  it("403 for the cashier, whose role has nothing to search; the body is never read", async () => {
    signIn("cashier");
    const req = request(JSON.stringify({ q: "eda@example.com" }));
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(req.bodyUsed).toBe(false);
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it("the body is read only once the session and the role stand", async () => {
    const req = request(JSON.stringify({ q: "eda@example.com" }));
    expect((await POST(req)).status).toBe(401);
    expect(req.bodyUsed).toBe(false);
  });
});

describe("the body: JSON, at most a kilobyte, exactly { q: string }", () => {
  beforeEach(() => signIn("owner"));

  const bad = async (req: Request) => {
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  };

  it("refuses a body that is not JSON", async () => {
    const json = JSON.stringify({ q: "latte" });
    await bad(request(json, { "content-type": "text/plain" }));
    await bad(
      request("q=latte", {
        "content-type": "application/x-www-form-urlencoded",
      }),
    );
    await bad(request(json, { "content-type": null }));
    await bad(request("{q: latte}"));
    await bad(request(""));
    await bad(request(null));
    await bad(request(new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x7d])));
    // A charset parameter is fine.
    expect(
      (
        await POST(
          request(json, { "content-type": "application/json; charset=utf-8" }),
        )
      ).status,
    ).toBe(200);
  });

  it("refuses any other shape: no role, no page, no second field", async () => {
    for (const body of [
      { q: 42 },
      { q: null },
      { q: ["latte"] },
      {},
      { query: "latte" },
      { q: "latte", role: "owner" },
      ["latte"],
      "latte",
      null,
    ]) {
      await bad(request(JSON.stringify(body)));
    }
    await bad(request(JSON.stringify({ q: "lat\u0000te" })));
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it("takes a kilobyte, not a byte more, with or without Content-Length", async () => {
    const sized = (bytes: number) => {
      const shell = JSON.stringify({ q: "" }).length;
      return JSON.stringify({ q: "a".repeat(bytes - shell) });
    };
    expect(sized(1024)).toHaveLength(1024);
    expect((await POST(request(sized(1024)))).status).toBe(200);
    await bad(request(sized(1025)));
    // Declared too long: refused without reading.
    const declared = request(sized(1024), { "content-length": "5000" });
    await bad(declared);
    // Streamed with no length: cut off at the limit.
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        const chunk = new TextEncoder().encode('{"q":"' + "a".repeat(600));
        c.enqueue(chunk);
        c.enqueue(chunk);
        c.enqueue(new TextEncoder().encode('"}'));
        c.close();
      },
    });
    await bad(request(stream));
    // Multi-byte letters count as bytes: 600 "ş" are 1200 bytes.
    await bad(request(JSON.stringify({ q: "ş".repeat(600) })));
  });
});

describe("the answer", () => {
  it("under two characters: no query at all", async () => {
    signIn("owner");
    for (const q of ["", "a", "  b  "]) {
      const res = await ask(q);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ groups: [] });
    }
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it("staff get their own sections, never the members, whatever the body says", async () => {
    signIn("staff");
    const res = await ask("Eda");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { groups: SearchGroup[] };
    const sections = body.groups.map((g) => g.section);
    expect(sections).toEqual(["orders", "karaoke"]);
    expect(sections).not.toContain("customers");
    const [parsed, role] = searchAdmin.mock.calls[0];
    expect(role).toBe("staff");
    expect(parsed).toMatchObject({ text: "Eda", pattern: "%Eda%" });
  });

  it("owners get every section, in the search's own order and shape", async () => {
    signIn("owner");
    const body = (await (await ask("latte")).json()) as {
      groups: SearchGroup[];
    };
    expect(Object.keys(body)).toEqual(["groups"]);
    expect(body.groups).toEqual(
      ["orders", "customers", "karaoke", "products", "menu"].map((s) =>
        group(s as SearchSection),
      ),
    );
  });

  it("drops the list link when the text looks like an e-mail or a phone", async () => {
    signIn("owner");
    for (const q of ["a@b.co", "0532 123 45 67"]) {
      const body = (await (await ask(q)).json()) as {
        groups: { listHref: string | null }[];
      };
      expect(body.groups.length, q).toBeGreaterThan(0);
      expect(
        body.groups.map((g) => g.listHref),
        q,
      ).toEqual(body.groups.map(() => null));
    }
    const kept = (await (await ask("latte")).json()) as {
      groups: { section: SearchSection; listHref: string | null }[];
    };
    expect(kept.groups.map((g) => g.listHref)).toEqual(
      kept.groups.map((g) => LIST[g.section]),
    );
  });

  it("the answer never echoes what was typed", async () => {
    signIn("owner");
    const text = await (await ask("eda.yilmaz@example.com")).text();
    expect(text).not.toContain("eda.yilmaz");
  });

  it("is never cached, whatever it says", async () => {
    const cases: [() => void, () => Promise<Response>][] = [
      [
        () => signIn("owner"),
        () => ask("latte", { "sec-fetch-site": "cross-site" }),
      ],
      [
        () => {
          session.value = null;
        },
        () => ask("latte"),
      ],
      [
        () => {
          session.throws = Object.assign(new Error("db"), {
            code: "ADMIN_SESSION_UNAVAILABLE",
          });
        },
        () => ask("latte"),
      ],
      [() => signIn("cashier"), () => ask("latte")],
      [() => signIn("owner"), () => POST(request("nope"))],
      [() => signIn("owner"), () => ask("a")],
      [() => signIn("manager"), () => ask("latte")],
      [
        () => {
          signIn("owner");
          searchAdmin.mockRejectedValueOnce(
            new DbUnreachableError("search.orders", "ECONNREFUSED"),
          );
        },
        () => ask("latte"),
      ],
      [
        () => {
          signIn("owner");
          searchAdmin.mockRejectedValueOnce(new Error("boom"));
        },
        () => ask("latte"),
      ],
    ];
    const statuses: number[] = [];
    for (const [arrange, act] of cases) {
      session.throws = null;
      arrange();
      const res = await act();
      statuses.push(res.status);
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(res.headers.get("cache-control")).toContain("private");
    }
    expect(statuses).toEqual([403, 401, 503, 403, 400, 200, 200, 503, 500]);
  });

  it("a database that does not answer is 503, not an empty result", async () => {
    signIn("owner");
    searchAdmin.mockRejectedValue(
      new DbUnreachableError("search.orders", "connect ECONNREFUSED"),
    );
    const res = await ask("latte");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("a query the database refused is a 500 with a code in the log, not 'unavailable'", async () => {
    signIn("owner");
    searchAdmin.mockRejectedValue(
      new DbQueryError(
        "search.orders",
        "relation does not exist",
        "42P01",
        400,
      ),
    );
    const res = await ask("latte");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "failed" });
    expect(logged()).toContain("DbQueryError 42P01");
    expect(logged()).not.toContain("relation does not exist");
  });
});

describe("nothing typed reaches the log", () => {
  const EMAIL = "eda.yilmaz@example.com";
  const PHONE = "0532 123 45 67";

  it("on every path: found, refused, unreachable, failed, malformed", async () => {
    // The failure's own message quotes the text, as a driver's might.
    const quoting = (q: string) =>
      Object.assign(new Error(`invalid input "${q}"`), { code: "22P02" });
    for (const q of [EMAIL, PHONE]) {
      signIn("owner");
      await ask(q);
      searchAdmin.mockRejectedValueOnce(
        new DbUnreachableError("search.orders", `ECONNREFUSED ${q}`),
      );
      await ask(q);
      searchAdmin.mockRejectedValueOnce(quoting(q));
      await ask(q);
      await POST(request(`{"q": "${q}"`));
      await POST(request(JSON.stringify({ q, role: "owner" })));
      await POST(request(JSON.stringify({ q: q.repeat(60) })));
      signIn("staff");
      await ask(q);
      signIn("cashier");
      await ask(q);
      session.value = null;
      await ask(q);
      session.throws = Object.assign(new Error(`lookup ${q}`), {
        code: "ADMIN_SESSION_UNAVAILABLE",
      });
      await ask(q);
      session.throws = null;
    }
    const log = logged();
    // The failures were logged (by class and code)...
    expect(log).toContain("[admin/ara/sonuc]");
    expect(log).toContain("22P02");
    // ...and nothing of what was typed.
    for (const leak of ["eda.yilmaz", "example.com", "0532", "123 45 67"]) {
      expect(log, leak).not.toContain(leak);
    }
  });
});

describe("piiLike: does the text look like it names a person?", () => {
  it("an e-mail: anything with an @", () => {
    for (const s of ["a@b.co", "eda@example.com", "@", "eda@", " x@y "]) {
      expect(piiLike(s), s).toBe(true);
    }
    // Full-width, as a phone keyboard may paste it.
    expect(piiLike("eda＠example.com")).toBe(true);
  });

  it("a phone: seven digits or more once spaces, dots, dashes, brackets and + go", () => {
    for (const s of [
      "0532 123 45 67",
      "+90 (532) 123-45-67",
      "532.123.45.67",
      "5321234567",
      "1234567",
      "12 34 56 7",
      "0532 123 45 67",
      "0532‑123‑45‑67",
      "０５３２１２３",
      "Eda 05321234567",
      // A date in digits counts too: the rule is loose on purpose.
      "2026-10-19",
    ]) {
      expect(piiLike(s), s).toBe(true);
    }
  });

  it("an order number, a booking code, a product: no", () => {
    for (const s of [
      "",
      "latte",
      "Fındık 250 g",
      "10234",
      "#10234",
      "123456",
      "KRK-00042",
      "krk42",
      "SKU-1234",
      "İsmail",
    ]) {
      expect(piiLike(s), s).toBe(false);
    }
  });

  it("is a pure, client-safe module", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/admin/pii-like.ts", "utf8");
    expect(source).not.toMatch(/^import /m);
    expect(source).not.toMatch(/["']server-only["']/);
  });
});
