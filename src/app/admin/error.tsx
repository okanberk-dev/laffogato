"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Card, PageHeader } from "@/components/admin/forms";

/**
 * The panel's own error boundary.
 *
 * Without one, every uncaught throw under /admin fell through to the SHOP's
 * boundary: the operator lost the sidebar, was addressed as a customer
 * ("bizimle iletişime geç") and was offered "Menüyü gör" — with no way back
 * to the panel except typing /admin by hand. Every admin page is
 * `force-dynamic` and talks to Postgres on every request, so a connection
 * that stumbles for one second lands here rather than anywhere rare.
 *
 * Rendered INSIDE admin/layout.tsx, so the sidebar stays on screen and the
 * operator is one click from any other page.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Message + digest only: no request body, no member row, nothing personal.
    console.error("[admin-error]", error.message, error.digest);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Panel"
        title="Bu ekran yüklenemedi."
        description="Çoğu zaman veritabanı bağlantısı bir anlık tökezler. Önce tekrar dene; sürerse aşağıdaki kodu not al."
      />
      <Card className="grid gap-4">
        <p className="text-sm text-[var(--admin-text-soft)]">
          Kaydedilmemiş bir form varsa yenilemeden önce içeriğini kopyala —
          tekrar denemek bu ekranı sıfırdan kurar.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--admin-primary)] px-5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)]"
          >
            Tekrar dene
          </button>
          <Link
            href="/admin"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-5 text-sm text-[var(--admin-text-soft)]"
          >
            Panele dön
          </Link>
        </div>
        {error.digest && (
          <p
            className="text-[11px] tracking-[0.12em] text-[var(--admin-text-mute)]"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Hata kodu: {error.digest}
          </p>
        )}
      </Card>
    </main>
  );
}
