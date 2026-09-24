import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { BACKDROP_FAMILIES } from "@/lib/backdrop/families";
import {
  backdropFromImage,
  sampleImage,
  SAMPLE_SIZE,
} from "@/lib/backdrop/from-image";
import { chroma, deltaEOK2, hexToOklab } from "@/lib/backdrop/oklab";
import {
  matchFamily,
  PICK,
  pickBackdrop,
  type PickInput,
} from "@/lib/backdrop/pick";

/**
 * The automatic scene pick (lafmobil docs/DESIGN-GLASS.md §6.5). Synthetic
 * photos stand in for the cases the design measured: a cutout, a framed
 * photo, dark bodies, the near-equal refs the item's hue has to settle, and
 * the categories that get no pick at all.
 */

type Rgba = [number, number, number, number];

function rgb(hex: string, alpha = 255): Rgba {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, alpha];
}

/** A `size` × `size` RGBA image painted per pixel. */
function paint(
  size: number,
  at: (x: number, y: number) => Rgba,
): Pick<PickInput, "pixels" | "width" | "height"> {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      pixels.set(at(x, y), (y * size + x) * 4);
    }
  }
  return { pixels, width: size, height: size };
}

const flat = (hex: string) => paint(SAMPLE_SIZE, () => rgb(hex));

/** Distance of a pixel centre from the image centre. */
const radius = (x: number, y: number, size = SAMPLE_SIZE) =>
  Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);

const TRANSPARENT_GREEN = rgb("#00C800", 0);

