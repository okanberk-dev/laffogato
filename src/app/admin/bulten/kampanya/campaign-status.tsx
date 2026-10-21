import { Badge } from "@/components/admin/ui";
import type { AdminTone } from "@/lib/admin/tone";
import {
  CAMPAIGN_STATUS_LABELS,
  type CampaignStatus,
} from "@/lib/email/campaigns";

/**
 * The kit's tones (tested to AA on their grounds) instead of Tailwind's
 * palette: "İptal edildi" was mid grey on light grey, 4.34:1 at 10 px
 * (admin audit PEO-17).
 */
const STATUS_TONE: Record<CampaignStatus, AdminTone> = {
  draft: "neutral",
  queued: "accent",
  sending: "info",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
};

/** Server component (no "use client"): `campaigns` is server-only. */
export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {CAMPAIGN_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** Which statuses the panel offers "Gönder" for, and which it offers "Sürdür". */
export function canSendCampaign(status: CampaignStatus): boolean {
  return status === "draft" || status === "failed";
}

export function canResumeCampaign(status: CampaignStatus): boolean {
  return status === "queued" || status === "sending";
}
