"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { startCampaignSend } from "@/lib/admin/campaign-mail";
import { setAdminFlash } from "@/lib/admin/flash";
import { isPublishWindowOpen } from "@/lib/admin/publish-window";
import {
  createAppPost,
  deleteAppPost,
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
  | { kind: "skipped" }
  | { kind: "failed"; campaignId: string };

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
 * recorded (console, and the outcome the list page shows) rather than
 * thrown: the post is on every phone either way, and an error page would
 * only tempt a second submit that creates a second post.
 */
async function emailMembersForPost(
  post: AdminAppPost,
  wanted: boolean,
  actor: string,
): Promise<MailOutcome> {
  if (
    !wanted ||
    !post.isActive ||
    !isPublishWindowOpen(post) ||
    post.emailCampaignId
  ) {
    return { kind: "skipped" };
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
      return { kind: "skipped" };
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

/** Where the list page reads the hook's outcome from (see its banner). */
function listPathAfter(outcome: MailOutcome): string {
  switch (outcome.kind) {
    case "queued":
      return `${LIST_PATH}?eposta=kuyrukta&adet=${outcome.total}`;
    case "failed":
      return `${LIST_PATH}?eposta=hata${
        outcome.campaignId
          ? `&kampanya=${encodeURIComponent(outcome.campaignId)}`
          : ""
      }`;
    default:
      return LIST_PATH;
  }
}

export async function createPostAction(formData: FormData) {
  const session = await requireRole("mobileApp");
  const input = parseInput(formData);
  if (!input.title.trim()) return;
  const created = await createAppPost(input);
  await logAudit({
    action: "create",
    entity: "app_post",
    entityId: created.id,
    payload: { title: created.title, kind: created.kind },
  });
  const outcome = await emailMembersForPost(
    created,
    formData.get("emailMembers") === "on",
    session.email,
  );
  revalidatePath(LIST_PATH);
  await setAdminFlash(`"${created.title}" gönderisi eklendi.`);
  redirect(listPathAfter(outcome));
}

export async function updatePostAction(id: string, formData: FormData) {
  const session = await requireRole("mobileApp");
  const input = parseInput(formData);
  // Same guard as the create action: the HTML `required` attribute is not a
  // guard on a Server Action, and the store only trims the title - a titleless
  // row renders as an empty card on every phone.
  if (!input.title.trim()) return;
  const updated = await updateAppPost(id, input);
  // The row was deleted while this form was open; without the check the audit
  // log claims an update that never happened.
  if (!updated) return;
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
    formData.get("emailMembers") === "on",
    session.email,
  );
  revalidatePath(LIST_PATH);
  await setAdminFlash(`"${updated.title}" kaydedildi.`);
  redirect(listPathAfter(outcome));
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
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
  return actionOk("Gönderi silindi, uygulamadan kalktı.");
}
