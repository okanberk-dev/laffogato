import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import {
  APP_POST_KIND_LABELS,
  type AppPostKind,
} from "@/lib/admin/app-content-schema";
import {
  CAMPAIGN_MAIL_APP_LINKS_MISSING,
  campaignMailHasFields,
  campaignMailTemplateAvailable,
} from "@/lib/admin/campaign-mail-schema";
import type { AdminAppPost } from "@/lib/admin/store";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import {
  assertIysSendable,
  isIysGateError,
  iysSendGate,
  reconcileIysQuietly,
} from "@/lib/iys/gate";
import { hasAppLinks } from "@/lib/mobile/app-store";
import { SITE } from "@/lib/seo/site";

import { renderEmail, type RenderedEmail } from "./render";
import {
  CAMPAIGN_TEMPLATES,
  deliverBatch,
  sendCampaignMail,
  stampTarget,
  unsubscribeUrlFor,
  type BatchMessage,
  type CampaignTemplateName,
  type SendResult,
} from "./send";
import { EMAIL_TEMPLATES } from "./templates.generated";
import { EMAIL_TEXT } from "./text";
import { loadVenueVars } from "./venue";

/**
 * Campaign e-mail: audience → queue → batches → send log.
 *
 * A campaign is a `campaign_emails` row the panel composes (template, the
 * template's `[ALAN]` values, which consent store the recipients come from).
 * "Gönder" materialises the audience into `campaign_email_sends` - one row
 * per address, in batches of 100 - and a runner works the batches through
 * Resend's batch endpoint, settling each batch with one UPDATE.
 *
 * The audience RULE lives in the database (`campaign_email_audience`, see
 * db/migrations/20260908150000_campaign_emails.sql and the amendments in
 * 20260908170000_campaign_email_reconsent.sql): the panel's dry count, the
 * enqueue AND the claim read the same function, so a person who withdraws
 * between "Gönder" and their batch is skipped, not mailed. The five plpgsql
 * helpers (audience, count, enqueue, claim, mark) are the only writes to the
 * send log that touch more than one row; on a max:1 pool a hundred
 * single-row updates per batch is the difference between a send finishing
 * and a function timing out.
 *
 * Idempotency, twice: a (campaign, address) pair is unique, so re-queueing a
 * campaign adds newcomers and never repeats anyone; and the provider key of a
 * batch is `cmp-<campaignId>-b<batchNo>`, so a batch retried after a crash is
 * the same request and Resend dedupes it within 24 hours. That key is only
 * ever posted with ONE address set: a skipped row that comes back to the
 * queue gets a fresh batch number, and the claim is serialised per campaign
 * in the database (the campaign row is locked for the statement), so two
 * runners never split a batch between them. The runner writes `postedAt` on
 * the batch BEFORE the POST; a batch posted but never settled is re-posted
 * under its key only inside that window, and settled as failed by the claim
 * once the window has closed - never mailed a second time. A mark settles
 * only the rows of the runner's own claim (`claimedAt`), so a runner that
 * stalled and lost its batch to another cannot settle what it did not send.
 */

export type CampaignStatus =
  "draft" | "queued" | "sending" | "sent" | "failed" | "cancelled";

export type CampaignAudience = "marketing" | "newsletter" | "both";

/** The member preference an audience of members is read from. */
export type CampaignPref = "marketing" | "newsletter";

export interface CampaignEmail {
  id: string;
  template: CampaignTemplateName;
  status: CampaignStatus;
  audience: CampaignAudience;
  subject: string;
  fields: Record<string, string>;
  sourcePostId: string;
  createdBy: string;
  createdAt: string;
  /**
   * When the operator wants this to go out, ISO-8601, or "" for "by hand".
   * Read only while the campaign is still a draft: the hourly cron queues
   * every draft whose moment has passed, which is the whole of the "özel
   * günler" feature. After the queue it is history, not a schedule.
   */
  scheduledAt: string;
  queuedAt: string;
  sentAt: string;
  total: number;
  sentCount: number;
  failedCount: number;
  lastError: string;
}

export interface CampaignInput {
  template: CampaignTemplateName;
  audience: CampaignAudience;
  fields: Record<string, string>;
  sourcePostId?: string;
  createdBy: string;
  /** ISO-8601 instant, or "" - see `CampaignEmail.scheduledAt`. */
  scheduledAt?: string;
}

export const CAMPAIGN_AUDIENCES: readonly CampaignAudience[] = [
  "marketing",
  "newsletter",
  "both",
];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Taslak",
  queued: "Kuyrukta",
  sending: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Başarısız",
  cancelled: "İptal edildi",
};

export const CAMPAIGN_AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  marketing: "Pazarlama izni olan üyeler",
  newsletter: "Bülten aboneleri",
  both: "İkisi birden (adres başına bir kez)",
};

/** A campaign may be (re)queued from these; sent and cancelled are final. */
const QUEUEABLE: readonly CampaignStatus[] = [
  "draft",
  "queued",
  "sending",
  "failed",
];

/** A batch left 'sending' longer than this belongs to a runner that died. */
const STALE_AFTER_MS = 15 * 60_000;
/**
 * Resend keeps an idempotency key for 24 hours, counted from ITS receipt of
 * the first request. A batch posted earlier than this and never settled
 * cannot be re-posted safely: the same key would be accepted as a new
 * request and the batch delivered twice. The threshold is checked when the
 * batch is CLAIMED, and the retry POST comes later - after the render, the
 * pause between batches and up to three 429 back-offs, on a clock that is
 * not the provider's - so the window is treated as 22 hours: two hours of
 * margin against a claim at 23:58 whose POST lands at 24:01.
 */
