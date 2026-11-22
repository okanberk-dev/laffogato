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
  patchVenueStatus,
  VENUE_NOISE_LEVELS,
  VENUE_WIFI_LEVELS,
} from "@/lib/mobile/venue";

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

// No table counts (operator, 22 Kas 2026: "boş masa sayısını da kaldır"):
// the app gets `freeTables: null` (lib/mobile/venue.ts toLiveStatus), and a
// posted freeTables / totalTables is ignored.
const fields = z.object({
  wifi: z.enum(VENUE_WIFI_LEVELS, { error: "Wi-Fi seçimi geçersiz." }),
  noise: z.enum(VENUE_NOISE_LEVELS, { error: "Gürültü seçimi geçersiz." }),
  power: z.boolean(),
  note: z.string().trim().max(200, "Not en fazla 200 karakter olabilir."),
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
 * `venue` (owner, manager, staff) saves the form: Wi-Fi, noise, power and
 * the note, one UPDATE of those columns (patchVenueStatus), so nothing else
 * in the row is touched.
 *
 * Answers with an ActionResult for ActionForm, which posts by hand.
 */
export async function saveVenueStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("venue");

  const parsed = fields.safeParse({
    wifi: String(formData.get("wifi") ?? "stable"),
    noise: String(formData.get("noise") ?? "medium"),
    power: formData.get("power") === "on",
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return refusal(parsed.error.issues);

  try {
    const saved = await patchVenueStatus({ ...parsed.data, ...AUTO });
    if (!saved) return actionError("Canlı durum kaydedilemedi.");
    await logAudit({
      action: "update",
      entity: "venue_status",
      entityId: "main",
      payload: {
        manualOverride: saved.manualOverride,
        wifi: saved.wifi,
        noise: saved.noise,
        power: saved.power,
      },
    });
  } catch (err) {
    if (isDbUnreachable(err)) return actionError(UNREACHABLE);
    throw err;
  }

  revalidatePath("/admin/mobil/canli-durum");
  return actionOk("Canlı durum kaydedildi. Uygulama 30 saniye içinde görür.");
}
