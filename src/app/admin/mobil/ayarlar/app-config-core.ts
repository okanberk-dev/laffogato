/**
 * What the Uygulama ayarları tabs and their actions share. Client-safe: no
 * "server-only", no database, so the tab forms can import it (and the
 * actions file, a "use server" module, may export nothing but actions).
 */

import { compareSemver, type MobileAppConfig } from "@/lib/mobile/app-config";

/**
 * A save that needs a second look before it is written: the whole app
 * going into maintenance, or the minimum version going up (every older
 * install then stops at the forced-update screen). The action answers with
 * this and writes nothing; the form shows the lines in a dialog and posts
 * again with each key as a `confirmed` value (CONFIRMED_FIELD).
 */
export interface AppConfigConfirm {
  keys: string[];
  title: string;
  /** One sentence per consequence. */
  lines: string[];
  submitLabel: string;
  /** Typed back before the yes button opens (the new version). */
  phrase?: string;
}

export interface AppConfigState {
  message?: string;
  error?: string;
  /** A form field's `name` to its message, shown under that field. */
  fieldErrors?: Record<string, string>;
  /** Nothing was written: the operator has to confirm first. */
  confirm?: AppConfigConfirm;
}

/** The form field a confirmed save carries, once per confirmed key. */
export const CONFIRMED_FIELD = "confirmed";

export const APP_CONFIG_TABS = [
  { id: "version", label: "Sürüm ve bakım" },
  { id: "ordering", label: "Sipariş" },
  { id: "loyalty", label: "Sadakat" },
  { id: "karaoke", label: "Karaoke kuralları" },
  { id: "reminders", label: "Hatırlatmalar" },
  { id: "cards", label: "Kampanya kartları" },
  { id: "sections", label: "Uygulama bölümleri" },
  { id: "happy", label: "Mutlu saatler" },
  { id: "venue", label: "Köşk bilgileri" },
  { id: "store", label: "Mağaza ve bağlantılar" },
] as const;

export type AppConfigTabId = (typeof APP_CONFIG_TABS)[number]["id"];

/** /admin/mobil/ayarlar?bolum=store opens "Mağaza ve bağlantılar". */
export const APP_CONFIG_TAB_PARAM = "bolum";

const APP_CONFIG_PATH = "/admin/mobil/ayarlar";
const TAB_IDS = new Set<string>(APP_CONFIG_TABS.map((t) => t.id));

/** `?bolum=` to a tab; anything unknown opens "Sürüm ve bakım". */
export function parseAppConfigTab(raw: unknown): AppConfigTabId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return TAB_IDS.has(text) ? (text as AppConfigTabId) : "version";
}

/** The address of a tab; the first one is the bare page. */
export function appConfigTabHref(tab: AppConfigTabId): string {
  return tab === "version"
    ? APP_CONFIG_PATH
    : `${APP_CONFIG_PATH}?${APP_CONFIG_TAB_PARAM}=${tab}`;
}

/**
 * Keyboard movement in the tab list (WAI-ARIA tabs): the arrows step and
 * wrap, Home and End jump to the ends. Up and Down too, since the list
 * stands vertical on a wide screen. Null for any other key.
 */
export function tabAfterKey(
  current: AppConfigTabId,
  key: string,
): AppConfigTabId | null {
  const ids = APP_CONFIG_TABS.map((t) => t.id);
  const at = ids.indexOf(current);
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return ids[(at + 1) % ids.length];
    case "ArrowLeft":
    case "ArrowUp":
      return ids[(at - 1 + ids.length) % ids.length];
    case "Home":
      return ids[0];
    case "End":
      return ids[ids.length - 1];
    default:
      return null;
  }
}

/** The confirm key of a version raise: it holds only for that version. */
export function versionConfirmKey(version: string): string {
  return `version:${version}`;
}

/**
 * The question a "Sürüm ve bakım" save has to ask first, or null.
 *
 * Asked when maintenance goes from off to on (every screen of the app
 * closes) or the minimum version goes up (every older install stops at the
 * forced-update screen, and without a store address that screen has no way
 * out). Measured against the saved document, not the form's defaults, so a
 * colleague's save in between is what counts. A confirmation for a version
 * holds for that version only. Pure, exported for tests.
 */
export function versionGateConfirm(
  current: MobileAppConfig,
  next: {
    minSupportedAppVersion: string;
    maintenance: { enabled: boolean; title: string };
  },
  confirmed: readonly string[],
): AppConfigConfirm | null {
  const turningOn = next.maintenance.enabled && !current.maintenance.enabled;
  const from = current.minSupportedAppVersion;
  const to = next.minSupportedAppVersion;
  const raising = compareSemver(to, from) > 0;
  const keys: string[] = [];
  if (turningOn) keys.push("maintenance");
  if (raising) keys.push(versionConfirmKey(to));
  if (keys.every((k) => confirmed.includes(k))) return null;

  const lines: string[] = [];
  if (turningOn) {
    lines.push(
      `Kaydedince uygulamanın bütün ekranları kapanır; üyeler yalnız “${next.maintenance.title}” bakım kartını görür. Telefonlara en geç 5 dakikada ulaşır.`,
      "Bakımı bitirmek için kutuyu kaldırıp yeniden kaydet.",
    );
  }
  if (raising) {
    lines.push(
      `${to} sürümünden eski her kurulum açılışta zorunlu güncelleme ekranında kalır; o üyeler uygulamayı güncellemeden kullanamaz.`,
    );
    const missing = [
      current.store.appStoreUrl ? null : "App Store",
      current.store.playStoreUrl ? null : "Google Play",
    ].filter(Boolean);
    lines.push(
      missing.length === 0
        ? "Ekrandaki düğme mağazadaki sayfaya gider."
        : `${missing.join(" ve ")} adresi boş: o telefonlarda ekranda mağazaya giden düğme yok, üye çıkış yolu bulamaz. Önce “Mağaza ve bağlantılar” bölümünü doldur.`,
    );
  }

  if (turningOn && raising) {
    return {
      keys,
      title: `Uygulama bakıma alınsın ve en düşük sürüm ${to} olsun mu?`,
      lines,
      submitLabel: "Onayla ve kaydet",
      phrase: to,
    };
  }
  if (turningOn) {
    return {
      keys,
      title: "Uygulama bakıma alınsın mı?",
      lines,
      submitLabel: "Bakıma al",
    };
  }
  return {
    keys,
    title: `En düşük sürüm ${from} yerine ${to} olsun mu?`,
    lines,
    submitLabel: "Sürümü yükselt",
    phrase: to,
  };
}
