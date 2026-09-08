/**
 * Shared vocabulary for the campaign e-mail form — template names and their
 * Turkish labels, the audiences, and which `[ALAN]` each template asks for.
 *
 * This file exists for the same reason as every other `*-schema.ts` here:
 * `@/lib/email/campaigns` and `@/lib/email/send` start with `server-only`
 * and reach the database, so a "use client" form cannot import a constant
 * from them without dragging `pg` into the browser bundle. Only TYPES are
 * imported from those modules — `import type` is erased at compile time.
 *
 * The maps below mirror two sources of truth and are pinned to them by
 * tests/admin-campaign-mail-actions.test.ts: the template list must equal
 * `CAMPAIGN_TEMPLATES`, every field key must be one `campaignFieldsSchema`
 * accepts with the same length cap, and a template's required fields must be
 * exactly the `[ALAN]`s that sit outside its optional `<!--IF:…-->` blocks.
 */

import type { CampaignAudience } from "@/lib/email/campaigns";
import type { CampaignTemplateName } from "@/lib/email/send";

export const CAMPAIGN_MAIL_TEMPLATES: readonly CampaignTemplateName[] = [
  "kampanya-duyuru",
  "kampanya-bonus-damga",
  "kampanya-happy-hour",
  "kampanya-ikram",
  "kampanya-etkinlik",
  "kampanya-yeni-urun",
  "kampanya-indirim",
  "bulten-kampanya",
];

export const CAMPAIGN_MAIL_TEMPLATE_LABELS: Record<
  CampaignTemplateName,
  string
> = {
  "kampanya-duyuru": "Duyuru",
  "kampanya-bonus-damga": "Bonus damga",
  "kampanya-happy-hour": "Happy hour",
  "kampanya-ikram": "İkram (3 adım)",
  "kampanya-etkinlik": "Etkinlik",
  "kampanya-yeni-urun": "Yeni ürün / ön erişim",
  "kampanya-indirim": "İndirim",
  "bulten-kampanya": "Bülten (3 ürün + kod)",
};

export function isCampaignMailTemplate(
  value: string,
): value is CampaignTemplateName {
  return (CAMPAIGN_MAIL_TEMPLATES as readonly string[]).includes(value);
}

export const CAMPAIGN_MAIL_AUDIENCES: readonly CampaignAudience[] = [
  "marketing",
  "newsletter",
  "both",
];

/** Mirrors `CAMPAIGN_AUDIENCE_LABELS` in `@/lib/email/campaigns` (server-only). */
export const CAMPAIGN_MAIL_AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  marketing: "Pazarlama izni olan üyeler",
  newsletter: "Bülten aboneleri",
  both: "İkisi birden (adres başına bir kez)",
};

export function isCampaignMailAudience(
  value: string,
): value is CampaignAudience {
  return (CAMPAIGN_MAIL_AUDIENCES as readonly string[]).includes(value);
}

// ── Fields ─────────────────────────────────────────────────────────────────

export interface CampaignMailField {
  /** The `[ALAN]` name in the template, and the form input's `name`. */
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "textarea" | "url";
  /** Same cap as `campaignFieldsSchema`; the input's `maxLength`. */
  max: number;
  /**
   * The template renders this field outside any optional block, so a blank
   * one fails the render — "Gönder" refuses the campaign, naming the field.
   */
  required: boolean;
  placeholder?: string;
}

export interface CampaignMailGroup {
  title: string;
  hint?: string;
  fields: readonly CampaignMailField[];
}

const text = (
  key: string,
  label: string,
  max: number,
  required: boolean,
  extra: Partial<Pick<CampaignMailField, "hint" | "placeholder">> = {},
): CampaignMailField => ({ key, label, max, required, kind: "text", ...extra });

const textarea = (
  key: string,
  label: string,
  max: number,
  required: boolean,
  extra: Partial<Pick<CampaignMailField, "hint" | "placeholder">> = {},
): CampaignMailField => ({
  key,
  label,
  max,
  required,
  kind: "textarea",
  ...extra,
});