const POSTED_EXPIRES_MS = 22 * 60 * 60_000;
/** Resend allows 10 requests a second; a pause between batches keeps well under it. */
const BATCH_DELAY_MS = 200;
/** Wait after a 429 when the provider does not say how long. */
const RETRY_DELAY_MS = 1_000;
const MAX_RATE_LIMIT_RETRIES = 3;
/** Under Vercel's 300 s function cap, with room to settle the last batch. */
const DEFAULT_DEADLINE_MS = 240_000;
/** Written to `campaign_email_sends.error` for a row the template rejected. */
const RENDER_FAILED = "hazırlanamadı";
const DRY_RUN_NOTE =
  "Kuru çalışma (CAMPAIGN_EMAIL_DRY_RUN=1): derlendi, hiçbir e-posta gönderilmedi.";
const NO_PROVIDER = "RESEND_API_KEY tanımlı değil.";

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

/** `ed**@<domain>` - enough to recognise a row in a log, not to be one. */
function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "***";
  const local = address.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}${address.slice(at)}`;
}

function sleep(ms: number): Promise<void> {
  return ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();
}

// ── Fields ─────────────────────────────────────────────────────────────────

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .optional();

/**
 * The same parse the mobile-content store applies to a post link: `new URL`
 * rejects what a regex waves through, and the protocol test rejects
 * `javascript:` and `data:` - the two that turn a link into an injection.
 * A data: image in particular cannot go into mail at all.
 */
const httpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `${label} çok uzun.`)
    .refine((v) => v === "" || isHttpsUrl(v), {
      message: `${label} https ile başlayan tam bir adres olmalı.`,
    })
    .optional();

const fieldsShape = z.object({
  KAMPANYA_EYEBROW: optionalText(32, "Üst başlık"),
  KAMPANYA_BASLIK: z
    .string()
    .trim()
    .min(1, "Başlık gerekli.")
    .max(80, "Başlık en fazla 80 karakter olabilir."),
  KAMPANYA_ALT: optionalText(140, "Alt başlık"),
  KAMPANYA_METIN: optionalText(600, "Metin"),
  KAMPANYA_VURGU: optionalText(80, "Vurgu"),
  KAMPANYA_GORSEL_URL: httpsUrl("Görsel adresi"),
  KAMPANYA_GORSEL_ALT: optionalText(120, "Görsel açıklaması"),
  KAMPANYA_BUTON: optionalText(32, "Buton"),
  KAMPANYA_URL: httpsUrl("Buton adresi"),
  KAMPANYA_TARIH: optionalText(40, "Tarih"),
  KAMPANYA_DIPNOT: optionalText(160, "Dipnot"),
  KUPON_KODU: optionalText(24, "Kupon kodu"),
  SON_KULLANIM: optionalText(40, "Son kullanım"),
  ETKINLIK_YER: optionalText(60, "Etkinlik yeri"),
  ETKINLIK_TARIH: optionalText(60, "Etkinlik tarihi"),
  ETKINLIK_SAAT: optionalText(60, "Etkinlik saati"),
  ADIM_1_BASLIK: optionalText(80, "1. adım başlığı"),
  ADIM_1_METIN: optionalText(140, "1. adım metni"),
  ADIM_2_BASLIK: optionalText(80, "2. adım başlığı"),
  ADIM_2_METIN: optionalText(140, "2. adım metni"),
  ADIM_3_BASLIK: optionalText(80, "3. adım başlığı"),
  ADIM_3_METIN: optionalText(140, "3. adım metni"),
  INDIRIM_ORAN: optionalText(8, "İndirim oranı"),
  INDIRIM_URUN: optionalText(80, "İndirimli ürün"),
  // bulten-kampanya's three product cards.
  URUN_1_AD: optionalText(60, "1. ürün adı"),
  URUN_1_NOT: optionalText(140, "1. ürün notu"),
  URUN_1_FIYAT: optionalText(24, "1. ürün fiyatı"),
  URUN_2_AD: optionalText(60, "2. ürün adı"),
  URUN_2_NOT: optionalText(140, "2. ürün notu"),
  URUN_2_FIYAT: optionalText(24, "2. ürün fiyatı"),
  URUN_3_AD: optionalText(60, "3. ürün adı"),
  URUN_3_NOT: optionalText(140, "3. ürün notu"),
  URUN_3_FIYAT: optionalText(24, "3. ürün fiyatı"),
});

/**
 * The template values as stored: unknown keys dropped, every value trimmed
 * and length-capped, both URLs https-only, the button URL defaulting to the
 * campaigns page. Empty values are dropped rather than stored as "" so the
 * templates' `<!--IF:GORSEL-->`-style sections read the same either way.
 *
 * Which keys a given template REQUIRES is the template's own business:
 * `queueCampaignEmail` renders one sample first and refuses to queue a
 * campaign with a hole in it.
 */
export const campaignFieldsSchema: z.ZodType<Record<string, string>> =
  fieldsShape.transform((parsed) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value !== "") out[key] = value;
    }
    if (!out.KAMPANYA_URL) out.KAMPANYA_URL = `${SITE.url}/kampanyalar`;
    return out;
  });

/**
 * The stored values for a template. A fixed-copy template (the app
 * announcement) has no fields and stores none: its subject and text are the
 * template's, and the one value it needs, the stamp target, is the server's.
 */
function parseFields(
  template: CampaignTemplateName,
  raw: Record<string, string>,
): Record<string, string> {
  if (!campaignMailHasFields(template)) return {};
  const parsed = campaignFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.message ?? "Kampanya alanları geçersiz.");
  }
  return parsed.data;
}

/**
 * Turkey has been on UTC+3 all year round since September 2016 - no summer
 * time, no second offset to guess. So a wall-clock the operator types is an
 * instant, deterministically.
 */
const ISTANBUL_OFFSET = "+03:00";

/** `<input type="datetime-local">`: local wall time, no zone. */
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * A stored `scheduledAt`: an ISO-8601 instant, or "".
 *
 * The panel's `datetime-local` input carries NO zone, and `Date.parse` on a
 * zoneless string uses the running machine's - which on Vercel is UTC. An
 * operator who typed "14 Şubat 09:00" would have got 12:00 in Tuzla. So a
 * zoneless value is read as Istanbul wall time, explicitly; a value that
 * already names a zone is taken as it is.
 *
 * Anything unparseable becomes "": a campaign whose schedule could not be
 * read waits for a person rather than going out at an hour nobody chose.
 */
function normalizeScheduledAt(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const ms = Date.parse(
    LOCAL_DATETIME.test(value) ? `${value}${ISTANBUL_OFFSET}` : value,
  );
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

/**
 * The stored instant back as the `datetime-local` value that produced it -
 * Istanbul wall time, minutes, no zone. Without this the edit form would
 * reopen a 09:00 schedule as 06:00 and saving it again would walk it back
 * three hours every time.
 */
export function scheduledAtInputValue(iso: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  // +03:00 shifted onto the UTC clock, then the ISO text cut at the minute.
  return new Date(ms + 3 * 60 * 60_000).toISOString().slice(0, 16);
}

/**
 * The subject IS the campaign title, for every template with fields; a
 * fixed-copy template carries its own (`data-subject`).
 */
export function subjectFor(input: {
  fields: Record<string, string>;
  template?: CampaignTemplateName;
}): string {
  if (input.template && !campaignMailHasFields(input.template)) {
    return EMAIL_TEMPLATES[input.template]?.subject ?? "";
  }
  return (input.fields.KAMPANYA_BASLIK ?? "").trim();
}

/**
 * The values a campaign's template needs that no form supplies, resolved
 * before the synchronous render: the footer's phone, address and hours
 * (every template), and `[DAMGA_HEDEFI]`, which the app announcement quotes
 * ("6 damgada bir içecek bizden") from the panel's loyalty settings - asked
 * for only by a template that carries it.
 */
export async function campaignServerVars(
  template: CampaignTemplateName,
): Promise<Record<string, string>> {
  const html = EMAIL_TEMPLATES[template]?.html ?? "";
  const text = EMAIL_TEXT[template] ?? "";
  // The footer's phone, address and hours from Ayarlar (`venue.ts`).
  const venue = await loadVenueVars();
  if (!`${html}${text}`.includes("[DAMGA_HEDEFI]")) return venue;
  return { ...venue, DAMGA_HEDEFI: await stampTarget() };
}

/** The app announcement without both store links is refused everywhere. */
function assertTemplateAvailable(template: CampaignTemplateName): void {
  if (!campaignMailTemplateAvailable(template, hasAppLinks())) {
    throw new Error(CAMPAIGN_MAIL_APP_LINKS_MISSING);
  }
}

/** Which member preference a template's audience of members is read from. */
export function prefForTemplate(template: CampaignTemplateName): CampaignPref {
  return template === "bulten-kampanya" ? "newsletter" : "marketing";
}

function assertTemplate(value: string): CampaignTemplateName {
  if (!(CAMPAIGN_TEMPLATES as readonly string[]).includes(value)) {
    throw new Error(`Bilinmeyen kampanya şablonu: ${value}`);
  }
  return value as CampaignTemplateName;
}

function assertAudience(value: string): CampaignAudience {
  if (!(CAMPAIGN_AUDIENCES as readonly string[]).includes(value)) {
    throw new Error(`Bilinmeyen kitle: ${value}`);
  }
  return value as CampaignAudience;
}

/** Which audiences a template may be sent to. Mirrored client-side by `campaignMailAudiencesFor`. */
export function audiencesForTemplate(
  template: CampaignTemplateName,
): readonly CampaignAudience[] {
  return template === "bulten-kampanya" ? CAMPAIGN_AUDIENCES : ["marketing"];
}

export const AUDIENCE_TEMPLATE_MISMATCH =
  "Kampanya şablonları yalnız pazarlama izni olan üyelere gider; bülten abonelerine 'Bülten' şablonunu kullan.";

/**
 * The seven `kampanya-*` layouts say "Yalnız L'Affogato üyelerine özel" in
 * both halves of the message, so they go to members only; a bulletin
 * subscriber who is not a member would be told the offer is not for them.
 * `bulten-kampanya` carries no such line and may go to any audience. Checked
 * here, where both the form and the post hook land, so neither can bypass it.
 */
function assertAudienceForTemplate(
  template: CampaignTemplateName,
  audience: CampaignAudience,
): void {
  if (!audiencesForTemplate(template).includes(audience)) {
    throw new Error(AUDIENCE_TEMPLATE_MISMATCH);
  }
}

// ── Rows ───────────────────────────────────────────────────────────────────

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toCampaign(row: Record<string, unknown>): CampaignEmail {
  const fields: Record<string, string> = {};
  const raw = row.fields;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") fields[key] = value;
    }
  }
  return {
    id: str(row.id),
    template: str(row.template) as CampaignTemplateName,
    status: str(row.status) as CampaignStatus,
    audience: str(row.audience) as CampaignAudience,
    subject: str(row.subject),
    fields,
    sourcePostId: str(row.sourcePostId),
    createdBy: str(row.createdBy),
    createdAt: str(row.createdAt),
    scheduledAt: str(row.scheduledAt),
    queuedAt: str(row.queuedAt),
    sentAt: str(row.sentAt),
    total: num(row.total),
    sentCount: num(row.sentCount),
    failedCount: num(row.failedCount),
    lastError: str(row.lastError),
  };
}

/** One `campaign_email_sends` row, as the claim function hands it back. */
interface CampaignSendRow {
  id: number | string;
  campaignId: string;
  email: string;
  recipientKind: "customer" | "subscriber";
  name: string;
  unsubUrl: string;
  batchNo: number;
  status: string;
  providerId: string;
  error: string;
  claimedAt: string;
  /** Set by the runner before the batch is posted; '' until then. */
  postedAt: string;
  createdAt: string;
  sentAt: string;
}

export async function createCampaignEmail(
  input: CampaignInput,
): Promise<CampaignEmail> {
  const template = assertTemplate(input.template);
  const fields = parseFields(template, input.fields);
  const audience = assertAudience(input.audience);
  assertAudienceForTemplate(template, audience);
  const now = new Date().toISOString();
  const row: CampaignEmail = {
    id: `cmail-${Date.now()}-${randomBytes(3).toString("hex")}`,
    template,
    status: "draft",
    audience,
    subject: subjectFor({ fields, template }),
    fields,
    sourcePostId: (input.sourcePostId ?? "").trim().slice(0, 100),
    createdBy: input.createdBy.trim().slice(0, 200),
    createdAt: now,
    scheduledAt: normalizeScheduledAt(input.scheduledAt),
    queuedAt: "",
    sentAt: "",
    total: 0,
    sentCount: 0,
    failedCount: 0,
    lastError: "",
  };
  const { error } = await getDb().from(TABLES.campaignEmails).insert(row);
  checkErr(error, "createCampaignEmail");
  return row;
}

/**
 * Edits a draft. Returns `null` when there is no such campaign or it has
 * already been queued: the send log was built from the fields as they were,
 * and the provider idempotency key promises a retry is the same message.
 * `createdBy` is the author and does not change.
 */
export async function updateCampaignEmail(
  id: string,
  patch: Partial<CampaignInput>,
): Promise<CampaignEmail | null> {
  const current = await getCampaignEmail(id);
  if (!current || current.status !== "draft") return null;
  const template =
    patch.template !== undefined
      ? assertTemplate(patch.template)
      : current.template;
  const audience =
    patch.audience !== undefined
      ? assertAudience(patch.audience)
      : current.audience;
  assertAudienceForTemplate(template, audience);
  const fields = !campaignMailHasFields(template)
    ? {}
    : patch.fields !== undefined
      ? parseFields(template, patch.fields)
      : current.fields;
  const { data, error } = await getDb()
    .from(TABLES.campaignEmails)
    .update({
      template,
      audience,
      fields,
      subject: subjectFor({ fields, template }),
      scheduledAt:
        patch.scheduledAt !== undefined
          ? normalizeScheduledAt(patch.scheduledAt)
          : current.scheduledAt,
      sourcePostId:
        patch.sourcePostId !== undefined
          ? patch.sourcePostId.trim().slice(0, 100)
          : current.sourcePostId,
    })
    .eq("id", id)
    // Conditioned on the status, so a "Gönder" racing this save cannot end up
    // sending one thing and recording another.
    .eq("status", "draft")
    .select("*");
  checkErr(error, "updateCampaignEmail");
  const rows = (data as Record<string, unknown>[] | null) ?? [];
  return rows[0] ? toCampaign(rows[0]) : null;
}

/** Removes a draft (and nothing else). True when a row went. */
export async function deleteCampaignEmail(id: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.campaignEmails)
    .delete()
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  checkErr(error, "deleteCampaignEmail");
  return (((data as { id: string }[] | null) ?? []).length ?? 0) > 0;
}

/** Newest first. */
export async function listCampaignEmails(): Promise<CampaignEmail[]> {
  const { data, error } = await getDb()
    .from(TABLES.campaignEmails)
    .select("*")
    .order("createdAt", { ascending: false });
  checkErr(error, "listCampaignEmails");
  return ((data as Record<string, unknown>[] | null) ?? []).map(toCampaign);
}

export async function getCampaignEmail(
  id: string,
): Promise<CampaignEmail | null> {
  const { data, error } = await getDb()
    .from(TABLES.campaignEmails)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  checkErr(error, "getCampaignEmail");
  return data ? toCampaign(data as Record<string, unknown>) : null;
}

async function patchCampaign(
  id: string,
  patch: Partial<Pick<CampaignEmail, "status" | "lastError" | "sentAt">>,
): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.campaignEmails)
    .update(patch)
    .eq("id", id);
  checkErr(error, "patchCampaign");
}

// ── Rendering ──────────────────────────────────────────────────────────────

/**
 * The dummy way out in a preview or a test send - spends nothing. Built the
 * way every member's link is (`/api/bulten/cikis`, the route that answers
 * both the footer click and the RFC 8058 POST), so the test message the
 * operator inspects carries the same path and headers the members' will.
 * The route answers 200 "Bağlantı geçersiz" for it.
 */
function previewUnsubscribeUrl(): string {
  return unsubscribeUrlFor("onizleme");
}

function renderCampaign(
  c: Pick<CampaignEmail, "template" | "fields">,
  recipient: { name: string; unsubscribeUrl: string },
  serverVars: Record<string, string> = {},
): RenderedEmail {
  assertTemplateAvailable(c.template);
  return renderEmail(c.template, {
    vars: { ...c.fields, ...serverVars, AD: recipient.name.trim() },
    text: EMAIL_TEXT[c.template],
    unsubscribeUrl: recipient.unsubscribeUrl,
  });
}

/**
 * For the panel's preview frame. Throws on a field the template needs.
 * `serverVars` is `campaignServerVars(c.template)`, resolved by the page.
 */
export function previewCampaignEmail(
  c: CampaignEmail,
  sample?: { name?: string },
  serverVars: Record<string, string> = {},
): RenderedEmail {
  return renderCampaign(
    c,
    {
      name: sample?.name ?? "",
      unsubscribeUrl: previewUnsubscribeUrl(),
    },
    serverVars,
  );
}

/**
 * One real send to one address, outside the send log: AD = "Test", the
 * unsubscribe link is the dummy preview one. What the operator sees in
 * their own inbox is what the members will get.
 */
export async function sendCampaignTest(
  c: CampaignEmail,
  to: string,
): Promise<SendResult> {
  const address = to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { ok: false, error: "Geçerli bir e-posta adresi gir." };
  }
  if (!campaignMailTemplateAvailable(c.template, hasAppLinks())) {
    return { ok: false, error: CAMPAIGN_MAIL_APP_LINKS_MISSING };
  }
  return sendCampaignMail(
    c.template,
    address,
    { ...c.fields, ...(await campaignServerVars(c.template)), AD: "Test" },
    previewUnsubscribeUrl(),
  );
}

// ── Audience and queue ─────────────────────────────────────────────────────

/**
 * Dry count for the confirmation before "Gönder" - the same function the
 * enqueue reads, so the number shown is the number queued.
 */
export async function countCampaignAudience(
  audience: CampaignAudience,
  pref: CampaignPref = "marketing",
): Promise<number> {
  const { data, error } = await getDb().rpc<unknown>(
    "campaign_email_audience_count",
    { p_audience: audience, p_pref: pref },
  );
  checkErr(error, "countCampaignAudience");
  return num(data);
}

/**
 * Materialises the audience into the send log and marks the campaign queued.
 *
 * Fails fast: one sample recipient is rendered first, so a template missing
 * a field throws HERE, naming the field, before a single row is queued.
 * Allowed from draft, queued, sending and failed - the enqueue is idempotent
 * (existing recipients are skipped, skipped rows go back in the queue,
 * newcomers get fresh batch numbers), so pressing "Gönder" twice is safe.
 *
 * İYS: the outbox is reconciled first (so /admin/iys is current), and a
 * campaign is refused with `IysGateError` while the last İYS refusal check
 * is older than three business days (src/lib/iys/gate.ts). The audience
 * itself names only addresses İYS holds ONAY for.
 */
export async function queueCampaignEmail(
  id: string,
): Promise<{ total: number }> {
  const c = await getCampaignEmail(id);
  if (!c) throw new Error("Kampanya bulunamadı.");
  if (!QUEUEABLE.includes(c.status)) {
    throw new Error(
      `Kampanya "${CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}" durumunda; yeniden kuyruğa alınamaz.`,
    );
  }
  renderCampaign(
    c,
    {
      name: "Örnek Üye",
      unsubscribeUrl: previewUnsubscribeUrl(),
    },
    await campaignServerVars(c.template),
  );

  await reconcileIysQuietly();
  await assertIysSendable();

  const { error } = await getDb().rpc<number>("campaign_email_enqueue", {
    p_campaign: id,
    p_audience: c.audience,
    p_pref: prefForTemplate(c.template),
    p_now: new Date().toISOString(),
    p_unsub_base: `${SITE.url}/api/bulten/cikis?token=`,
  });
  checkErr(error, "queueCampaignEmail");

  const fresh = await getCampaignEmail(id);
  return { total: fresh?.total ?? 0 };
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function claimBatch(id: string): Promise<CampaignSendRow[]> {
  const now = Date.now();
  const { data, error } = await getDb().rpc<unknown>("campaign_email_claim", {
    p_campaign: id,
    p_stale_before: new Date(now - STALE_AFTER_MS).toISOString(),
    p_posted_before: new Date(now - POSTED_EXPIRES_MS).toISOString(),
    p_now: new Date(now).toISOString(),
  });
  checkErr(error, "campaign_email_claim");
  return Array.isArray(data) ? (data as CampaignSendRow[]) : [];
}

/**
 * Records the hand-off BEFORE the POST: every row of the batch still
 * 'sending' under THIS claim and not yet posted gets `postedAt` now. The
 * first hand-off time stands on a retry - the provider's idempotency window
 * runs from the first post, and overwriting it would let a batch outlive
 * that window unnoticed.
 */
async function markPosted(
  id: string,
  batchNo: number,
  claimedAt: string,
): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.campaignEmailSends)
    .update({ postedAt: new Date().toISOString() })
    .eq("campaignId", id)
    .eq("batchNo", batchNo)
    .eq("status", "sending")
    .eq("claimedAt", claimedAt)
    .eq("postedAt", "");
  checkErr(error, "campaign_email_sends.posted");
}

/**
 * Settles the batch - the rows this runner's claim stamped with `claimedAt`
 * and no others. A runner that stalled past the stale window and whose
 * batch was reclaimed by another finds nothing to mark, rather than marking
 * as sent rows it never delivered.
 */
async function markBatch(
  id: string,
  batchNo: number,
  claimedAt: string,
  status: "sent" | "failed" | "skipped",
  providerIds: string[],
  errorText: string,
): Promise<void> {
  const { error } = await getDb().rpc<null>("campaign_email_mark", {
    p_campaign: id,
    p_batch: batchNo,
    p_status: status,
    p_ids: providerIds,
    p_error: errorText.slice(0, 500),
    p_now: new Date().toISOString(),
    p_claimed_at: claimedAt,
  });
  checkErr(error, "campaign_email_mark");
}

/** One row the template refused; it leaves the batch before the post. */
async function markRowFailed(
  row: CampaignSendRow,
  errorText: string,
): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.campaignEmailSends)
    .update({ status: "failed", error: errorText })
    .eq("id", row.id);
  checkErr(error, "campaign_email_sends.failed");
}

async function remainingCount(id: string): Promise<number> {
  const { count, error } = await getDb()
    .from(TABLES.campaignEmailSends)
    .select("*", { count: "exact", head: true })
    .eq("campaignId", id)
    .in("status", ["queued", "sending"]);
  checkErr(error, "campaign_email_sends.remaining");
  return count ?? 0;
}

type BatchResult = Awaited<ReturnType<typeof deliverBatch>>;

/** A provider result may say how long to wait; the contract does not promise it. */
function retryAfterMs(result: BatchResult): number | null {
  const value = (result as { retryAfterMs?: unknown }).retryAfterMs;
  return typeof value === "number" && value > 0 ? value : null;
}

/** 429 → wait, then post the SAME key again; the provider dedupes overlap. */
async function deliverWithBackoff(
  messages: BatchMessage[],
  key: string,
  retryDelay: number,
): Promise<BatchResult> {
  for (let attempt = 0; ; attempt++) {
    const result = await deliverBatch(messages, key);
    if (
      result.ok ||
      result.status !== 429 ||
      attempt >= MAX_RATE_LIMIT_RETRIES
    ) {
      return result;
    }
    await sleep(retryAfterMs(result) ?? retryDelay);
  }
}

export interface RunOptions {
  /** Stop claiming new batches after this long; status stays 'sending'. */
  deadlineMs?: number;
  /** Pause between batches (tests set 0). */
  batchDelayMs?: number;
  /** Pause after a 429 without a Retry-After (tests set 0). */
  retryDelayMs?: number;
}

export interface RunResult {
  sent: number;
  failed: number;
  remaining: number;
}

/**
 * Works a queued campaign, batch by batch, until nothing is left or the
 * deadline passes. Safe to run twice at once (claims on one campaign are
 * serialised in the database: the second runner waits, then takes the next
 * batch) and safe to run again after a crash (a batch left 'sending' is
 * reclaimed once it is stale, and its provider key makes the retry a no-op
 * upstream).
 *
 * Guards, in order: `CAMPAIGN_EMAIL_DRY_RUN=1` renders and marks every row
 * skipped without an HTTP call; no `RESEND_API_KEY` marks the batch skipped
 * and fails the campaign (re-queue once the key exists); a non-production
 * Vercel deployment refuses a real send - every link in the message would
 * point at the preview host.
 *
 * İYS: no batch is claimed while the last İYS refusal check is older than
 * three business days (src/lib/iys/gate.ts). The campaign keeps its status
 * (queued or sending) with the reason in `lastError`, nobody is marked
 * failed, and the cron or the next "Gönder" carries on once the check is
 * fresh. Checked before every claim, so a run that outlives the check
 * stops at the next batch.
 */
export async function runCampaignEmail(
  id: string,
  opts: RunOptions = {},
): Promise<RunResult> {
  const deadlineMs = opts.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const batchDelay = opts.batchDelayMs ?? BATCH_DELAY_MS;
  const retryDelay = opts.retryDelayMs ?? RETRY_DELAY_MS;
  const started = Date.now();

  const campaign = await getCampaignEmail(id);
  if (!campaign) throw new Error(`Kampanya bulunamadı: ${id}`);
  if (campaign.status !== "queued" && campaign.status !== "sending") {
    return { sent: 0, failed: 0, remaining: 0 };
  }

  let sent = 0;
  let failed = 0;
  try {
    // Queued while both store links existed, run after one went away: the
    // rows stay queued (nobody is marked failed for it) and the campaign
    // says why, to be sent again once the links are back.
    if (!campaignMailTemplateAvailable(campaign.template, hasAppLinks())) {
      await patchCampaign(id, {
        status: "failed",
        lastError: CAMPAIGN_MAIL_APP_LINKS_MISSING,
      });
      return { sent, failed, remaining: await remainingCount(id) };
    }
    const gate = await iysSendGate();
    if (!gate.fresh) {
      console.warn(`[campaign] ${id}: İYS kontrolü güncel değil, bekliyor`);
      await patchCampaign(id, { lastError: gate.message });
      return { sent, failed, remaining: await remainingCount(id) };
    }
    const serverVars = await campaignServerVars(campaign.template);
    await patchCampaign(id, { status: "sending", lastError: "" });
    const dryRun = process.env.CAMPAIGN_EMAIL_DRY_RUN === "1";
    const vercelEnv = process.env.VERCEL_ENV ?? "";
    const previewHost = vercelEnv !== "" && vercelEnv !== "production";

    for (let first = true; ; first = false) {
      if (!first) {
        const again = await iysSendGate();
        if (!again.fresh) {
          console.warn(`[campaign] ${id}: İYS kontrolü süresi doldu, durdu`);
          await patchCampaign(id, { lastError: again.message });
          return { sent, failed, remaining: await remainingCount(id) };
        }
      }
      const rows = await claimBatch(id);
      if (rows.length === 0) break;
      const batchNo = num(rows[0]?.batchNo);
      // The claim's stamp on these rows; the posted mark and the settle
      // below reach only rows carrying it.
      const claimedAt = String(rows[0]?.claimedAt ?? "");

      // Render every row first. A row the template rejects is settled on its
      // own and leaves the batch, so the rest still go out; the batch's
      // provider-id order stays the claim's e-mail order minus those rows.
      const messages: BatchMessage[] = [];
      for (const row of rows) {
        try {
          const r = renderCampaign(
            campaign,
            {
              name: row.name,
              unsubscribeUrl: row.unsubUrl,
            },
            serverVars,
          );
          messages.push({
            to: row.email,
            subject: r.subject,
            html: r.html,
            text: r.text,
            unsubscribeUrl: row.unsubUrl,
          });
        } catch (err) {
          console.error(
            `[campaign] ${id}: ${maskEmail(row.email)} ${RENDER_FAILED}`,
            err,
          );
          await markRowFailed(row, RENDER_FAILED);
          failed += 1;
        }
      }

      let stop = "";
      if (dryRun) {
        await markBatch(id, batchNo, claimedAt, "skipped", [], DRY_RUN_NOTE);
        failed += messages.length;
      } else if (!process.env.RESEND_API_KEY) {
        stop = NO_PROVIDER;
        await markBatch(id, batchNo, claimedAt, "skipped", [], stop);
        failed += messages.length;
      } else if (previewHost) {
        stop = `Önizleme dağıtımından (VERCEL_ENV=${vercelEnv}) gerçek gönderim yapılmaz - her bağlantı önizleme adresine işaret ederdi. Denemek için CAMPAIGN_EMAIL_DRY_RUN=1.`;
        await markBatch(id, batchNo, claimedAt, "skipped", [], stop);
        failed += messages.length;
      } else if (messages.length === 0) {
        // Every row was refused by the template and is already marked; this
        // touches no row and refreshes the campaign's counters.
        await markBatch(id, batchNo, claimedAt, "failed", [], RENDER_FAILED);
      } else {
        const key = `cmp-${id}-b${batchNo}`;
        // The hand-off is on record before the provider hears of it: should
        // the mark below fail, the claim knows this batch may have gone out.
        await markPosted(id, batchNo, claimedAt);
        const result = await deliverWithBackoff(messages, key, retryDelay);
        if (result.ok) {
          await markBatch(id, batchNo, claimedAt, "sent", result.ids, "");
          sent += messages.length;
          console.info(
            `[campaign] ${id} b${batchNo}: ${messages.length} gönderildi`,
          );
        } else {
          console.error(`[campaign] ${id} b${batchNo}: ${result.error}`);
          await markBatch(id, batchNo, claimedAt, "failed", [], result.error);
          failed += messages.length;
        }
      }

      if (stop) {
        await patchCampaign(id, { status: "failed", lastError: stop });
        return { sent, failed, remaining: await remainingCount(id) };
      }
      if (Date.now() - started >= deadlineMs) {
        // Out of time. Status stays 'sending'; the cron (or the next
        // "Gönder") carries on from the next batch.
        return { sent, failed, remaining: await remainingCount(id) };
      }
      await sleep(batchDelay);
    }

    // An empty claim is not the end: the lowest open batch may be 'sending'
    // under another runner (the panel's after() and the cron overlapping, a
    // second "Gönder"). Those rows are not ours to close - the campaign stays
    // 'sending', the other runner or the cron finishes it, and the counters
    // are refreshed from the rows as they settle.
    const left = await remainingCount(id);
    if (left > 0) return { sent, failed, remaining: left };

    const fresh = await getCampaignEmail(id);
    const sentTotal = fresh?.sentCount ?? sent;
    const failedTotal = fresh?.failedCount ?? failed;
    if (dryRun) {
      await patchCampaign(id, {
        status: "sent",
        sentAt: new Date().toISOString(),
        lastError: DRY_RUN_NOTE,
      });
    } else if (sentTotal === 0 && failedTotal > 0) {
      // Not one message left the building: that is a failure, not a send
      // with a bad day. Partial failures stay 'sent' with the counters
      // telling the story.
      await patchCampaign(id, {
        status: "failed",
        lastError:
          "Hiçbir e-posta gönderilemedi; alıcı satırlarındaki hataya bakın.",
      });
    } else {
      // Also the empty-audience case: 0 recipients, 'sent' with sentAt.
      await patchCampaign(id, {
        status: "sent",
        sentAt: new Date().toISOString(),
      });
    }
    return { sent, failed, remaining: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[campaign] ${id}: beklenmedik hata`, err);
    try {
      await patchCampaign(id, {
        status: "failed",
        lastError: message.slice(0, 500),
      });
    } catch {
      // The original error is the one worth surfacing.
    }
    throw err;
  }
}

