"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The interactive pour hero — a 3D edible waffle cup the visitor fills with
 * espresso themselves. Designed in Claude Design; the widget itself is a
 * framework-agnostic custom element built from its own project and shipped
 * here as `public/laffogato-pour.js`.
 *
 * Two things shape how it is loaded:
 *
 * 1. The bundle is ~860 KB (three.js plus the brand font, inlined so the
 *    widget never depends on a font host). That must not sit in the
 *    homepage's critical path, so the script is fetched only once the
 *    section is about to scroll into view — the page's LCP is the dark hero
 *    below, which stays untouched.
 * 2. It is a custom element, not a React component. Creating it imperatively
 *    keeps it out of React's reconciler entirely: no JSX typings for an
 *    unknown tag, no SSR mismatch, and React never tries to diff a subtree
 *    that a WebGL renderer owns.
 */

const SCRIPT_SRC = "/laffogato-pour.js";

/** Load the widget bundle once per page, no matter how many heroes mount. */
function loadWidget(): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${SCRIPT_SRC}"]`,
  );
  if (existing) {
    return existing.dataset.loaded === "true"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () =>
            reject(new Error("pour widget failed to load")),
          );
        });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = SCRIPT_SRC;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error("pour widget failed to load")),
    );
    document.head.appendChild(script);
  });
}

export function PourHero() {
  const host = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moved, setMoved] = useState(false);

  // A hero that fills the screen hides the fact that anything follows it. The
  // cue below says so — and retires the moment the visitor starts scrolling,
  // however they do it.
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 24) {
        setMoved(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toNextSection = () => {
    const el = section.current;
    if (!el) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      top: el.offsetTop + el.offsetHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    let cancelled = false;
    let element: HTMLElement | undefined;

    const start = () => {
      loadWidget()
        .then(() => customElements.whenDefined("affogato-pour"))
        .then(() => {
          if (cancelled) return;
          element = document.createElement("affogato-pour");
          element.setAttribute("autorotate", "");
          element.setAttribute("name", "laffogato-cup");
          mount.appendChild(element);
          setReady(true);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    };

    // No IntersectionObserver (very old browser, or a JSDOM-ish env): just
    // load it — a working hero beats a clever one.
    if (typeof IntersectionObserver !== "function") {
      start();
      return () => {
        cancelled = true;
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        start();
      },
      // Start fetching a screen early so the cup is there by the time the
      // visitor arrives at it.
      { rootMargin: "600px 0px" },
    );
    io.observe(mount);

    return () => {
      cancelled = true;
      io.disconnect();
      // The element owns a WebGL context and a 2048² shadow map; dropping the
      // node alone would leak both until GC got around to it.
      const disposable = element as
        | (HTMLElement & { dispose?: () => void })
        | undefined;
      disposable?.dispose?.();
      element?.remove();
    };
  }, []);

  // The section always stays. Unmounting it would pull a whole viewport out
  // from under the visitor after it had already painted — and the paper wash
  // and wordmark are exactly what someone who never gets the bundle should
  // see, whether it is still loading or failed outright.
  return (
    <section
      className="pour-hero"
      ref={section}
      aria-label="L'Affogato — kahveni kendin dök"
    >
      <div className="pour-hero-stage" ref={host} />
      {!ready && (
        <div className="pour-hero-fallback" aria-hidden="true">
          L&apos;Affogato
        </div>
      )}
      {!failed && (
        <button
          type="button"
          className={`pour-hero-scroll${moved ? "is-gone" : ""}`}
          onClick={toNextSection}
          aria-label="Aşağı kaydır"
          tabIndex={moved ? -1 : 0}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M6 9.5 12 15.5 18 9.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </section>
  );
}
