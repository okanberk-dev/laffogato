"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { startCampaignSend } from "@/lib/admin/campaign-mail";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  CAMPAIGN_MAIL_APP_LINKS_MISSING,
  CAMPAIGN_MAIL_AUDIENCE_MISMATCH,
  CAMPAIGN_MAIL_FIELD_KEYS,
  campaignMailAudiencesFor,
  campaignMailHasFields,
  campaignMailTemplateAvailable,
  isCampaignMailAudience,
  isCampaignMailTemplate,
} from "@/lib/admin/campaign-mail-schema";
import { listAdminUsers } from "@/lib/admin/users";
import { isDbUnreachable } from "@/lib/db/health";
import {
  campaignFieldsSchema,
  createCampaignEmail,
  deleteCampaignEmail,
  getCampaignEmail,
  sendCampaignTest,
  updateCampaignEmail,
  type CampaignAudience,
} from "@/lib/email/campaigns";
import type { CampaignTemplateName } from "@/lib/email/send";
import { hasAppLinks } from "@/lib/mobile/app-store";

export interface CampaignMailState {
  message?: string;
  error?: string;
}

const LIST_PATH = "/admin/bulten/kampanya";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A stored instant as the operator reads it - Tuzla's clock, never the
 * server's. The schedule is agreed in Istanbul time, so it is confirmed back
 * in Istanbul time.
 */
const ISTANBUL_DATETIME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function scheduleLabel(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ISTANBUL_DATETIME.format(new Date(ms)) : iso;
}

/**
 * Rol kapısı her action'da ayrıca açılır: sayfadaki `requireRole` bir Server
 * Action'ı korumaz - action, sayfadan bağımsız çağrılabilen bir POST ucudur.
 * Kapı burada yoksa, paneli hiç açmamış biri de rıza vermiş her üyeye ticari
 * ileti gönderebilir.
 */

type ParsedDraft =
  | {
      ok: true;
      template: CampaignTemplateName;
      audience: CampaignAudience;
      fields: Record<string, string>;
      scheduledAt: string;
    }
  | { ok: false; error: string };

/**
 * FormData → the store's shape. Only the keys the form could have shown are
 * read, and only when present: a template's form carries that template's
 * fields alone, so switching template on a draft drops the other template's
 * values instead of storing them invisibly. The zod schema (B's, shared with
 * the post hook) trims, caps lengths, insists on https and defaults the
 * button URL; which fields the template REQUIRES is checked by the render
 * at "Gönder", so a half-written draft can still be saved.
 */
function parseDraft(formData: FormData): ParsedDraft {
  const template = String(formData.get("template") ?? "");
  if (!isCampaignMailTemplate(template)) {
    return { ok: false, error: "Şablon seçilmedi." };
  }
  // The panel greys the app announcement out until both store listings
  // exist; a forged or stale form gets the same sentence.
  if (!campaignMailTemplateAvailable(template, hasAppLinks())) {
    return { ok: false, error: CAMPAIGN_MAIL_APP_LINKS_MISSING };
  }
  const audience = String(formData.get("audience") ?? "");
  if (!isCampaignMailAudience(audience)) {
    return { ok: false, error: "Kitle geçersiz." };
  }
  // The store refuses this too (createCampaignEmail / updateCampaignEmail);
  // checked here so the form gets the sentence rather than a thrown one.
  if (!campaignMailAudiencesFor(template).includes(audience)) {
    return { ok: false, error: CAMPAIGN_MAIL_AUDIENCE_MISMATCH };
  }
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  // Fixed copy: nothing to read, nothing to validate. The shared schema
  // would otherwise insist on a title this template does not have.
  if (!campaignMailHasFields(template)) {
    return { ok: true, template, audience, fields: {}, scheduledAt };
  }
  const raw: Record<string, string> = {};
  for (const key of CAMPAIGN_MAIL_FIELD_KEYS) {
    if (formData.has(key)) raw[key] = String(formData.get(key) ?? "");
  }
  const parsed = campaignFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Kampanya alanları geçersiz.",
    };
  }
  // Zamanlama: boş = elle gönderilecek. Biçim denetimi sunucuda
  // (`normalizeScheduledAt`) - okunamayan bir değer sessizce "elle"ye döner,
  // kimsenin seçmediği bir saatte ticari ileti çıkmaz.
  return { ok: true, template, audience, fields: parsed.data, scheduledAt };
}

function describe(err: unknown): string {
  if (isDbUnreachable(err)) {
    return "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.";
  }
  return err instanceof Error ? err.message : String(err);
}

export async function createCampaignMailAction(
  _prev: CampaignMailState,
  formData: FormData,
): Promise<CampaignMailState> {
  const session = await requireRole("newsletter");
  const draft = parseDraft(formData);
  if (!draft.ok) return { error: draft.error };
  let id: string;
  try {
    const created = await createCampaignEmail({
      template: draft.template,
      audience: draft.audience,
      fields: draft.fields,
      scheduledAt: draft.scheduledAt,
      createdBy: session.email,
    });
    id = created.id;
    await logAudit({
      action: "create",
      entity: "campaign_email",
      entityId: created.id,
      payload: {
        template: created.template,
        audience: created.audience,
        subject: created.subject,
        scheduledAt: created.scheduledAt,
      },
    });
  } catch (err) {
    return { error: describe(err) };
  }
  revalidatePath(LIST_PATH);
  await setAdminFlash(
    "Taslak oluşturuldu. Önizle, kendine test gönder, sonra gönder.",
  );
  // Straight to the draft's own page: the preview and the test send live there.
  redirect(`${LIST_PATH}/${id}`);
}