/**
 * Queues every draft whose `scheduledAt` has come - the whole of "özel
 * günler".
 *
 * There is no separate scheduler and no special-days table: the operator
 * writes the campaign the way they always have, names a moment, and this
 * turns it into the same `queueCampaignEmail` call the "Gönder" button makes.
 * Everything downstream (audience rule, 100-a-batch, idempotency key, retry)
 * is the pipeline that was already there.
 *
 * A campaign that cannot be queued - a hole in the template, a status that
 * moved on - is logged and its schedule cleared so the next hour does not
 * retry it forever; the draft stays a draft for a person to fix. Every other
 * campaign in the sweep still goes. The one exception is a stale İYS check
 * (`IysGateError`): the schedule stays, the draft says why, and the first
 * run after the operator's check queues it.
 */
async function queueDueCampaigns(nowIso: string): Promise<string[]> {
  const { data, error } = await getDb()
    .from(TABLES.campaignEmails)
    .select("*")
    .eq("status", "draft")
    .order("scheduledAt", { ascending: true });
  checkErr(error, "queueDueCampaigns");
  const due = ((data as Record<string, unknown>[] | null) ?? [])
    .map(toCampaign)
    .filter((c) => c.scheduledAt !== "" && c.scheduledAt <= nowIso);

  const queued: string[] = [];
  for (const c of due) {
    try {
      await queueCampaignEmail(c.id);
      queued.push(c.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isIysGateError(err)) {
        // Not a hole in the campaign: the İYS check is stale. The schedule
        // stays, so the next run after the check queues it; the draft says
        // why it has not gone yet.
        console.warn(`[campaign] ${c.id}: İYS kontrolü güncel değil, bekliyor`);
        try {
          await getDb()
            .from(TABLES.campaignEmails)
            .update({ lastError: message.slice(0, 500) })
            .eq("id", c.id)
            .eq("status", "draft");
        } catch {
          // The next run tries again.
        }
        continue;
      }
      console.error(
        `[campaign] ${c.id}: zamanlanmış gönderim başlatılamadı`,
        err,
      );
      try {
        await getDb()
          .from(TABLES.campaignEmails)
          .update({
            scheduledAt: "",
            lastError: `Zamanlanmış gönderim başlatılamadı: ${message}`.slice(
              0,
              500,
            ),
          })
          .eq("id", c.id)
          .eq("status", "draft");
      } catch {
        // The original failure is the one worth surfacing; the next hour
        // will try again, which is better than losing the campaign.
      }
    }
  }
  return queued;
}

