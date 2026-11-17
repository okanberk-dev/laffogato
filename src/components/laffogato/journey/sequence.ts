import { FRAME_COUNT } from "./config";
import { FRAME_PACKS, type FrameCut, type FramePack } from "./frames";

/** One frame of the journey: its picture and its depth map (white = near). */
export interface Frame {
  colour: HTMLImageElement;
  depth: HTMLImageElement;
}

type PackState = "idle" | "loading" | "done";

/** Frames of a pack are decoded four at a time, this far apart. */
const BATCH = 4;
const BATCH_GAP_MS = 20;

/**
 * Loads a cut of the journey and keeps every frame for the life of the page.
 *
 * The film is a timeline of FRAME_COUNT steps; a pack lists the frames that
 * exist on it (frames/index.json), and nothing here assumes every step has
 * one: the drawer dissolves between the frames either side of the scroll.
 *
 * The first pack is fetched at once and its frame 0 is made first: the
 * preloader waits for that one frame. Its other frames follow together.
 * The remaining packs load in order once `loadAll()` is called, each
 * frame's two images made four frames at a time; a pack the scroll asks for
 * (`want`) jumps the queue. A frame or a pack that fails is logged once and
 * never retried: its neighbours stand in (`bracket`).
 */
export class Sequence {
  private readonly packs: FramePack[];
  private readonly state: PackState[];
  private readonly frames: (Frame | null)[] = new Array<Frame | null>(
    FRAME_COUNT,
  ).fill(null);
  private readonly packOf = new Map<number, number>();
  private readonly firstFrame: Promise<boolean>;
  private eager = false;
  private wanted = -1;
  private running = false;
  private readonly listeners = new Set<() => void>();

  constructor(cut: FrameCut) {
    this.packs = FRAME_PACKS[cut];
    this.state = this.packs.map(() => "idle");
    this.packs.forEach((pack, p) => {
      for (const frame of pack.frames) this.packOf.set(frame.index, p);
    });
    this.firstFrame = this.loadFirst();
  }

  /** True once frame 0 is in, false if it could not be loaded. */
  first(): Promise<boolean> {
    return this.firstFrame;
  }

  /** Load every remaining pack, in order (the wanted one first). */
  loadAll() {
    this.eager = true;
    void this.run();
  }

  /**
   * The scroll is at this frame: the pack that holds it (or, where the film
   * has no frame at that number, the frame nearest to it) loads next if it
   * has not.
   */
  want(index: number) {
    let pack: number | undefined;
    for (let step = 0; step < 8 && pack === undefined; step += 1) {
      pack = this.packOf.get(index - step) ?? this.packOf.get(index + step);
    }
    if (pack === undefined || this.state[pack] !== "idle") return;
    this.wanted = pack;
    void this.run();
  }

  /** Called whenever a frame arrives. Returns the way to stop listening. */
  onFrame(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * The loaded frames either side of a position on the film (a frame number
   * with a fraction): the nearest one at or before it, the nearest at or
   * after it, and how far between them the position lies. Where only one
   * side has a frame yet, both are that frame.
   */
  bracket(position: number): {
    lo: number;
    hi: number;
    a: Frame;
    b: Frame;
    mix: number;
  } | null {
    const last = FRAME_COUNT - 1;
    let lo = -1;
    for (let at = Math.min(last, Math.floor(position)); at >= 0; at -= 1) {
      if (this.frames[at]) {
        lo = at;
        break;
      }
    }
    let hi = -1;
    for (let at = Math.max(0, Math.ceil(position)); at <= last; at += 1) {
      if (this.frames[at]) {
        hi = at;
        break;
      }
    }
    if (lo < 0) lo = hi;
    if (hi < 0) hi = lo;
    const a = lo < 0 ? null : this.frames[lo];
    const b = hi < 0 ? null : this.frames[hi];
    if (!a || !b) return null;
    const mix =
      hi === lo ? 0 : Math.min(1, Math.max(0, (position - lo) / (hi - lo)));
    return { lo, hi, a, b, mix };
  }

  private async loadFirst(): Promise<boolean> {
    const pack = this.packs[0];
    if (!pack) return false;
    this.state[0] = "loading";
    try {
      const blob = await this.fetchPack(pack);
      const [first, ...rest] = pack.frames;
      const ok = first ? await this.makeFrame(blob, first) : false;
      // The rest of the first pack together: the first stretch of the scroll.
      void Promise.all(rest.map((frame) => this.makeFrame(blob, frame))).then(
        () => {
          this.state[0] = "done";
          void this.run();
        },
      );
      return ok;
    } catch (error) {
      console.error("journey: the first frames did not load", error);
      this.state[0] = "done";
      return false;
    }
  }

  private async run() {
    if (this.running || this.state[0] !== "done") return;
    this.running = true;
    try {
      for (;;) {
        let next = -1;
        if (this.wanted >= 0 && this.state[this.wanted] === "idle") {
          next = this.wanted;
        } else if (this.eager) {
          next = this.state.indexOf("idle");
        }
        this.wanted = -1;
        if (next < 0) break;
        await this.loadPack(next);
      }
    } finally {
      this.running = false;
    }
  }

  private async loadPack(p: number) {
    const pack = this.packs[p];
    this.state[p] = "loading";
    try {
      const blob = await this.fetchPack(pack);
      for (let at = 0; at < pack.frames.length; at += BATCH) {
        const batch = pack.frames.slice(at, at + BATCH);
        await Promise.all(batch.map((frame) => this.makeFrame(blob, frame)));
        await new Promise((resolve) => setTimeout(resolve, BATCH_GAP_MS));
      }
    } catch (error) {
      console.error(`journey: pack ${p} did not load`, error);
    }
    this.state[p] = "done";
  }

  private async fetchPack(pack: FramePack): Promise<Blob> {
    const response = await fetch(pack.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  }

  private async makeFrame(
    blob: Blob,
    packed: FramePack["frames"][number],
  ): Promise<boolean> {
    try {
      const [colour, depth] = await Promise.all([
        image(blob, packed.colour),
        image(blob, packed.depth),
      ]);
      this.frames[packed.index] = { colour, depth };
      for (const listener of this.listeners) listener();
      return true;
    } catch {
      console.error(`journey: frame ${packed.index} did not load`);
      return false;
    }
  }
}

/** An image made from a slice of a pack. */
function image(
  blob: Blob,
  [offset, length]: readonly [number, number],
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      blob.slice(offset, offset + length, "image/webp"),
    );
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("frame"));
    };
    img.src = url;
  });
}

/**
 * One sequence per cut for the life of the page: coming back to the home
 * page (and React's second mount in development) finds its frames already
 * loaded.
 */
const sequences = new Map<FrameCut, Sequence>();

export function sequenceFor(cut: FrameCut): Sequence {
  let sequence = sequences.get(cut);
  if (!sequence) {
    sequence = new Sequence(cut);
    sequences.set(cut, sequence);
  }
  return sequence;
}
