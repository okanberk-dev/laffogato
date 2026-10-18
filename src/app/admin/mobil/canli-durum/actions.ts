"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { isDbUnreachable } from "@/lib/db/health";
import {
  updateVenueStatus,
  VENUE_NOISE_LEVELS,
  VENUE_OVERRIDES,
  VENUE_WIFI_LEVELS,
} from "@/lib/mobile/venue";

const tables = z.coerce
  .number({ error: "Masa sayısı bir sayı olmalı." })
  .int("Masa sayısı tam sayı olmalı.")
  .min(0, "Masa sayısı negatif olamaz.")
  .max(999, "Masa sayısı 999'u geçemez.");

const schema = z
  .object({
    manualOverride: z.enum(VENUE_OVERRIDES, {
      error: "Açık/kapalı seçimi geçersiz.",
    }),
    freeTables: tables,
    totalTables: tables,
    wifi: z.enum(VENUE_WIFI_LEVELS, { error: "Wi-Fi seçimi geçersiz." }),
    noise: z.enum(VENUE_NOISE_LEVELS, { error: "Gürültü seçimi geçersiz." }),
    power: z.boolean(),
    note: z.string().trim().max(200, "Not en fazla 200 karakter olabilir."),
  })
  .refine((v) => v.freeTables <= v.totalTables, {
    message: "Boş masa sayısı toplam masa sayısını geçemez.",
    path: ["freeTables"],
  });

/**
 * Rol kapısı burada da açılır: sayfadaki `requireRole` bir Server Action'ı
 * korumaz - action, sayfadan bağımsız çağrılabilen bir POST ucudur.
 *
 * Answers with an ActionResult for ActionForm, which posts by hand: the
 * `<form action>` it replaced put every field back to what was saved when
 * this refused one (more free tables than tables).
 */
export async function saveVenueStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");

  const parsed = schema.safeParse({
    manualOverride: String(formData.get("manualOverride") ?? "auto"),
    freeTables: String(formData.get("freeTables") ?? "0"),
    totalTables: String(formData.get("totalTables") ?? "0"),
    wifi: String(formData.get("wifi") ?? "stable"),
    noise: String(formData.get("noise") ?? "medium"),
    power: formData.get("power") === "on",
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return actionError(
      parsed.error.issues[0]?.message ?? "Form geçersiz.",
      fieldErrorsFromIssues(parsed.error.issues),
    );
  }

  try {
    const saved = await updateVenueStatus(parsed.data);
    await logAudit({
      action: "update",
      entity: "venue_status",
      entityId: "main",
      payload: {
        manualOverride: saved.manualOverride,
        freeTables: saved.freeTables,
        totalTables: saved.totalTables,
        wifi: saved.wifi,
        noise: saved.noise,
        power: saved.power,
      },
    });
  } catch (err) {
    if (isDbUnreachable(err)) {
      return actionError(
        "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
      );
    }
    throw err;
  }

  revalidatePath("/admin/mobil/canli-durum");
  return actionOk("Canlı durum kaydedildi. Uygulama 30 saniye içinde görür.");
}
