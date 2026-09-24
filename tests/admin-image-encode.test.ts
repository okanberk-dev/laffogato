import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  dataUrlFormat,
  DOWNSCALE_STEP,
  encodeForUpload,
  fitWithin,
  hasTransparentPixel,
  JPEG_QUALITY,
  MAX_DIMENSION,
  MAX_STORED_IMAGE_LENGTH,
  MIN_DIMENSION,
  UploadError,
  WEBP_QUALITY,
  type EncodeSource,
} from "@/lib/admin/image-encode";

/**
 * The panel's uploader (glass round G5): a cutout keeps its transparency, a
 * browser that cannot encode WebP still stores one under the server's cap,
 * and a photo that cannot fit is refused with a Turkish message instead of
 * being dropped by the server without a word.
 *
 * The canvas is a fake: each drawing answers `toDataURL` with a payload whose
 * length grows with the pixel count, and records what it was asked.
 */

interface Call {
  width: number;
  height: number;
  type: string;
  quality?: number;
}

function fakeSource(opts: {
  width: number;
  height: number;
  transparent: boolean;
  /** Characters of base64 per pixel the encoder produces. */
  perPixel: number;
  /** What the browser answers for an image/webp request. */
  webp: "webp" | "png";
}): { source: EncodeSource; calls: Call[] } {
  const calls: Call[] = [];
  const source: EncodeSource = {
    width: opts.width,
    height: opts.height,
    draw(width, height) {
      return {
        hasTransparency: () => opts.transparent,
        toDataURL(type, quality) {
          calls.push({ width, height, type, quality });
          const answered =
            type === "image/webp" && opts.webp === "png" ? "image/png" : type;
          const body = "A".repeat(Math.ceil(width * height * opts.perPixel));
          return `data:${answered};base64,${body}`;
        },
      };
    },
  };
  return { source, calls };
}

describe("encodeForUpload", () => {
  it("stores an opaque photo as JPEG 0.82, at most 1600 px on the long side", () => {
    const { source, calls } = fakeSource({
      width: 4000,
      height: 3000,
      transparent: false,
      perPixel: 0.2,
      webp: "webp",
    });
    const out = encodeForUpload(source, "latte.jpg");
    expect(out.format).toBe("jpeg");
    expect(out.transparent).toBe(false);
    expect([out.width, out.height]).toEqual([MAX_DIMENSION, 1200]);
    expect(calls).toEqual([
      { width: 1600, height: 1200, type: "image/jpeg", quality: JPEG_QUALITY },
    ]);
  });

  it("keeps a cutout's transparency as WebP 0.9 where the canvas encodes WebP", () => {
    const { source, calls } = fakeSource({
      width: 1200,
      height: 1600,
      transparent: true,
      perPixel: 0.3,
      webp: "webp",
    });
    const out = encodeForUpload(source, "cilek.png");
    expect(out.format).toBe("webp");
    expect(out.transparent).toBe(true);
    expect(out.dataUrl.startsWith("data:image/webp;base64,")).toBe(true);
    expect(calls).toEqual([
      { width: 1200, height: 1600, type: "image/webp", quality: WEBP_QUALITY },
    ]);
  });

  it("stores the PNG a WebP-less canvas answers, downscaled until it is under 2 MB", () => {
    // Safari's canvas answers image/webp with a PNG. 1.6 characters a pixel
    // is a heavy PNG: 1600 × 1600 would be ~4 MB of base64.
    const { source, calls } = fakeSource({
      width: 1600,
      height: 1600,
      transparent: true,
      perPixel: 1.6,
      webp: "png",
    });
    const out = encodeForUpload(source, "cilek.png");
    expect(out.format).toBe("png");
    expect(out.transparent).toBe(true);
    expect(out.dataUrl.length).toBeLessThanOrEqual(MAX_STORED_IMAGE_LENGTH);
    expect(out.width).toBeLessThan(1600);
    expect(out.width).toBeGreaterThanOrEqual(MIN_DIMENSION);
    // Every attempt asked for WebP first, never for a JPEG (no alpha there),
    // and each step drew the source smaller than the one before.
    expect(calls.every((c) => c.type === "image/webp")).toBe(true);
    for (let i = 1; i < calls.length; i += 1) {
      expect(calls[i].width).toBe(
        Math.floor(calls[i - 1].width * DOWNSCALE_STEP),
      );
    }
    expect(calls.length).toBeGreaterThan(1);
  });

  it("refuses with a Turkish message when even the smallest step does not fit", () => {
    const { source } = fakeSource({
      width: 1600,
      height: 1600,
      transparent: true,
      perPixel: 12,
      webp: "png",
    });
    let caught: unknown;
    try {
      encodeForUpload(source, "dev.png");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UploadError);
    const message = (caught as Error).message;
    expect(message).toContain("dev.png");
    expect(message).toContain("2 MB");
    // The WebP-less browser is named as the cause, with a way out.
    expect(message).toContain("WebP");
    expect(message).toContain("Chrome ya da Firefox");
  });

  it("downscales an oversize JPEG too, and says so plainly when it cannot fit", () => {
    const heavy = fakeSource({
      width: 1600,
      height: 1200,
      transparent: false,
      perPixel: 1.5,
      webp: "webp",
    });
    const out = encodeForUpload(heavy.source, "doku.jpg");
    expect(out.format).toBe("jpeg");
    expect(out.dataUrl.length).toBeLessThanOrEqual(MAX_STORED_IMAGE_LENGTH);

    const hopeless = fakeSource({
      width: 1600,
      height: 1200,
      transparent: false,
      perPixel: 20,
      webp: "webp",
    });
    expect(() => encodeForUpload(hopeless.source, "doku.jpg")).toThrow(
      /doku\.jpg küçültülse de 2 MB sınırına sığmadı\. Daha küçük bir dosya dene\./,
    );
  });

  it("refuses an empty canvas answer instead of storing it", () => {
    const source: EncodeSource = {
      width: 20000,
      height: 20000,
      draw: () => ({
        hasTransparency: () => false,
        toDataURL: () => "data:,",
      }),
    };
    expect(() => encodeForUpload(source, "dev.jpg")).toThrow(UploadError);
  });
});

