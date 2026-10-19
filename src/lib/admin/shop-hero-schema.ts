// The shop hero slide form (/admin/magaza-hero), read and checked. NO
// "server-only" and no database: the action and the tests share it, and the
// client form reads the limits below.
//
// The form used to go straight to the store: a blank title was dropped
// without a word on create and saved as "" on an edit (the shop then drew a
// grey "Başlık"), and the photo address and the button link were any text.
// An address with a space, a quote or a bracket showed no photo, and one
// ending in `);position:fixed;...;(` added its own declarations to the shop
// hero's style attribute (admin audit CAT-13, CAT-27).

import type { ShopHeroSlideInput } from "@/lib/admin/store";
import { sameSitePath } from "@/lib/http/same-site-path";

/** The panel's lengths; the store clamps to the same numbers. */
export const SHOP_HERO_LIMITS = {
  title: 120,
  subtitle: 300,
  ctaLabel: 40,
  ctaHref: 200,
  /** An https photo address. */
  imageUrl: 500,
  /** An uploaded photo: the store keeps at most 4 MB of data URL. */
  imageData: 4 * 1024 * 1024,
  sortOrder: 999,
} as const;

/** What the slide form's uploader produces (canvas JPEG), or a pasted one. */
const DATA_IMAGE =
  /^data:image\/(jpeg|png|webp|gif|avif);base64,[A-Za-z0-9+/]+=*$/;

/** A same-page anchor on /magaza, e.g. the seed's "#products". */
const ANCHOR = /^#[A-Za-z][\w-]{0,63}$/;

/**
 * An absolute https address written so that nothing in it can end a CSS
 * `url()` or an HTML attribute early: the URL parser percent-encodes spaces
 * and double quotes, and the three characters it keeps in a path (the
 * brackets and the apostrophe) are encoded here. A server reads `%28` as
 * `(`, so the photo still loads. Null when it is not https, has no host or
 * carries a user name or password.
 */
function httpsAddress(raw: string, max: number): string | null {
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname) return null;
  if (url.username || url.password) return null;
  const out = url.href.replace(
    /[()']/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return out.length <= max ? out : null;
}

/**
 * The slide's photo as it may be stored, or a refusal. Empty is allowed:
 * the shop then draws the theme's gradient.
 */
export function shopHeroImage(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, value: "" };
  if (value.startsWith("data:")) {
    if (!DATA_IMAGE.test(value)) {
      return {
        ok: false,
        error: "Bu görsel kaydedilemiyor: JPG, PNG ya da WebP yükle.",
      };
    }
    if (value.length > SHOP_HERO_LIMITS.imageData) {
      return {
        ok: false,
        error: "Görsel 4 MB'tan büyük: daha küçük bir dosya seç.",
      };
    }
    return { ok: true, value };
  }
  if (/^http:\/\//i.test(value)) {
    return { ok: false, error: "Görsel bağlantısı https:// ile başlamalı." };
  }
  const address = httpsAddress(value, SHOP_HERO_LIMITS.imageUrl);
  if (!address) {
    return {
      ok: false,
      error: `Görsel bağlantısı https:// ile başlayan, en çok ${SHOP_HERO_LIMITS.imageUrl} karakterlik bir adres olmalı.`,
    };
  }
  return { ok: true, value: address };
}

/**
 * Where the slide's button may go: a path on this site, an anchor on the
 * shop page or an https address. Null for anything else (`javascript:`,
 * `http:`, a protocol-relative `//host`, a bare word).
 */
export function shopHeroCtaHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > SHOP_HERO_LIMITS.ctaHref) return null;
  if (value.startsWith("#")) return ANCHOR.test(value) ? value : null;
  if (value.startsWith("/")) {
    const path = sameSitePath(value);
    return path && !/\s/.test(path) ? path : null;
  }
  return httpsAddress(value, SHOP_HERO_LIMITS.ctaHref);
}

export type ShopHeroFormResult =
  | { ok: true; input: ShopHeroSlideInput }
  | { ok: false; fieldErrors: Record<string, string> };

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
};

/**
 * Reads and checks the slide form. Every refusal names its field, in the
 * form's own field names, so ActionForm puts it under what has to change.
 * Nothing is written on a refusal.
 */
export function parseShopHeroForm(formData: FormData): ShopHeroFormResult {
  const errors: Record<string, string> = {};
  const L = SHOP_HERO_LIMITS;

  const title = text(formData, "title");
  if (!title) errors.title = "Slaytın başlığını yaz.";
  else if (title.length > L.title) {
    errors.title = `Başlık en fazla ${L.title} karakter olabilir.`;
  }

  const subtitle = text(formData, "subtitle");
  if (subtitle.length > L.subtitle) {
    errors.subtitle = `Alt başlık en fazla ${L.subtitle} karakter olabilir.`;
  }

  const image = shopHeroImage(text(formData, "imageUrl"));
  if (!image.ok) errors.imageUrl = image.error;

  // The shop draws the button only with both its text and its link, so
  // one without the other would be saved and never seen.
  const ctaLabel = text(formData, "ctaLabel");
  const ctaRaw = text(formData, "ctaHref");
  let ctaHref = "";
  if (ctaLabel.length > L.ctaLabel) {
    errors.ctaLabel = `Düğme yazısı en fazla ${L.ctaLabel} karakter olabilir.`;
  } else if (ctaLabel && !ctaRaw) {
    errors.ctaHref = "Düğmenin bağlantısını yaz ya da yazısını sil.";
  } else if (!ctaLabel && ctaRaw) {
    errors.ctaLabel = "Düğmenin yazısını yaz ya da bağlantısını sil.";
  }
  if (ctaRaw && !errors.ctaHref) {
    const safe = shopHeroCtaHref(ctaRaw);
    if (safe) ctaHref = safe;
    else {
      errors.ctaHref =
        "Bağlantı sitedeki bir yol (örn. /magaza), sayfadaki bir bölüm (örn. #products) ya da https:// ile başlayan bir adres olmalı.";
    }
  }

  const theme = text(formData, "textTheme") || "light";
  if (theme !== "light" && theme !== "dark") {
    errors.textTheme = "Listeden bir metin rengi seç.";
  }

  const orderRaw = text(formData, "sortOrder");
  const sortOrder = orderRaw ? Number(orderRaw) : 0;
  if (
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > L.sortOrder
  ) {
    errors.sortOrder = `Sıra 0 ile ${L.sortOrder} arasında bir tam sayı olmalı.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    input: {
      title,
      subtitle,
      imageUrl: image.ok ? image.value : "",
      ctaLabel,
      ctaHref,
      textTheme: theme === "dark" ? "dark" : "light",
      sortOrder,
      isActive: formData.get("isActive") === "on",
    },
  };
}
