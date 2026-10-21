// Client-safe (no server-only): the send log's vocabulary and URL. The
// reads are lib/admin/campaign-sends.ts.

import {
  firstParam,
  type FilterField,
  type SearchParamsInput,
} from "./list-params";
import type { AdminTone } from "./tone";

export type CampaignSendStatus =
  "queued" | "sending" | "sent" | "failed" | "skipped";

/**
 * Every status, in the order the tabs show them: the failures first,
 * because that is the first question every time.
 */
export const CAMPAIGN_SEND_STATUSES: readonly CampaignSendStatus[] = [
  "failed",
  "skipped",
  "queued",
  "sending",
  "sent",
];

export interface CampaignSendRow {
  email: string;
  /** `customer` (member) or `subscriber` (newsletter list). */
  recipientKind: string;
  name: string;
  batchNo: number;
  status: CampaignSendStatus;
  /** Resend's id - searchable in their panel. Empty unless the batch went out. */
  providerId: string;
  error: string;
  createdAt: string;
  sentAt: string;
}

/** Rows per status over the whole campaign, and their sum. */
export type CampaignSendTally = Record<CampaignSendStatus, number> & {
  total: number;
};

export const CAMPAIGN_SEND_STATUS_LABELS: Record<CampaignSendStatus, string> = {
  queued: "Kuyrukta",
  sending: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Başarısız",
  skipped: "Atlandı",
};

export const CAMPAIGN_SEND_STATUS_TONES: Record<CampaignSendStatus, AdminTone> =
  {
    queued: "neutral",
    sending: "info",
    sent: "success",
    failed: "danger",
    skipped: "warning",
  };

export const CAMPAIGN_SEND_KIND_LABELS: Record<string, string> = {
  customer: "Üye",
  subscriber: "Bülten",
};

/** The tab param on the campaign's page; Tümü is the tab without it. */
export const CAMPAIGN_SEND_TAB_PARAM = "durum";

export function parseCampaignSendTab(
  sp: SearchParamsInput,
): CampaignSendStatus | null {
  const raw = firstParam(sp, CAMPAIGN_SEND_TAB_PARAM) ?? "";
  return (CAMPAIGN_SEND_STATUSES as readonly string[]).includes(raw)
    ? (raw as CampaignSendStatus)
    : null;
}

export const CAMPAIGN_SEND_FILTER_FIELDS: readonly FilterField[] = [
  {
    type: "search",
    name: "q",
    label: "Alıcı ara",
    placeholder: "E-posta ya da ad",
    maxLength: 120,
  },
];

/**
 * The tabs and their counts: Tümü, then every status that has rows (with
 * the search applied), and the open tab even when it has none, so the
 * operator never stands on a tab that is not drawn.
 */
export function campaignSendTabs(
  tally: CampaignSendTally,
  current: CampaignSendStatus | null,
): Array<{ value: string | null; label: string; count: number }> {
  return [
    { value: null, label: "Tümü", count: tally.total },
    ...CAMPAIGN_SEND_STATUSES.filter((s) => tally[s] > 0 || s === current).map(
      (s) => ({
        value: s,
        label: CAMPAIGN_SEND_STATUS_LABELS[s],
        count: tally[s],
      }),
    ),
  ];
}
