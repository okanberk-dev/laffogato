"use client";

import { useEffect } from "react";

/**
 * The largest correction a kerning pair of the title face asks for, in em.
 * A bigger one means the word was measured on some other face: throw the
 * whole word's measure away rather than open a gap inside it.
 */
const MAX_KERN_EM = 0.14;

/**
 * Restores the kerning a glyph-split title loses.
 *
 * <RevealText> puts every glyph of a title in its own inline-block so each
 * can rise through its mask; a browser does not kern across those boxes, and
 * at title size a fat face shows it (the "WA" of a wide word opens up). For
 * each word this measures where the glyphs sit when the word is set as one
 * run, compares that with where the boxes landed, and closes the difference
 * with a margin in em, so it holds at every size. `offsetLeft` is used for
 * the boxes because it ignores the transform a box may be carrying mid-rise.
 *
 * The measure is only worth anything on the title face itself. So each
 * title first waits for the faces ITS text needs (`document.fonts.load`
 * with the text: a Turkish capital comes from a second file that only
 * starts loading when a title first uses it; `document.fonts.ready` says
 * nothing about a file not yet asked for), and a word whose corrections
 * come out larger than any real pair is left exactly as it was. Without
 * script the title is only a hair looser.
 */
async function restoreKerning() {
  const titles = Array.from(
    document.querySelectorAll<HTMLElement>(".rv-chars:not([data-kerned])"),
  );
  for (const title of titles) {
    title.dataset.kerned = "";
    const style = getComputedStyle(title);
    const text = title.textContent ?? "";
    try {
      const faces = await document.fonts.load(
        `${style.fontWeight} 1em ${style.fontFamily}`,
        text + text.toLocaleUpperCase("tr"),
      );
      // Nothing came: the title is set in a fallback. Leave it alone.
      if (faces.length === 0) continue;
    } catch {
      continue;
    }
    if (!title.isConnected) continue;
    title.querySelectorAll<HTMLElement>(".rv-mask").forEach((word) => {
      const boxes = Array.from(word.children) as HTMLElement[];
      if (boxes.length < 2) return;
      const size = parseFloat(getComputedStyle(word).fontSize) || 16;
      const probe = document.createElement("span");
      probe.textContent = boxes.map((box) => box.textContent).join("");
      probe.style.cssText =
        "position:absolute;visibility:hidden;white-space:pre;left:0;top:0";
      word.appendChild(probe);
      const run = probe.firstChild;
      const margins: number[] = [];
      if (run) {
        const range = document.createRange();
        const at = (i: number) => {
          range.setStart(run, i);
          range.setEnd(run, i + 1);
          return range.getBoundingClientRect().left;
        };
        const first = at(0);
        let closed = 0;
        for (let i = 1; i < boxes.length; i++) {
          const natural = at(i) - first;
          const actual = boxes[i].offsetLeft - boxes[0].offsetLeft;
          const gap = natural - actual - closed;
          margins[i] = gap / size;
          closed += gap;
        }
      }
      probe.remove();
      if (margins.some((em) => Math.abs(em) > MAX_KERN_EM)) return;
      margins.forEach((em, i) => {
        if (Math.abs(em) > 0.002) boxes[i].style.marginLeft = `${em}em`;
      });
    });
  }
}

/**
 * Scroll-reveal motion driver.
 *
 * Safety-first: `.reveal` content, and a <RevealText> title (`.rv`), is
 * visible by default (SSR / no-JS / crawler safe). Only AFTER hydration, and
 * only for the user who hasn't asked for reduced motion, do we hide the
 * elements that are currently BELOW the fold (`will-reveal`) and bring them
 * in as they scroll into view (`is-in`). Above-the-fold content is never
 * hidden - so the hero can never flash or sit blank while JS hydrates. (A
 * title that plays on load, `.rv-load`, is CSS's own business.)
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
      document
        .querySelectorAll(".reveal:not(.is-in), .rv:not(.is-in):not(.rv-load)")
        .forEach((el) => {
          // Armed by an earlier run of this effect (development's double
          // mount, a fast refresh): that run's observer is gone, and an
          // element nobody watches would stay hidden for good. Watching one
          // twice is a no-op.
          if (el.classList.contains("will-reveal")) {
            io.observe(el);
            return;
          }
          // Only arm elements that are still below the fold; anything already in
          // or above view stays painted (visible) so nothing ever blanks out.
          if (el.getBoundingClientRect().top > fold) {
            el.classList.add("will-reveal");
            io.observe(el);
          }
        });
      void restoreKerning();
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
