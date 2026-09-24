import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { NO_BACKDROP } from "@/lib/admin/store";
import type { BackdropKey } from "@/lib/backdrop/families";
import { sceneColumns } from "@/lib/backdrop/scene";
import {
  decideScene,
  parseBackdropChoice,
  parseVesselChoice,
  photoKind,
  type PhotoReading,
  type ScenePrevious,
} from "@/lib/backdrop/scene-core";

/**
 * What one save of the panel writes into the scene columns (glass round G5,
 * lafmobil docs/DESIGN-GLASS.md §6.5): the automatic pick, the hand choice
 * that survives a new photo, the cutout flag that always follows the photo,
 * and the vessel that only the form writes.
 */

const PHOTO_A = "data:image/webp;base64,QUFB";
const PHOTO_B = "data:image/jpeg;base64,QkJC";
const LINK = "https://cdn.example.com/latte.jpg";

const read = (
  family: BackdropKey | null,
  photoCutout: boolean,
  hex: string | null = "#C07A3A",
): PhotoReading => ({ kind: "read", family, photoCutout, hex });

function previous(over: Partial<ScenePrevious>): ScenePrevious {
  return { ...NO_BACKDROP, photo: PHOTO_A, ...over };
}

describe("the form's choices", () => {
  it("reads a family as a hand choice, anything else as Otomatik, a missing field as keep", () => {
    expect(parseBackdropChoice("caramel")).toEqual({
      kind: "manual",
      family: "caramel",
    });
    expect(parseBackdropChoice("auto")).toEqual({ kind: "auto" });
    // A screen scene or a stale value never pins a scene nobody chose.
    expect(parseBackdropChoice("house")).toEqual({ kind: "auto" });
    expect(parseBackdropChoice("velvet")).toEqual({ kind: "auto" });
    expect(parseBackdropChoice("")).toEqual({ kind: "auto" });
    expect(parseBackdropChoice(null)).toEqual({ kind: "keep" });
    expect(parseBackdropChoice(undefined)).toEqual({ kind: "keep" });
  });

  it("reads a vessel key, turns '' and unknown shapes into Kategoriden, keeps on a missing field", () => {
    expect(parseVesselChoice("tulip")).toEqual({ kind: "set", vessel: "tulip" });
    expect(parseVesselChoice("")).toEqual({ kind: "set", vessel: null });
    expect(parseVesselChoice("mug")).toEqual({ kind: "set", vessel: null });
    expect(parseVesselChoice(null)).toEqual({ kind: "keep" });
  });

  it("names the photo's kind without handing the photo over", () => {
    expect(photoKind("")).toBe("none");
    expect(photoKind(undefined)).toBe("none");
    expect(photoKind(PHOTO_A)).toBe("upload");
    expect(photoKind(LINK)).toBe("link");
    expect(photoKind("/menu/matcha-latte.webp")).toBe("link");
  });
});

