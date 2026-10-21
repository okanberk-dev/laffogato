import { createServer, type Server, type Socket } from "node:net";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * What a deployment WITHOUT DATABASE_URL answers, probe by probe, next to
 * what the same deployment answers when DATABASE_URL is set but the database
 * is unreachable (independent security review of the db-safety-and-keys
 * change, finding F1).
 *
 * CLAUDE.md "Veritabanı Kesintisinde Davranış": public pages stay up on the
 * bundled content when the connection cannot be made at all, commercial
 * paths fail loudly; docs/API-MOBILE.md §0: 503 = veritabanı ulaşılamıyor.
 * The design: never dial POSTGRES_URL AND degrade exactly like an
 * unreachable database everywhere, while /api/health says "unconfigured"
 * instead of "down" (src/lib/db/database-url.mjs, raiseDbError).
 *
 * The real data layer runs: with no DATABASE_URL nothing is dialled; the
 * "unreachable" scenario dials 127.0.0.1:1 (refused at once). Supabase's
 * bearer check is mocked (no network). The POSTGRES_URL points at a local
 * listener that counts connections, so dialling it is visible.
 */

const getUser = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({
  getSupabaseAnonClient: () => ({ auth: { getUser } }),
}));

interface Listener {
  server: Server;
  port: number;
  hits: number;
}

const wrongDb: Listener = { server: createServer(), port: 0, hits: 0 };

beforeAll(async () => {
  wrongDb.server.on("connection", (socket: Socket) => {
    wrongDb.hits += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve) =>
    wrongDb.server.listen(0, "127.0.0.1", () => resolve()),
  );
  wrongDb.port = (wrongDb.server.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise((resolve) => wrongDb.server.close(resolve));
});

type Scenario = "no-url-at-all" | "only-postgres-url" | "unreachable";

function resetDbGlobals(): void {
  const g = globalThis as { __laffogatoPool?: unknown; __laffogatoDb?: unknown };
  g.__laffogatoPool = undefined;
  g.__laffogatoDb = undefined;
}

function stubScenario(s: Scenario): void {
  vi.stubEnv("SUPABASE_DB_URL", undefined);
  vi.stubEnv("VERCEL_ENV", "production");
  if (s === "unreachable") {
    vi.stubEnv("DATABASE_URL", "postgres://ci@127.0.0.1:1/unreachable");
    vi.stubEnv("POSTGRES_URL", undefined);
  } else {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv(
      "POSTGRES_URL",
      s === "only-postgres-url"
        ? `postgres://postgres.ref:pw@127.0.0.1:${wrongDb.port}/postgres`
        : undefined,
    );
  }
}

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.c2lnbmF0dXJl";

function req(path: string, bearer = false): NextRequest {
  return new NextRequest(`https://laffogato.net${path}`, {
    headers: bearer ? { authorization: `Bearer ${TOKEN}` } : {},
  });
}

async function routeOutcome(res: Response): Promise<string> {
  let code = "";
  try {
    const body = (await res.clone().json()) as { error?: string; db?: string };
    code = body.error ?? body.db ?? "";
  } catch {
    code = "(no json)";
  }
  return `${res.status}${code ? ` ${code}` : ""}`;
}

async function readerOutcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "answers";
  } catch (err) {
    return `throws ${err instanceof Error ? err.name : typeof err}`;
  }
}

type Probe = { name: string; run: () => Promise<string> };