describe("helpers", () => {
  it("finds any pixel below full opacity", () => {
    expect(hasTransparentPixel([255, 0, 0, 255, 0, 255, 0, 255])).toBe(false);
    expect(hasTransparentPixel([255, 0, 0, 255, 0, 255, 0, 254])).toBe(true);
    expect(hasTransparentPixel(new Uint8ClampedArray([1, 2, 3, 0]))).toBe(true);
    expect(hasTransparentPixel([])).toBe(false);
  });

  it("fits the long side without upscaling", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(1, 5000, 1600)).toEqual({ width: 1, height: 1600 });
  });

  it("reads the format from the prefix the browser actually answered", () => {
    expect(dataUrlFormat("data:image/webp;base64,AA")).toBe("webp");
    expect(dataUrlFormat("data:image/png;base64,AA")).toBe("png");
    expect(dataUrlFormat("data:image/jpeg;base64,AA")).toBe("jpeg");
    expect(dataUrlFormat("data:,")).toBeNull();
  });
});

describe("one cap, three places", () => {
  it("the product schema and the menu action read the uploader's constant", () => {
    const schema = readFileSync("src/lib/admin/product-schema.ts", "utf8");
    expect(schema).toContain("MAX_IMAGE_BYTES = MAX_STORED_IMAGE_LENGTH");
    const menu = readFileSync("src/app/admin/menu/actions.ts", "utf8");
    expect(menu).toContain("MAX_MENU_IMAGE_BYTES = MAX_STORED_IMAGE_LENGTH");
  });

  it("the uploader encodes through encodeForUpload and no longer flattens onto white", () => {
    const uploader = readFileSync(
      "src/components/admin/image-upload.tsx",
      "utf8",
    );
    expect(uploader).toContain("encodeForUpload(");
    expect(uploader).not.toContain('fillStyle = "#ffffff"');
    expect(uploader).not.toContain("destination-over");
  });
});
