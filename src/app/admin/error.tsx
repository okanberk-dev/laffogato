"use client";

import { useEffect } from "react";

import { Card, PageHeader } from "@/components/admin/forms";
import { PanelHomeLink } from "@/components/admin/panel-home";

/**
 * The panel's own error boundary.
 *
 * Without one, every uncaught throw under /admin fell through to the SHOP's
 * boundary: the operator lost the sidebar, was addressed as a customer
 * ("bizimle iletişime geç") and was offered "Menüyü gör" - with no way back
 * to the panel except typing /admin by hand. Every admin page is
 * `force-dynamic` and talks to Postgres on every request, so a connection
 * that stumbles for one second lands here rather than anywhere rare.
 *
 * Rendered INSIDE admin/layout.tsx, so the sidebar stays on screen and the
 * operator is one click from any other page.
 *
 * "Tekrar dene" is `retry` (Next 16.3): it fetches the page again from the
 * server. `reset` only re-rendered what had already failed, so after a
 * database stumble the button showed this same screen again.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Message + digest only: no request body, no member row, nothing personal.
    console.error("[admin-error]", error.message, error.digest);
  }, [error]);

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-3xl">
      <PageHeader
        eyebrow="Panel"
        title="Bu ekran yüklenemedi."
        description="Çoğu zaman veritabanı bağlantısı bir anlık tökezler. Önce tekrar dene; sürerse aşağıdaki kodu not al."
      />
      <Card className="grid gap-4">
        <p className="text-sm text-[var(--admin-text-soft)]">
          Kaydedilmemiş bir form varsa yenilemeden önce içeriğini kopyala -
          tekrar denemek bu ekranı sıfırdan kurar.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--admin-primary)] px-5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] pointer-fine:min-h-9"
          >
            Tekrar dene
          </button>
          <PanelHomeLink className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-5 text-sm text-[var(--admin-text-soft)] pointer-fine:min-h-9">
            Panele dön
          </PanelHomeLink>
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
