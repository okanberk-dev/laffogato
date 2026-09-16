import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

/**
 * The campaign send log, read back.
 *
 * `campaign_email_sends` has always carried one row per (campaign, address)
 * with its own status, provider id and error — the panel just never read it,
 * so a campaign was three numbers ("Alıcı 400 · Gönderildi 363 · Başarısız
 * 37") and the 37 had no names. Under 6563 the burden of proof that a
 * commercial message was or was not sent to a given address is on the sender,
 * and that proof was sitting in a table with no reader.
 *
 * Read-only: nothing here writes. The five plpgsql helpers own every write to
 * this table (see db/migrations/20260908150000_campaign_emails.sql).
 */

export type CampaignSendStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export interface CampaignSendRow {
  email: string;
  /** `customer` (member) or `subscriber` (newsletter list). */
  recipientKind: string;
  name: string;
  batchNo: number;
  status: CampaignSendStatus;
  /** Resend's id — searchable in their panel. Empty unless the batch went out. */
  providerId: string;
  error: string;
  createdAt: string;
  sentAt: string;
}

/**
 * How many rows the detail page reads at once.
 *
 * The page is a summary, not an export: a thousand `<tr>`s help nobody and
 * the operator's first question is always "which ones failed". The ordering
 * below answers that within the cap.
 */
export const CAMPAIGN_SENDS_LIMIT = 200;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toRow(raw: Record<string, unknown>): CampaignSendRow {
  const status = str(raw.status);
  return {
    email: str(raw.email),
    recipientKind: str(raw.recipientKind) || "customer",
    name: str(raw.name),
    batchNo: Number(raw.batchNo) || 0,
    status: (status || "queued") as CampaignSendStatus,
    providerId: str(raw.providerId),
    error: str(raw.error),
    createdAt: str(raw.createdAt),
    sentAt: str(raw.sentAt),
  };
}

export interface ListCampaignSendsOptions {
  status?: CampaignSendStatus;
  limit?: number;
}

/**
 * One campaign's recipients, failures first.
 *
 * The ordering is alphabetical on `status`, which is not an accident worth
 * trusting silently: **failed < queued < sending < sent < skipped**, so
 * ordering by the column puts exactly the rows the operator came for at the
 * top, without a CASE expression the query builder cannot express. `email`
 * breaks the tie so the list is stable between reloads.
 */
export async function listCampaignSends(
  campaignId: string,
  options: ListCampaignSendsOptions = {},
): Promise<CampaignSendRow[]> {
  if (!campaignId) return [];
  const limit = Math.min(
    Math.max(Math.trunc(options.limit ?? CAMPAIGN_SENDS_LIMIT), 1),
    1000,
  );
  let query = getDb()
    .from(TABLES.campaignEmailSends)
    .select("*")
    .eq("campaignId", campaignId);
  if (options.status) query = query.eq("status", options.status);
  const { data, error, status } = await query
    .order("status")
    .order("email")
    .limit(limit);
  if (error) raiseDbError("listCampaignSends", error as DbError, status);
  return ((data as Record<string, unknown>[] | null) ?? []).map(toRow);
}

/** Row counts per status, for the header line above the table. */
export function tallyCampaignSends(
  rows: CampaignSendRow[],
): Record<CampaignSendStatus, number> {
  const out: Record<CampaignSendStatus, number> = {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  for (const r of rows) {
    if (r.status in out) out[r.status] += 1;
  }
  return out;
}