const url = (
  key: string,
  label: string,
  required: boolean,
  extra: Partial<Pick<CampaignMailField, "hint" | "placeholder">> = {},
): CampaignMailField => ({
  key,
  label,
  max: 2048,
  required,
  kind: "url",
  ...extra,
});

/** Title, sub-line, body — the top of every `kampanya-*` layout. */
const HEAD: CampaignMailGroup = {
  title: "Başlık ve metin",
  fields: [
    text("KAMPANYA_EYEBROW", "Üst başlık", 32, true, {
      hint: "Başlığın üstündeki küçük etiket. Büyük harfle basılır.",
      placeholder: "KAMPANYA",
    }),
    text("KAMPANYA_BASLIK", "Başlık", 80, true, {
      hint: "E-postanın konusu da budur.",
      placeholder: "Eylül seçkisi",
    }),
    text("KAMPANYA_ALT", "Alt başlık", 140, true, {
      hint: "Gelen kutusunda konunun yanında görünen ön izleme satırı.",
      placeholder: "Bu ay köşkte",
    }),
    textarea("KAMPANYA_METIN", "Metin", 600, true, {
      hint: "Tek paragraf; satır sonu korunmaz.",
    }),
    text("KAMPANYA_VURGU", "Vurgu satırı", 80, false, {
      hint: "İsteğe bağlı. Metnin altında öne çıkan tek cümle.",
    }),
  ],
};

const IMAGE: CampaignMailGroup = {
  title: "Görsel",
  hint: "İsteğe bağlı. Adres boşsa görsel satırı hiç basılmaz.",
  fields: [
    url("KAMPANYA_GORSEL_URL", "Görsel adresi", false, {
      hint: "https ile başlayan tam adres. Panelden yüklenen (data:) görseller e-postaya giremez.",
      placeholder: "https://…/kampanya.jpg",
    }),
    text("KAMPANYA_GORSEL_ALT", "Görsel açıklaması", 120, false, {
      hint: "Görsel yüklenmezse okunan metin. Boşsa başlık kullanılır.",
    }),
  ],
};

const CTA: CampaignMailGroup = {
  title: "Buton",
  fields: [
    text("KAMPANYA_BUTON", "Buton yazısı", 32, true, {
      placeholder: "MENÜYE GÖZ AT",
    }),
    url("KAMPANYA_URL", "Buton adresi", false, {
      hint: "Boşsa laffogato.net/kampanyalar sayfasına gider.",
      placeholder: "https://laffogato.net/menu",
    }),
  ],
};

const EXTRAS: CampaignMailGroup = {
  title: "Ek bilgiler",
  hint: "İkisi de isteğe bağlı; boş bırakılan satır basılmaz.",
  fields: [
    text("KAMPANYA_TARIH", "Tarih satırı", 40, false, {
      placeholder: "1–30 Eylül",
    }),
    text("KAMPANYA_DIPNOT", "Dipnot", 160, false, {
      hint: "Küçük puntoda, butonun altında.",
    }),
  ],
};

const code = (required: boolean): CampaignMailGroup => ({
  title: "Kupon kodu",
  hint: required
    ? "Bu şablonda kod kutusu her zaman basılır."
    : "İsteğe bağlı. Kod girilirse son kullanım da zorunludur — süresi olmayan bir kod, tutulamayacak bir sözdür.",
  fields: [
    text("KUPON_KODU", "Kod", 24, required, { placeholder: "EYLUL10" }),
    text("SON_KULLANIM", "Son kullanım", 40, required, {
      placeholder: "30 Eylül 2026",
    }),
  ],
});

const EVENT: CampaignMailGroup = {
  title: "Etkinlik bilgileri",
  fields: [
    text("ETKINLIK_YER", "Yer", 60, true, { placeholder: "Köşk, üst kat" }),
    text("ETKINLIK_TARIH", "Tarih", 60, true, {
      placeholder: "Cumartesi, 20 Eylül",
    }),
    text("ETKINLIK_SAAT", "Saat", 60, true, { placeholder: "17:00–19:00" }),
  ],
};

