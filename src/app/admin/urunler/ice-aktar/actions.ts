"use server";

import { revalidatePath } from "next/cache";

import { safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  applyProductImport,
  loadImportContext,
  planProductImport,
  readImportFile,
} from "@/lib/admin/product-import";
import type { ProductImportState } from "@/lib/admin/product-import-core";

/**
 * The product CSV import (/admin/urunler/ice-aktar): a dry run that writes
 * nothing, then the import of the rows it showed. Both read the uploaded
 * file themselves; the import plans again against the catalogue as it is
 * now and writes only if that plan is the one previewed (`planHash`).
 */

export async function previewProductImportAction(
  _prev: ProductImportState,
  formData: FormData,
): Promise<ProductImportState> {
  await requireRole("products");
  const file = await readImportFile(formData.get("file"));
  if (!file.ok) return { phase: "idle", error: file.error };
  const plan = planProductImport(file.text, await loadImportContext());
  if (!plan.ok) {
    return { phase: "idle", error: plan.error, fileName: file.fileName };
  }
  return {
    phase: "preview",
    fileName: file.fileName,
    planHash: plan.hash,
    rows: plan.rows.map((r) => r.view),
    counts: plan.counts,
    notices: [...file.notices, ...plan.notices],
  };
}

export async function applyProductImportAction(
  _prev: ProductImportState,
  formData: FormData,
): Promise<ProductImportState> {
  const startedAt = Date.now();
  const session = await requireRole("products");
  const file = await readImportFile(formData.get("file"));
  if (!file.ok) return { phase: "idle", error: file.error };
  const plan = planProductImport(file.text, await loadImportContext());
  if (!plan.ok) {
    return { phase: "idle", error: plan.error, fileName: file.fileName };
  }
  const preview: ProductImportState = {
    phase: "preview",
    fileName: file.fileName,
    planHash: plan.hash,
    rows: plan.rows.map((r) => r.view),
    counts: plan.counts,
    notices: [...file.notices, ...plan.notices],
  };
  if (String(formData.get("planHash") ?? "") !== plan.hash) {
    return {
      ...preview,
      notices: [
        ...(preview.notices ?? []),
        "Önizlemeden bu yana dosya ya da ürünler değişti. Yeni önizlemeye bak, sonra yeniden içe aktar.",
      ],
    };
  }
  if (plan.counts.create + plan.counts.update === 0) {
    return {
      ...preview,
      notices: [...(preview.notices ?? []), "Yazılacak satır yok."],
    };
  }

  const outcome = await applyProductImport(plan, {
    actor: session.email,
    startedAt,
  });
  // One row for the whole import: counts and ids, never the file itself.
  await safeAudit({
    action: "bulk_update",
    entity: "product",
    payload: {
      op: "csv_import",
      created: outcome.createdIds.length,
      updated: outcome.updatedIds.length,
      skipped: outcome.counts.unchanged,
      errors: outcome.counts.error,
      stockMoves: outcome.stockMoves,
      notStarted: outcome.notStarted,
      createdIds: outcome.createdIds,
      updatedIds: outcome.updatedIds,
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
  if (outcome.stockMoves > 0) revalidatePath("/admin/stok-hareketleri");

  return {
    phase: "done",
    fileName: file.fileName,
    rows: outcome.rows,
    counts: outcome.counts,
    notices:
      outcome.notStarted > 0
        ? [
            ...(preview.notices ?? []),
            `Süre yetmedi: ${outcome.notStarted} satır yazılmadı. Aynı dosyayı yeniden önizleyip içe aktar.`,
          ]
        : preview.notices,
  };
}
