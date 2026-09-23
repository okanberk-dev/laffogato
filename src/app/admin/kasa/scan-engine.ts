/**
 * The till's QR reader.
 *
 * Split out of `till-console.tsx` because almost none of it is React: the
 * geometry, the decoder choice and the "have I already spent this code"
 * bookkeeping are plain functions with plain answers, and they are the parts
 * that are worth a test.
 *
 * Two decoders, in preference order:
 *
 *  1. `BarcodeDetector` - the browser's own, hardware-accelerated where the
 *     platform has it. Chrome and Edge on desktop and Android.
 *  2. `jsQR` - pure JavaScript, imported only when the first is missing.
 *
 * The second one is the point of this file. **Safari has no
 * `BarcodeDetector`**, so an iPad - which is what a café till actually is -
 * used to reach the camera tab, be told "bu cihazın tarayıcısı QR okumayı
 * desteklemiyor", and leave the cashier typing eight characters for every
 * member in the queue. jsQR is ~40 KB, has no dependencies of its own, and is
 * behind a dynamic import, so a Chrome till never downloads it.
 */

/** The browser API, minus the members we do not use. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

export type DecoderKind = "native" | "js";

export interface Decoder {
  kind: DecoderKind;
  /** The decoded string, or "" when this frame carried no readable code. */
  decode(frame: ImageData, source: HTMLCanvasElement): Promise<string>;
}

export function nativeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector ?? null
  );
}

/**
 * The region of the video actually handed to a decoder.
 *
 * A centred square, because that is where the reticle tells the cashier to
 * hold the phone, and because decoding the full frame is both slower and more
 * likely to lock onto something else on the counter. Capped so a very wide
 * webcam does not hand the decoder a strip, and floored so the code is never
 * cropped smaller than it is drawn.
 *
 * Returned in *source* pixels: the caller draws this rectangle into a canvas
 * of `size × size`, so the decoder always sees a square regardless of the
 * camera's aspect ratio.
 */
export interface ScanRegion {
  sx: number;
  sy: number;
  size: number;
}

export function scanRegion(width: number, height: number): ScanRegion {
  const shorter = Math.min(width, height);
  // 78% of the short edge: wide enough that a member holding the phone
  // roughly right is inside it, tight enough to drop the counter, the till
  // display and whatever else is in shot.
  const size = Math.max(1, Math.round(shorter * 0.78));
  return {
    sx: Math.round((width - size) / 2),
    sy: Math.round((height - size) / 2),
    size,
  };
}

/**
 * How large a bitmap the decoder is given.
 *
 * Downscaling is not a compromise here, it is the tuning. A 1080p frame costs
 * jsQR real milliseconds per attempt and carries no information a 25×25 code
 * needs; 480 px across leaves roughly 15 pixels per module at arm's length,
 * which is far past the 3-4 a decoder wants. A native detector is given the
 * same canvas so both paths see an identical picture - a bug that only
 * reproduces on one decoder is the worst kind to chase.
 */
export const DECODE_SIZE = 480;

/**
 * Picks a decoder once, and remembers which one it was.
 *
 * `jsQR`'s import is awaited here rather than at module scope so that the
 * admin bundle does not carry it for the tills that will never run it.
 */
export async function createDecoder(): Promise<Decoder> {
  const Native = nativeDetector();
  if (Native) {
    const detector = new Native({ formats: ["qr_code"] });
    return {
      kind: "native",
      async decode(_frame, source) {
        const found = await detector.detect(source);
        return found[0]?.rawValue?.trim() ?? "";
      },
    };
  }

  const { default: jsQR } = await import("jsqr");
  return {
    kind: "js",
    async decode(frame) {
      // `attemptBoth` inverts the image on a second pass, which is what reads
      // a code shown on a phone in dark mode.
      const found = jsQR(frame.data, frame.width, frame.height, {
        inversionAttempts: "attemptBoth",
      });
      return found?.data?.trim() ?? "";
    },
  };
}

/**
 * Why a camera could not be opened, in the terms the cashier needs.
 *
 * The old console collapsed every failure into one sentence about browser
 * permissions, which is wrong and unhelpful for the two cases that are not
 * about permission at all: a laptop with no camera, and a camera another
 * program is already holding.
 */
export type CameraFault = "denied" | "missing" | "busy" | "unsupported" | "other";

export function cameraFault(err: unknown): CameraFault {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return "unsupported";
  }
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "missing";
  }
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "other";
}

