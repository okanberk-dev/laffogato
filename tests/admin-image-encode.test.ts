import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ImageUpload } from "@/components/admin/image-upload";
import {
  dataUrlFormat,
  DOWNSCALE_STEP,
  encodeForUpload,
  fitUploadTotal,
  fitWithin,
  formatUploadMB,
  hasTransparentPixel,
  JPEG_QUALITY,
  MAX_DIMENSION,
  MAX_STORED_IMAGE_LENGTH,
  MAX_UPLOAD_TOTAL_LENGTH,
  MIN_DIMENSION,
  UploadError,
  uploadFieldLength,
  uploadTotalMessage,
  uploadTotalNotice,
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

/**
 * The one-save total (review M-1, 25 Sep 2026). The form posts every photo of
 * the item on every save; a Vercel Function refuses a body over 4.5 MB with
 * 413 before the action runs, and the panel's error page then wipes the
 * unsaved form. The uploader refuses the photo that would get there instead.
 */
describe("the one-save photo total", () => {
  const LONG_DASH = /[\u2013\u2014]/;
  const png = (chars: number) => `data:image/png;base64,${"A".repeat(chars)}`;
  const jpeg = (chars: number) => `data:image/jpeg;base64,${"A".repeat(chars)}`;

  it("stays under the platform's 4.5 MB request ceiling, with room for the form", () => {
    // 4.5 MB read the strict way (10^6 bytes). The product form's other
    // fields are a few kilobytes; a quarter of a megabyte is left for them.
    expect(MAX_UPLOAD_TOTAL_LENGTH + 256 * 1024).toBeLessThanOrEqual(4_500_000);
    // Still room for more than one photo at the per-photo cap's scale.
    expect(MAX_UPLOAD_TOTAL_LENGTH).toBeGreaterThan(
      1.9 * MAX_STORED_IMAGE_LENGTH,
    );
  });

  it("measures the field the way the form posts it: the JSON array", () => {
    expect(uploadFieldLength([])).toBe(2);
    expect(uploadFieldLength(["ab"])).toBe('["ab"]'.length);
    expect(uploadFieldLength(["ab", "c"])).toBe('["ab","c"]'.length);
  });

  it("takes photos in order, leaves out one that does not fit, and lets a later smaller one in", () => {
    // ["aaaa"] is 8; ,"bbbbbbbbbb" would add 13 (21 > 20); ,"cc" and ,"dd"
    // add 5 each.
    const fit = fitUploadTotal(["aaaa"], ["bbbbbbbbbb", "cc", "dd"], 20);
    expect(fit.accepted).toEqual(["cc", "dd"]);
    expect(fit.refused).toEqual([0]);
    expect(fit.length).toBe(18);
    expect(fit.refusedLength).toBe(21);
    // The running length is exactly what the field will hold.
    expect(uploadFieldLength(["aaaa", ...fit.accepted])).toBe(fit.length);
  });

  it("accepts a photo that lands exactly on the limit and refuses one character more", () => {
    // [] + "x" is ["x"] = 5 characters.
    expect(fitUploadTotal([], ["x"], 5)).toMatchObject({
      accepted: ["x"],
      refused: [],
      length: 5,
      refusedLength: 0,
    });
    expect(fitUploadTotal([], ["x"], 4)).toMatchObject({
      accepted: [],
      refused: [0],
      length: 2,
      refusedLength: 5,
    });
  });

  it("refuses the third of three Safari PNG cutouts of about 1.9 MB", () => {
    const cutout = png(1_900_000);
    const fit = fitUploadTotal([], [cutout, cutout, cutout]);
    expect(fit.accepted).toHaveLength(2);
    expect(fit.refused).toEqual([2]);
    expect(fit.length).toBeLessThanOrEqual(MAX_UPLOAD_TOTAL_LENGTH);
    expect(fit.refusedLength).toBeGreaterThan(MAX_UPLOAD_TOTAL_LENGTH);
  });

  it("still takes a JPEG next to photos already stored, counting them too", () => {
    const stored = [jpeg(1_500_000), jpeg(1_500_000)];
    expect(fitUploadTotal(stored, [jpeg(900_000)]).accepted).toHaveLength(1);
    expect(fitUploadTotal(stored, [jpeg(1_300_000)]).refused).toEqual([0]);
  });

  it("refuses everything, even a link, once stored photos already pass the total", () => {
    const stored = [png(2_000_000), png(2_000_000), jpeg(400_000)];
    expect(uploadFieldLength(stored)).toBeGreaterThan(MAX_UPLOAD_TOTAL_LENGTH);
    expect(
      fitUploadTotal(stored, ["https://cdn.example.com/a.jpg"]).refused,
    ).toEqual([0]);
  });

  it("rounds a total up, so one character over the limit never reads as the limit", () => {
    expect(formatUploadMB(MAX_UPLOAD_TOTAL_LENGTH)).toBe("4");
    expect(formatUploadMB(MAX_UPLOAD_TOTAL_LENGTH + 1)).toBe("4,1");
    // 1,900,000 characters is 1.81 MB, shown as 1,9.
    expect(formatUploadMB(1_900_000)).toBe("1,9");
  });

  it("says what was left out, the total it would have made, the limit and the way out", () => {
    const message = uploadTotalMessage(["cilek.png"], 4_900_000, true);
    expect(message).toContain("cilek.png eklenmedi");
    // 4,900,000 characters is 4.67 MB, shown rounded up.
    expect(message).toContain("toplamda 4,7 MB olurdu");
    expect(message).toContain("en çok 4 MB gönderilebilir");
    expect(message).toContain("bir fotoğrafı kaldır");
    // A PNG is the Safari case: the cause and the way out are named.
    expect(message).toContain("PNG");
    expect(message).toContain("Chrome ya da Firefox");

    const two = uploadTotalMessage(["a.jpg", "b.jpg"], 4_300_000, false);
    expect(two).toContain("a.jpg, b.jpg eklenmedi");
    expect(two).not.toContain("PNG");

    const notice = uploadTotalNotice(4_900_000);
    expect(notice).toContain("toplamda 4,7 MB");
    expect(notice).toContain("Kaydetmeden önce bir fotoğrafı kaldır");
    for (const text of [message, two, notice]) {
      expect(LONG_DASH.test(text), text).toBe(false);
    }
  });

  it("warns before saving when the stored photos already pass the total", () => {
    const over = renderToStaticMarkup(
      createElement(ImageUpload, {
        name: "images",
        initial: [png(2_000_000), png(2_000_000), jpeg(400_000)],
      }),
    );
    expect(over).toContain('role="alert"');
    expect(over).toContain("Kaydetmeden önce bir fotoğrafı kaldır");

    const under = renderToStaticMarkup(
      createElement(ImageUpload, {
        name: "images",
        initial: [jpeg(300_000), jpeg(300_000)],
      }),
    );
    expect(under).not.toContain("Kaydetmeden önce bir fotoğrafı kaldır");
    // The rule is stated up front on the product's multi-photo field...
    expect(under).toContain("Tek kayıtta fotoğrafların toplamı en çok 4 MB");
    // ...and not on the menu item's single photo, which can never reach it.
    const menu = renderToStaticMarkup(
      createElement(ImageUpload, { name: "image", max: 1, initial: [] }),
    );
    expect(menu).not.toContain("Tek kayıtta fotoğrafların toplamı");
  });

  it("the uploader checks the total on both ways in: files and links", () => {
    const uploader = readFileSync(
      "src/components/admin/image-upload.tsx",
      "utf8",
    );
    expect(uploader).toContain("fitUploadTotal(images, next)");
    expect(uploader).toContain("fitUploadTotal(prev, fit.accepted)");
    expect(uploader).toContain("fitUploadTotal(images, [v])");
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
