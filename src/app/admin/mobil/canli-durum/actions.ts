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
import { canAccess } from "@/lib/admin/roles";
import { isDbUnreachable } from "@/lib/db/health";
import {
  patchVenueStatus,
  updateVenueStatus,
  VENUE_NOISE_LEVELS,
  VENUE_WIFI_LEVELS,
} from "@/lib/mobile/venue";

const tables = z.coerce
  .number({ error: "Masa sayısı bir sayı olmalı." })
  .int("Masa sayısı tam sayı olmalı.")
  .min(0, "Masa sayısı negatif olamaz.")
  .max(999, "Masa sayısı 999'u geçemez.");

const OVER_TOTAL = "Boş masa sayısı toplam masa sayısını geçemez.";
const UNREACHABLE =
  "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.";

/**
 * The köşk's open/closed is not a field (operator, 21 Kas 2026: "köşk açık
 * yoğun vs. durumunu kaldır, belli aralık olan o saatlerde otomatik
 * çeksin"): every save writes `manualOverride: "auto"`, so the app, the
 * order check and the panel all go by Ayarlar → Saatler alone. A
 * `manualOverride` posted by an old page or by hand is ignored. Migration
 * 20261121120000 put the stored row back on "auto".
 */
const AUTO = { manualOverride: "auto" } as const;

const fields = z.object({
  freeTables: tables,
  wifi: z.enum(VENUE_WIFI_LEVELS, { error: "Wi-Fi seçimi geçersiz." }),
  noise: z.enum(VENUE_NOISE_LEVELS, { error: "Gürültü seçimi geçersiz." }),
  power: z.boolean(),
  note: z.string().trim().max(200, "Not en fazla 200 karakter olabilir."),
});

/** Owner and manager: every field, the table count included. */
const fullSchema = fields
  .extend({ totalTables: tables })
  .refine((v) => v.freeTables <= v.totalTables, {
    message: OVER_TOTAL,
    path: ["freeTables"],
  });

function refusal(
  issues: ReadonlyArray<{
    path: ReadonlyArray<PropertyKey>;
    message: string;
  }>,
): ActionResult {
  // The message is under its field; the line by the button only points
  // there (one announcement, not the same sentence twice).
  const fieldErrors = fieldErrorsFromIssues(issues);
  return actionError(
    Object.keys(fieldErrors).length
      ? "Formdaki uyarıları gider."
      : (issues[0]?.message ?? "Form geçersiz."),
    fieldErrors,
  );
}

/**
 * Rol kapısı burada da açılır: sayfadaki `requireRole` bir Server Action'ı
 * korumaz - action, sayfadan bağımsız çağrılabilen bir POST ucudur.
 *
 * `venue` (owner, manager, staff) saves the form; only a role with
 * `mobileApp` changes the table count. For Personel a posted `totalTables`
 * is ignored, not refused: the save goes through patchVenueStatus, which
 * never writes the count and holds the free tables to the stored one in
 * the same statement (a field error when they exceed it).
 *
 * Answers with an ActionResult for ActionForm, which posts by hand: the
 * `<form action>` it replaced put every field back to what was saved when
 * this refused one (more free tables than tables).
 */
export async function saveVenueStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("venue");
  const mayEditTotal = canAccess("mobileApp", session.role);

  const raw = {
    freeTables: String(formData.get("freeTables") ?? "0"),
    wifi: String(formData.get("wifi") ?? "stable"),
    noise: String(formData.get("noise") ?? "medium"),
    power: formData.get("power") === "on",
    note: String(formData.get("note") ?? ""),
  };

  try {
    if (mayEditTotal) {
      const parsed = fullSchema.safeParse({
        ...raw,
        totalTables: String(formData.get("totalTables") ?? "0"),
      });
      if (!parsed.success) return refusal(parsed.error.issues);
      const saved = await updateVenueStatus({ ...parsed.data, ...AUTO });
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
    } else {
      const parsed = fields.safeParse(raw);
      if (!parsed.success) return refusal(parsed.error.issues);
      const saved = await patchVenueStatus({ ...parsed.data, ...AUTO });
      if (!saved) {
        return actionError("Formdaki uyarıları gider.", {
          freeTables: OVER_TOTAL,
        });
      }
      await logAudit({
        action: "update",
        entity: "venue_status",
        entityId: "main",
        payload: {
          manualOverride: saved.manualOverride,
          freeTables: saved.freeTables,
          wifi: saved.wifi,
          noise: saved.noise,
          power: saved.power,
        },
      });
    }
  } catch (err) {
    if (isDbUnreachable(err)) return actionError(UNREACHABLE);
    throw err;
  }

  revalidatePath("/admin/mobil/canli-durum");
  return actionOk("Canlı durum kaydedildi. Uygulama 30 saniye içinde görür.");
}