export const CAMERA_FAULT_MESSAGE: Record<CameraFault, string> = {
  denied:
    "Kamera izni verilmedi. Tarayıcının adres çubuğundaki kamera simgesinden izin ver, ya da kodu elle yaz.",
  missing:
    "Bu cihazda kamera bulunamadı. Üyenin kartındaki 8 karakterlik kodu yaz.",
  busy: "Kamera başka bir uygulamada açık. Onu kapat ve yeniden dene.",
  unsupported:
    "Bu tarayıcı kamerayı açamıyor. Sayfayı https üzerinden aç ya da kodu elle yaz.",
  other: "Kameraya erişilemedi. Kodu elle yazabilirsin.",
};

/**
 * Decides whether a decoded string should be submitted.
 *
 * The same code sits in front of the lens for dozens of frames, so a naive
 * loop would spend one member's token five times over - and the previous
 * console's fix for that (remember the last value forever) had the opposite
 * failure: when a redeem came back with a network error, that same QR could
 * never be retried, because the string had not changed. The rule that gets
 * both right is a *cooldown per value*: a value just seen is ignored for a
 * moment, and a value whose attempt failed becomes submittable again as soon
 * as the caller clears it.
 */
export const SCAN_COOLDOWN_MS = 2500;

/** How many spent codes are remembered before the oldest is dropped. */
const SPENT_LIMIT = 500;

export class ScanGate {
  private seen = new Map<string, number>();
  /** Codes a redeem actually consumed. A QR is single-use; these are final. */
  private spent = new Set<string>();

  /** True when this value should be submitted now. Records the attempt. */
  accept(value: string, now: number): boolean {
    if (!value) return false;
    if (this.spent.has(value)) return false;
    const last = this.seen.get(value);
    if (last !== undefined && now - last < SCAN_COOLDOWN_MS) return false;
    this.seen.set(value, now);
    // Values older than the cooldown can never block anything again, and the
    // map must not grow for the length of a shift.
    for (const [key, at] of this.seen) {
      if (now - at >= SCAN_COOLDOWN_MS) this.seen.delete(key);
    }
    return true;
  }

  /**
   * Marks a code as consumed: it is never submitted again from this till.
   *
   * The cooldown alone cannot do this job. It expires in two and a half
   * seconds, and the member is usually still holding the phone up - so the
   * console would submit the code it just burned and answer a successful scan
   * with "Bu kod kullanıldı", which reads like the stamp did not land.
   */
  burn(value: string): void {
    if (!value) return;
    this.spent.add(value);
    if (this.spent.size > SPENT_LIMIT) {
      // Insertion-ordered: the first key is the oldest.
      const oldest = this.spent.values().next();
      if (!oldest.done) this.spent.delete(oldest.value);
    }
  }

  /**
   * Lets a value through again immediately.
   *
   * For a redeem that FAILED - a dropped connection, a database blip. The old
   * console remembered the last scanned string forever and had no way back
   * from this: the same QR in front of the same lens could never be retried,
   * because the string had not changed.
   */
  forget(value: string): void {
    this.seen.delete(value);
    this.spent.delete(value);
  }

  clear(): void {
    this.seen.clear();
    // `spent` deliberately survives: those codes are gone whatever the
    // cashier does next.
  }
}

/**
 * The confirmation tone lives in `@/components/admin/beep` now - the order
 * list rings the same one when a new order lands. Re-exported here so the
 * till's own imports (and `till-scan-engine.test.ts`) still find it.
 */
export { beep } from "@/components/admin/beep";

/** Tracks that expose a torch - a dark counter is a real till, not an edge case. */
export function torchCapable(track: MediaStreamTrack | null): boolean {
  if (!track) return false;
  // `torch` is in the Image Capture spec, not in lib.dom's
  // `MediaTrackCapabilities`, so the whole method is re-typed rather than
  // intersected - an intersection would conflict with the built-in signature.
  const get = (track as unknown as {
    getCapabilities?: () => { torch?: boolean };
  }).getCapabilities;
  return get?.call(track).torch === true;
}

export async function setTorch(
  track: MediaStreamTrack | null,
  on: boolean,
): Promise<void> {
  if (!torchCapable(track)) return;
  await (
    track as MediaStreamTrack & {
      applyConstraints: (c: unknown) => Promise<void>;
    }
  ).applyConstraints({ advanced: [{ torch: on }] });
}
