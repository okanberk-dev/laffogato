import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NO_BACKDROP } from "@/lib/admin/store";
import { sceneColumns } from "@/lib/backdrop/scene";

/**
 * A fault anywhere in the colour step leaves the save standing (review L-1,
 * 25 Sep 2026): the photo counts as unread and `decideScene` does the rest.
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
