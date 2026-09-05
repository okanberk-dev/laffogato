"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { getSettings, updateSettings } from "@/lib/admin/store";
import { isDbUnreachable } from "@/lib/db/health";
import {
  APP_CONFIG_LIMITS as L,
  mergeMobileAppConfig,
  reminderCopyIssue,
  type MobileAppConfig,
} from "@/lib/mobile/app-config";

export interface AppConfigState {
  message?: string;
  error?: string;
}

const SAVED = "Kaydedildi. Uygulama en geç 5 dakika içinde görür.";

// ─── Field helpers (FormData → zod input) ─────────────────────────────────

const str = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "");
const flag = (formData: FormData, name: string) => formData.get(name) === "on";

const intField = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `${label} bir sayı olmalı.` })
    .int(`${label} tam sayı olmalı.`)
    .min(min, `${label} en az ${min} olmalı.`)
    .max(max, `${label} en fazla ${max} olabilir.`);

const textField = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} boş olamaz.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`);

/** "280" / "280,50" / "280.50" (₺) → kuruş; the form never edits kuruş directly. */
function parseMoneyMinor(raw: string): number {
  const s = raw.replace(",", ".").trim();
  if (!s) return Number.NaN;
  const v = parseFloat(s);
  if (!Number.isFinite(v)) return Number.NaN;
  return Math.round(v * 100);
}

// ─── Shared save path ─────────────────────────────────────────────────────

/**
 * Rol kapısı her action'da ayrıca açılır: sayfadaki `requireRole` bir Server
 * Action'ı korumaz — action, sayfadan bağımsız çağrılabilen bir POST ucudur.
 *
 * The patch is merged section by section onto the live document so saving
 * "Sipariş" can never wipe what someone else just saved under "Sadakat".
 */
async function saveSection(
  section: keyof MobileAppConfig,
  patch: Partial<MobileAppConfig>,
): Promise<AppConfigState> {
  try {
    const { mobileApp } = await getSettings();
    const merged = mergeMobileAppConfig(mobileApp, patch);
    await updateSettings({ mobileApp: merged });
    await logAudit({
      action: "update",
      entity: "mobile_app_config",
      entityId: section,
      payload: { [section]: merged[section] },
    });
  } catch (err) {
    if (isDbUnreachable(err)) {
      return {
        error: "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
      };
    }
    throw err;
  }
  revalidatePath("/admin/mobil/ayarlar");
  return { message: SAVED };
}

function firstIssue(error: z.ZodError): AppConfigState {
  return { error: error.issues[0]?.message ?? "Form geçersiz." };
}

// ─── 1. Sürüm ve bakım ────────────────────────────────────────────────────

const versionSchema = z.object({
  minSupportedAppVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, "Sürüm x.y.z biçiminde olmalı (örn. 1.2.0)."),
  maintenance: z.object({
    enabled: z.boolean(),
    title: textField(L.maintenanceTitleMax, "Bakım başlığı"),
    message: textField(L.maintenanceMessageMax, "Bakım mesajı"),
  }),
});

export async function saveVersionAction(
  _prev: AppConfigState,
  formData: FormData,
): Promise<AppConfigState> {
  await requireRole("mobileApp");
  const parsed = versionSchema.safeParse({
    minSupportedAppVersion: str(formData, "minSupportedAppVersion"),
    maintenance: {
      enabled: flag(formData, "maintenanceEnabled"),
      title: str(formData, "maintenanceTitle"),
      message: str(formData, "maintenanceMessage"),
    },
  });
  if (!parsed.success) return firstIssue(parsed.error);
  // Two sections of the document share one form; both are written together.
  return saveSection("maintenance", parsed.data);
}

// ─── 2. Sipariş ───────────────────────────────────────────────────────────

const etaField = intField(L.courierEtaMin, L.courierEtaMax, "Kurye süresi");

const orderingSchema = z
  .object({
    cafeEnabled: z.boolean(),
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    courierEtaMinutes: z.tuple([etaField, etaField]),
    closedMessage: textField(L.closedMessageMax, "Kapalı mesajı"),
  })
  .refine((v) => v.courierEtaMinutes[0] <= v.courierEtaMinutes[1], {
    message: "Kurye süresinin alt sınırı üst sınırından büyük olamaz.",
    path: ["courierEtaMinutes"],
  });

export async function saveOrderingAction(
  _prev: AppConfigState,
  formData: FormData,
): Promise<AppConfigState> {
  await requireRole("mobileApp");
  const parsed = orderingSchema.safeParse({
    cafeEnabled: flag(formData, "cafeEnabled"),
    deliveryEnabled: flag(formData, "deliveryEnabled"),
    pickupEnabled: flag(formData, "pickupEnabled"),
    courierEtaMinutes: [str(formData, "etaMin"), str(formData, "etaMax")],
    closedMessage: str(formData, "closedMessage"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  return saveSection("ordering", { ordering: parsed.data });
}

// ─── 3. Sadakat ───────────────────────────────────────────────────────────

const loyaltySchema = z.object({
  stampTarget: intField(L.stampTargetMin, L.stampTargetMax, "Damga hedefi"),
  rewardTitle: textField(L.rewardTitleMax, "Ödül adı"),
  rewardValueMinor: z
    .number({ error: "Ödül değeri bir tutar olmalı (₺)." })
    .int()
    .min(0, "Ödül değeri negatif olamaz.")
    .max(
      L.rewardValueMinorMax,
      `Ödül değeri en fazla ${L.rewardValueMinorMax / 100} ₺ olabilir.`,
    ),
  rewardTtlDays: intField(
    L.rewardTtlDaysMin,
    L.rewardTtlDaysMax,
    "Kupon geçerlilik süresi",
  ),
});

export async function saveLoyaltyAction(
  _prev: AppConfigState,
  formData: FormData,
): Promise<AppConfigState> {
  await requireRole("mobileApp");
  const parsed = loyaltySchema.safeParse({
    stampTarget: str(formData, "stampTarget"),
    rewardTitle: str(formData, "rewardTitle"),
    rewardValueMinor: parseMoneyMinor(str(formData, "rewardValue")),
    rewardTtlDays: str(formData, "rewardTtlDays"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  return saveSection("loyalty", { loyalty: parsed.data });
}

// ─── 4. Karaoke kuralları ─────────────────────────────────────────────────

const karaokeSchema = z
  .object({
    firstHour: intField(0, 23, "İlk saat"),
    closeHour: intField(1, 24, "Kapanış saati"),
    maxHours: intField(1, L.karaokeMaxHoursMax, "En fazla saat"),
    bookingWindowDays: intField(
      1,
      L.bookingWindowDaysMax,
      "Rezervasyon penceresi",
    ),
    oroDiscountPct: intField(0, 100, "ORO indirimi"),
  })
  .refine((v) => v.closeHour > v.firstHour, {
    message: "Kapanış saati ilk saatten sonra olmalı.",
    path: ["closeHour"],
  });

export async function saveKaraokeRulesAction(
  _prev: AppConfigState,
  formData: FormData,
): Promise<AppConfigState> {
  await requireRole("mobileApp");
  const parsed = karaokeSchema.safeParse({
    firstHour: str(formData, "firstHour"),
    closeHour: str(formData, "closeHour"),
    maxHours: str(formData, "maxHours"),
    bookingWindowDays: str(formData, "bookingWindowDays"),
    oroDiscountPct: str(formData, "oroDiscountPct"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  return saveSection("karaoke", { karaoke: parsed.data });
}

// ─── 5. Hatırlatmalar ─────────────────────────────────────────────────────

/**
 * Reminder copy is a nudge, not an advert: the app's own test refuses price,
 * discount and urgency words, so the panel refuses them first (see
 * `reminderCopyIssue`).
 */
const noSalesCopy = (label: string) =>
  z
    .string()
    .trim()
    .superRefine((text, ctx) => {
      const issue = reminderCopyIssue(text);
      if (issue)
        ctx.addIssue({ code: "custom", message: `${label}: ${issue}` });
    });

const reminderItemSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(
      L.reminderIdPattern,
      "Hatırlatma kimliği yalnız küçük harf, rakam ve tire içerebilir (en fazla 24).",
    ),
  hour: intField(0, 23, "Saat"),
  minute: intField(0, 59, "Dakika"),
  title: textField(L.reminderTitleMax, "Hatırlatma başlığı").pipe(
    noSalesCopy("Başlık"),
  ),
  body: textField(L.reminderBodyMax, "Hatırlatma metni").pipe(
    noSalesCopy("Metin"),
  ),
});

const remindersSchema = z
  .object({
    enabled: z.boolean(),
    items: z
      .array(reminderItemSchema)
      .max(
        L.reminderItemsMax,
        `En fazla ${L.reminderItemsMax} hatırlatma tanımlanabilir.`,
      ),
  })
  .refine((v) => new Set(v.items.map((it) => it.id)).size === v.items.length, {
    message: "Hatırlatma kimlikleri benzersiz olmalı.",
    path: ["items"],
  });

export async function saveRemindersAction(
  _prev: AppConfigState,
  formData: FormData,
): Promise<AppConfigState> {
  await requireRole("mobileApp");
  // Four fixed rows in the form; a row whose id is blank is "unused".
  const items = [];
  for (let i = 0; i < L.reminderItemsMax; i++) {
    const id = str(formData, `reminder-${i}-id`).trim();
    if (!id) continue;
    items.push({
      id,
      hour: str(formData, `reminder-${i}-hour`),
      minute: str(formData, `reminder-${i}-minute`),
      title: str(formData, `reminder-${i}-title`),
      body: str(formData, `reminder-${i}-body`),
    });
  }
  const parsed = remindersSchema.safeParse({
    enabled: flag(formData, "remindersEnabled"),
    items,
  });
  if (!parsed.success) return firstIssue(parsed.error);
  return saveSection("reminders", { reminders: parsed.data });
}

// ─── 6. Kampanya kartları ─────────────────────────────────────────────────

export async function saveCampaignCardsAction(
  _prev: AppConfigState,
  formData: FormData,
): Promise<AppConfigState> {
  await requireRole("mobileApp");
  return saveSection("campaignCards", {
    campaignCards: {
      loyalty: flag(formData, "cardLoyalty"),
      invite: flag(formData, "cardInvite"),
      subscription: flag(formData, "cardSubscription"),
    },
  });
}

// ─── 7. Köşk bilgileri ────────────────────────────────────────────────────

const venueSchema = z.object({
  shortName: textField(L.venueShortNameMax, "Kısa ad"),
  landmark: textField(L.venueLandmarkMax, "Yer tarifi"),
  mapsQuery: textField(L.venueMapsQueryMax, "Harita sorgusu"),
});

export async function saveVenueAction(
  _prev: AppConfigState,
  formData: FormData,
): Promise<AppConfigState> {
  await requireRole("mobileApp");
  const parsed = venueSchema.safeParse({
    shortName: str(formData, "shortName"),
    landmark: str(formData, "landmark"),
    mapsQuery: str(formData, "mapsQuery"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  return saveSection("venue", { venue: parsed.data });
}
