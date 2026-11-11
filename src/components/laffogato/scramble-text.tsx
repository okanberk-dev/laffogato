"use client";

import { createElement, useEffect, useRef, useState } from "react";

import { cx } from "./cx";

type Tag = "p" | "span" | "div";

/** What a glyph spins through before it settles (Turkish capitals too). */
const GLYPHS = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789#%&*+/<>";
/** One more glyph starts every 32 ms and spins for 260 ms. */
const STEP_MS = 32;
const SPIN_MS = 260;
/** Never spun: the line keeps its shape while it decodes. */
const FIXED = /[\s:.,·'’\-–]/;

/**
 * A kicker that decodes left to right when it comes into view (the
 * reference's scrambled "SECTION 1" line).
 *
 * The server renders the finished line and nothing else, so it is there
 * without script and under prefers-reduced-motion. After hydration, the
 * first time the line is on screen, each glyph spins through a few capitals
 * and settles in turn; while that runs a screen reader gets the finished
 * line from a visually hidden copy, not the noise. `on="load"` (the line at
 * the top of a page) is held back for a moment by CSS so the decode starts
 * from nothing (globals.css `.scr-load`).
 */
export function ScrambleText({
  text,
  as = "span",
  on = "view",
  delay = 0,
  className,
}: {
  text: string;
  as?: Tag;
  on?: "load" | "view";
  /** ms after coming into view before the first glyph starts. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  /** The line mid-decode ("" = not yet started), or null when at rest. */
  const [frame, setFrame] = useState<string[] | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.scr = "still";
      return;
    }
    const glyphs = [...text];
    let raf = 0;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        el.dataset.scr = "on";
        const start = performance.now() + delay;
        const tick = (now: number) => {
          const t = now - start;
          if (t >= glyphs.length * STEP_MS + SPIN_MS) {
            setFrame(null);
            return;
          }
          setFrame(
            glyphs.map((glyph, i) => {
              if (FIXED.test(glyph)) return glyph;
              const at = i * STEP_MS;
              if (t < at) return "";
              if (t < at + SPIN_MS)
                return GLYPHS[(Math.random() * GLYPHS.length) | 0];
              return glyph;
            }),
          );
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text, delay]);

  const glyphs = frame ? [...text] : null;
  return createElement(
    as,
    { ref, className: cx("scr", on === "load" && "scr-load", className) },
    frame && glyphs ? (
      <>
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">
          {glyphs.map((glyph, i) => {
            const shown = frame[i];
            // An unstarted glyph keeps its width so the line does not jump.
            if (!shown) {
              return (
                <span key={i} style={{ visibility: "hidden" }}>
                  {glyph}
                </span>
              );
            }
            return (
              <span key={i} className={shown === glyph ? undefined : "scr-spin"}>
                {shown}
              </span>
            );
          })}
        </span>
      </>
    ) : (
      text
    ),
  );
}
