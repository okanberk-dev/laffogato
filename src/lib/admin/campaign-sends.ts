import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import type { AnyOfCondition, FoldLikeValue } from "@/lib/db/sql";
import { raiseDbError } from "@/lib/db/health";

import {
  CAMPAIGN_SEND_STATUSES,
  type CampaignSendRow,
  type CampaignSendStatus,
  type CampaignSendTally,
} from "./campaign-sends-core";
import { escapeLike } from "./order-filters";
import { TR_FOLD_SQL_FROM, TR_FOLD_SQL_TO } from "./text-fold";

export type {
  CampaignSendRow,
  CampaignSendStatus,
  CampaignSendTally,
} from "./campaign-sends-core";

/**
 * The campaign send log, read back.
 *
 * `campaign_email_sends` has always carried one row per (campaign, address)
 * with its own status, provider id and error - the panel just never read it,
 * so a campaign was three numbers ("Alıcı 400 · Gönderildi 363 · Başarısız
 * 37") and the 37 had no names. Under 6563 the burden of proof that a
 * commercial message was or was not sent to a given address is on the sender,
 * and that proof was sitting in a table with no reader.
 *
 * The page reads one page of rows and the per-status counts over the WHOLE
 * campaign, both in SQL (admin audit PEO-15): it used to read the first 200
 * rows and count those, so a 412-recipient campaign said "Tümü · 200" next
 * to "Alıcı 412", and nobody past row 200 could be found.
 *
 * Read-only: nothing here writes. The five plpgsql helpers own every write to
 * this table (see db/migrations/20260908150000_campaign_emails.sql).
 */

/** Rows per page of the send log. */
export const CAMPAIGN_SENDS_PAGE_SIZE = 50;

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

/**
 * The search box as SQL: part of the address or the name, folded the
 * Turkish way on both sides ("ismail" finds "İsmail"), LIKE's wildcards
 * taken literally. Null for an empty box.
 */
export function campaignSendSearch(
  raw: string | undefined,
): AnyOfCondition[] | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const pattern = `%${escapeLike(text)}%`;
  const folded = (column: string): AnyOfCondition => {
    const value: FoldLikeValue = {
      pattern,
      from: TR_FOLD_SQL_FROM,
      to: TR_FOLD_SQL_TO,
    };
    return { column, op: "foldLike", value };
  };
  return [folded("email"), folded("name")];
}

export interface CampaignSendQuery {
  status?: CampaignSendStatus | null;
  search?: string;
}

/** The rows of one campaign, the search and the status applied. */
function base(
  campaignId: string,
  query: CampaignSendQuery,
  columns: string,
  options?: { count: "exact"; head: true },
) {
  let q = getDb()
    .from(TABLES.campaignEmailSends)
    .select(columns, options)
    .eq("campaignId", campaignId);
  if (query.status) q = q.eq("status", query.status);
  const search = campaignSendSearch(query.search);
  if (search) q = q.anyOf(search);
  return q;
}

/**
 * How many rows each status holds over the whole campaign (the search
 * applied, the status tab not): one count per status, in parallel. The tabs
 * above the log and the pager below it read this, never the page's rows.
 */
export async function countCampaignSends(
  campaignId: string,
  query: Pick<CampaignSendQuery, "search"> = {},
): Promise<CampaignSendTally> {
  const out: CampaignSendTally = {
    total: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  if (!campaignId) return out;
  const results = await Promise.all(
    CAMPAIGN_SEND_STATUSES.map((status) =>
      base(campaignId, { ...query, status }, "*", {
        count: "exact",
        head: true,
      }),
    ),
  );
  CAMPAIGN_SEND_STATUSES.forEach((status, i) => {
    const res = results[i];
    if (res.error)
      raiseDbError("countCampaignSends", res.error as DbError, res.status);
    out[status] = res.count ?? 0;
    out.total += out[status];
  });
  return out;
}

/**
 * One page of a campaign's recipients, failures first.
 *
 * The ordering is alphabetical on `status`, which is not an accident worth
 * trusting silently: **failed < queued < sending < sent < skipped**, so
 * ordering by the column puts exactly the rows the operator came for at the
 * top, without a CASE expression the query builder cannot express. `email`
 * breaks the tie so the list is stable between reloads and pages.
 */
export async function listCampaignSendsPage(
  campaignId: string,
  query: CampaignSendQuery & { page?: number; pageSize?: number } = {},
): Promise<CampaignSendRow[]> {
  if (!campaignId) return [];
  const size = Math.min(
    Math.max(Math.trunc(query.pageSize ?? CAMPAIGN_SENDS_PAGE_SIZE), 1),
    200,
  );
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const { data, error, status } = await base(campaignId, query, "*")
    .order("status")
    .order("email")
    .limit(size)
    .offset((page - 1) * size);
  if (error) raiseDbError("listCampaignSendsPage", error as DbError, status);
  return ((data as Record<string, unknown>[] | null) ?? []).map(toRow);
}
