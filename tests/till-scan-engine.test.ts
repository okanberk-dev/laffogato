import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CAMERA_FAULT_MESSAGE,
  cameraFault,
  createDecoder,
  DECODE_SIZE,
  nativeDetector,
  RETICLE_MAX_SHARE,
  reticleSize,
  SCAN_COOLDOWN_MS,
  ScanGate,
  scanRegion,
  torchCapable,
} from "@/app/admin/kasa/scan-engine";

/**
 * The till's scanner, in the parts that are decidable without a camera.
 *
 * Every case here is a shift that actually goes wrong: the same QR read
 * twenty times in a second, a code that was consumed and must never be sent
 * again, a redeem that failed and must be retryable, an iPad with no
 * `BarcodeDetector`, and a laptop with no camera at all.
 */

const g = globalThis as unknown as {
  window?: unknown;
  navigator?: unknown;
};

afterEach(() => {
  delete g.window;
  delete g.navigator;
  vi.unstubAllGlobals();
});

describe("reticleSize (admin audit ORD-14)", () => {
  // The preview box is the card's width and at most 340 px tall, the
  // picture drawn object-fit: cover into it.
  it("marks the decoded square on a landscape camera, inside the box", () => {
    // An iPad in landscape or a laptop: a 670 px card, a 1280x720 stream.
    const side = reticleSize(
      { width: 670, height: 340 },
      { width: 1280, height: 720 },
    );
    // Scale max(670/1280, 340/720) = 0.523; 562 decoded px -> 294 on screen.
    expect(side).toBe(294);
    // The old frame was 78% of the WIDTH: 523 px, taller than the box.
    expect(side).toBeLessThan(340);
    expect(side).toBeLessThan(Math.round(670 * 0.78));
  });

  it("matches the old frame on a portrait phone, where it was right", () => {
    // 390 px phone, a 358 px card, a 720x1280 stream cropped to 340 tall.
    const side = reticleSize(
      { width: 358, height: 340 },
      { width: 720, height: 1280 },
    );
    expect(side).toBe(279);
    expect(Math.abs(side - 358 * 0.78)).toBeLessThan(1);
  });

  it("never draws more than is decoded, and always shows all four sides", () => {
    const cases: Array<
      [{ width: number; height: number }, { width: number; height: number }]
    > = [
      [
        { width: 670, height: 340 },
        { width: 720, height: 1280 },
      ],
      [
        { width: 1100, height: 340 },
        { width: 1920, height: 1080 },
      ],
      [
        { width: 300, height: 300 },
        { width: 640, height: 480 },
      ],
      [
        { width: 900, height: 340 },
        { width: 480, height: 480 },
      ],
    ];
    for (const [box, source] of cases) {
      const side = reticleSize(box, source);
      const scale = Math.max(
        box.width / source.width,
        box.height / source.height,
      );
      const decoded = scanRegion(source.width, source.height).size * scale;
      expect(side, JSON.stringify([box, source])).toBeLessThanOrEqual(decoded);
      expect(side).toBeLessThanOrEqual(
        RETICLE_MAX_SHARE * Math.min(box.width, box.height),
      );
      expect(side).toBeGreaterThan(0);
    }
  });

  it("is 0 while the video or the box has no size yet (the CSS guess stays)", () => {
    expect(
      reticleSize({ width: 0, height: 0 }, { width: 1280, height: 720 }),
    ).toBe(0);
    expect(
      reticleSize({ width: 670, height: 340 }, { width: 0, height: 0 }),
    ).toBe(0);
  });

  it("the scanner draws it from the video's own rect and picture size", () => {
    const src = readFileSync("src/app/admin/kasa/camera-scanner.tsx", "utf8");
    expect(src).toMatch(
      /reticleSize\(\s*\{ width: rect\.width, height: rect\.height \},\s*\{ width: video\.videoWidth, height: video\.videoHeight \}/,
    );
    expect(src).toContain('video.addEventListener("resize", measure)');
    expect(src).toContain("{ width: reticle, height: reticle }");
  });
});

describe("the scanner after a camera fault", () => {
  it("keeps the video and canvas mounted, so Yeniden dene has a camera to restart", () => {
    const src = readFileSync("src/app/admin/kasa/camera-scanner.tsx", "utf8");
    // The old early return dropped both elements; the retry effect then
    // found no video and the till stayed on the fault.
    expect(src).not.toMatch(/if \(status === "fault"\) \{\s*return/);
    expect(src).toContain('className={faulted ? "hidden" : "grid gap-3"}');
    expect(src).toContain('<canvas ref={canvasRef} className="hidden" />');
  });
});

describe("scanRegion", () => {
  it("crops a centred square out of a landscape frame", () => {
    const r = scanRegion(1280, 720);
    expect(r.size).toBe(Math.round(720 * 0.78));
    // Centred on both axes, so the reticle the cashier aims at IS the region
    // the decoder is handed.
    expect(r.sx).toBe(Math.round((1280 - r.size) / 2));
    expect(r.sy).toBe(Math.round((720 - r.size) / 2));
  });

  it("uses the short edge on a portrait frame too", () => {
    const r = scanRegion(720, 1280);
    expect(r.size).toBe(Math.round(720 * 0.78));
    expect(r.sy).toBeGreaterThan(r.sx);
  });

  it("never returns a zero-sized crop", () => {
    expect(scanRegion(1, 1).size).toBeGreaterThan(0);
    expect(scanRegion(0, 0).size).toBeGreaterThan(0);
  });

  it("decodes at a fixed square regardless of the camera", () => {
    // A 25x25 code across 480px is ~19 pixels a module - far past the three
    // or four a decoder needs, and a fraction of the work a 1080p frame costs.
    expect(DECODE_SIZE).toBe(480);
  });
});

describe("ScanGate", () => {
  it("submits a code once while it sits in front of the lens", () => {
    const gate = new ScanGate();
    expect(gate.accept("ABC", 0)).toBe(true);
    // The next thirty frames carry the same picture.
    for (let t = 16; t < SCAN_COOLDOWN_MS; t += 16) {
      expect(gate.accept("ABC", t)).toBe(false);
    }
  });

  it("ignores an empty decode", () => {
    expect(new ScanGate().accept("", 0)).toBe(false);
  });

  it("never offers a consumed code again, however long the queue", () => {
    const gate = new ScanGate();
    gate.accept("ABC", 0);
    gate.burn("ABC");
    // Well past the cooldown: the member is still holding the phone up, and
    // submitting again would answer a successful scan with "kod kullanıldı".
    expect(gate.accept("ABC", SCAN_COOLDOWN_MS * 10)).toBe(false);
    // Even after the cashier presses "Yeni okuma".
    gate.clear();
    expect(gate.accept("ABC", SCAN_COOLDOWN_MS * 20)).toBe(false);
  });

  it("lets a failed redeem be retried immediately", () => {
    const gate = new ScanGate();
    gate.accept("ABC", 0);
    // The connection dropped; nothing was spent.
    gate.forget("ABC");
    expect(gate.accept("ABC", 1)).toBe(true);
  });

  it("takes the next member without waiting", () => {
    const gate = new ScanGate();
    gate.accept("ABC", 0);
    gate.burn("ABC");
    expect(gate.accept("XYZ", 10)).toBe(true);
  });

  it("does not grow for the length of a shift", () => {
    const gate = new ScanGate();
    for (let i = 0; i < 5000; i += 1) gate.accept(`code-${i}`, i * 1000);
    // Only values inside the cooldown can still block anything.
    const seen = (gate as unknown as { seen: Map<string, number> }).seen;
    expect(seen.size).toBeLessThanOrEqual(3);
  });

  it("bounds the consumed set", () => {
    const gate = new ScanGate();
    for (let i = 0; i < 900; i += 1) gate.burn(`code-${i}`);
    const spent = (gate as unknown as { spent: Set<string> }).spent;
    expect(spent.size).toBeLessThanOrEqual(500);
    // The most recent are the ones that matter - a member still at the till.
    expect(spent.has("code-899")).toBe(true);
  });
});

describe("cameraFault", () => {
  it("tells the three failures apart", () => {
    g.navigator = { mediaDevices: {} };
    expect(cameraFault({ name: "NotAllowedError" })).toBe("denied");
    expect(cameraFault({ name: "NotFoundError" })).toBe("missing");
    expect(cameraFault({ name: "NotReadableError" })).toBe("busy");
    expect(cameraFault({ name: "SomethingElse" })).toBe("other");
  });

  it("calls a browser with no getUserMedia unsupported, not denied", () => {
    // http rather than https, or a very old browser: telling the cashier to
    // grant a permission they were never asked for is a dead end.
    g.navigator = {};
    expect(cameraFault(new Error("nope"))).toBe("unsupported");
  });

  it("has a cashier-readable sentence for every fault", () => {
    for (const key of [
      "denied",
      "missing",
      "busy",
      "unsupported",
      "other",
    ] as const) {
      expect(CAMERA_FAULT_MESSAGE[key].length).toBeGreaterThan(20);
    }
  });
});

describe("decoder selection", () => {
  it("finds no native detector when the browser has none", () => {
    g.window = {};
    expect(nativeDetector()).toBeNull();
  });

  it("prefers the browser's detector when it exists", async () => {
    const detect = vi.fn().mockResolvedValue([{ rawValue: "  JETON  " }]);
    g.window = {
      BarcodeDetector: class {
        detect = detect;
      },
    };
    const decoder = await createDecoder();
    expect(decoder.kind).toBe("native");
    const value = await decoder.decode(
      {} as ImageData,
      {} as HTMLCanvasElement,
    );
    // Trimmed: a detector may hand back surrounding whitespace.
    expect(value).toBe("JETON");
  });

  it("falls back to jsQR on Safari, where there is no BarcodeDetector", async () => {
    // The whole reason this file exists: an iPad till used to be told its
    // browser could not read QR at all.
    g.window = {};
    const decoder = await createDecoder();
    expect(decoder.kind).toBe("js");
    // A blank frame decodes to nothing rather than throwing.
    const blank = {
      data: new Uint8ClampedArray(4 * 8 * 8).fill(255),
      width: 8,
      height: 8,
    } as ImageData;
    await expect(decoder.decode(blank, {} as HTMLCanvasElement)).resolves.toBe(
      "",
    );
  });

  it("reports an empty read when the detector saw nothing", async () => {
    g.window = {
      BarcodeDetector: class {
        detect = async () => [];
      },
    };
    const decoder = await createDecoder();
    expect(await decoder.decode({} as ImageData, {} as HTMLCanvasElement)).toBe(
      "",
    );
  });
});

describe("torchCapable", () => {
  it("is false for a track that cannot report capabilities", () => {
    expect(torchCapable(null)).toBe(false);
    expect(torchCapable({} as MediaStreamTrack)).toBe(false);
  });

  it("is true only when the track says so", () => {
    const withTorch = {
      getCapabilities: () => ({ torch: true }),
    } as unknown as MediaStreamTrack;
    const without = {
      getCapabilities: () => ({}),
    } as unknown as MediaStreamTrack;
    expect(torchCapable(withTorch)).toBe(true);
    expect(torchCapable(without)).toBe(false);
  });
});
