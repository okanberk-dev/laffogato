import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IdentityKeyStatus } from "@/app/admin/ayarlar/identity-status";
import { PanelLinkStatus } from "@/app/admin/ayarlar/panel-link-status";
import {
  KeepaliveStatusRow,
  SystemStatus,
} from "@/app/admin/ayarlar/system-status";
import {
  keepaliveView,
  type KeepaliveRead,
} from "@/lib/admin/supabase-keepalive-core";

/**
 * Ayarlar → Sistem durumu (operator, 21 Oct 2026: "ekteki kısımlar da
 * gözükmesin orda"). The Supabase keep-alive line left Genel bakış, where
 * it stood on every visit, for this card beside the service-key line. It is
 * closed while all is well and opens by itself when a row needs someone:
 * the dashboard keeps the line for a warning only
 * (tests/admin-dashboard.test.ts).
 */

const NOW = new Date("2026-10-21T10:00:00.000Z");

const read = (record: {
  lastStatus: "ok" | "failed" | "skipped";
  lastAttemptAt: string;
  lastSuccessAt: string;
}): KeepaliveRead => ({ kind: "record", record }) as KeepaliveRead;

function card(
  hasKey: boolean,
  keepalive: KeepaliveRead | null,
  panelUrl: string | null = "https://ladmin.laffogato.net",
) {
  const ping = keepalive ? keepaliveView(keepalive, NOW) : null;
  return renderToStaticMarkup(
    createElement(
      // Children go positionally (react/no-children-prop); the cast lets
      // TypeScript take them that way.
      SystemStatus as never,
      { attention: !hasKey || !panelUrl || ping?.tone === "warning" },
      createElement(IdentityKeyStatus, { hasKey }),
      createElement(PanelLinkStatus, { panelUrl }),
      ping ? createElement(KeepaliveStatusRow, { view: ping }) : null,
    ),
  );
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\s+/g, " ");

describe("Sistem durumu", () => {
  it("stays closed and says all is well while the key is set and the ping gets through", () => {
    const html = card(
      true,
      read({
        lastStatus: "ok",
        lastAttemptAt: "2026-10-21T06:24:00.000Z",
        lastSuccessAt: "2026-10-21T06:24:00.000Z",
      }),
    );
    expect(html).toMatch(/<details data-testid="system-status"(?![^>]*\sopen)/);
    expect(text(html)).toContain("Sistem durumu");
    expect(text(html)).toContain("Her şey yolunda");
    expect(text(html)).toContain(
      "Supabase uyanık tutma: son başarılı ping 21 Eki 2026 09:24.",
    );
    expect(html).toContain('data-testid="supabase-keepalive-status"');
    expect(html).toMatch(
      /data-testid="supabase-keepalive-status" data-state="fresh" data-tone="success"/,
    );
    expect(text(html)).not.toContain("7 gün sessiz kalırsa");
  });

  it("opens by itself and says why when the ping failed", () => {
    const html = card(
      true,
      read({
        lastStatus: "failed",
        lastAttemptAt: "2026-10-21T06:00:00.000Z",
        lastSuccessAt: "2026-10-19T06:00:00.000Z",
      }),
    );
    expect(html).toMatch(/<details open=""[^>]*data-testid="system-status"/);
    expect(text(html)).toContain("Dikkat istiyor");
    expect(text(html)).toContain("son deneme başarısız");
    expect(text(html)).toContain("7 gün sessiz kalırsa duraklar");
    expect(html).toContain('data-tone="warning"');
  });

  it("opens by itself when the service key is missing", () => {
    const html = card(false, null);
    expect(html).toContain('open=""');
    expect(text(html)).toContain("Supabase servis anahtarı: tanımlı değil");
    expect(html).toContain('data-tone="danger"');
  });

  it("links to the köşk's panel while the link is on", () => {
    const html = card(true, null);
    expect(html).not.toContain('open=""');
    expect(text(html)).toContain(
      "Köşk paneli bağlantısı: açık - karaoke, menü fiyatları, bar ekranındaki siparişler ve online satış ladmin.laffogato.net ile eşitleniyor.",
    );
    expect(html).toContain(
      '<a href="https://ladmin.laffogato.net" target="_blank" rel="noopener noreferrer"',
    );
    expect(html).toMatch(
      /data-testid="panel-link-status" data-state="on" data-tone="success"/,
    );
  });

  it("opens by itself when the link to the köşk's panel is off", () => {
    const html = card(true, null, null);
    expect(html).toContain('open=""');
    expect(text(html)).toContain("Köşk paneli bağlantısı: kapalı");
    expect(text(html)).toContain("KARAOKE_SYNC_SECRET");
    expect(html).toMatch(
      /data-testid="panel-link-status" data-state="off" data-tone="warning"/,
    );
    expect(html).not.toContain("<a ");
  });

  it("says plainly that nothing is recorded yet, in grey", () => {
    const html = card(true, { kind: "none", since: "" } as KeepaliveRead);
    expect(text(html)).toContain("Supabase uyanık tutma: henüz kayıt yok");
    expect(html).toContain('data-state="none" data-tone="neutral"');
    expect(html).not.toContain('open=""');
  });

  it("is wired on Ayarlar behind the same role gate as the dashboard", () => {
    const page = readFileSync("src/app/admin/ayarlar/page.tsx", "utf8");
    expect(page).toContain(
      "readKeepaliveFor(session.role, loadSupabaseKeepalive)",
    );
    expect(page).toContain("<SystemStatus");
    expect(page).toContain("<KeepaliveStatusRow");
    expect(page).toContain("<IdentityKeyStatus");
    expect(page).toContain("const panelUrl = panelLinkUrl();");
    expect(page).toContain("<PanelLinkStatus panelUrl={panelUrl} />");
  });

  it("leaves the dashboard without the 2FA nag", () => {
    const page = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(page).not.toContain("has2FA");
    expect(page).not.toContain("İki adımlı doğrulama kapalı");
    expect(page).toContain('keepaliveAlarm?.tone === "warning"');
  });
});
