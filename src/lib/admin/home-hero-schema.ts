import { z } from "zod";

import { splitLead } from "@/components/laffogato/split-lead";

import { fieldErrorsFromIssues } from "./action-result";
import {
  HOME_HERO_LIMITS as L,
  HOME_SLIDE_PLACEHOLDERS,
  isBundledHomeHeroImage,
  isHomeHeroScene,
  isHomeSlideAction,
  safeSlideHref,
  safeSlideImage,
  unknownPlaceholders,
  type HomeHeroSlideInput,
} from "./home-hero-core";
import { normalizePublishInstant, parsePublishInstant } from "./publish-window";

/**
 * The home hero slide form (/admin/anasayfa-hero). Zod, so it stays on the
 * server: the action and the tests share it, the client form only reads the
 * plain lists in ./home-hero-core.ts.
 *
 * Every refusal names its field, in the form's own field names, so the
 * message lands under what has to change (ActionForm).
 */

/** The image picker's "upload or link" choice; anything else is a bundled path. */
export const CUSTOM_IMAGE = "custom";

/** A button's "free link" target; anything else is an action code or "". */
export const LINK_TARGET = "link";

/** A form value as text: a missing field or a stray file reads as "". */
const field = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" ? v : ""), schema);

const text = () => field(z.string().trim());

const formSchema = z.object({
  kicker: field(
    z
      .string()
      .trim()
      .max(L.kicker, `Üst satır en fazla ${L.kicker} karakter olabilir.`),
  ),
  titleLine1: field(
    z
      .string()
      .trim()
      .min(1, "Başlığın ilk satırını yaz.")
      .max(
        L.titleLine,
        `Başlığın her satırı en fazla ${L.titleLine} karakter.`,
      ),
  ),
  titleLine2: field(
    z
      .string()
      .trim()
      .max(
        L.titleLine,
        `Başlığın her satırı en fazla ${L.titleLine} karakter.`,
      ),
  ),
  body: field(
    z
      .string()
      .trim()
      .min(1, "Slaytın metnini yaz.")
      .max(L.body, `Metin en fazla ${L.body} karakter olabilir.`),
  ),
  imageSource: text(),
  imageUpload: field(z.string()),
  alt: field(
    z
      .string()
      .trim()
      .min(1, "Görseli bir cümleyle anlat: ekran okuyucu bunu okur.")
      .max(L.alt, `Görsel açıklaması en fazla ${L.alt} karakter.`),
  ),
  scene: field(z.string().refine(isHomeHeroScene, "Listeden bir ışık seç.")),
  primaryLabel: text(),
  primaryTarget: text(),
  primaryHref: text(),
  secondaryLabel: text(),
  secondaryTarget: text(),
  secondaryHref: text(),
  sortOrder: text(),
  isActive: field(z.string()),
  startsAt: text(),
  endsAt: text(),
});

type RawForm = z.infer<typeof formSchema>;

interface Issue {
  path: [string];
  message: string;
}

/** The uploader posts a JSON array of one; a bare value is taken as it is. */
function uploadedValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) && typeof parsed[0] === "string"
      ? parsed[0].trim()
      : "";
  } catch {
    return "";
  }
}

function image(v: RawForm, issues: Issue[]): string {
  if (v.imageSource !== CUSTOM_IMAGE) {
    if (isBundledHomeHeroImage(v.imageSource)) return v.imageSource;
    issues.push({
      path: ["imageSource"],
      message: "Listeden bir görsel seç ya da kendi görselini ekle.",
    });
    return "";
  }
  const value = uploadedValue(v.imageUpload);
  const safe = safeSlideImage(value);
  if (safe) return safe;
  issues.push({
    path: ["imageUpload"],
    message: !value
      ? "Bir görsel yükle ya da https ile başlayan bir bağlantı ekle."
      : /^http:\/\//i.test(value)
        ? "Görsel bağlantısı https:// ile başlamalı."
        : "Bu görsel kaydedilemiyor: JPG, PNG ya da WebP yükle veya https bağlantısı ver.",
  });
  return "";
}