describe("decideScene", () => {
  const auto = { kind: "auto" } as const;
  const keepVessel = { kind: "keep" } as const;

  it("stores the automatic pick, its colour and the cutout flag of a new photo", () => {
    expect(
      decideScene({
        photo: PHOTO_A,
        backdrop: auto,
        vessel: keepVessel,
        previous: null,
        reading: read("caramel", true),
      }),
    ).toEqual({
      backdrop: "caramel",
      backdropSource: "auto",
      backdropHex: "#C07A3A",
      photoCutout: true,
      vessel: null,
    });
  });

  it("keeps a hand choice across a new upload, and recomputes the cutout flag", () => {
    const out = decideScene({
      photo: PHOTO_B,
      backdrop: { kind: "manual", family: "gelato" },
      vessel: keepVessel,
      previous: previous({
        backdrop: "gelato",
        backdropSource: "manual",
        photoCutout: true,
      }),
      reading: read("strawberry", false, "#E07A95"),
    });
    expect(out.backdrop).toBe("gelato");
    expect(out.backdropSource).toBe("manual");
    expect(out.photoCutout).toBe(false);
    // The swatch shows what the new photo reads as, beside the hand choice.
    expect(out.backdropHex).toBe("#E07A95");
  });

  it("keeps a hand choice when the request does not carry the field at all", () => {
    const out = decideScene({
      photo: PHOTO_B,
      backdrop: { kind: "keep" },
      vessel: keepVessel,
      previous: previous({ backdrop: "ice", backdropSource: "manual" }),
      reading: read("latte", false),
    });
    expect(out).toMatchObject({ backdrop: "ice", backdropSource: "manual" });
  });

  it("recomputes when the operator turns a hand choice back to Otomatik", () => {
    const out = decideScene({
      photo: PHOTO_A,
      backdrop: auto,
      vessel: keepVessel,
      previous: previous({ backdrop: "ice", backdropSource: "manual" }),
      reading: read("strawberry", true),
    });
    expect(out).toMatchObject({
      backdrop: "strawberry",
      backdropSource: "auto",
      photoCutout: true,
    });
  });

  it("clears an automatic pick when the photo is removed", () => {
    expect(
      decideScene({
        photo: "",
        backdrop: auto,
        vessel: keepVessel,
        previous: previous({
          backdrop: "caramel",
          backdropHex: "#B87333",
          photoCutout: true,
        }),
        reading: { kind: "none" },
      }),
    ).toEqual({
      backdrop: null,
      backdropSource: "auto",
      backdropHex: null,
      photoCutout: false,
      vessel: null,
    });
  });

  it("keeps a hand choice when the photo is removed, but not the cutout flag", () => {
    expect(
      decideScene({
        photo: "",
        backdrop: { kind: "manual", family: "berry" },
        vessel: keepVessel,
        previous: previous({
          backdrop: "berry",
          backdropSource: "manual",
          photoCutout: true,
        }),
        reading: { kind: "none" },
      }),
    ).toMatchObject({
      backdrop: "berry",
      backdropSource: "manual",
      photoCutout: false,
    });
  });

  it("stores no pick when the photo gives none (a tie, a far colour, gear or merch)", () => {
    expect(
      decideScene({
        photo: PHOTO_A,
        backdrop: auto,
        vessel: keepVessel,
        previous: previous({ backdrop: "matcha" }),
        reading: read(null, true, "#C5BA66"),
      }),
    ).toMatchObject({ backdrop: null, backdropHex: "#C5BA66", photoCutout: true });
  });

  it("keeps what was measured for an unreadable photo that did not change", () => {
    const stored = previous({
      photo: LINK,
      backdrop: "latte",
      backdropHex: "#D2B48C",
      photoCutout: true,
    });
    expect(
      decideScene({
        photo: LINK,
        backdrop: auto,
        vessel: keepVessel,
        previous: stored,
        reading: { kind: "unread" },
      }),
    ).toEqual({
      backdrop: "latte",
      backdropSource: "auto",
      backdropHex: "#D2B48C",
      photoCutout: true,
      vessel: null,
    });
  });

  it("does not carry a hand choice over as an automatic pick of an unreadable photo", () => {
    expect(
      decideScene({
        photo: LINK,
        backdrop: auto,
        vessel: keepVessel,
        previous: previous({
          photo: LINK,
          backdrop: "ice",
          backdropSource: "manual",
        }),
        reading: { kind: "unread" },
      }),
    ).toMatchObject({ backdrop: null, backdropSource: "auto" });
  });

  it("drops the old photo's pick when a new photo cannot be read", () => {
    expect(
      decideScene({
        photo: LINK,
        backdrop: auto,
        vessel: keepVessel,
        previous: previous({
          backdrop: "caramel",
          backdropHex: "#B87333",
          photoCutout: true,
        }),
        reading: { kind: "unread" },
      }),
    ).toMatchObject({ backdrop: null, backdropHex: null, photoCutout: false });
  });

  it("writes the vessel only from the form", () => {
    const base = {
      photo: "",
      backdrop: auto,
      reading: { kind: "none" } as const,
    };
    const stored = previous({ vessel: "cloche" });
    expect(
      decideScene({
        ...base,
        vessel: { kind: "set", vessel: "tulip" },
        previous: stored,
      }).vessel,
    ).toBe("tulip");
    expect(
      decideScene({ ...base, vessel: { kind: "set", vessel: null }, previous: stored })
        .vessel,
    ).toBeNull();
    expect(
      decideScene({ ...base, vessel: { kind: "keep" }, previous: stored }).vessel,
    ).toBe("cloche");
    expect(
      decideScene({ ...base, vessel: { kind: "keep" }, previous: null }).vessel,
    ).toBeNull();
  });
});

type SharpImage = ReturnType<typeof sharp>;

async function dataUrl(
  image: SharpImage,
  format: "png" | "webp" | "jpeg",
): Promise<string> {
  const bytes = await image.toFormat(format).toBuffer();
  return `data:image/${format};base64,${bytes.toString("base64")}`;
}

/** A 96 px transparent square with a filled disc of `hex` in the middle. */
function cutout(hex: string): SharpImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="30" fill="${hex}"/></svg>`;
  return sharp(Buffer.from(svg));
}

/** A 96 px opaque photo of one colour. */
function solid(hex: string): SharpImage {
  return sharp({
    create: { width: 96, height: 96, channels: 3, background: hex },
  });
}

describe("sceneColumns (sharp)", () => {
  it("picks a family and marks a transparent WebP as a cutout", async () => {
    const photo = await dataUrl(cutout("#E27D9A"), "webp");
    const out = await sceneColumns(
      {
        photo,
        hue: "rose",
        category: "frozen",
        backdrop: { kind: "auto" },
        vessel: { kind: "keep" },
      },
      null,
    );
    expect(out).toMatchObject({
      backdrop: "strawberry",
      backdropSource: "auto",
      photoCutout: true,
    });
    expect(out.backdropHex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("marks an opaque JPEG as no cutout", async () => {
    const photo = await dataUrl(solid("#B87333"), "jpeg");
    const out = await sceneColumns(
      {
        photo,
        hue: "caramel",
        category: "ice-coffee",
        backdrop: { kind: "auto" },
        vessel: { kind: "keep" },
      },
      null,
    );
    expect(out).toMatchObject({ backdrop: "caramel", photoCutout: false });
  });

  it("runs no pick for gear, but still reads the cutout flag", async () => {
    const photo = await dataUrl(cutout("#B87333"), "png");
    const out = await sceneColumns(
      {
        photo,
        hue: "dark",
        category: "gear",
        backdrop: { kind: "auto" },
        vessel: { kind: "keep" },
      },
      null,
    );
    expect(out).toMatchObject({
      backdrop: null,
      backdropHex: null,
      photoCutout: true,
    });
  });

  it("never fetches a link: an unchanged link keeps its stored scene", async () => {
    const out = await sceneColumns(
      {
        photo: LINK,
        hue: "cream",
        category: "hot",
        backdrop: { kind: "auto" },
        vessel: { kind: "keep" },
      },
      previous({ photo: LINK, backdrop: "latte", photoCutout: true }),
    );
    expect(out).toMatchObject({ backdrop: "latte", photoCutout: true });
  });
});
