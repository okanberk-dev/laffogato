"use client";

import { useEffect } from "react";

import {
  LAF_BEAN_PATH,
  LAF_LETTERS_PATH,
  LAF_VIEWBOX,
} from "@/components/laffogato/laf-paths";

/**
 * Root error boundary - catches failures in the root layout itself (where the
 * segment-level error.tsx can't reach). Must render its own <html>/<body>.
 * Inline styles and an inline mark only: globals.css, the fonts and the
 * /brand files may not have loaded when this renders. It is error.tsx's
 * stage on its own: the band (--band), black type, the line in tracked
 * capitals at 400, the sentence in --muted (5.1:1 on the band) and a filled
 * charcoal 48px button. The values are src/styles/foundation.css's, spelled
 * out.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.message, error.digest);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          alignItems: "end",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          background: "#f6f6f3",
          color: "#000000",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main
          style={{
            boxSizing: "border-box",
            width: "100%",
            maxWidth: 720,
            padding: "64px clamp(20px, 4.2vw, 60px)",
          }}
        >
          <svg
            viewBox={`0 0 ${LAF_VIEWBOX.width} ${LAF_VIEWBOX.height}`}
            width={96}
            height={Math.round((96 * LAF_VIEWBOX.height) / LAF_VIEWBOX.width)}
            role="img"
            aria-label="L'Affogato"
            style={{ display: "block", marginBottom: 40 }}
          >
            <path fillRule="evenodd" fill="#000000" d={LAF_LETTERS_PATH} />
            <path fillRule="evenodd" fill="#b8893a" d={LAF_BEAN_PATH} />
          </svg>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: "24px",
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color: "#6c6864",
            }}
          >
            Geçici bir aksaklık
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(28px, 4.6vw, 48px)",
              lineHeight: 1.15,
              letterSpacing: "2px",
              textTransform: "uppercase",
              fontWeight: 400,
            }}
          >
            Şu an bağlanamadık
          </h1>
          <p
            style={{
              margin: "20px 0 0",
              maxWidth: "46ch",
              fontSize: 16,
              lineHeight: "22px",
              color: "#6c6864",
            }}
          >
            Büyük ihtimalle birkaç saniyelik bir şey. Lütfen birazdan tekrar
            dene.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              minHeight: 48,
              width: "min(350px, 100%)",
              padding: "12px 36px",
              borderRadius: 0,
              border: "1px solid #333333",
              background: "#333333",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: 16,
              lineHeight: "22px",
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
