"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { cx } from "./cx";
import type { RoastHandle, RoastKind } from "./roast-scene";

/**
 * One switch for every live drawing on the page (WCAG 2.2.2): pausing one
 * pauses all three, and the control only exists while one of them is
 * actually running.
 */
const motion = {
  paused: false,
  live: 0,
  listeners: new Set<() => void>(),
  emit() {
    for (const listener of this.listeners) listener();
  },
};
const subscribe = (listener: () => void) => {
  motion.listeners.add(listener);
  return () => {
    motion.listeners.delete(listener);
  };
};
const readPaused = () => motion.paused;
const readLive = () => motion.live > 0;
const never = () => false;

/** Sets the hero drawing's scroll position, 0..1. */
export type RoastScrub = (progress: number) => void;

/**
 * The host of one live drawing (roast-scene.ts): the bean in the hero, the
 * pour and the affogato in the two bands below it.
 *
 * Nothing waits for it. The server renders a small still drawing in its
 * place; the canvas is created only after the page has loaded and gone
 * idle, only where WebGL 2 runs without a performance caveat, and (for the
 * two bands) only once the band is within half a screen. three.js and the
 * scene arrive through `import()`, a chunk of their own that never enters
 * the first-load bundle, and fade in over the still once their first frame
 * is drawn (`data-gl="ready"`). Without WebGL, on Save-Data, or if the GPU
 * drops the context, the still simply stays (`data-gl="off"`).
 *
 * The whole thing is decoration: hidden from assistive technology, and it
 * never takes a pointer event.
 */
export function RoastStage({
  kind,
  className,
  onScrub,
}: {
  kind: RoastKind;
  className?: string;
  /**
   * The hero only: called with a setter for the drawing's scroll position
   * once the stage has mounted, and with null when it goes away.
   */
  onScrub?: (scrub: RoastScrub | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const handle = useRef<RoastHandle | null>(null);
  const progress = useRef(0);
  const paused = useSyncExternalStore(subscribe, readPaused, never);

  useEffect(() => {
    handle.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (!onScrub) return;
    onScrub((next) => {
      progress.current = next;
      handle.current?.setProgress(next);
    });
    return () => onScrub(null);
  }, [onScrub]);

  useEffect(() => {
    const stage = stageRef.current;
    const host = hostRef.current;
    if (!stage || !host) return;
    const mark = (state: "loading" | "ready" | "off") => {
      stage.dataset.gl = state;
    };

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (typeof WebGL2RenderingContext === "undefined" || connection?.saveData) {
      mark("off");
      return;
    }
    mark("loading");

    let cancelled = false;
    let live = false;
    let canvas: HTMLCanvasElement | null = null;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const begin = async () => {
      if (cancelled) return;
      canvas = document.createElement("canvas");
      canvas.className = "roast-canvas";
      const context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        depth: true,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
        // A software-rendered context would spend the visitor's CPU on
        // decoration: the still drawing is the better answer there.
        failIfMajorPerformanceCaveat: true,
      });
      if (!context) {
        mark("off");
        return;
      }
      try {
        const { startRoast } = await import("./roast-scene");
        if (cancelled) return;
        host.append(canvas);
        handle.current = startRoast({
          canvas,
          context,
          kind,
          lite: window.matchMedia("(max-width: 760px), (pointer: coarse)")
            .matches,
          still,
          onReady: () => {
            mark("ready");
            if (!still && !live) {
              live = true;
              motion.live += 1;
              motion.emit();
            }
          },
          onLost: () => mark("off"),
        });
        handle.current.setPaused(motion.paused);
        handle.current.setProgress(progress.current);
      } catch {
        // A failed chunk or a shader the driver refuses: the still drawing.
        mark("off");
      }
    };

    // After the load event and an idle moment: the type and the photographs
    // are painted first, then the scene's chunk is fetched.
    let idle = 0;
    let timer = 0;
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(() => void begin(), {
          timeout: 2500,
        });
      } else {
        timer = window.setTimeout(() => void begin(), 400);
      }
    };
    const afterLoad = () => {
      if (document.readyState === "complete") schedule();
      else window.addEventListener("load", schedule, { once: true });
    };

    // The hero's drawing is on the first screen. The bands' are not: a
    // visitor who never scrolls to one never downloads or runs it.
    let near: IntersectionObserver | null = null;
    if (kind === "bean") {
      afterLoad();
    } else {
      near = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          near?.disconnect();
          afterLoad();
        },
        { rootMargin: "50% 0px" },
      );
      near.observe(stage);
    }

    return () => {
      cancelled = true;
      near?.disconnect();
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback?.(idle);
      window.clearTimeout(timer);
      handle.current?.dispose();
      handle.current = null;
      canvas?.remove();
      if (live) {
        motion.live -= 1;
        motion.emit();
      }
    };
  }, [kind]);

  return (
    <div
      ref={stageRef}
      className={cx("roast-stage", `roast-stage--${kind}`, className)}
      aria-hidden="true"
    >
      <div className="roast-stage-art">
        <RoastStill kind={kind} />
      </div>
      <div ref={hostRef} className="roast-stage-gl" />
    </div>
  );
}

