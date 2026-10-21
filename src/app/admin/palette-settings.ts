/**
 * The palette's "Ayarlar içinde" (admin UI v2, UI-12, design §4.2 item 4):
 * deep links into the settings tabs, built on the server from the tab lists
 * the two settings pages already own, so a tab added there cannot be
 * forgotten here (the Records below must name every id, or typecheck
 * fails). The layout hands the result to the palette as plain data: the
 * palette's chunk is at its 45 KB budget and has no code for this, only the
 * list it already draws and ranks. No Server Action, no database, no
 * "server-only": the tests import it.
 *
 * Gated by the section each page asks for (`settings`: owner only; the
 * app's `mobileApp`: owner and manager), so a manager is never offered the
 * site settings and Personel and the cashier get nothing.
 */

import type { PaletteEntry } from "@/lib/admin/palette-shell";
import { canAccess, type AdminRole } from "@/lib/admin/roles";

import {
  SETTINGS_TAB_PARAM,
  SETTINGS_TABS,
  type SettingsTabId,
} from "./ayarlar/settings-core";
import {
  APP_CONFIG_TABS,
  appConfigTabHref,
  type AppConfigTabId,
} from "./mobil/ayarlar/app-config-core";

/**
 * The site settings tabs as the operator says them (not the tab's own
 * short name: "Vergi" is where KDV is), each with the words its fields
 * use. The page's own tab label rides along as the hint.
 */
const SITE_PAGES: Record<
  SettingsTabId,
  { label: string; keywords: readonly string[] }
> = {
  general: {
    label: "Genel bilgiler",
    keywords: ["kafe adı", "slogan", "telefon", "adres", "mağaza durumu"],
  },
  hours: {
    label: "Çalışma saatleri",
    keywords: ["haftalık saatler", "açılış", "kapanış", "kapalı gün"],
  },
  tax: {
    label: "KDV",
    keywords: ["vergi", "KDV oranları", "menü fiyat listesi", "fiyat tarihi"],
  },
  shipping: {
    label: "Kargo ücreti",
    keywords: ["kargo ve kurye", "ücretsiz kargo", "kurye ücreti", "gel-al"],
  },
  karaoke: {
    label: "Karaoke ücreti ve ön ödeme",
    keywords: ["saatlik ücret", "kapasite", "iptal", "iade", "ön ödeme"],
  },
  seo: {
    label: "SEO",
    keywords: ["arama motoru", "ana sayfa başlığı", "paylaşım görseli"],
  },
  notifications: {
    label: "Sipariş bildirimi e-postası",
    keywords: [
      "bildirim",
      "operasyon e-postası",
      "yeni sipariş",
      "alacak roller",
    ],
  },
  email: {
    label: "E-posta gönderen",
    keywords: [
      "gönderen adı",
      "gönderen adresi",
      "yanıt adresi",
      "test e-postası",
    ],
  },
};

/**
 * What each Uygulama ayarları tab holds. The first tab is the page itself,
 * so it is the "Uygulama ayarları" entry and carries "Bakım modu" (the
 * app's switch lives there, not in the site's Genel tab).
 */
const APP_KEYWORDS: Record<AppConfigTabId, readonly string[]> = {
  version: [
    "Sürüm ve bakım",
    "Bakım modu",
    "en düşük sürüm",
    "zorunlu güncelleme",
  ],
  ordering: ["kanallar", "kurye süresi", "gel-al", "masaya sipariş"],
  loyalty: ["damga hedefi", "ödül", "kupon geçerlilik"],
  karaoke: ["ilk saat", "kapanış saati", "rezervasyon penceresi", "ruby"],
  reminders: ["hatırlatma", "bildirim saati"],
  cards: ["sadakat kartı", "davet kartı", "kampanya"],
  happy: ["mutlu saat", "happy hour", "indirim oranı"],
  venue: ["köşk", "kısa ad", "yer tarifi", "harita"],
  store: ["app store", "google play", "derin bağlantı", "paket adı"],
};

const APP_NAME = "Uygulama ayarları";

/** The role's "Ayarlar içinde" entries: site tabs, then the app's. */
export function settingsPaletteEntries(
  role: AdminRole | null | undefined,
): PaletteEntry[] {
  if (!role) return [];
  const out: PaletteEntry[] = [];
  if (canAccess("settings", role)) {
    for (const tab of SETTINGS_TABS) {
      const page = SITE_PAGES[tab.id];
      const href = `/admin/ayarlar?${SETTINGS_TAB_PARAM}=${tab.id}`;
      out.push({
        id: `set:${href}`,
        label: page.label,
        hint: `Ayarlar · ${tab.label}`,
        href,
        keywords: page.keywords,
      });
    }
  }
  if (canAccess("mobileApp", role)) {
    for (const tab of APP_CONFIG_TABS) {
      const href = appConfigTabHref(tab.id);
      const root = tab.id === "version";
      out.push({
        id: `set:${href}`,
        label: root ? APP_NAME : tab.label,
        hint: root ? "Ayarlar" : APP_NAME,
        href,
        keywords: APP_KEYWORDS[tab.id],
      });
    }
  }
  return out;
}
