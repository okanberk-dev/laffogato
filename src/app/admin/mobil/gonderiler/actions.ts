"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { appContentFieldErrors } from "@/lib/admin/app-content-schema";
import { logAudit } from "@/lib/admin/audit";
import { requireRole, type AdminSession } from "@/lib/admin/auth";
import { deletedAnswer } from "@/lib/admin/delete-answer";
import { startCampaignSend } from "@/lib/admin/campaign-mail";
import { setAdminFlash } from "@/lib/admin/flash";
import type { AdminFlashTone } from "@/lib/admin/flash-core";
import { isPublishWindowOpen } from "@/lib/admin/publish-window";
import { canAccess } from "@/lib/admin/roles";
import {
  moveAnswer,
  readActiveForm,
  readMoveForm,
} from "@/lib/admin/list-order";
import {
  createAppPost,
  deleteAppPost,
  moveAppPost,
  setAppPostActive,
  setAppPostEmailCampaign,
  updateAppPost,
  type AdminAppPost,
  type AppPostInput,
  type AppPostKind,
} from "@/lib/admin/store";
import {
  campaignFromPost,
  createCampaignEmail,
  deleteCampaignEmail,
} from "@/lib/email/campaigns";

const LIST_PATH = "/admin/mobil/gonderiler";
const REFUSED = "Formdaki uyarıları gider.";
const GONE = "Bu gönderi silinmiş; listeye dön.";

/**
 * Her action kendi rol kapısını açar.
 *
 * Sayfadaki `requireRole` bunları KORUMAZ: bir Server Action, sayfadan
 * bağımsız olarak çağrılabilen bir POST uç noktasıdır. Kapı burada yoksa,
 * panelin kendisini hiç açmamış biri de her telefona düşen ana sayfa
 * içeriğini değiştirebilir.
 */
function parseInput(formData: FormData): AppPostInput {
  return {
    // The store normalises an unknown kind to "campaign"; this cast shapes the
    // argument, it does not trust it.
    kind: String(formData.get("kind") ?? "campaign") as AppPostKind,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    image: String(formData.get("image") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? ""),
    linkLabel: String(formData.get("linkLabel") ?? ""),
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
    isActive: formData.get("isActive") === "on",
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  };
}

// ── The automatic campaign e-mail ─────────────────────────────────────────

type MailOutcome =
  | { kind: "queued"; campaignId: string; total: number }
  /**
   * Nothing sent. `not_live`: the box was ticked but the post is off or
   * outside its window, which the operator is told; the other reasons
   * (box off, already mailed, another save marked it first) say nothing.
   */
  | { kind: "skipped"; reason: "not_asked" | "not_live" | "already" }
  | { kind: "failed"; campaignId: string };

/**
 * Whether this save may mail the members. A post's mail is a commercial
 * message to everyone with marketing consent (6563), the same send as the
 * Kampanya e-postası page, so it takes the same trust: the `newsletter`
 * role as well as `mobileApp` (decision D27). The two hold the same roles
 * today; this keeps it so if Personel is ever given the app content.
 */
function mayMailMembers(session: Pick<AdminSession, "role">): boolean {
  return Boolean(session.role) && canAccess("newsletter", session.role);
}

/**
 * A post that is live right now - active, and inside its publish window -
 * becomes ONE `kampanya-duyuru` campaign to the members with marketing
 * consent, when the form asked for it.
 *
 * Idempotency is the mark on the post (`emailCampaignId`), written before
 * the campaign is queued and never cleared: a later save, whatever the
 * checkbox says, finds the mark and sends nothing. A scheduled post (start
 * in the future) is not live, so nothing is sent and nothing is marked; when
 * it goes live no hook fires - the form says so, and the campaign page is
 * where that mail is sent by hand.
 *
 * Nothing here can undo the save that just happened, so a failure is
 * recorded (console, and the outcome the save's toast shows) rather than
 * thrown: the post is on every phone either way, and an error page would
 * only tempt a second submit that creates a second post.
 */
async function emailMembersForPost(
  post: AdminAppPost,
  wanted: boolean,
  actor: string,
): Promise<MailOutcome> {
  if (!wanted) return { kind: "skipped", reason: "not_asked" };
  if (post.emailCampaignId) return { kind: "skipped", reason: "already" };
  if (!post.isActive || !isPublishWindowOpen(post)) {
    return { kind: "skipped", reason: "not_live" };
  }
  let campaignId = "";
  try {
    const created = await createCampaignEmail({
      ...campaignFromPost(post),
      createdBy: actor,
    });
    campaignId = created.id;
    const marked = await setAppPostEmailCampaign(post.id, created.id);
    if (!marked) {
      // Another save marked the post first (or it was deleted meanwhile);
      // its campaign is the one that counts, this draft would be a second.
      await deleteCampaignEmail(created.id);
      return { kind: "skipped", reason: "already" };
    }
    const { total } = await startCampaignSend(created.id);
    await logAudit({
      action: "send",
      entity: "campaign_email",
      entityId: created.id,
      payload: {
        sourcePostId: post.id,
        template: created.template,
        audience: created.audience,
        total,
      },
    });
    return { kind: "queued", campaignId: created.id, total };
  } catch (err) {
    console.error(`[campaign] gönderi ${post.id}: otomatik e-posta`, err);
    // With a campaign id the draft exists and is marked on the post: the
    // list page points the operator at it, where the missing piece is named.
    return { kind: "failed", campaignId };
  }
}