function button(
  which: "primary" | "secondary",
  v: RawForm,
  issues: Issue[],
): { label: string; action: string; href: string } {
  const label = v[`${which}Label`];
  const target = v[`${which}Target`];
  const none = { label: "", action: "", href: "" };
  if (!label && !target) return none;
  if (label.length > L.buttonLabel) {
    issues.push({
      path: [`${which}Label`],
      message: `Düğme yazısı en fazla ${L.buttonLabel} karakter.`,
    });
    return none;
  }
  if (!label) {
    issues.push({ path: [`${which}Label`], message: "Düğmenin yazısını yaz." });
    return none;
  }
  if (!target) {
    issues.push({
      path: [`${which}Target`],
      message: "Düğmenin nereye gideceğini seç.",
    });
    return none;
  }
  if (isHomeSlideAction(target)) return { label, action: target, href: "" };
  if (target !== LINK_TARGET) {
    issues.push({
      path: [`${which}Target`],
      message: "Listeden bir hedef seç.",
    });
    return none;
  }
  const href = safeSlideHref(v[`${which}Href`]);
  if (!href) {
    issues.push({
      path: [`${which}Href`],
      message:
        "Bağlantı sitedeki bir yol (örn. /kampanyalar) ya da https:// ile başlayan bir adres olmalı.",
    });
    return none;
  }
  return { label, action: "", href };
}

function body(v: RawForm, issues: Issue[]): string {
  const unknown = unknownPlaceholders(v.body);
  if (unknown.length > 0) {
    issues.push({
      path: ["body"],
      message: `${unknown.join(", ")} doldurulmaz; yalnız ${HOME_SLIDE_PLACEHOLDERS.join(" ve ")} kullanılabilir.`,
    });
  }
  const [lead] = splitLead(v.body);
  if (lead.length > L.lead) {
    issues.push({
      path: ["body"],
      message: `İlk cümle telefonda tek başına görünür; ${L.lead} karakteri geçmesin (şu an ${lead.length}).`,
    });
  }
  return v.body;
}

function sortOrder(raw: string, issues: Issue[]): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > L.sortOrder) {
    issues.push({
      path: ["sortOrder"],
      message: `Sıra 0 ile ${L.sortOrder} arasında bir tam sayı olmalı.`,
    });
    return 0;
  }
  return n;
}

function windowBounds(
  v: RawForm,
  issues: Issue[],
): { startsAt: string; endsAt: string } {
  const from = v.startsAt ? parsePublishInstant(v.startsAt) : null;
  const to = v.endsAt ? parsePublishInstant(v.endsAt) : null;
  if (v.startsAt && from === null) {
    issues.push({
      path: ["startsAt"],
      message: "Başlangıcı gün ve saatle seç.",
    });
  }
  if (v.endsAt && to === null) {
    issues.push({ path: ["endsAt"], message: "Bitişi gün ve saatle seç." });
  }
  if (from !== null && to !== null && to <= from) {
    issues.push({
      path: ["endsAt"],
      message: "Bitiş, başlangıçtan sonra olmalı.",
    });
  }
  return {
    startsAt: v.startsAt ? normalizePublishInstant(v.startsAt) : "",
    endsAt: v.endsAt ? normalizePublishInstant(v.endsAt) : "",
  };
}

export type HomeHeroFormResult =
  | { ok: true; input: HomeHeroSlideInput }
  | { ok: false; fieldErrors: Record<string, string> };

/** Reads and checks the slide form. Nothing is written on a refusal. */
export function parseHomeHeroForm(formData: FormData): HomeHeroFormResult {
  const raw = Object.fromEntries(
    Object.keys(formSchema.shape).map((k) => [k, formData.get(k)]),
  );
  const parsed = formSchema.safeParse(raw);
  const issues: Issue[] = [];
  if (!parsed.success) {
    // Field rules first; the cross-field ones below need parsed values.
    return {
      ok: false,
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
    };
  }
  const v = parsed.data;
  const picture = image(v, issues);
  const bodyText = body(v, issues);
  const primary = button("primary", v, issues);
  const secondary = button("secondary", v, issues);
  if (secondary.label && !v.primaryLabel && !v.primaryTarget) {
    issues.push({
      path: ["primaryLabel"],
      message: "Önce birinci düğmeyi doldur; ikinci düğme tek başına durmaz.",
    });
  }
  const order = sortOrder(v.sortOrder, issues);
  const { startsAt, endsAt } = windowBounds(v, issues);
  if (issues.length > 0) {
    return { ok: false, fieldErrors: fieldErrorsFromIssues(issues) };
  }
  return {
    ok: true,
    input: {
      sortOrder: order,
      isActive: v.isActive === "on",
      startsAt,
      endsAt,
      kicker: v.kicker,
      titleLine1: v.titleLine1,
      titleLine2: v.titleLine2,
      body: bodyText,
      image: picture,
      alt: v.alt,
      scene: v.scene,
      primaryLabel: primary.label,
      primaryAction: primary.action,
      primaryHref: primary.href,
      secondaryLabel: secondary.label,
      secondaryAction: secondary.action,
      secondaryHref: secondary.href,
    },
  };
}
