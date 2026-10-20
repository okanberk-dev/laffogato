"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
  type ActionResult,
} from "@/lib/admin/action-result";
import { safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  consentSaveRefusal,
  consentScope,
  legalDocSchema,
  resolveEffectiveDate,
} from "@/lib/admin/legal-schema";
import {
  isLiveLegalOverride,
  istanbulDayLabel,
} from "@/lib/legal/consent-version";
import { findLegalDoc } from "@/lib/legal/documents";
import { liveLegalDoc } from "@/lib/legal/karaoke-doc";
import {
  getLegalDocOverride,
  getLegalOverrideArchive,
  legalDocRow,
  listConsentArchive,
  listLegalDocOverrides,
  resetLegalDoc,
  upsertLegalDoc,
  type LegalDocInput,
} from "@/lib/legal/store";
import {
  legalVersionOf,
  shownVersionDoc,
  type ShownOverride,
} from "@/lib/legal/version-core";
import { recordLegalVersions } from "@/lib/legal/versions";

// Every export here is a public POST endpoint (CLAUDE.md rule 27): each one
// checks the session and the owner-only `legal` section itself.

function readForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function revalidateLegal(slug: string) {
  revalidatePath("/admin/hukuk");
  revalidatePath(`/admin/hukuk/${slug}`);
  revalidatePath(`/hukuk/${slug}`);
  revalidatePath("/hukuk");
}

/**
 * Why writing `next` would make a consent record name the wrong text
 * (consentSaveRefusal), or null. Reads the overrides and the archive of the
 * consent's documents only for a checkout or karaoke document that goes
 * live.
 */
async function consentRefusal(
  slug: string,
  next: LegalDocInput,
  at: string,
): Promise<string | null> {
  const after = { ...next, updatedAt: at };
  const scope = consentScope(slug);
  if (!scope || !isLiveLegalOverride(after)) return null;
  const [overrides, archived] = await Promise.all([
    listLegalDocOverrides(),
    listConsentArchive(scope.docs),
  ]);
  return consentSaveRefusal({
    slug,
    before: overrides[slug] ?? null,
    after,
    overrides,
    archived,
  });
}

const VERSION_NOT_STORED =
  "Metin şu an kaydedilemedi: gösterilen sürüm arşive yazılamadı. Birazdan yeniden dene.";

/**
 * The text /hukuk/<slug> shows now and the one it will show once `after`
 * is written (null: the coded text), both stored in `legal_doc_versions`
 * BEFORE the change (decision D-VERSIONS-TABLE): no text goes live, and none
 * goes away, without its copy. Their hashes go into the audit row. Null when
 * the copy could not be stored; the change is then refused.
 *
 * Not exported: every export of a "use server" file is a public endpoint
 * (CLAUDE.md rule 27).
 */
async function storeShownTexts(
  slug: string,
  after: ShownOverride | null,
): Promise<{ before: string; after: string } | null> {
  try {
    const doc = await liveLegalDoc(slug);
    if (!doc) return null;
    const current = await getLegalDocOverride(slug);
    const before = legalVersionOf(shownVersionDoc(doc, current));
    const next = legalVersionOf(shownVersionDoc(doc, after));
    await recordLegalVersions([before, next]);
    return { before: before.hash, after: next.hash };
  } catch (err) {
    console.error(
      `[admin/hukuk] ${slug}: shown texts not stored`,
      err instanceof Error ? err.message.slice(0, 160) : "unknown",
    );
    return null;
  }
}

/** The editor's save; a success goes back to the list with a toast. */
export async function updateLegalDocAction(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("legal");
  const doc = findLegalDoc(slug);
  if (!doc) return actionError("Belge bulunamadı.");
  const parsed = legalDocSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return actionError(
      "Formdaki uyarıları gider.",
      fieldErrorsFromIssues(parsed.error.issues),
    );
  }
  const at = new Date().toISOString();
  const next: LegalDocInput = {
    ...parsed.data,
    effectiveDate: resolveEffectiveDate(
      parsed.data.effectiveDate,
      parsed.data.isPublished,
      at,
    ),
  };
  const refusal = await consentRefusal(slug, next, at);
  if (refusal) {
    return actionError("Formdaki uyarıları gider.", {
      effectiveDate: refusal,
    });
  }
  const texts = await storeShownTexts(slug, legalDocRow(slug, next, at));
  if (!texts) return actionError(VERSION_NOT_STORED);
  const saved = await upsertLegalDoc(slug, next, { by: session.email });
  await safeAudit({
    action: "update",
    entity: "legal_doc",
    entityId: slug,
    payload: {
      published: next.isPublished,
      effectiveDate: next.effectiveDate,
      archivedId: saved.archivedId,
      textHashBefore: texts.before,
      textHashAfter: texts.after,
    },
  });
  revalidateLegal(slug);
  await setAdminFlash(
    next.isPublished
      ? `${doc.title} kaydedildi ve yayında.`
      : `${doc.title} taslak olarak kaydedildi; sitede hazır metin görünüyor.`,
  );
  redirect("/admin/hukuk");
}