/**
 * The cron's entry point, in two steps: first every draft whose scheduled
 * moment has passed is queued, then every campaign still queued or mid-send
 * is carried on, oldest first, within one shared deadline. Doing both here is
 * what lets a campaign scheduled for 09:00 actually leave at 09:00 rather
 * than an hour later. A campaign that throws is recorded as failed by
 * `runCampaignEmail` and does not stop the others.
 */
export async function resumePendingCampaigns(
  opts: { deadlineMs?: number; now?: Date } = {},
): Promise<Array<{ id: string } & RunResult>> {
  const deadlineAt = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS);
  await queueDueCampaigns((opts.now ?? new Date()).toISOString());
  const { data, error } = await getDb()
    .from(TABLES.campaignEmails)
    .select("*")
    .in("status", ["queued", "sending"])
    .order("queuedAt", { ascending: true });
  checkErr(error, "resumePendingCampaigns");
  const pending = ((data as Record<string, unknown>[] | null) ?? []).map(
    toCampaign,
  );

  const results: Array<{ id: string } & RunResult> = [];
  for (const c of pending) {
    const left = deadlineAt - Date.now();
    if (left <= 0) {
      results.push({
        id: c.id,
        sent: 0,
        failed: 0,
        remaining: await remainingCount(c.id),
      });
      continue;
    }
    try {
      results.push({
        id: c.id,
        ...(await runCampaignEmail(c.id, { deadlineMs: left })),
      });
    } catch (err) {
      console.error(`[campaign] ${c.id}: cron`, err);
      let remaining = 0;
      try {
        remaining = await remainingCount(c.id);
      } catch {
        // Already logged above; the count is informational.
      }
      results.push({ id: c.id, sent: 0, failed: 0, remaining });
    }
  }
  return results;
}

