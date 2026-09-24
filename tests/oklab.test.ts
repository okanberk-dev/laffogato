import { describe, expect, it } from "vitest";

import {
  chroma,
  deltaEOK2,
  hexToOklab,
  linearSrgbToOklab,
  oklabToHex,
  oklabToLinearSrgb,
  srgb8ToOklab,
  srgbToLinear,
  linearToSrgb,
  toOklch,
  xyzToOklab,
  type Oklab,
} from "@/lib/backdrop/oklab";

function expectLab(got: Oklab, want: [number, number, number], digits: number) {
  expect(got.L).toBeCloseTo(want[0], digits);
  expect(got.a).toBeCloseTo(want[1], digits);
  expect(got.b).toBeCloseTo(want[2], digits);
}

describe("Oklab against Ottosson's published values", () => {
  // The XYZ / Oklab reference table on bottosson.github.io/posts/oklab/,
  // given there to three decimals.
  it.each([
    [
      [0.95, 1.0, 1.089],
      [1.0, 0.0, 0.0],
    ],
    [
      [1.0, 0.0, 0.0],
      [0.45, 1.236, -0.019],
    ],
    [
      [0.0, 1.0, 0.0],
      [0.922, -0.671, 0.263],
    ],
    [
      [0.0, 0.0, 1.0],
      [0.153, -1.415, -0.449],
    ],
  ] as const)("XYZ %j → Oklab %j", (xyz, lab) => {
    expectLab(xyzToOklab(xyz[0], xyz[1], xyz[2]), [...lab], 3);
  });

  it("puts sRGB white at L 1 on the grey axis", () => {
    expectLab(srgb8ToOklab(255, 255, 255), [1, 0, 0], 4);
    expectLab(linearSrgbToOklab(0, 0, 0), [0, 0, 0], 6);
  });

  it("gives the sRGB primaries their usual Oklab values", () => {
    // The same page's linear-sRGB matrices; the widely published Oklab values
    // of red, lime and blue.
    expectLab(hexToOklab("#FF0000"), [0.62796, 0.22486, 0.12585], 4);
    expectLab(hexToOklab("#00FF00"), [0.86644, -0.23389, 0.1795], 4);
    expectLab(hexToOklab("#0000FF"), [0.45201, -0.03246, -0.31153], 4);
  });
});

describe("round trips", () => {
  it("inverts the transfer function", () => {
    for (const c of [0, 0.002, 0.04, 0.2, 0.5, 0.9, 1]) {
      expect(linearToSrgb(srgbToLinear(c))).toBeCloseTo(c, 10);
    }
  });

  it("returns a hex colour to itself through Oklab", () => {
    for (const hex of [
      "#3D2818",
      "#B87333",
      "#E27D9A",
      "#9CC3E6",
      "#FFFFFF",
      "#000000",
    ]) {
      expect(oklabToHex(hexToOklab(hex))).toBe(hex);
    }
  });

  it("inverts linear sRGB to Oklab", () => {
    const [r, g, b] = oklabToLinearSrgb(linearSrgbToOklab(0.2, 0.5, 0.8));
    expect(r).toBeCloseTo(0.2, 6);
    expect(g).toBeCloseTo(0.5, 6);
    expect(b).toBeCloseTo(0.8, 6);
  });

  it("clips an out-of-gamut colour into sRGB rather than wrapping", () => {
    expect(oklabToHex({ L: 0.7, a: 0.4, b: 0.4 })).toMatch(/^#FF[0-9A-F]{4}$/);
    expect(oklabToHex({ L: 1.2, a: 0, b: 0 })).toBe("#FFFFFF");
  });

  it("reads #RRGGBB with or without the hash and rejects anything else", () => {
    expect(hexToOklab("e27d9a")).toEqual(hexToOklab("#E27D9A"));
    expect(() => hexToOklab("#FFF")).toThrow();
    expect(() => hexToOklab("#E27D9A80")).toThrow();
  });
});

describe("OKLCH and ΔEOK2", () => {
  it("measures chroma and hue angle", () => {
    const red = toOklch(hexToOklab("#FF0000"));
    expect(red.C).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    expect(chroma(hexToOklab("#808080"))).toBeLessThan(1e-4);
    // A negative atan2 angle is folded into 0-360.
    expect(toOklch(hexToOklab("#0000FF")).h).toBeGreaterThan(180);
  });

  it("doubles a and b, not L", () => {
    const p = { L: 0.5, a: 0, b: 0 };
    expect(deltaEOK2(p, { L: 0.6, a: 0, b: 0 })).toBeCloseTo(0.1, 10);
    expect(deltaEOK2(p, { L: 0.5, a: 0.05, b: 0 })).toBeCloseTo(0.1, 10);
    expect(deltaEOK2(p, { L: 0.5, a: 0, b: -0.05 })).toBeCloseTo(0.1, 10);
  });

  it("reproduces the distances the design's tie rule was written for", () => {
    // DESIGN-GLASS §6.5 step 5: two refs sit closer than the accept radius,
    // which is why the item's hue settles them.
    const d = (x: string, y: string) => deltaEOK2(hexToOklab(x), hexToOklab(y));
    expect(d("#8DB060", "#A9B870")).toBeCloseTo(0.065, 3); // matcha ↔ pistachio
    expect(d("#B87333", "#C98F5F")).toBeCloseTo(0.09, 3); // caramel ↔ spice
  });
});