describe("pickBackdrop - the design's cases", () => {
  it("reads a pink cutout as strawberry and ignores what the alpha hides", () => {
    const img = paint(SAMPLE_SIZE, (x, y) => {
      const r = radius(x, y);
      if (r < 18) return y < 20 ? rgb("#FFFFFF") : rgb("#E27D9A"); // foam cap
      if (r < 22) return rgb("#00C800", 100); // half-transparent halo
      return TRANSPARENT_GREEN; // the cut-away ground
    });
    for (const hue of ["", "rose"]) {
      const out = pickBackdrop({ ...img, isOpaque: false, hue });
      expect(out.family).toBe("strawberry");
      expect(out.hex).toBe("#E27D9A");
    }
  });

  it("ignores a black frame around a latte", () => {
    const img = paint(SAMPLE_SIZE, (x, y) => {
      const edge = Math.min(x, y, SAMPLE_SIZE - 1 - x, SAMPLE_SIZE - 1 - y);
      if (edge < 10) return rgb("#050505");
      return rgb("#D9B98C");
    });
    const out = pickBackdrop({ ...img, isOpaque: true, hue: "cream" });
    expect(out).toMatchObject({ family: "latte", hex: "#D9B98C" });
    // And without the prior: the nearest ref, not the frame.
    expect(pickBackdrop({ ...img, isOpaque: true }).family).toBe("latte");
  });

  it("drops the outer ring of an opaque photo, where a frame lives", () => {
    // A dark grey 4 px border, a white card (dropped as foam) and a small
    // latte swatch. Counted, the border would outweigh the swatch.
    const img = paint(SAMPLE_SIZE, (x, y) => {
      const edge = Math.min(x, y, SAMPLE_SIZE - 1 - x, SAMPLE_SIZE - 1 - y);
      if (edge < PICK.ringPx) return rgb("#262626");
      if (Math.abs(x + 0.5 - 32) < 4 && Math.abs(y + 0.5 - 32) < 4) {
        return rgb("#D9B98C");
      }
      return rgb("#FFFFFF");
    });
    expect(pickBackdrop({ ...img, isOpaque: true }).family).toBe("latte");
    // The same pixels read as a cutout (no ring cut, no centre weight): the
    // border wins, which is what the opaque path exists to prevent.
    expect(pickBackdrop({ ...img, isOpaque: false }).family).toBe("espresso");
  });

  it("weighs the centre of an opaque photo over a dark ground", () => {
    const img = paint(SAMPLE_SIZE, (x, y) =>
      radius(x, y) < 20 ? rgb("#D9B98C") : rgb("#262626"),
    );
    expect(pickBackdrop({ ...img, isOpaque: true }).family).toBe("latte");
    expect(pickBackdrop({ ...img, isOpaque: false }).family).toBe("espresso");
  });

  it("reads a dark neutral as espresso", () => {
    const out = pickBackdrop({ ...flat("#2B2926"), isOpaque: true });
    expect(out.family).toBe("espresso");
    expect(out.reason).toBe("neutral");
    // A caramel item's prior does not pull a dark neutral photo to caramel.
    expect(
      pickBackdrop({ ...flat("#2B2926"), isOpaque: true, hue: "caramel" })
        .family,
    ).toBe("espresso");
  });

  it("reads a cold brew in a clear glass as espresso, ice and grey glass notwithstanding", () => {
    // The body sits at Oklab L 0.15-0.24; the earlier near-black cut (0.18)
    // dropped exactly this and let the ice pull the pick to `latte`.
    const BODY = "#150E0A";
    const body = hexToOklab(BODY);
    expect(body.L).toBeGreaterThan(PICK.nearBlackL);
    expect(body.L).toBeLessThan(0.18);

    const img = paint(SAMPLE_SIZE, (x, y) => {
      if (x < 16 || x >= 48) return TRANSPARENT_GREEN; // cut-away ground
      if (x < 18 || x >= 46) return rgb("#9A9A9A"); // the glass wall
      if (y < 24) return rgb("#D8E0E6"); // ice on top
      return rgb(BODY);
    });
    for (const hue of ["espresso", ""]) {
      const out = pickBackdrop({ ...img, isOpaque: false, hue });
      expect(out.family).toBe("espresso");
      expect(hexToOklab(out.hex!).L).toBeLessThan(0.3);
    }
  });

  it("keeps a matcha latte matcha when the item says so (else pistachio)", () => {
    // The body colour measured on public/menu/matcha-latte-cut.webp.
    const img = flat("#A7B271");
    expect(
      pickBackdrop({ ...img, isOpaque: false, hue: "matcha" }),
    ).toMatchObject({
      family: "matcha",
      reason: "prior",
    });
    expect(pickBackdrop({ ...img, isOpaque: false, hue: "" })).toMatchObject({
      family: "pistachio",
      reason: "nearest",
    });
  });

  it("keeps a caramel latte caramel when the item says so (else spice)", () => {
    const BODY = "#C58855";
    const d = (k: "caramel" | "spice") =>
      deltaEOK2(hexToOklab(BODY), hexToOklab(BACKDROP_FAMILIES[k].ref));
    expect(d("caramel")).toBeLessThanOrEqual(PICK.acceptRadius);
    expect(d("caramel") - d("spice")).toBeGreaterThan(PICK.tieMargin);

    const img = flat(BODY);
    expect(
      pickBackdrop({ ...img, isOpaque: false, hue: "caramel" }).family,
    ).toBe("caramel");
    expect(pickBackdrop({ ...img, isOpaque: false, hue: "" }).family).toBe(
      "spice",
    );
  });

  it("settles an iced latte's latte / spice tie with the item's hue", () => {
    // Half-way between the two refs: 0.063 from each.
    const img = flat("#D1A476");
    expect(pickBackdrop({ ...img, isOpaque: false, hue: "cream" }).family).toBe(
      "latte",
    );
    expect(pickBackdrop({ ...img, isOpaque: false, hue: "dawn" }).family).toBe(
      "spice",
    );
  });

  it("makes no pick on a tie the hue does not settle", () => {
    const img = flat("#D1A476");
    for (const hue of ["", "matcha", "unknown"]) {
      expect(pickBackdrop({ ...img, isOpaque: false, hue })).toMatchObject({
        family: null,
        reason: "tie",
      });
    }
  });

  it("makes no pick for a colour far from every family", () => {
    const out = pickBackdrop({
      ...flat("#00C800"),
      isOpaque: true,
      hue: "matcha",
    });
    expect(out.family).toBeNull();
    expect(out.reason).toBe("far");
    expect(out.distance).toBeGreaterThan(PICK.acceptRadius);
    expect(out.hex).toBe("#00C800");
  });

  it("runs no pick at all for gear and merch", () => {
    for (const category of ["gear", "merch"]) {
      expect(
        pickBackdrop({ ...flat("#E27D9A"), isOpaque: true, category }),
      ).toEqual({
        family: null,
        hex: null,
        distance: null,
        reason: "category",
      });
    }
    expect(
      pickBackdrop({ ...flat("#E27D9A"), isOpaque: true, category: "beans" })
        .family,
    ).toBe("strawberry");
  });

  it("answers empty for a fully transparent or all-white photo", () => {
    expect(
      pickBackdrop({
        ...paint(SAMPLE_SIZE, () => TRANSPARENT_GREEN),
        isOpaque: false,
      }),
    ).toEqual({
      family: null,
      hex: null,
      distance: null,
      reason: "empty",
    });
    expect(pickBackdrop({ ...flat("#FFFFFF"), isOpaque: true }).reason).toBe(
      "empty",
    );
  });

  it("is deterministic", () => {
    // A noisy photo from a fixed-seed generator.
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const img = paint(SAMPLE_SIZE, () => [
      Math.floor(next() * 256),
      Math.floor(next() * 256),
      Math.floor(next() * 256),
      255,
    ]);
    const first = pickBackdrop({ ...img, isOpaque: true, hue: "caramel" });
    const again = pickBackdrop({
      pixels: new Uint8Array(img.pixels),
      width: img.width,
      height: img.height,
      isOpaque: true,
      hue: "caramel",
    });
    expect(again).toEqual(first);
  });
});

