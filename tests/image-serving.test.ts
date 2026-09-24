import { describe, expect, it } from "vitest";

import {
  heroImagePath,
  isDataImage,
  menuImagePath,
  productImagePath,
  servedImage,
} from "@/lib/admin/image-url";
import { decodeDataImage } from "@/lib/admin/image-bytes";
import { imageResponse } from "@/lib/admin/image-response";

const PIXEL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

describe("uploaded image delivery", () => {
  it("routes a data URL through a cacheable path", () => {
    // Inlined into the RSC payload, this string is ~400 KB on every page that
    // lists the product and cannot be cached by the browser.
    expect(isDataImage(PIXEL)).toBe(true);
    expect(servedImage(PIXEL, productImagePath("prd-0001", 0))).toBe(
      "/gorsel/urun/prd-0001/0",
    );
    expect(servedImage(PIXEL, menuImagePath("mnu-12"))).toBe(
      "/gorsel/menu/mnu-12",
    );
    expect(servedImage(PIXEL, heroImagePath("hero-1"))).toBe(
      "/gorsel/hero/hero-1",
    );
  });

  it("leaves an externally hosted image alone", () => {
    const external = "https://cdn.example.com/kahve.jpg";
    expect(isDataImage(external)).toBe(false);
    expect(servedImage(external, productImagePath("prd-0001", 0))).toBe(
      external,
    );
  });

  it("escapes an id that would otherwise break out of the path", () => {
    expect(productImagePath("a/b", 0)).toBe("/gorsel/urun/a%2Fb/0");
    expect(menuImagePath("../secret")).toBe("/gorsel/menu/..%2Fsecret");
  });

  it("decodes a data URL into servable bytes", () => {
    const decoded = decodeDataImage(PIXEL);
    expect(decoded?.contentType).toBe("image/jpeg");
    expect(decoded!.body.length).toBeGreaterThan(0);
    // JPEG magic number - proof it decoded rather than echoing the string.
    expect(decoded!.body[0]).toBe(0xff);
    expect(decoded!.body[1]).toBe(0xd8);
  });

  it("refuses anything that is not an image data URL", () => {
    expect(decodeDataImage(undefined)).toBeNull();
    expect(decodeDataImage("https://cdn.example.com/x.jpg")).toBeNull();
    // Never echo an arbitrary content type back out of stored data.
    expect(decodeDataImage("data:image/svg+xml;base64,PHN2Zy8+")).toBeNull();
    expect(
      decodeDataImage("data:text/html;base64,PGgxPmhpPC9oMT4="),
    ).toBeNull();
  });
});

describe("a cutout stored as WebP (glass round G5)", () => {
  // The panel now keeps a transparent photo's alpha as WebP instead of
  // flattening it into a JPEG; the served bytes must say what they are.
  const WEBP =
    "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

  it("decodes a WebP data URL with its own content type", () => {
    const decoded = decodeDataImage(WEBP);
    expect(decoded?.contentType).toBe("image/webp");
    // RIFF....WEBP
    expect(decoded!.body.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(decoded!.body.subarray(8, 12).toString("latin1")).toBe("WEBP");
  });

  it("serves it as image/webp from the /gorsel routes", async () => {
    const res = imageResponse(
      new Request("https://laffogato.net/gorsel/menu/mnu-0007"),
      WEBP,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(body.subarray(8, 12)).toString("latin1")).toBe("WEBP");
  });
});
