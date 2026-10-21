"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit, safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import {
  quickChoiceOf,
  quickPatchFor,
  VENUE_QUICK_CHOICES,
  VENUE_QUICK_LABELS,
  type VenueSignalAnswer,
} from "@/lib/admin/venue-quick-core";
import { venueSignal } from "@/lib/admin/venue-signal";
import { isDbUnreachable } from "@/lib/db/health";
import {
  patchVenueStatus,
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

const OVER_TOTAL = "Boş masa sayısı toplam masa sayısını geçemez.";
const UNREACHABLE =
  "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.";

const fields = z.object({
  manualOverride: z.enum(VENUE_OVERRIDES, {
    error: "Açık/kapalı seçimi geçersiz.",
  }),
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

const quickSchema = z.object({
  status: z.enum(VENUE_QUICK_CHOICES, { error: "Durum seçimi geçersiz." }),
  freeTables: tables,
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
    manualOverride: String(formData.get("manualOverride") ?? "auto"),
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
    } else {
      const parsed = fields.safeParse(raw);
      if (!parsed.success) return refusal(parsed.error.issues);
      const saved = await patchVenueStatus(parsed.data);
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

/**
 * The top bar's köşk chip (components/admin/venue-quick.tsx): open, busy or
 * closed, and the free tables, nothing else. One UPDATE of those two
 * columns (patchVenueStatus), so Wi-Fi, noise, power and the note a
 * colleague saved meanwhile stay as they are; Yoğun sets the free tables
 * alone and leaves the open/closed as it is. Its own gate and parse: like
 * every export here it is a public POST endpoint.
 */
export async function saveVenueQuickAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("venue");

  const parsed = quickSchema.safeParse({
    status: String(formData.get("status") ?? ""),
    freeTables: String(formData.get("freeTables") ?? ""),
  });
  if (!parsed.success) {
    return actionError(
      parsed.error.issues[0]?.message ?? "Form geçersiz.",
      fieldErrorsFromIssues(parsed.error.issues),
    );
  }

  const patch = quickPatchFor(parsed.data.status, parsed.data.freeTables);
  const saved = await patchVenueStatus(patch).catch((err: unknown) => {
    if (isDbUnreachable(err)) return "unreachable" as const;
    throw err;
  });
  if (saved === "unreachable") return actionError(UNREACHABLE);
  if (!saved) return actionError(OVER_TOTAL, { freeTables: OVER_TOTAL });

  // The row is saved: an audit insert that fails is logged, not shown as a
  // failed save the operator would repeat. It names what was written: a
  // Yoğun leaves the open/closed out.
  await safeAudit({
    action: "update",
    entity: "venue_status",
    entityId: "main",
    payload: {
      ...(patch.manualOverride !== undefined
        ? { manualOverride: saved.manualOverride }
        : {}),
      freeTables: saved.freeTables,
    },
  });

  revalidatePath("/admin/mobil/canli-durum");
  // Named from what was saved, the way the popover reads it back: open with
  // no free table is "Yoğun", whichever mode.
  const choice = quickChoiceOf({ ...saved, isOpen: true, saved: true });
  return actionOk(
    `Köşk: ${VENUE_QUICK_LABELS[choice].label}, boş masa ${saved.freeTables} / ${saved.totalTables}. Uygulama 30 saniye içinde görür.`,
  );
}

/**
 * The köşk chip's poll (components/admin/venue-quick.tsx), once a minute
 * while the tab is visible: the layout reads nothing for it. The gate and
 * the cheap path are venueSignal's (src/lib/admin/venue-signal.ts), the nav
 * badges' pattern: `{ unchanged: true }` without the database while
 * nothing changed, and a status only after the account was read again and
 * still has Canlı durum. Never redirects: it runs in the background on
 * every screen. `cursor` is whatever the browser sent; venueSignal trusts
 * none of it.
 */
export async function venueQuickSignalAction(
  cursor: string,
): Promise<VenueSignalAnswer> {
  return venueSignal(cursor);
}