// ── From a mobile post ─────────────────────────────────────────────────────

/** The sub-line under the title, per kind - the mail's answer to "why now?". */
const POST_ALT_BY_KIND: Record<AppPostKind, string> = {
  campaign: "Bu ay köşkte",
  collab: "İş birliği",
  event: "Etkinlik",
};

/**
 * A published post (`/admin/mobil/gonderiler`) as a campaign draft. The
 * author (`createdBy`) is the caller's to fill in. A `data:` image uploaded
 * from the panel cannot go into mail and is left out, which drops the
 * template's image section rather than shipping a broken one.
 */
export function campaignFromPost(post: AdminAppPost): CampaignInput {
  const kindLabel = APP_POST_KIND_LABELS[post.kind] ?? "Kampanya";
  const fields: Record<string, string> = {
    KAMPANYA_EYEBROW: kindLabel.toLocaleUpperCase("tr-TR"),
    KAMPANYA_BASLIK: post.title,
    KAMPANYA_ALT: POST_ALT_BY_KIND[post.kind] ?? POST_ALT_BY_KIND.campaign,
    KAMPANYA_METIN: post.body,
    KAMPANYA_BUTON: post.linkLabel || "AYRINTILAR",
    KAMPANYA_URL: isHttpsUrl(post.linkUrl)
      ? post.linkUrl
      : `${SITE.url}/kampanyalar`,
  };
  if (isHttpsUrl(post.image)) {
    fields.KAMPANYA_GORSEL_URL = post.image;
    fields.KAMPANYA_GORSEL_ALT = post.title;
  }
  return {
    template: "kampanya-duyuru",
    audience: "marketing",
    fields,
    sourcePostId: post.id,
    createdBy: "",
  };
}

