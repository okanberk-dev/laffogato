import { describe, expect, it } from "vitest";

import {
  IMAGE_CACHE_CONTROL,
  IMMUTABLE_IMAGE_CACHE_CONTROL,
  imageDigest,
  imageVersion,
} from "@/lib/admin/image-bytes";
import { imageResponse } from "@/lib/admin/image-response";
import {
  heroImagePath,
  menuImagePath,
  productImagePath,
  servedImage,
} from "@/lib/admin/image-url";
import { toMobileMenuItem } from "@/lib/mobile/menu-mapper";
import type { AdminMenuItem } from "@/lib/admin/store";

/**
 * The bug: `/gorsel/menu/<id>` never changed, so a replaced photo reached
 * nobody. The CDN held the old bytes for `s-maxage=86400` and the app's disk
 * cache - keyed by URL - held them until reinstall. Uploading did nothing.
 *
 * The fix is a stamp taken from the photo itself. These tests are the proof
 * that it is taken from the CONTENT: same photo, same URL (nothing
 * re-downloads); different photo, different URL (everything misses at once).
 */

/** 1×1 JPEG. */
const RED =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
/** A different 1×1 JPEG - one byte of payload apart, which is the point. */
const BLUE = RED.replace("AAAACf", "AAAACg");

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://laffogato.net${url}`, { headers });
}

describe("the served image URL carries a content stamp", () => {
  it("gives the same photo the same URL every time", () => {
    const first = menuImagePath("mnu-0007", imageVersion(RED));
    const second = menuImagePath("mnu-0007", imageVersion(RED));
    expect(first).toBe(second);
    expect(first).toMatch(/^\/gorsel\/menu\/mnu-0007\?v=[0-9a-f]{12}$/);
  });

  it("gives a replaced photo a URL no cache has seen", () => {
    expect(RED).not.toBe(BLUE);
    expect(menuImagePath("mnu-0007", imageVersion(RED))).not.toBe(
      menuImagePath("mnu-0007", imageVersion(BLUE)),
    );
  });

  it("stamps from the content, not from the id or the slot", () => {
    // The same photo on two items differs only in the path.
    expect(imageVersion(RED)).toBe(imageVersion(RED));
    expect(productImagePath("prd-0001", 0, imageVersion(RED))).toBe(
      `/gorsel/urun/prd-0001/0?v=${imageVersion(RED)}`,
    );
    expect(heroImagePath("hero-1", imageVersion(BLUE))).toBe(
      `/gorsel/hero/hero-1?v=${imageVersion(BLUE)}`,
    );
  });

  it("leaves an unstamped path and an external URL exactly as they were", () => {
    expect(menuImagePath("mnu-0007")).toBe("/gorsel/menu/mnu-0007");
    // Nothing of ours to stamp: the other host decides its own caching.
    expect(imageVersion("https://cdn.example.com/kahve.jpg")).toBe("");
    expect(imageVersion("")).toBe("");
    expect(
      servedImage(
        "https://cdn.example.com/kahve.jpg",
        menuImagePath("mnu-0007", imageVersion("https://cdn.example.com/x")),
      ),
    ).toBe("https://cdn.example.com/kahve.jpg");
  });

  it("reaches the mobile menu item as an absolute stamped URL", () => {
    const item = {
      id: "mnu-0007",
      categoryKey: "espresso",
      name: "Cappuccino",
      desc: "…",
      priceMinor: 19500,
      priceMinorL: 0,
      hue: "caramel",
      image: RED,
      tags: [],
      isActive: true,
      sortOrder: 1,
      updatedAt: "2026-09-09T00:00:00.000Z",
    } as AdminMenuItem;

    const before = toMobileMenuItem(item, "https://laffogato.net");
    expect(before.image).toBe(
      `https://laffogato.net/gorsel/menu/mnu-0007?v=${imageVersion(RED)}`,
    );

    // The operator uploads a new photo; nothing else about the row changes.
    const after = toMobileMenuItem(
      { ...item, image: BLUE },
      "https://laffogato.net",
    );
    expect(after.image).not.toBe(before.image);
  });
});

describe("the image route answers the stamp", () => {
  it("is immutable only when the stamp matches the bytes it is serving", () => {
    const stamped = imageResponse(
      request(`/gorsel/menu/mnu-0007?v=${imageVersion(RED)}`),
      RED,
    );
    expect(stamped.status).toBe(200);
    expect(stamped.headers.get("cache-control")).toBe(
      IMMUTABLE_IMAGE_CACHE_CONTROL,
    );
    expect(IMMUTABLE_IMAGE_CACHE_CONTROL).toContain("immutable");
  });

  it("falls back to a short cache for an unstamped or wrong stamp", () => {
    expect(
      imageResponse(request("/gorsel/menu/mnu-0007"), RED).headers.get(
        "cache-control",
      ),
    ).toBe(IMAGE_CACHE_CONTROL);
    // A stamp left over from the previous photo must NOT earn a year.
    expect(
      imageResponse(
        request(`/gorsel/menu/mnu-0007?v=${imageVersion(BLUE)}`),
        RED,
      ).headers.get("cache-control"),
    ).toBe(IMAGE_CACHE_CONTROL);
    // A prefix of the real stamp is not a stamp we ever hand out.
    expect(
      imageResponse(
        request(`/gorsel/menu/mnu-0007?v=${imageVersion(RED).slice(0, 4)}`),
        RED,
      ).headers.get("cache-control"),
    ).toBe(IMAGE_CACHE_CONTROL);
    expect(IMAGE_CACHE_CONTROL).not.toContain("86400");
  });

  it("answers a matching If-None-Match with 304 and no body", async () => {
    const first = imageResponse(request("/gorsel/menu/mnu-0007"), RED);
    const etag = first.headers.get("etag");
    expect(etag).toBe(`"${imageDigest(RED)}"`);
    expect((await first.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const second = imageResponse(
      request("/gorsel/menu/mnu-0007", { "If-None-Match": etag! }),
      RED,
    );
    expect(second.status).toBe(304);
    expect(second.headers.get("etag")).toBe(etag);
    expect((await second.arrayBuffer()).byteLength).toBe(0);

    // A weak tag and a list both compare weakly (RFC 9110 §13.1.2).
    expect(
      imageResponse(
        request("/gorsel/menu/mnu-0007", {
          "If-None-Match": `W/${etag}, "other"`,
        }),
        RED,
      ).status,
    ).toBe(304);
  });

  it("sends the bytes when the caller holds a different photo", async () => {
    const stale = `"${imageDigest(BLUE)}"`;
    const res = imageResponse(
      request("/gorsel/menu/mnu-0007", { "If-None-Match": stale }),
      RED,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("404s when there is nothing of ours behind the URL", () => {
    expect(imageResponse(request("/gorsel/menu/nope"), undefined).status).toBe(
      404,
    );
    expect(
      imageResponse(request("/gorsel/menu/x"), "https://cdn.example.com/a.jpg")
        .status,
    ).toBe(404);
  });
});