/**
 * The pause control for the live drawings (WCAG 2.2.2). Place one wherever
 * a drawing is in view; they all throw the same switch. It renders nothing
 * until a drawing is actually running, so it is absent without WebGL and
 * under prefers-reduced-motion.
 */
export function RoastPause({ className }: { className?: string }) {
  const paused = useSyncExternalStore(subscribe, readPaused, never);
  const live = useSyncExternalStore(subscribe, readLive, never);
  if (!live) return null;
  return (
    <button
      type="button"
      className={cx("roast-pause", className)}
      aria-pressed={paused}
      aria-label={paused ? "Hareketi başlat" : "Hareketi durdur"}
      onClick={() => {
        motion.paused = !motion.paused;
        motion.emit();
      }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        {paused ? (
          <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
        ) : (
          <path
            d="M8.5 6v12M15.5 6v12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}

/**
 * What stands where a drawing will be: a flat drawing of the same subject
 * in the same place, so the page is composed before (and without) WebGL.
 * Colours are the scene's pigments, set once here.
 */
function RoastStill({ kind }: { kind: RoastKind }) {
  if (kind === "bean") {
    return (
      <svg viewBox="0 0 200 260" className="roast-still roast-still--bean">
        <defs>
          <radialGradient id="roast-still-bean" cx="38%" cy="32%" r="78%">
            <stop offset="0" stopColor="#a4633a" />
            <stop offset="0.55" stopColor="#6d3a1f" />
            <stop offset="1" stopColor="#3a1c0e" />
          </radialGradient>
        </defs>
        <g transform="rotate(24 100 130)">
          <ellipse
            cx="100"
            cy="130"
            rx="74"
            ry="108"
            fill="url(#roast-still-bean)"
          />
          <path
            d="M104 28c-22 36 20 62-4 104s18 62-2 100"
            fill="none"
            stroke="#22100a"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M96 34c-20 34 20 60-4 100s16 60-2 92"
            fill="none"
            stroke="#b7774a"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>
      </svg>
    );
  }
  if (kind === "pour") {
    return (
      <svg viewBox="0 0 360 640" className="roast-still roast-still--pour">
        <rect x="118" y="34" width="124" height="34" rx="8" fill="#b98a4a" />
        <rect x="242" y="42" width="96" height="18" rx="9" fill="#4a2916" />
        <path
          d="M176 70c-2 60 50 96 34 168s-70 96-64 170 24 70 26 92"
          fill="none"
          stroke="#8c5226"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <ellipse cx="172" cy="552" rx="140" ry="20" fill="#c8673b" />
        <path d="M82 478h180c0 46-32 78-90 78s-90-32-90-78z" fill="#c8673b" />
        <ellipse cx="172" cy="478" rx="90" ry="20" fill="#7a4420" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 360 640" className="roast-still roast-still--affogato">
      <path
        d="M236 40l88 56-34 58-88-56z"
        fill="#d8cfc4"
        opacity="0.55"
        stroke="#b5aa9d"
        strokeWidth="2"
      />
      <path
        d="M218 132c-30 60 20 100-10 170s-40 80-34 150"
        fill="none"
        stroke="#2d1408"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <ellipse cx="172" cy="602" rx="126" ry="14" fill="#2a2523" />
      <path d="M104 500h136l-18 100h-100z" fill="#cf8f4c" />
      <circle cx="172" cy="474" r="64" fill="#fbf4e6" />
      <path
        d="M112 458c20-52 100-52 120 0-8 26-18 8-28 30-10-26-22 12-34-8-12 24-22-10-30 10-10-20-20 0-28-32z"
        fill="#2d1408"
      />
    </svg>
  );
}
