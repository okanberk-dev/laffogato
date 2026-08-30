"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-segment error boundary. Catches render-time throws from server
 * components / actions — most importantly a database connection or query
 * failure in the data layer — and shows a calm Turkish fallback with a retry
 * instead of a raw 500. `reset()` re-renders the segment (re-runs the data
 * fetch) so a transient DB blip recovers without a full reload.
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

  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 24px",
        background: "var(--bg-warm, #f9f8f7)",
        color: "var(--ink, #1d1c1c)",
      }}
    >
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--mono, monospace)",
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: 0.55,
            marginBottom: 16,
          }}
        >
          Bir şeyler ters gitti
        </div>
        <h1
          style={{
            fontFamily: "var(--serif, 'Playfair Display', serif)",
            fontSize: 34,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Şu an bağlanamadık.
        </h1>
        <p style={{ marginTop: 18, lineHeight: 1.6, opacity: 0.75 }}>
          Geçici bir aksaklık olabilir. Birazdan tekrar dener misin? Sorun
          sürerse bizimle iletişime geçebilirsin.
        </p>
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={reset}
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              background: "var(--ink, #1d1c1c)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Tekrar dene
          </button>
          <Link
            href="/"
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              border: "1px solid var(--ink-line, #e1e5e0)",
              color: "var(--ink, #1d1c1c)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </main>
  );
}
