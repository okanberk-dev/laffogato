"use client";

import { useEffect } from "react";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import {
  isStaleActionError,
  STALE_ACTION_MESSAGE,
} from "@/components/laffogato/stale-action";
import Link from "@/components/link";

/**
 * Route-segment error boundary. Catches render-time throws from server
 * components / actions - most importantly a database connection or query
 * failure in the data layer - and shows a calm Turkish fallback with a retry
 * instead of a raw 500. `reset()` re-renders the segment (re-runs the data
 * fetch) so a transient DB blip recovers without a full reload.
 *
 * The picture is the 404's mark stopped halfway: the coffee got to the
 * middle of the letters and no further - a pour that was interrupted, not a
 * page that is missing. It sits inside the site's own chrome so the way out
 * is where it always is.
 *
 * One failure gets its own words: a form on a page loaded before a deploy
 * calls an action the new build no longer has (stale-action.ts). "Tekrar
 * dene" would re-render the same old page and fail the same way, so that
 * case offers a full reload instead; the cart is in localStorage and
 * survives it.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to server/client logs; PII-free (message + digest only).
    console.error("[app-error]", error.message, error.digest);
  }, [error]);

  const stale = isStaleActionError(error);

  return (
    <SiteChrome>
      <div className="nf-page">
        <div className="wrap">
          <section className="nf-hero" aria-labelledby="err-title">
            <div className="nf-stage nf-stage--half" aria-hidden="true">
              <span className="nf-glow" />
              <span className="nf-mark">
                <span className="nf-coffee" />
              </span>
            </div>
            <p className="nf-code">
              <span>!</span>{" "}
              {stale ? "Site güncellendi" : "Geçici bir aksaklık"}
            </p>
            {stale ? (
              <>
                <h1 id="err-title" className="nf-title">
                  Sayfa <span className="script">güncellendi</span>
                </h1>
                <p className="nf-lede">{STALE_ACTION_MESSAGE}</p>
                <div className="nf-actions">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="btn btn-primary btn-lg"
                  >
                    Sayfayı yenile
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 id="err-title" className="nf-title">
                  Bir şey <span className="script">yarım kaldı</span>
                </h1>
                <p className="nf-lede">
                  Şu an bağlanamadık - büyük ihtimalle birkaç saniyelik bir şey.
                  Tekrar dener misin? Sorun sürerse bize yazabilirsin.
                </p>
                <div className="nf-actions">
                  <button
                    type="button"
                    onClick={reset}
                    className="btn btn-primary btn-lg"
                  >
                    Tekrar dene
                  </button>
                  <Link href="/" className="btn btn-ghost btn-lg">
                    Anasayfa
                  </Link>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}