export async function updateCampaignMailAction(
  id: string,
  _prev: CampaignMailState,
  formData: FormData,
): Promise<CampaignMailState> {
  await requireRole("newsletter");
  const draft = parseDraft(formData);
  if (!draft.ok) return { error: draft.error };
  let scheduledAt = "";
  try {
    const updated = await updateCampaignEmail(id, {
      template: draft.template,
      audience: draft.audience,
      fields: draft.fields,
      scheduledAt: draft.scheduledAt,
    });
    // Null for both "no such campaign" and "no longer a draft": the send log
    // was built from the fields as they were, so a queued campaign is fixed.
    if (!updated) {
      return {
        error:
          "Taslak bulunamadı ya da bu arada kuyruğa alınmış. Kuyruğa alınan bir kampanya düzenlenemez; yeni bir taslak aç.",
      };
    }
    scheduledAt = updated.scheduledAt;
    await logAudit({
      action: "update",
      entity: "campaign_email",
      entityId: id,
      payload: {
        template: updated.template,
        audience: updated.audience,
        subject: updated.subject,
        scheduledAt: updated.scheduledAt,
      },
    });
  } catch (err) {
    return { error: describe(err) };
  }
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return {
    message: scheduledAt
      ? `Taslak kaydedildi · ${scheduleLabel(scheduledAt)} için zamanlandı.`
      : "Taslak kaydedildi.",
  };
}

export async function deleteCampaignMailAction(formData: FormData) {
  await requireRole("newsletter");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  // Only a draft goes; a campaign with a send log is the record of who was
  // mailed what, and stays.
  const removed = await deleteCampaignEmail(id);
  if (removed) {
    await logAudit({
      action: "delete",
      entity: "campaign_email",
      entityId: id,
    });
  }
  revalidatePath(LIST_PATH);
}

const TEST_RECIPIENTS_ONLY = "Test yalnız panel kullanıcılarına gönderilir.";

/**
 * A test may go to the signed-in operator or to another panel account -
 * nobody else. It is a real commercial message with a dummy way out; typed
 * at a stranger's address it would be exactly the mail 6563 forbids, audit
 * row or not.
 */
async function isPanelAddress(
  to: string,
  session: { email: string },
): Promise<boolean> {
  if (to === session.email.trim().toLowerCase()) return true;
  const users = await listAdminUsers();
  return users.some((u) => u.isActive && u.email.trim().toLowerCase() === to);
}

/**
 * One real message to one inbox - the operator's own unless they type
 * another panel user's - outside the send log, with AD = Test and a dummy
 * way out on the same route the members' links use. The provider's verdict
 * is shown as it is: every other mail path swallows a delivery failure on
 * purpose, so this is where "domain not verified" gets to be read by a
 * person.
 */
export async function sendCampaignMailTestAction(
  id: string,
  _prev: CampaignMailState,
  formData: FormData,
): Promise<CampaignMailState> {
  const session = await requireRole("newsletter");
  const to = (
    String(formData.get("to") ?? "").trim() || session.email
  ).toLowerCase();
  if (!EMAIL_RE.test(to)) {
    return { error: "Test için geçerli bir e-posta gir." };
  }
  let c;
  try {
    if (!(await isPanelAddress(to, session))) {
      return { error: TEST_RECIPIENTS_ONLY };
    }
    c = await getCampaignEmail(id);
  } catch (err) {
    return { error: describe(err) };
  }
  if (!c) return { error: "Kampanya bulunamadı." };
  const result = await sendCampaignTest(c, to);
  if (!result.ok) return { error: `Gönderilemedi - ${result.error}` };
  // The address is the point of the audit row: a commercial message left the
  // building, and this is the one place its recipient is recorded.
  await logAudit({
    action: "send_test",
    entity: "campaign_email",
    entityId: id,
    payload: { to, template: c.template },
  });
  return { message: `Test e-postası ${to} adresine gönderildi.` };
}

/**
 * "Gönder": the audience goes into the send log now, the batches go out in
 * the background (`after()`), and the row on the list page tells the rest.
 * Safe to press twice - the enqueue skips everyone already queued - which is
 * also how a campaign left half-sent by a timeout is resumed by hand.
 */
export async function sendCampaignMailAction(
  id: string,
  _prev: CampaignMailState,
  _formData: FormData,
): Promise<CampaignMailState> {
  await requireRole("newsletter");
  let c;
  let total: number;
  try {
    c = await getCampaignEmail(id);
    if (!c) return { error: "Kampanya bulunamadı." };
    ({ total } = await startCampaignSend(id));
  } catch (err) {
    // A missing field ("doldurulmamış alan - [KAMPANYA_METIN]"), a campaign
    // that is already sent, or the database: the message names which.
    return { error: `Gönderim başlatılamadı - ${describe(err)}` };
  }
  await logAudit({
    action: "send",
    entity: "campaign_email",
    entityId: id,
    payload: {
      template: c.template,
      audience: c.audience,
      subject: c.subject,
      total,
    },
  });
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  if (total === 0) {
    // What the runner does with an empty send log: no batch, no failure -
    // the row closes as 'sent' with zero recipients (runCampaignEmail).
    return {
      message:
        "Kitle boş: bu kampanya için gönderilecek adres yok; kampanya 0 alıcıyla “Gönderildi” olarak kapanır.",
    };
  }
  return {
    message: `${total} adres kuyruğa alındı; gönderim arka planda sürüyor. Sayacı görmek için sayfayı yenile.`,
  };
}