const STEPS: CampaignMailGroup = {
  title: "Üç adım",
  hint: "Üyeye ne yapacağını sırayla anlatan üç kısa adım.",
  fields: [
    text("ADIM_1_BASLIK", "1. adım başlığı", 80, true),
    text("ADIM_1_METIN", "1. adım metni", 140, true),
    text("ADIM_2_BASLIK", "2. adım başlığı", 80, true),
    text("ADIM_2_METIN", "2. adım metni", 140, true),
    text("ADIM_3_BASLIK", "3. adım başlığı", 80, true),
    text("ADIM_3_METIN", "3. adım metni", 140, true),
  ],
};

const DISCOUNT: CampaignMailGroup = {
  title: "İndirim",
  fields: [
    text("INDIRIM_ORAN", "Oran", 8, true, {
      hint: "Büyük puntoda basılır.",
      placeholder: "%20",
    }),
    text("INDIRIM_URUN", "İndirimli ürün", 80, true, {
      placeholder: "tüm gelato kupları",
    }),
  ],
};

const product = (n: 1 | 2 | 3): CampaignMailField[] => [
  text(`URUN_${n}_AD`, `${n}. ürün adı`, 60, true),
  text(`URUN_${n}_NOT`, `${n}. ürün notu`, 140, true),
  text(`URUN_${n}_FIYAT`, `${n}. ürün fiyatı`, 24, true, {
    placeholder: "250,00 ₺",
  }),
];

const PRODUCTS: CampaignMailGroup = {
  title: "Üç ürün",
  hint: "Üç kart; fiyatı menüdeki gibi yaz, sunucu hesaplamaz.",
  fields: [...product(1), ...product(2), ...product(3)],
};

/** Bülten's head has no eyebrow and no sub-line; its preheader is fixed. */
const BULTEN_HEAD: CampaignMailGroup = {
  title: "Başlık ve metin",
  fields: [
    text("KAMPANYA_BASLIK", "Başlık", 80, true, {
      hint: "E-postanın konusu da budur.",
    }),
    textarea("KAMPANYA_METIN", "Giriş metni", 600, true),
  ],
};

/**
 * What the form shows for each template, in reading order. A template's
 * required fields are exactly the ones its HTML renders outside an optional
 * block (see the test); everything inside `<!--IF:GORSEL-->`, `KOD`, `TARIH`,
 * `DIPNOT` and `VURGU` is optional and drops out together with its block.
 */
export const CAMPAIGN_MAIL_GROUPS: Record<
  CampaignTemplateName,
  readonly CampaignMailGroup[]
> = {
  "kampanya-duyuru": [HEAD, IMAGE, CTA, EXTRAS, code(false)],
  "kampanya-bonus-damga": [HEAD, IMAGE, CTA, EXTRAS, code(false)],
  "kampanya-happy-hour": [HEAD, EVENT, IMAGE, CTA, EXTRAS, code(false)],
  "kampanya-ikram": [HEAD, STEPS, IMAGE, CTA, EXTRAS, code(false)],
  "kampanya-etkinlik": [HEAD, EVENT, IMAGE, CTA, EXTRAS],
  "kampanya-yeni-urun": [HEAD, STEPS, IMAGE, CTA, EXTRAS],
  "kampanya-indirim": [HEAD, DISCOUNT, IMAGE, CTA, EXTRAS, code(false)],
  "bulten-kampanya": [BULTEN_HEAD, PRODUCTS, code(true), CTA],
};

/** The template's fields, flattened, in form order. */
export function campaignMailFieldsFor(
  template: CampaignTemplateName,
): CampaignMailField[] {
  return CAMPAIGN_MAIL_GROUPS[template].flatMap((g) => [...g.fields]);
}

/** Every field key any template uses — what a Server Action reads off the form. */
export const CAMPAIGN_MAIL_FIELD_KEYS: readonly string[] = [
  ...new Set(
    CAMPAIGN_MAIL_TEMPLATES.flatMap((t) =>
      campaignMailFieldsFor(t).map((f) => f.key),
    ),
  ),
];

/** Label for a stored field, for the read-only view of a queued campaign. */
export function campaignMailFieldLabel(
  template: CampaignTemplateName,
  key: string,
): string {
  return (
    campaignMailFieldsFor(template).find((f) => f.key === key)?.label ?? key
  );
}
