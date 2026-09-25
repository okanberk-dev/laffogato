import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_STORED_IMAGE_LENGTH } from "@/lib/admin/image-encode";
import { NO_BACKDROP } from "@/lib/admin/store";
import {
  backdropFromImage,
  MAX_INPUT_PIXELS,
  sampleImage,
} from "@/lib/backdrop/from-image";
import { sceneColumns } from "@/lib/backdrop/scene";

/**
 * The two guards around the server-side read of a photo (review L-1 and L-2,
 * 25 Sep 2026): a fault anywhere in the colour step leaves the save standing,
 * and a photo that declares a huge canvas is never decoded.
 */

/** Switches the pick into a fault for one test; the real pick otherwise. */
const pickFault = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/backdrop/pick", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/backdrop/pick")>();
  return {
    ...real,
    pickBackdrop: (...args: Parameters<typeof real.pickBackdrop>) => {
      if (pickFault.on) throw new RangeError("pick fault");
      return real.pickBackdrop(...args);
    },
  };
});

const errors = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => errors.mockRestore());

beforeEach(() => {
  pickFault.on = false;
  errors.mockClear();
});

/** A solid PNG: small on disk, width x height pixels when decoded. */
async function solidPng(width: number, height = width): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#B87333" },
  })
    .png()
    .toBuffer();
}

async function dataUrl(bytes: Buffer): Promise<string> {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

describe("a fault in the colour step", () => {
  it("saves the photo as unread instead of failing the save", async () => {
    const photo = await dataUrl(await solidPng(96));
    // The same photo reads normally while the pick works...
    const read = await sceneColumns(
      {
        photo,
        hue: "caramel",
        category: "ice-coffee",
        backdrop: { kind: "auto" },
        vessel: { kind: "set", vessel: null },
      },
      null,
    );
    expect(read.backdropHex).toMatch(/^#[0-9A-F]{6}$/i);

    // ...and with a fault in it, the save still gets its columns: a new
    // photo with no pick, taken as opaque, and the form's vessel.
    pickFault.on = true;
    const faulted = await sceneColumns(
      {
        photo,
        hue: "caramel",
        category: "ice-coffee",
        backdrop: { kind: "auto" },
        vessel: { kind: "set", vessel: "tulip" },
      },
      null,
    );
    expect(faulted).toEqual({
      backdrop: null,
      backdropSource: "auto",
      backdropHex: null,
      photoCutout: false,
      vessel: "tulip",
    });
    expect(errors).toHaveBeenCalledWith(
      "[backdrop] the photo could not be read, saving without a new scene pick:",
      "pick fault",
    );
  });

  it("keeps what was measured for the same photo, and a hand choice", async () => {
    const photo = await dataUrl(await solidPng(96));
    pickFault.on = true;
    const kept = await sceneColumns(
      {
        photo,
        hue: "caramel",
        category: "ice-coffee",
        backdrop: { kind: "keep" },
        vessel: { kind: "keep" },
      },
      {
        ...NO_BACKDROP,
        photo,
        backdrop: "latte",
        backdropSource: "manual",
        backdropHex: "#B87333",
        photoCutout: true,
        vessel: "cup",
      },
    );
    expect(kept).toEqual({
      backdrop: "latte",
      backdropSource: "manual",
      backdropHex: "#B87333",
      photoCutout: true,
      vessel: "cup",
    });
  });
});

describe("the pixel cap on the server-side decode", () => {
  it("is 4096 x 4096, far above anything the uploader stores (1600 px)", () => {
    expect(MAX_INPUT_PIXELS).toBe(4096 * 4096);
  });

  it("reads a photo right at the cap", async () => {
    const sample = await sampleImage(await solidPng(4096));
    expect(sample).not.toBeNull();
    expect(Math.max(sample!.width, sample!.height)).toBe(64);
  });

  it("never decodes a small file that declares a larger canvas", async () => {
    // 4097 x 4096 is one column of pixels over the cap. As a PNG it is far
    // under the 2 MB string cap, the only other bound before sharp (the
    // action drops a longer data URL), while decoding it takes 67 MB.
    const bytes = await solidPng(4097, 4096);
    const stored = await dataUrl(bytes);
    expect(stored.length).toBeLessThan(MAX_STORED_IMAGE_LENGTH);
    expect(await sampleImage(bytes)).toBeNull();
    // Through the data URL the panel stores, too: no pick, the caller keeps
    // what it had.
    expect(await backdropFromImage(stored, { hue: "caramel" })).toBeNull();
  });
});