/**
 * The save's toast, with what happened to the mail. It used to ride in the
 * list's address (`?eposta=kuyrukta&adet=12`), so it came back on every
 * reload and stayed after the operator deleted posts on that page. The
 * list row keeps the lasting answer: the campaign's own status.
 */
function savedFlash(
  saved: string,
  outcome: MailOutcome,
): { message: string; tone: AdminFlashTone } {
  switch (outcome.kind) {
    case "queued":
      return outcome.total > 0
        ? {
            message: `${saved} ${outcome.total} üyeye kampanya e-postası kuyruğa alındı; gönderim arka planda sürüyor.`,
            tone: "success",
          }
        : {
            message: `${saved} Pazarlama izni olan üye bulunamadı; e-posta çıkmadı.`,
            tone: "warning",
          };
    case "failed":
      return {
        message: outcome.campaignId
          ? `${saved} Kampanya e-postası kuyruğa alınamadı: taslağı "Kampanya e-postası" sayfasında tamamlayıp oradan gönder.`
          : `${saved} Kampanya e-postası oluşturulamadı; "Kampanya e-postası" sayfasından elle açabilirsin.`,
        tone: "warning",
      };
    case "skipped":
      return outcome.reason === "not_live"
        ? {
            message: `${saved} Gönderi şu an yayında olmadığı için e-posta gitmedi; yayına girince "Kampanya e-postası" sayfasından gönder.`,
            tone: "warning",
          }
        : { message: saved, tone: "success" };
  }
}

/**
 * Answers with an ActionResult for ActionForm (field errors under their
 * fields); a save that went through redirects with its toast. It used to
 * return nothing on a blank title, and a second press before the first
 * answer created a second post (ActionForm drops it now).
 */
export async function createPostAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("mobileApp");
  const input = parseInput(formData);
  // The HTML `required` attribute is not a guard on a Server Action, and the
  // store only trims the title - a titleless row renders as an empty card on
  // every phone.
  const fieldErrors = appContentFieldErrors(input);
  if (Object.keys(fieldErrors).length) return actionError(REFUSED, fieldErrors);
  const created = await createAppPost(input);
  await logAudit({
    action: "create",
    entity: "app_post",
    entityId: created.id,
    payload: { title: created.title, kind: created.kind },
  });
  const outcome = await emailMembersForPost(
    created,
    mayMailMembers(session) && formData.get("emailMembers") === "on",
    session.email,
  );
  revalidatePath(LIST_PATH);
  const flash = savedFlash(`"${created.title}" gönderisi eklendi.`, outcome);
  await setAdminFlash(flash.message, flash.tone);
  redirect(LIST_PATH);
}

export async function updatePostAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("mobileApp");
  const input = parseInput(formData);
  const fieldErrors = appContentFieldErrors(input);
  if (Object.keys(fieldErrors).length) return actionError(REFUSED, fieldErrors);
  const updated = await updateAppPost(id, input);
  // The row was deleted while this form was open; without the check the audit
  // log claims an update that never happened.
  if (!updated) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "app_post",
    entityId: id,
    payload: { title: input.title, isActive: input.isActive },
  });
  // `updated` is the row as stored, mark included - so a post that already
  // had its campaign is recognised here, whatever the checkbox says.
  const outcome = await emailMembersForPost(
    updated,
    mayMailMembers(session) && formData.get("emailMembers") === "on",
    session.email,
  );
  revalidatePath(LIST_PATH);
  const flash = savedFlash(`"${updated.title}" kaydedildi.`, outcome);
  await setAdminFlash(flash.message, flash.tone);
  redirect(LIST_PATH);
}

/**
 * "Sil", behind a confirm. It used to delete on the first click, silently.
 * Not "kalktı": phones read the home content through a shared cache, so it
 * takes a few minutes to leave every phone (see the slide delete).
 */
export async function deletePostAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Gönderi seçilmedi.");
  const removed = await deleteAppPost(id);
  revalidatePath(LIST_PATH);
  if (!removed) return actionError("Gönderi zaten silinmiş.");
  await logAudit({ action: "delete", entity: "app_post", entityId: id });
  return deletedAnswer(
    formData,
    "Gönderi silindi; uygulamadan birkaç dakika içinde kalkar.",
    LIST_PATH,
  );
}

/**
 * "Yayına al" / "Yayından kaldır" from the list: one click, reversible. It
 * never mails the members: a post's e-mail is the form's step
 * (emailMembersForPost, with its checkbox), never a side effect of the list.
 */
export async function setPostActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const form = readActiveForm(formData);
  if (!form.ok) return actionError(form.error);
  const found = await setAppPostActive(form.id, form.isActive);
  revalidatePath(LIST_PATH);
  if (!found) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "app_post",
    entityId: form.id,
    payload: { isActive: form.isActive },
  });
  return actionOk(
    form.isActive
      ? "Gönderi yayına alındı; telefonlara birkaç dakika içinde ulaşır."
      : "Gönderi yayından kaldırıldı; uygulamadan birkaç dakika içinde kalkar.",
  );
}

/** The ↑ / ↓ beside each row (the list unfiltered). */
export async function movePostAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const form = readMoveForm(formData);
  if (!form.ok) return actionError(form.error);
  const outcome = await moveAppPost(form.id, form.direction);
  if (outcome === "moved") {
    await logAudit({
      action: "update",
      entity: "app_post",
      entityId: form.id,
      payload: { move: form.direction },
    });
    revalidatePath(LIST_PATH);
  }
  return moveAnswer(outcome, form.direction, "Gönderi", GONE);
}
