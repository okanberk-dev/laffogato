import {
  CAMPAIGN_STATUS_LABELS,
  type CampaignStatus,
} from "@/lib/email/campaigns";

const STATUS_TONE: Record<CampaignStatus, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  queued: "bg-amber-50 text-amber-700",
  sending: "bg-blue-50 text-blue-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-500",
};

/** Server component (no "use client"): `campaigns` is server-only. */
export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.18em] uppercase ${STATUS_TONE[status] ?? STATUS_TONE.draft}`}
    >
      {CAMPAIGN_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Which statuses the panel offers "Gönder" for, and which it offers "Sürdür". */
export function canSendCampaign(status: CampaignStatus): boolean {
  return status === "draft" || status === "failed";
}

export function canResumeCampaign(status: CampaignStatus): boolean {
  return status === "queued" || status === "sending";
}