async function probes(): Promise<Probe[]> {
  const { LEGAL_DOCS } = await import("@/lib/legal/documents");
  const slug = LEGAL_DOCS[0].slug;
  const health = await import("@/app/api/health/route");
  const menu = await import("@/app/api/mobile/v1/menu/route");
  const shop = await import("@/app/api/mobile/v1/shop/route");
  const bootstrap = await import("@/app/api/mobile/v1/bootstrap/route");
  const story = await import("@/app/api/mobile/v1/story/route");
  const live = await import("@/app/api/mobile/v1/live-status/route");
  const legal = await import("@/app/api/mobile/v1/legal/route");
  const legalDoc = await import("@/app/api/mobile/v1/legal/[slug]/route");
  const content = await import("@/app/api/mobile/v1/app-content/route");
  const tables = await import("@/app/api/mobile/v1/tables/[code]/route");
  const karaoke = await import("@/app/api/mobile/v1/karaoke/availability/route");
  const me = await import("@/app/api/mobile/v1/me/route");
  const siteData = await import("@/lib/seo/site-data");
  const robots = await import("@/app/robots");
  const sitemap = await import("@/app/sitemap");
  const home = await import("@/app/page");

  return [
    { name: "GET /api/health", run: async () => routeOutcome(await health.GET()) },
    { name: "GET /api/mobile/v1/menu", run: async () => routeOutcome(await menu.GET(req("/api/mobile/v1/menu"))) },
    { name: "GET /api/mobile/v1/shop", run: async () => routeOutcome(await (shop.GET as (r: Request) => Promise<Response>)(req("/api/mobile/v1/shop"))) },
    { name: "GET /api/mobile/v1/bootstrap", run: async () => routeOutcome(await (bootstrap.GET as (r: Request) => Promise<Response>)(req("/api/mobile/v1/bootstrap"))) },
    { name: "GET /api/mobile/v1/story", run: async () => routeOutcome(await (story.GET as (r: Request) => Promise<Response>)(req("/api/mobile/v1/story"))) },
    { name: "GET /api/mobile/v1/live-status", run: async () => routeOutcome(await live.GET()) },
    { name: "GET /api/mobile/v1/legal", run: async () => routeOutcome(await (legal.GET as (r: Request) => Promise<Response>)(req("/api/mobile/v1/legal"))) },
    {
      name: "GET /api/mobile/v1/legal/{slug}",
      run: async () =>
        routeOutcome(
          await legalDoc.GET(req(`/api/mobile/v1/legal/${slug}`), {
            params: Promise.resolve({ slug }),
          }),
        ),
    },
    { name: "GET /api/mobile/v1/app-content", run: async () => routeOutcome(await content.GET()) },
    {
      name: "GET /api/mobile/v1/tables/{code}",
      run: async () =>
        routeOutcome(
          await tables.GET(req("/api/mobile/v1/tables/ABCDEFGHJK"), {
            params: Promise.resolve({ code: "ABCDEFGHJK" }),
          }),
        ),
    },
    {
      name: "GET /api/mobile/v1/karaoke/availability",
      run: async () =>
        routeOutcome(await karaoke.GET(req("/api/mobile/v1/karaoke/availability?date=2026-10-23"))),
    },
    { name: "GET /api/mobile/v1/me (bearer)", run: async () => routeOutcome(await me.GET(req("/api/mobile/v1/me", true))) },
    { name: "getSiteSettings (every public page)", run: () => readerOutcome(() => siteData.getSiteSettings()) },
    { name: "listSiteShopProducts (/, /magaza)", run: () => readerOutcome(() => siteData.listSiteShopProducts()) },
    { name: "listSiteMenu (/, /menu)", run: () => readerOutcome(() => siteData.listSiteMenu()) },
    { name: "robots.txt", run: () => readerOutcome(() => robots.default()) },
    { name: "sitemap.xml", run: () => readerOutcome(() => sitemap.default()) },
    { name: "/ generateMetadata", run: () => readerOutcome(() => home.generateMetadata()) },
  ];
}

async function runScenario(s: Scenario): Promise<Record<string, string>> {
  vi.resetModules();
  resetDbGlobals();
  stubScenario(s);
  const out: Record<string, string> = {};
  for (const p of await probes()) out[p.name] = await p.run();
  // Close the pool the scenario opened, so the next one starts clean.
  const g = globalThis as { __laffogatoPool?: { end?: () => Promise<void> } };
  await g.__laffogatoPool?.end?.().catch(() => {});
  resetDbGlobals();
  return out;
}

describe("a deployment without DATABASE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("never dials POSTGRES_URL, and degrades exactly like an unreachable database", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "eda@example.com", email_confirmed_at: "2026-10-01T00:00:00Z" } },
      error: null,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = wrongDb.hits;

    const unreachable = await runScenario("unreachable");
    const noUrl = await runScenario("no-url-at-all");
    const onlyPostgres = await runScenario("only-postgres-url");

    // The goal: nothing dials the Supabase integration's database.
    expect(wrongDb.hits - before).toBe(0);
    // Health names the configuration problem instead of calling it "down".
    expect(noUrl["GET /api/health"]).toBe("503 unconfigured");
    expect(onlyPostgres["GET /api/health"]).toBe("503 unconfigured");
    // Everything else answers as it does over an outage: bundled content on
    // public reads, 503 unavailable on the app's API.
    const parity = (row: Record<string, string>) =>
      Object.fromEntries(Object.entries(row).filter(([k]) => k !== "GET /api/health"));
    expect(parity(noUrl)).toEqual(parity(unreachable));
    expect(parity(onlyPostgres)).toEqual(parity(unreachable));
    // And the outage answers are the documented ones, not 500s.
    expect(noUrl["GET /api/mobile/v1/menu"]).toBe("503 unavailable");
    expect(noUrl["getSiteSettings (every public page)"]).toBe("answers");
  }, 60_000);
});
