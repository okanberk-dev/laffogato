// The /franchise application: its questions, the answers' labels and the
// rules a submission is checked by. Pure and client-safe (no "server-only"):
// the form draws its options from here, the action parses with the same
// schema, and the panel prints the same labels.
//
// Operator, 22 Kas 2026: "franchise bölümü ekle form doldurulan ve açılır
// sectionlar dahil tasarım metriklerine uyumlu olsun estetik yap".
//
// The option KEYS are stored (franchise_applications, check constraints in
// db/migrations/20261122135425_franchise_applications.sql) and are the
// form's contract: never rename one that has rows. A label may change.

import { z } from "zod";

import { isValidPhone } from "@/lib/checkout/delivery";

/** The form's field names: the action reads exactly these. */
export const FRANCHISE_FIELDS = [
  "name",
  "email",
  "phone",
  "city",
  "district",
  "locationStatus",
  "budget",
  "experience",
  "timeline",
  "message",
  "consent",
] as const;

export type FranchiseField = (typeof FRANCHISE_FIELDS)[number];

/** The honeypot: hidden from people, filled by form-spamming scripts. */
export const FRANCHISE_HONEYPOT = "website";

export const FRANCHISE_LIMITS = {
  name: 100,
  email: 200,
  phone: 30,
  city: 60,
  district: 60,
  message: 2000,
} as const;

export interface FranchiseOption<K extends string = string> {
  value: K;
  label: string;
}

export const LOCATION_OPTIONS = [
  { value: "ready", label: "Hazır bir yerim var" },
  { value: "searching", label: "Yer arıyorum" },
  { value: "none", label: "Henüz bakmadım" },
] as const satisfies readonly FranchiseOption[];

export const BUDGET_OPTIONS = [
  { value: "under-3m", label: "3 milyon TL altı" },
  { value: "3m-6m", label: "3 - 6 milyon TL" },
  { value: "over-6m", label: "6 milyon TL üstü" },
  { value: "undecided", label: "Henüz netleşmedi" },
] as const satisfies readonly FranchiseOption[];

export const EXPERIENCE_OPTIONS = [
  { value: "none", label: "Sektör deneyimim yok" },
  { value: "food", label: "Yiyecek ve içecek" },
  { value: "retail", label: "Perakende" },
  { value: "franchise", label: "Başka bir franchise işletiyorum" },
] as const satisfies readonly FranchiseOption[];

export const TIMELINE_OPTIONS = [
  { value: "0-3", label: "3 ay içinde" },
  { value: "3-6", label: "3 - 6 ay içinde" },
  { value: "6-12", label: "6 - 12 ay içinde" },
  { value: "12+", label: "1 yıldan sonra" },
] as const satisfies readonly FranchiseOption[];

export type FranchiseLocationStatus =
  (typeof LOCATION_OPTIONS)[number]["value"];
export type FranchiseBudget = (typeof BUDGET_OPTIONS)[number]["value"];
export type FranchiseExperience = (typeof EXPERIENCE_OPTIONS)[number]["value"];
export type FranchiseTimeline = (typeof TIMELINE_OPTIONS)[number]["value"];

/** What the panel did with an application. */
export const FRANCHISE_STATUSES = ["new", "contacted", "archived"] as const;
export type FranchiseStatus = (typeof FRANCHISE_STATUSES)[number];

export const FRANCHISE_STATUS_LABELS: Record<FranchiseStatus, string> = {
  new: "Yeni",
  contacted: "Görüşüldü",
  archived: "Arşiv",
};

/** An option key's label; the key itself if it is not (or no longer) one. */
export function franchiseOptionLabel(
  options: readonly FranchiseOption[],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/** The KVKK notice the applicant ticks, versioned for the consent record. */
export const FRANCHISE_NOTICE_VERSION = "2026-11-22";

/** How long an application is kept (src/lib/retention.ts, the form's notice). */
export const FRANCHISE_RETENTION_MONTHS = 12;

/** The document the consent box links to (src/lib/legal/content.ts). */
export const FRANCHISE_PRIVACY_PATH = "/hukuk/kvkk-aydinlatma-metni";

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

const text = (label: string, max: number, required: boolean) => {
  const base = z
    .string()
    .transform(oneLine)
    .pipe(
      z
        .string()
        .max(max, { error: `${label} en fazla ${max} karakter olabilir.` }),
    );
  return required
    ? base.pipe(z.string().min(1, { error: `${label} gerekli.` }))
    : base;
};

const choice = <T extends readonly FranchiseOption[]>(
  options: T,
  message: string,
) =>
  z.enum(
    options.map((o) => o.value) as [
      T[number]["value"],
      ...T[number]["value"][],
    ],
    {
      error: message,
    },
  );

export const franchiseApplicationSchema = z.object({
  name: text("Ad soyad", FRANCHISE_LIMITS.name, true).pipe(
    z.string().min(3, { error: "Adını ve soyadını yaz." }),
  ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "E-posta gerekli." })
    .max(FRANCHISE_LIMITS.email, { error: "E-posta çok uzun." })
    .pipe(z.email({ error: "Geçerli bir e-posta yaz." })),
  phone: text("Telefon", FRANCHISE_LIMITS.phone, true).refine(isValidPhone, {
    error: "Geçerli bir telefon yaz (ör. 0532 123 45 67).",
  }),
  city: text("İl", FRANCHISE_LIMITS.city, true),
  district: text("İlçe", FRANCHISE_LIMITS.district, false),
  locationStatus: choice(LOCATION_OPTIONS, "Yer durumunu seç."),
  budget: choice(BUDGET_OPTIONS, "Yatırım aralığını seç."),
  experience: choice(EXPERIENCE_OPTIONS, "Deneyimini seç."),
  timeline: choice(TIMELINE_OPTIONS, "Ne zaman başlamak istediğini seç."),
  message: z
    .string()
    .trim()
    .max(FRANCHISE_LIMITS.message, {
      error: `Not en fazla ${FRANCHISE_LIMITS.message} karakter olabilir.`,
    }),
  consent: z.literal("on", {
    error: "Devam etmek için aydınlatma metnini okuduğunu işaretle.",
  }),
});

export type FranchiseApplicationInput = z.infer<
  typeof franchiseApplicationSchema
>;

/** What the form shows after a submit. */
export interface FranchiseFormState {
  ok?: boolean;
  /** A message for the whole form (rate limit, database down). */
  error?: string;
  /** Per field, the first problem. */
  fieldErrors?: Partial<Record<FranchiseField, string>>;
}

/** FormData → the schema's input: every field a string ("" when absent). */
export function franchiseFormInput(
  formData: FormData,
): Record<FranchiseField, string> {
  const out = {} as Record<FranchiseField, string>;
  for (const f of FRANCHISE_FIELDS) {
    const v = formData.get(f);
    out[f] = typeof v === "string" ? v : "";
  }
  return out;
}

/** The schema's issues as one message per field, first one wins. */
export function franchiseFieldErrors(
  error: z.ZodError,
): Partial<Record<FranchiseField, string>> {
  const out: Partial<Record<FranchiseField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    if (!(FRANCHISE_FIELDS as readonly string[]).includes(key)) continue;
    const field = key as FranchiseField;
    if (!out[field]) out[field] = issue.message;
  }
  return out;
}
