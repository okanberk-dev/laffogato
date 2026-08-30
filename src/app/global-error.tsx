"use client";

import { useEffect } from "react";

/**
 * Root error boundary — catches failures in the root layout itself (where the
 * segment-level error.tsx can't reach). Must render its own <html>/<body>.
 * Inline styles only: globals/fonts may not have loaded when this renders.
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
          fontFamily: "system-ui, sans-serif",
          background: "#f9f8f7",
          color: "#1d1c1c",
          padding: "48px 24px",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Şu an bağlanamadık.</h1>
          <p style={{ marginTop: 16, lineHeight: 1.6, opacity: 0.75 }}>
            Geçici bir aksaklık olabilir. Lütfen birazdan tekrar dene.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "12px 22px",
              borderRadius: 999,
              border: "none",
              background: "#1d1c1c",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
