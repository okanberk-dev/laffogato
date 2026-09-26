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
          background:
            "radial-gradient(60% 50% at 50% 38%, rgba(253, 175, 109, 0.22) 0%, rgba(253, 175, 109, 0) 70%), #f7f3ed",
          color: "#211c18",
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
            <path fillRule="evenodd" fill="#211c18" d={LAF_LETTERS_PATH} />
            <path fillRule="evenodd" fill="#b08a2e" d={LAF_BEAN_PATH} />
          </svg>
          <h1
            style={{
              fontSize: 32,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Şu an bağlanamadık.
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 16,
              lineHeight: 1.6,
              color: "#564d46",
            }}
          >
            Geçici bir aksaklık olabilir. Lütfen birazdan tekrar dene.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 26,
              minHeight: 48,
              padding: "0 26px",
              borderRadius: 999,
              border: "none",
              background: "#1d6d56",
              color: "#fbf8f4",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(59, 42, 30, 0.1)",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
