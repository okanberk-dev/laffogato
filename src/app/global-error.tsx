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
 * /brand files may not have loaded when this renders. The colours are the
 * porcelain palette's own (globals.css :root), spelled out.
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
          placeItems: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          background: "#f6f6f3",
          color: "#000000",
          padding: "48px 24px",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <svg
            viewBox={`0 0 ${LAF_VIEWBOX.width} ${LAF_VIEWBOX.height}`}
            width={132}
            height={Math.round((132 * LAF_VIEWBOX.height) / LAF_VIEWBOX.width)}
            role="img"
            aria-label="L'Affogato"
            style={{ margin: "0 auto 28px", display: "block" }}
          >
            <path fillRule="evenodd" fill="#000000" d={LAF_LETTERS_PATH} />
            <path fillRule="evenodd" fill="#b8893a" d={LAF_BEAN_PATH} />
          </svg>
          <h1
            style={{
              fontSize: 24,
              lineHeight: 1.3,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              fontWeight: 400,
              margin: 0,
            }}
          >
            Şu an bağlanamadık
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 16,
              lineHeight: 1.6,
              color: "#6c6864",
            }}
          >
            Geçici bir aksaklık olabilir. Lütfen birazdan tekrar dene.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 26,
              minHeight: 48,
              minWidth: 280,
              padding: "0 36px",
              borderRadius: 0,
              border: "1px solid #333333",
              background: "#333333",
              color: "#ffffff",
              fontSize: 16,
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
