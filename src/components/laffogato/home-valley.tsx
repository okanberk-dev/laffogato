"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";

import { cx } from "./cx";
import { ROUTE_PATHS } from "./route-paths";
import { openStatusDetail, useOpenStatus } from "./use-open-status";
import type { ValleyHandle } from "./valley-scene";

/**
 * The brand's wordmark as an alpha mask: "L'Affogato" with the bean
 * apostrophe, traced to a smoothed vector path from the app's
 * logo-wordmark.png (lafmobil assets/brand) so its edges stay clean at hero
 * size. CSS paints it (white to cream).
 */
const WORDMARK = "/brand/laffogato-wordmark.svg";

/**
 * The home page's first screen: a night valley of coffee, drawn live with
 * three.js behind the name (owner's brief, 6 Kas 2026: a glowing night
 * valley in the hero, made for a coffee house, "kahve çekirdekleri
 * kullanabilirsin"; second round the same day: beans first, the brand's wordmark, green,
 * bordo and white).
 *
 * The words never wait for the scene. The wordmark, the caption, the arrow
 * to the menu, the live open/closed line and the scroll hint are
 * server-rendered over a CSS night ground (the wordmark's mask is
 * preloaded);
 * the canvas is created only after the page has loaded and gone idle, and
 * only where WebGL 2 runs without a performance caveat. three.js and the
 * scene arrive through `import()` (valley-scene.ts), a chunk of their own
 * that never enters the first-load bundle, and fade in behind the type once
 * their first frame is drawn. Without WebGL, on Save-Data, or if the GPU
 * drops the context, the CSS ground simply stays (`data-gl="off"`).
 *
 * Under prefers-reduced-motion the valley is one still frame: no drift, no
 * pointer, no dispersal. Otherwise it drifts until the visitor pauses it
 * (the pause control, WCAG 2.2.2), scrolls it out of view or hides the tab.
 *
 * Since 6 Kas 2026 this screen is the home page's whole entrance: the
 * operator's slides (/admin/anasayfa-hero) are not drawn, and that page
 * says so. The open/closed line moved here from the slider band.
 */
export function HomeValley({
  hours,
  onMenu,
  onVisit,
}: {
  /** Opening-hours rows (the visit block's), for the live open/closed line. */
  hours?: ReadonlyArray<readonly [string, string]>;
  onMenu: () => void;
  onVisit: () => void;
}) {
  // A CSS mask is fetched in CORS mode, so the preload must be too, or the
  // browser fetches the file twice.
  preload(WORDMARK, {
    as: "image",
    crossOrigin: "anonymous",
    fetchPriority: "high",
  });
  const stageRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const quietRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const handle = useRef<ValleyHandle | null>(null);
  const [paused, setPaused] = useState(false);

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
    let canvas: HTMLCanvasElement | null = null;

    const begin = async () => {
      if (cancelled) return;
      canvas = document.createElement("canvas");
      canvas.className = "valley-canvas";
      const context = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "low-power",
        // A software-rendered context would spend the visitor's CPU on
        // decoration: the CSS ground is the better answer there.
        failIfMajorPerformanceCaveat: true,
      });
      if (!context) {
        mark("off");
        return;
      }
      try {
        const { startValley } = await import("./valley-scene");
        if (cancelled) return;
        host.append(canvas);
        handle.current = startValley({
          canvas,
          context,
          stage,
          quiet: quietRef.current,
          name: nameRef.current,
          lite: window.matchMedia("(max-width: 760px), (pointer: coarse)")
            .matches,
          still: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          onReady: () => mark("ready"),
          onLost: () => mark("off"),
        });
      } catch {
        // A failed chunk or a shader the driver refuses: the CSS ground.
        mark("off");
      }
    };

    // After the load event and an idle moment: the photographs and the
    // type are painted first, then the scene's chunk is fetched.
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
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback?.(idle);
      window.clearTimeout(timer);
      handle.current?.dispose();
      handle.current = null;
      canvas?.remove();
    };
  }, []);

  const disperse = (on: boolean) => handle.current?.setDisperse(on);

  return (
    <section
      ref={stageRef}
      className="valley"
      aria-label="L'Affogato"
      data-ground="dark"
    >
      <div ref={hostRef} className="valley-gl" aria-hidden="true" />
      <div className="valley-copy">
        {/* The brand's wordmark, a picture of the name the page's sr-only
            h1 already says: not read twice. */}
        <div ref={nameRef} className="valley-mark" aria-hidden="true">
          <span className="valley-wordmark" />
        </div>
        <div ref={quietRef} className="valley-quiet">
          <p className="valley-caption">
            <span>Bologna 1897&apos;den Tuzla&apos;ya,</span>
            <span>iki yüz yıllık bir köşkte.</span>
          </p>
          <a
            className="valley-go"
            href={ROUTE_PATHS.menu}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                return;
              e.preventDefault();
              onMenu();
            }}
            onMouseEnter={() => disperse(true)}
            onMouseLeave={() => disperse(false)}
            onFocus={() => disperse(true)}
            onBlur={() => disperse(false)}
          >
            <span className="valley-go-ring" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path
                  d="M4 12h15m-6-6 6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="valley-go-label">Menüyü keşfet</span>
          </a>
          <ValleyStatus hours={hours} onVisit={onVisit} />
        </div>
      </div>

      <span className="valley-loader" aria-hidden="true" />
      <button
        type="button"
        className="valley-hint"
        onClick={() =>
          stageRef.current?.nextElementSibling?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
          })
        }
      >
        Kaydır ve keşfet
        <span className="valley-hint-line" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="valley-pause"
        aria-pressed={paused}
        aria-label={paused ? "Hareketi başlat" : "Hareketi durdur"}
        onClick={() => {
          const next = !paused;
          setPaused(next);
          handle.current?.setPaused(next);
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
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
    </section>
  );
}

/**
 * "Şu an açık · Kapanış 02:00" under the arrow - the one fact a café's front
 * page owes someone deciding whether to come now. Read live on the visitor's
 * clock in the köşk's time zone, from the same rows as the hours on
 * /ziyaret, and nothing at all until the browser has answered. It opens the
 * visit page.
 */
function ValleyStatus({
  hours,
  onVisit,
}: {
  hours?: ReadonlyArray<readonly [string, string]>;
  onVisit: () => void;
}) {
  const st = useOpenStatus(hours);
  if (!st) return null;
  const detail = openStatusDetail(st);
  return (
    <a
      href={ROUTE_PATHS.visit}
      className={cx("valley-status", st.open ? "is-open" : "is-closed")}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onVisit();
      }}
    >
      <span className="valley-status-dot" aria-hidden="true" />
      <span>
        <strong>{st.open ? "Şu an açık" : "Şu an kapalı"}</strong>
        {detail && <span className="valley-status-detail"> · {detail}</span>}
      </span>
    </a>
  );
}
