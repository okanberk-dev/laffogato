import { StatusRow } from "./system-status";

/**
 * Whether this deployment is linked to the köşk's panel
 * (ladmin.laffogato.net): the karaoke board, the menu's prices, the bar
 * screen's orders and the online sales all ride on one shared secret
 * (`KARAOKE_SYNC_SECRET`, docs/PANEL-KARAOKE.md). Without it every one of
 * them stops and the site says nothing - the only place to check was the
 * Vercel dashboard. A row of Sistem durumu (./system-status.tsx), which
 * opens by itself when the link is off; with it on, the row is the way
 * from this panel to that one.
 *
 * Presence only: the page hands over the panel's address, never the secret.
 */
export function PanelLinkStatus({ panelUrl }: { panelUrl: string | null }) {
  if (!panelUrl) {
    return (
      <StatusRow tone="warning" testId="panel-link-status" state="off">
        <strong className="font-medium text-[var(--admin-text)]">
          Köşk paneli bağlantısı: kapalı
        </strong>{" "}
        - köşkün paneli karaoke rezervasyonlarını, menü fiyatlarını, uygulamadan
        gelen siparişleri ve online satışı görmüyor. Geliştiriciye ilet:
        Vercel&apos;de iki projeye de aynı <code>KARAOKE_SYNC_SECRET</code> (en
        az 32 karakter) tanımlanıp ikisi de yeniden yayına alınmalı.
      </StatusRow>
    );
  }
  const host = new URL(panelUrl).host;
  return (
    <StatusRow tone="success" testId="panel-link-status" state="on">
      <strong className="font-medium text-[var(--admin-text)]">
        Köşk paneli bağlantısı: açık
      </strong>{" "}
      - karaoke, menü fiyatları, bar ekranındaki siparişler ve online satış{" "}
      <a
        href={panelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--admin-text)] underline underline-offset-2"
      >
        {host}
      </a>{" "}
      ile eşitleniyor.
    </StatusRow>
  );
}
