"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The interactive pour toy — a 3D edible waffle cup the visitor fills with
 * espresso themselves. Designed in Claude Design; the widget itself is a
 * framework-agnostic custom element built from its own project and shipped
 * here as `public/laffogato-pour.js`.
 *
 * It used to BE the home page hero, a full `100svh` of it above everything
 * else. The Köşk redesign demotes it to a card low on the page ("küçük bir
 * oyun"), which is a better bargain in every direction: the 860 KB bundle is
 * now genuinely below the fold, the hero slot goes to the slider, and the
 * widget is a reward for scrolling rather than a toll gate in front of the
 * menu.
 *
 * Two things still shape how it is loaded:
 *
 * 1. The bundle is ~860 KB (three.js plus the brand font, inlined so the
 *    widget never depends on a font host). It is fetched when the card is
 *    near the viewport AND the page has finished loading AND the browser is
 *    idle — and not at all on a metered or very slow connection, where the
 *    static wash is the whole of it.
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

export function PourModule({ onOrder }: { onOrder?: () => void } = {}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    let cancelled = false;
    let element: HTMLElement | undefined;

    // Keeps the 860 KB off the critical path: wait for the load event, then
    // for an idle moment. Both have hard timeouts so the cup still arrives on
    // a busy page.
    const startWhenIdle = () => {
      const idle = () => {
        const ric = (
          window as unknown as {
            requestIdleCallback?: (
              cb: () => void,
              o?: { timeout: number },
            ) => void;
          }
        ).requestIdleCallback;
        if (ric) ric(() => start(), { timeout: 2000 });
        else window.setTimeout(start, 200);
      };
      if (document.readyState === "complete") idle();
      else window.addEventListener("load", idle, { once: true });
    };

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
          /* The card keeps its wash and its copy; only the cup is missing. */
        });
    };

    // Metered or very slow connection: never fetch it. A 860 KB toy is not
    // worth someone's data plan, and the card still reads as a card without
    // it — copy, wash and CTA are all server-rendered.
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      conn?.saveData === true ||
      conn?.effectiveType === "slow-2g" ||
      conn?.effectiveType === "2g"
    ) {
      return () => {
        cancelled = true;
      };
    }

    // No IntersectionObserver (very old browser, or a JSDOM-ish env): just
    // load it — a working hero beats a clever one.
    if (typeof IntersectionObserver !== "function") {
      startWhenIdle();
      return () => {
        cancelled = true;
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        startWhenIdle();
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

  return (
    <section className="section">
      <div className="wrap">
        <div className="pour-module">
          <div className="pour-module-copy">
            <div className="eyebrow">Küçük bir oyun</div>
            <h2 className="pour-module-title">
              Kupayı çevir, espressoyu kendin dök.
            </h2>
            <p>
              Masada yapılan ritüelin küçük bir provası: kupayı sürükleyerek
              çevir, üstüne dokunup espressoyu boşalt.
            </p>
            {onOrder ? (
              <button
                type="button"
                className="btn btn-outline btn-sm pour-module-cta"
                onClick={onOrder}
              >
                Gerçeğini sipariş et
                <span className="arrow">→</span>
              </button>
            ) : null}
          </div>
          <div className="pour-module-stage-wrap">
            <div className="pour-module-stage" ref={host} />
            {!ready && (
              <div className="pour-module-loading" aria-hidden="true">
                Kupa yükleniyor…
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
