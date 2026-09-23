"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal motion driver.
 *
 * Safety-first: `.reveal` content is visible by default (SSR / no-JS / crawler
 * safe). Only AFTER hydration, and only for the user who hasn't asked for
 * reduced motion, do we hide the elements that are currently BELOW the fold
 * (`will-reveal`) and fade them in as they scroll into view (`is-in`).
 * Above-the-fold content is never hidden - so the hero can never flash or sit
 * blank while JS hydrates.
 *
 * A MutationObserver re-runs the pass after SPA route swaps replace the DOM.
 */
export function RevealMotion() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    const scan = () => {
      const fold = window.innerHeight * 0.85;
      document.querySelectorAll(".reveal:not(.will-reveal)").forEach((el) => {
        // Only arm elements that are still below the fold; anything already in
        // or above view stays painted (visible) so nothing ever blanks out.
        if (el.getBoundingClientRect().top > fold) {
          el.classList.add("will-reveal");
          io.observe(el);
        }
      });
    };

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scan();
      });
    };

    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
