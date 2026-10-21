import {
  CAMPAIGN_SEND_KIND_LABELS,
  CAMPAIGN_SEND_STATUS_LABELS,
  CAMPAIGN_SEND_STATUS_TONES,
  type CampaignSendRow,
} from "@/lib/admin/campaign-sends-core";

import { formatDateTime } from "./forms";
import { Badge, DataTable, EmptyState, NUMERIC_STYLE } from "./ui";

function StatusBadge({ row }: { row: CampaignSendRow }) {
  return (
    <Badge tone={CAMPAIGN_SEND_STATUS_TONES[row.status] ?? "neutral"} dot>
      {CAMPAIGN_SEND_STATUS_LABELS[row.status] ?? row.status}
    </Badge>
  );
}

/** Why it failed, or Resend's id to look it up there, or nothing. */
function Note({ row }: { row: CampaignSendRow }) {
  if (row.error) {
    return (
      <span className="text-xs break-words text-[var(--admin-danger-ink)]">
        {row.error}
      </span>
    );
  }
  if (row.providerId) {
    return (
      <span
        className="text-xs break-all text-[var(--admin-text-soft)]"
        style={NUMERIC_STYLE}
      >
        {row.providerId}
      </span>
    );
  }
  return <span className="text-xs text-[var(--admin-text-soft)]">-</span>;
}

/**
 * One page of the recipient table, on the kit's DataTable (cards on
 * phones). Server-safe: the tabs, the search and the pages are links.
 *
 * Addresses are shown whole, not masked: this is the panel, the same operator
 * one click away from /admin/musteriler, and a masked address cannot answer
 * the question the screen exists for - "did Ali get it, and if not, why".
 * Masking belongs in the LOGS, where `maskEmail` already does it.
 */
export function CampaignSendTable({ rows }: { rows: CampaignSendRow[] }) {
  return (
    <DataTable<CampaignSendRow>
      caption="Gönderim defteri"
      rows={rows}
      rowKey={(r) => r.email}
      empty={<EmptyState title="Bu görünümde alıcı yok." />}
      columns={[
        {
          key: "adres",
          header: "Adres",
          // Room for an ordinary address on one line; a long one breaks
          // where it must instead of widening the table.
          className: "min-w-[14rem] max-w-[22rem]",
          cell: (r) => (
            <span className="block min-w-0 [overflow-wrap:anywhere]">
              {r.email}
              {/* Below xl the source rides under the address: beside the
                  sidebar the reason column had a word per line. */}
              <span className="block text-xs text-[var(--admin-text-soft)]">
                {r.name}
                <span className="xl:hidden">
                  {r.name ? " · " : ""}
                  {CAMPAIGN_SEND_KIND_LABELS[r.recipientKind] ??
                    r.recipientKind}
                </span>
              </span>
            </span>
          ),
        },
        {
          key: "kaynak",
          header: "Kaynak",
          hideBelow: "xl",
          cell: (r) => (
            <span className="text-xs text-[var(--admin-text-soft)]">
              {CAMPAIGN_SEND_KIND_LABELS[r.recipientKind] ?? r.recipientKind}
            </span>
          ),
        },
        {
          key: "durum",
          header: "Durum",
          cell: (r) => <StatusBadge row={r} />,
        },
        {
          key: "zaman",
          header: "Zaman",
          cell: (r) => (
            <span className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
              {r.sentAt ? formatDateTime(r.sentAt) : "-"}
            </span>
          ),
        },
        {
          key: "not",
          header: "Not",
          className: "min-w-[12rem] max-w-[18rem]",
          cell: (r) => <Note row={r} />,
        },
      ]}
      mobileCard={(r) => (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium break-all text-[var(--admin-text)]">
            {r.email}
          </span>
          {r.name ? (
            <span className="text-xs text-[var(--admin-text-soft)]">
              {r.name}
            </span>
          ) : null}
          <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-text-soft)]">
            <StatusBadge row={r} />
            {CAMPAIGN_SEND_KIND_LABELS[r.recipientKind] ?? r.recipientKind}
            {r.sentAt ? ` · ${formatDateTime(r.sentAt)}` : ""}
          </span>
          {r.error || r.providerId ? <Note row={r} /> : null}
        </div>
      )}
    />
  );
}
