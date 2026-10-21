// Client-safe (no server-only): the one-shot "flash" a redirecting admin
// action leaves for the next page. The server half (set / read) is
// lib/admin/flash.ts; the toast that shows it is components/admin/ui/toast.tsx.
//
// Why a cookie and not `?msg=`: a message in the URL survives a reload, a
// bookmark and a link pasted into WhatsApp, and anyone can write one. The
// cookie lives a minute, only under /admin, and the panel deletes it the
// moment the toast is on screen.

export const ADMIN_FLASH_COOKIE = "adm_flash";
/** Seconds. Long enough for a redirect, short enough to never resurface. */
export const ADMIN_FLASH_MAX_AGE = 60;
export const ADMIN_FLASH_PATH = "/admin";
/** Longest message kept; a cookie is not the place for a paragraph. */
export const ADMIN_FLASH_MAX_MESSAGE = 300;

export type AdminFlashTone = "success" | "info" | "warning" | "danger";

export interface AdminFlash {
  /** Unique per flash, so a layout rendered twice shows it once. */
  id: string;
  message: string;
  tone: AdminFlashTone;
}

const TONES: readonly AdminFlashTone[] = [
  "success",
  "info",
  "warning",
  "danger",
];

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * The cookie value: base64url of a small JSON. base64url, so the value is
 * cookie-safe as is and no layer's percent-encoding can change it.
 */
export function encodeFlash(flash: AdminFlash): string {
  return toBase64Url(
    JSON.stringify({
      i: flash.id,
      m: flash.message.slice(0, ADMIN_FLASH_MAX_MESSAGE),
      t: flash.tone,
    }),
  );
}

/** The flash in a cookie value, or null for a missing or tampered one. */
export function decodeFlash(
  value: string | null | undefined,
): AdminFlash | null {
  if (!value || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value));
    if (!parsed || typeof parsed !== "object") return null;
    const { i, m, t } = parsed as Record<string, unknown>;
    if (typeof i !== "string" || !i || i.length > 64) return null;
    if (typeof m !== "string" || !m.trim()) return null;
    const tone = TONES.includes(t as AdminFlashTone)
      ? (t as AdminFlashTone)
      : "info";
    return {
      id: i,
      message: m.slice(0, ADMIN_FLASH_MAX_MESSAGE),
      tone,
    };
  } catch {
    return null;
  }
}

/**
 * `document.cookie` assignment that deletes the flash. Same name and path
 * as the one the server set, or the browser keeps it.
 */
export function clearFlashCookieString(): string {
  return `${ADMIN_FLASH_COOKIE}=; Path=${ADMIN_FLASH_PATH}; Max-Age=0; SameSite=Lax`;
}