describe("matchFamily - the hue prior and the tie rule", () => {
  it("settles a tie outside the accept radius with the hue's family", () => {
    // latte 0.092, spice 0.106: a tie, and spice is only reachable as the
    // runner-up of that tie.
    const body = hexToOklab("#B5A281");
    expect(chroma(body)).toBeGreaterThanOrEqual(PICK.neutralC);
    expect(matchFamily(body, "dawn")).toMatchObject({
      family: "spice",
      reason: "tie-prior",
    });
    expect(matchFamily(body, "cream")).toMatchObject({
      family: "latte",
      reason: "prior",
    });
    expect(matchFamily(body, null)).toMatchObject({
      family: null,
      reason: "tie",
    });
  });

  it("splits a neutral by lightness", () => {
    expect(matchFamily({ L: 0.3, a: 0.005, b: 0.01 })).toMatchObject({
      family: "espresso",
      reason: "neutral",
    });
    expect(matchFamily({ L: 0.7, a: 0.005, b: 0.01 })).toMatchObject({
      family: "latte",
      reason: "neutral",
    });
  });

  it("returns the distance to what it chose, or to the nearest when it chose nothing", () => {
    const ref = hexToOklab(BACKDROP_FAMILIES.berry.ref);
    expect(matchFamily(ref)).toEqual({
      family: "berry",
      distance: 0,
      reason: "nearest",
    });
  });
});

describe("from-image - photos through sharp", () => {
  async function png(img: Pick<PickInput, "pixels" | "width" | "height">) {
    return sharp(Buffer.from(img.pixels), {
      raw: { width: img.width, height: img.height, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  it("marks a photo with transparency as a cutout and picks from it", async () => {
    const cut = await png(
      paint(128, (x, y) =>
        radius(x, y, 128) < 40 ? rgb("#E27D9A") : TRANSPARENT_GREEN,
      ),
    );
    const out = await backdropFromImage(cut, {
      hue: "rose",
      category: "smoothie",
    });
    expect(out).toMatchObject({ photoCutout: true, version: "v1" });
    expect(out!.pick.family).toBe("strawberry");
  });

  it("reads an opaque JPEG data URL as no cutout", async () => {
    const jpeg = await sharp(
      await png(
        paint(200, (x, y) => {
          const edge = Math.min(x, y, 199 - x, 199 - y);
          return edge < 20 ? rgb("#000000") : rgb("#D9B98C");
        }),
      ),
    )
      .jpeg({ quality: 90 })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    const out = await backdropFromImage(dataUrl, { hue: "cream" });
    expect(out!.photoCutout).toBe(false);
    expect(out!.pick.family).toBe("latte");
  });

  it("samples at most 64 px on the long side, keeping the aspect", async () => {
    const tall = await png(paint(10, () => rgb("#8DB060")));
    const wide = await sharp(tall)
      .resize(300, 100, { fit: "fill" })
      .png()
      .toBuffer();
    const sample = await sampleImage(wide);
    expect(sample).toMatchObject({ width: 64, height: 21, isOpaque: true });
    expect(sample!.pixels.length).toBe(64 * 21 * 4);
  });

  it("still measures a gear product's cutout, with no pick", async () => {
    const cut = await png(
      paint(64, (x, y) =>
        radius(x, y) < 20 ? rgb("#3D2818") : TRANSPARENT_GREEN,
      ),
    );
    const out = await backdropFromImage(cut, { category: "gear" });
    expect(out!.photoCutout).toBe(true);
    expect(out!.pick.reason).toBe("category");
  });

  it("answers null for what is not a readable image", async () => {
    expect(await backdropFromImage(Buffer.from("not an image"), {})).toBeNull();
    expect(
      await backdropFromImage("https://cdn.example/a.webp", {}),
    ).toBeNull();
    expect(
      await backdropFromImage("data:text/plain;base64,aGk=", {}),
    ).toBeNull();
    expect(await backdropFromImage(Buffer.alloc(0), {})).toBeNull();
  });

  it("keeps the bundled matcha latte cutout matcha, through its hue", async () => {
    // The design's own example, on the one real photo the repo ships: the
    // body alone is nearest to pistachio; the item's hue keeps it matcha.
    const photo = readFileSync("public/menu/matcha-latte-cut.webp");
    const withHue = await backdropFromImage(photo, {
      hue: "matcha",
      category: "matcha",
    });
    expect(withHue).toMatchObject({ photoCutout: true });
    expect(withHue!.pick.family).toBe("matcha");
    const without = await backdropFromImage(photo, {
      hue: "",
      category: "matcha",
    });
    expect(without!.pick.family).toBe("pistachio");
  });
});