/**
 * "Varsayılana döndür", behind a confirm. It used to delete the override on
 * one click with no answer; the text is now archived first and can be put
 * back (restoreLegalDocAction).
 */
export async function resetLegalDocAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("legal");
  const slug = String(formData.get("slug") ?? "");
  const doc = findLegalDoc(slug);
  if (!doc) return actionError("Belge bulunamadı.");
  // The coded text comes back: stored with the one it replaces, first.
  const texts = await storeShownTexts(slug, null);
  if (!texts) return actionError(VERSION_NOT_STORED);
  const archivedId = await resetLegalDoc(slug, { by: session.email });
  revalidateLegal(slug);
  if (!archivedId) {
    return actionError("Bu belgenin özel metni zaten yok; sayfa yenilendi.");
  }
  await safeAudit({
    action: "delete",
    entity: "legal_doc",
    entityId: slug,
    payload: {
      reset: true,
      archivedId,
      textHashBefore: texts.before,
      textHashAfter: texts.after,
    },
  });
  return actionOk(
    `${doc.title} sitedeki hazır metne döndü. Özel metin arşivde; oradan geri yükleyebilirsin.`,
  );
}

/**
 * Puts an archived text back as it was (published or draft). The text it
 * replaces is archived in turn. A consent document whose old date would now
 * make orders record the wrong text comes back as a draft when nothing live
 * is replaced, and is refused when something is.
 */
export async function restoreLegalDocAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("legal");
  const archived = await getLegalOverrideArchive(
    String(formData.get("id") ?? ""),
  );
  if (!archived) {
    return actionError("Bu arşiv kaydı bulunamadı; sayfayı yenile.");
  }
  const slug = archived.slug;
  const doc = findLegalDoc(slug);
  if (!doc) return actionError("Bu belge artık sitede yok.");

  const at = new Date().toISOString();
  // A text published without a date counted from the day it was saved; that
  // day becomes its date, so the restore does not move it to today.
  const effectiveDate =
    archived.isPublished && !archived.effectiveDate.trim()
      ? (istanbulDayLabel(archived.updatedAt) ?? "")
      : archived.effectiveDate;
  let next: LegalDocInput = {
    title: archived.title,
    summary: archived.summary,
    effectiveDate,
    bodyMarkdown: archived.bodyMarkdown,
    isPublished: archived.isPublished,
  };
  const refusal = await consentRefusal(slug, next, at);
  if (refusal) {
    if (isLiveLegalOverride(await getLegalDocOverride(slug))) {
      return actionError(
        `Geri yüklenmedi. ${refusal} Yayındaki metne dokunulmadı.`,
      );
    }
    next = { ...next, isPublished: false };
  }

  const texts = await storeShownTexts(slug, legalDocRow(slug, next, at));
  if (!texts) return actionError(VERSION_NOT_STORED);
  const saved = await upsertLegalDoc(slug, next, { by: session.email });
  await safeAudit({
    action: "update",
    entity: "legal_doc",
    entityId: slug,
    payload: {
      restoredFrom: archived.id,
      published: next.isPublished,
      archivedId: saved.archivedId,
      textHashBefore: texts.before,
      textHashAfter: texts.after,
    },
  });
  revalidateLegal(slug);
  if (refusal) {
    return actionOk(
      `${doc.title} taslak olarak geri yüklendi. ${refusal} Düzenle'den tarihi güncelleyip yayınla.`,
      "warning",
    );
  }
  return actionOk(
    next.isPublished
      ? `${doc.title} geri yüklendi ve yayında.`
      : `${doc.title} taslak olarak geri yüklendi.`,
  );
}
