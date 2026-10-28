import { beforeEach, describe, expect, it, vi } from "vitest";

import { DbUnreachableError } from "@/lib/db/health";

/**
 * `GET /menu` is the only place the app learns that a photo changed, and it is
 * behind five minutes of CDN cache that no admin action can purge (see the
 * route's own comment). The least it can do is let a client that already holds
 * the menu say so and get a 304 back instead of the whole payload.
 */

const listMenuForMobile = vi.fn();

vi.mock("@/lib/mobile/menu", () => ({ listMenuForMobile }));

const { GET } = await import("@/app/api/mobile/v1/menu/route");

const MENU = {
  categories: [
    {
      key: "espresso",
      title: "Espresso",
      subtitle: "",
      italian: "",
      note: "",
      items: [
        {
          id: "mnu-0007",
          categoryKey: "espresso",
          name: "Cappuccino",
          description: "",
          priceMinor: 19500,
          priceLargeMinor: null,
          tags: [],
          hue: "caramel",
          image:
            "https://laffogato.net/gorsel/menu/mnu-0007?v=6f1c2a9d3b40",
        },
      ],
    },
  ],
  customization: {},
  updatedAt: "2026-09-09T00:00:00.000Z",
};

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://laffogato.net/api/mobile/v1/menu", {
    headers,
  });
}

beforeEach(() => {
  listMenuForMobile.mockReset();
  listMenuForMobile.mockResolvedValue(MENU);
});

describe("GET /api/mobile/v1/menu", () => {
  it("keeps the documented cache window and sends the whole menu", async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    // 300 s of CDN, then at most 300 s more of a stale copy while it
    // refreshes: a price or a Tükendi reaches the app's next fetch within
    // 10 minutes (docs/API-MOBILE.md "Tazelik penceresi").
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=300",
    );
    expect(res.headers.get("content-type")).toBe("application/json");
    const body = (await res.json()) as typeof MENU;
    expect(body.categories[0].items[0].image).toContain("?v=");
  });

  it("answers a client that already holds this menu with 304", async () => {
    const first = await GET(request());
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);

    const second = await GET(request({ "If-None-Match": etag! }));
    expect(second.status).toBe(304);
    expect((await second.arrayBuffer()).byteLength).toBe(0);
    expect(second.headers.get("cache-control")).toBe(
      first.headers.get("cache-control"),
    );
  });

  it("sends the menu again once a photo behind it changed", async () => {
    const before = (await GET(request())).headers.get("etag");

    const changed = structuredClone(MENU);
    changed.categories[0].items[0].image =
      "https://laffogato.net/gorsel/menu/mnu-0007?v=0a1b2c3d4e5f";
    listMenuForMobile.mockResolvedValue(changed);

    const res = await GET(request({ "If-None-Match": before! }));
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).not.toBe(before);
  });

  it("still maps an unreachable database to a retryable 503", async () => {
    listMenuForMobile.mockRejectedValue(
      new DbUnreachableError("listMenuItems", "ECONNREFUSED"),
    );
    const res = await GET(request());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("unavailable");
    expect(body.message.length).toBeGreaterThan(0);
  });
});
