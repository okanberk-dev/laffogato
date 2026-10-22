"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { readImportFile } from "@/lib/admin/product-import";
import {
  IYS_EXPORT_ID_RE,
  iysCheckFreshness,
  iysImportSentence,
  istanbulDateTimeLabel,
  parseIysConsentList,
} from "@/lib/iys/iys-core";
import {
  attestIysCheck,
  importIysConsentList,
  reconcileIys,
  rejectIysEvent,
  settleIysExport,
} from "@/lib/iys/store";

/**
 * /admin/iys: the manual round trip with İYS Web (docs/IYS.md). Each action
 * checks the session and the `newsletter` role itself (CLAUDE.md rule 27),
 * parses with Zod, writes, leaves an audit row with counts only (never an
 * address) and revalidates the page. The file download is a route handler
 * (./dosya/route.ts), which checks the same.
 */

const PATH = "/admin/iys";

const exportSchema = z.object({
  exportId: z.string().trim().regex(IYS_EXPORT_ID_RE, "Dosya bulunamadı."),
});

/** "İYS'ye yüklendi": every open event of that file is registered. */
export async function settleIysExportAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("newsletter");
  const parsed = exportSchema.safeParse({ exportId: formData.get("exportId") });
  if (!parsed.success) return actionError("Dosya bulunamadı.");
  const settled = await settleIysExport(parsed.data.exportId, session.email);
  revalidatePath(PATH);
  if (settled === 0) {
    return actionError(
      "Bu dosyada onay bekleyen kayıt kalmadı; sayfayı yenile. Daha yeni bir dosya indirildiyse kayıtlar oraya geçmiştir.",
    );
  }
  await safeAudit({
    action: "update",
    entity: "iys",
    entityId: parsed.data.exportId,
    payload: { op: "registered", events: settled },
  });
  return actionOk(
    `${settled} kayıt İYS'de kayıtlı sayıldı. Onaylar artık kampanya kitlesinde.`,
  );
}

const rejectSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{0,17}$/, "Kayıt bulunamadı."),
  note: z
    .string()
    .trim()
    .max(300, "Not en fazla 300 karakter olabilir.")
    .optional()
    .default(""),
});

/** "İYS reddetti", with İYS's code or a note (H467, H178...). */
export async function rejectIysEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("newsletter");
  const parsed = rejectSchema.safeParse({
    id: formData.get("id"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Kayıt bulunamadı.");
  }
  const event = await rejectIysEvent(
    parsed.data.id,
    parsed.data.note,
    session.email,
  );
  revalidatePath(PATH);
  if (!event) {
    return actionError("Kayıt artık açık değil; sayfayı yenile.");
  }
  await safeAudit({
    action: "update",
    entity: "iys",
    entityId: `event-${event.id}`,
    // The İYS code says why; the address stays out of the log.
    payload: {
      op: "rejected",
      status: event.status,
      legacy: event.legacy,
      note: parsed.data.note.slice(0, 40),
    },
  });
  return actionOk(
    event.status === "ONAY"
      ? "İYS'nin reddi kaydedildi. Bu adres yeniden onay verene kadar kampanya almaz."
      : "İYS'nin reddi kaydedildi. Adres bizde zaten kapalı; ticari e-posta gitmez.",
    "warning",
  );
}

/**
 * "İYS izin listesini yükle": İYS Web's export of the brand's consents.
 * New refusals are applied to the consent stores (ledger source `iys`),
 * downloaded events İYS shows as done are settled, and the check is
 * recorded. An ONAY row never creates a consent here.
 */
export async function importIysListAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("newsletter");
  const file = await readImportFile(formData.get("file"));
  if (!file.ok) return actionError(file.error);
  const parsed = parseIysConsentList(file.text);
  if (!parsed.ok) return actionError(parsed.error);
  if (parsed.rows.length === 0) {
    return actionError(
      "Dosyada e-posta adresi ve ONAY ya da RET yazan bir satır bulunamadı. İYS Web'den markanın e-posta izinlerini indirip CSV olarak kaydet.",
    );
  }
  // The outbox first, so a consent given since the last run is known.
  await reconcileIys();
  const result = await importIysConsentList(parsed.rows, {
    by: session.email,
    skipped: parsed.skipped,
    fileName: file.fileName,
  });
  // And again: refusals applied above may supersede pending approvals.
  await reconcileIys();
  await safeAudit({
    action: "update",
    entity: "iys",
    entityId: "import",
    payload: {
      op: "import",
      onayListed: result.onayListed,
      onayIgnored: result.onayIgnored,
      retListed: result.retListed,
      refusalsApplied: result.refusalsApplied,
      registered: result.registered,
      superseded: result.superseded,
      skipped: parsed.skipped,
      duplicates: parsed.duplicates,
    },
  });
  revalidatePath(PATH);
  revalidatePath("/admin/bulten");
  return actionOk(
    iysImportSentence({ ...result, skipped: parsed.skipped }),
    result.refusalsApplied > 0 ? "warning" : "success",
  );
}

/** "İYS'yi kontrol ettim, yeni ret yok": the check, by hand. */
export async function attestIysCheckAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("newsletter");
  const now = new Date();
  await attestIysCheck(session.email, now);
  await safeAudit({
    action: "update",
    entity: "iys",
    entityId: "attest",
    payload: { op: "attest" },
  });
  revalidatePath(PATH);
  const { expiresAt } = iysCheckFreshness(now.toISOString(), now);
  return actionOk(
    `Kaydedildi. Kampanyalar ${istanbulDateTimeLabel(expiresAt)} tarihine kadar gönderilebilir; sonra İYS yeniden kontrol edilmeli.`,
  );
}
