/**
 * What the settings tabs and their actions share. Client-safe: no
 * "server-only", no database, so the tab forms can import it.
 */

/**
 * A save that needs a second look before it is written: the shop closing,
 * the site leaving search, staff order mail going quiet, a sender Resend
 * will refuse. The action answers with this and writes nothing; the form
 * shows the lines in a dialog and posts again with each key as a
 * `confirmed` value (CONFIRMED_FIELD).
 */
export interface SettingsConfirm {
  keys: string[];
  title: string;
  /** One sentence per consequence. */
  lines: string[];
  submitLabel: string;
}

export interface SettingsState {
  message?: string;
  error?: string;
  /** A form field's `name` to its message, shown under that field. */
  fieldErrors?: Record<string, string>;
  /** Nothing was written: the operator has to confirm first. */
  confirm?: SettingsConfirm;
}

/** The form field a confirmed save carries, once per confirmed key. */
export const CONFIRMED_FIELD = "confirmed";

export const SETTINGS_TABS = [
  { id: "general", label: "Genel" },
  { id: "hours", label: "Saatler" },
  { id: "tax", label: "Vergi" },
  { id: "shipping", label: "Kargo" },
  { id: "karaoke", label: "Karaoke" },
  { id: "seo", label: "SEO" },
  { id: "notifications", label: "Bildirim" },
  { id: "email", label: "E-posta" },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

/**
 * The URL parameter that opens a tab: /admin/ayarlar?sekme=email. The
 * same word the karaoke panel uses for its tabs.
 */
export const SETTINGS_TAB_PARAM = "sekme";

const TAB_IDS = new Set<string>(SETTINGS_TABS.map((t) => t.id));

/**
 * `?sekme=` to a tab; anything unknown opens Genel. An audit row's entity
 * id is a tab id too, except the test mail's ("email-test"), which belongs
 * to E-posta.
 */
export function parseSettingsTab(raw: unknown): SettingsTabId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "email-test") return "email";
  return TAB_IDS.has(text) ? (text as SettingsTabId) : "general";
}

/** The address of a tab; Genel is the bare page. */
export function settingsTabHref(tab: SettingsTabId): string {
  return tab === "general"
    ? "/admin/ayarlar"
    : `/admin/ayarlar?${SETTINGS_TAB_PARAM}=${tab}`;
}

/**
 * Keyboard movement in the tab list (WAI-ARIA tabs): the arrows step to
 * the next or previous tab and wrap, Home and End jump to the ends. Up and
 * Down work too, since the list stands vertical on a wide screen. Null
 * for any other key.
 */
export function tabAfterKey(
  current: SettingsTabId,
  key: string,
): SettingsTabId | null {
  const ids = SETTINGS_TABS.map((t) => t.id);
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

/**
 * A form's content as one comparable string, for "has anything changed
 * since it was saved". Order-sensitive on purpose (a form's fields come
 * out in document order every time); the `confirmed` values a dialog adds
 * are not content.
 */
export function formSnapshot(
  entries: Iterable<[string, FormDataEntryValue]>,
): string {
  const out: [string, string][] = [];
  for (const [name, value] of entries) {
    if (name === CONFIRMED_FIELD) continue;
    out.push([name, typeof value === "string" ? value : value.name]);
  }
  return JSON.stringify(out);
}

/** The part of a form control `defaultsSnapshot` reads. */
export interface DefaultsControl {
  tagName: string;
  name: string;
  type?: string;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  defaultChecked?: boolean;
  multiple?: boolean;
  options?: ArrayLike<{ value: string; defaultSelected: boolean }>;
}

/**
 * The snapshot the form would post as it was rendered: each control's
 * default (`defaultValue`, `defaultChecked`, `defaultSelected`), in the
 * order and shape FormData uses (an unticked box sends nothing, buttons and
 * disabled controls send nothing). That is the saved state "unsaved
 * changes" is measured against, with no snapshot taken on load.
 */
export function defaultsSnapshot(controls: Iterable<DefaultsControl>): string {
  const out: [string, string][] = [];
  for (const el of controls) {
    if (!el.name || el.disabled) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.type ?? "").toLowerCase();
    if (tag === "button" || tag === "fieldset" || tag === "output") continue;
    if (tag === "input") {
      if (["submit", "button", "reset", "image", "file"].includes(type)) {
        continue;
      }
      if (type === "checkbox" || type === "radio") {
        if (el.defaultChecked) out.push([el.name, el.value || "on"]);
        continue;
      }
    }
    if (tag === "select") {
      const options = Array.from(el.options ?? []);
      const chosen = options.filter((o) => o.defaultSelected);
      const picked =
        chosen.length > 0 || el.multiple ? chosen : options.slice(0, 1);
      for (const o of picked) out.push([el.name, o.value]);
      continue;
    }
    out.push([el.name, el.defaultValue ?? ""]);
  }
  return formSnapshot(out);
}

/** Longest values Genel keeps; the form's maxLength and the action agree. */
export const GENERAL_LIMITS = {
  name: 80,
  tagline: 160,
  phone: 40,
  email: 254,
  address: 500,
  heroImageUrl: 2000,
} as const;
