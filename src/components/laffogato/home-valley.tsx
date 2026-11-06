"use client";

import { useEffect, useRef, useState } from "react";

import { ROUTE_PATHS } from "./route-paths";
import type { ValleyHandle } from "./valley-scene";

/**
 * The home page's first screen: a night valley of coffee, drawn live with
 * three.js behind the name (owner's brief, 6 Kas 2026: a glowing night
 * valley in the hero, made for a coffee house, "kahve çekirdekleri
 * kullanabilirsin").
 *
 * The words never wait for the scene. The name, the caption, the arrow to
 * the menu and the scroll hint are server-rendered over a CSS night ground;
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
 * The operator's slides (/admin/anasayfa-hero) are not here: they follow
 * directly below as the slider band (home-hero-slider.tsx), unchanged in
 * data and controls. This screen carries the house, not a campaign.
 */
export function HomeValley({ onMenu }: { onMenu: () => void }) {
  const stageRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const quietRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
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
        depth: false,
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
        {/* The name is already the page's sr-only h1: not read twice. */}
        <p ref={nameRef} className="valley-name" aria-hidden="true">
          L&apos;Affogato
        </p>
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
