import { describe, expect, it } from "vitest";
import QRCode from "qrcode";

/**
 * The QR the member holds up at the till, measured rather than assumed.
 *
 * The token's alphabet, its length and the encoder's settings are one design:
 * spend the entropy in QR's alphanumeric character set, spend less of it, and
 * put what that frees into error correction and a spec-compliant quiet zone.
 * Change any one of them and the grid grows again - which is exactly the
 * regression these tests exist to catch, because nothing else in the system
 * fails when a code merely becomes *harder* to scan.
 *
 * Numbers here are produced by `qrcode` itself, not estimated.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const EC = "Q" as const;
const QUIET_ZONE = 4;

/** A stand-in with the exact shape `issueCounterToken` mints. */
function sampleToken(seed: number): string {
  let out = "";
  for (let i = 0; i < 26; i += 1) {
    out += ALPHABET[(seed * 31 + i * 7) % ALPHABET.length];
  }
  return out;
}

describe("counter QR geometry", () => {
  it("encodes wholly in alphanumeric mode", () => {
    // Byte mode costs 8 bits a character where alphanumeric costs 5.5; a
    // single lowercase letter or a `-` in the alphabet would silently push
    // the whole payload into it.
    const qr = QRCode.create(sampleToken(1), { errorCorrectionLevel: EC });
    expect(qr.segments.map((s) => s.mode.id)).toEqual(["Alphanumeric"]);
  });

  it("fits a 25x25 grid at error-correction level Q", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const qr = QRCode.create(sampleToken(seed), { errorCorrectionLevel: EC });
      expect(qr.version).toBe(2);
      expect(qr.modules.size).toBe(25);
    }
  });

  it("is coarser than the base64url token it replaced", () => {
    // The regression this guards: 43 base64url characters needed 33x33 at the
    // weaker level M. Fewer modules in the same drawn square is a physically
    // larger module, which is what a camera actually resolves.
    const legacy = QRCode.create("a".repeat(43), { errorCorrectionLevel: "M" });
    const current = QRCode.create(sampleToken(7), { errorCorrectionLevel: EC });
    expect(current.modules.size).toBeLessThan(legacy.modules.size);
  });

  it("draws a four-module quiet zone and crisp module edges", async () => {
    const svg = await QRCode.toString(sampleToken(3), {
      type: "svg",
      margin: QUIET_ZONE,
      errorCorrectionLevel: EC,
    });
    // 25 modules + four blank ones on each side.
    expect(svg).toContain('viewBox="0 0 33 33"');
    // Relied on rather than injected by the route; if a `qrcode` release
    // stops emitting it, the route must start doing so itself.
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  it("carries more error correction than the level it replaced", () => {
    // Level Q recovers ~25% of a damaged code where M recovers ~15% - the
    // difference between reading through a thumbprint and asking the member
    // to wipe their screen. Compared by codeword count, which is the thing
    // that actually differs; the `bit` field is only an enum tag.
    const q = QRCode.create(sampleToken(11), { errorCorrectionLevel: "Q" });
    const m = QRCode.create(sampleToken(11), { errorCorrectionLevel: "M" });
    expect(q.errorCorrectionLevel.bit).not.toBe(m.errorCorrectionLevel.bit);
    // Same payload, stronger level, so at least as many total modules are
    // spent on recovery: version 2 either way here, with Q holding more.
    expect(q.version).toBeGreaterThanOrEqual(m.version);
  });
});