// ── Tokens ─────────────────────────────────────────────────────────────────

/**
 * The member's unsubscribe token, minted on first use. The enqueue mints for
 * a whole audience in SQL; this is for one link at a time (a birthday mail,
 * a test). Retries on the one-in-2^192 collision the unique index would
 * report, and yields to a concurrent minter rather than overwriting it.
 */
export async function ensureCustomerUnsubToken(
  rawEmail: string,
): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  const db = getDb();
  const read = async (): Promise<string | null> => {
    const { data, error } = await db
      .from(TABLES.customers)
      .select("unsubToken")
      .eq("email", email)
      .maybeSingle();
    checkErr(error, "ensureCustomerUnsubToken.select");
    if (!data) return null;
    return str((data as { unsubToken?: unknown }).unsubToken);
  };

  const existing = await read();
  if (existing === null) throw new Error("Üye bulunamadı.");
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt++) {
    const token = randomBytes(24).toString("hex");
    const { data, error } = await db
      .from(TABLES.customers)
      .update({ unsubToken: token })
      .eq("email", email)
      .eq("unsubToken", "")
      .select("unsubToken");
    if (error) {
      if (error.code === "23505") continue;
      checkErr(error, "ensureCustomerUnsubToken.update");
    }
    if (((data as unknown[] | null) ?? []).length > 0) return token;
    // Lost the race to another minter: use what it wrote.
    const theirs = await read();
    if (theirs) return theirs;
  }
  throw new Error("Çıkış jetonu üretilemedi.");
}
