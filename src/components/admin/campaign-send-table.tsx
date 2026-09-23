"use client";

import { useState } from "react";

import type {
  CampaignSendRow,
  CampaignSendStatus,
} from "@/lib/admin/campaign-sends";

import { formatDateTime } from "./forms";

const STATUS_LABEL: Record<CampaignSendStatus, string> = {
  queued: "Kuyrukta",
  sending: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Başarısız",
  skipped: "Atlandı",
};

const STATUS_TONE: Record<CampaignSendStatus, string> = {
  queued: "bg-neutral-100 text-neutral-600",
  sending: "bg-blue-50 text-blue-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-amber-50 text-amber-700",
};

const KIND_LABEL: Record<string, string> = {
  customer: "Üye",
  subscriber: "Bülten",
};

type Filter = "all" | CampaignSendStatus;

/**
 * The recipient table.
 *
 * Addresses are shown whole, not masked: this is the panel, the same operator
 * one click away from /admin/musteriler, and a masked address cannot answer
 * the question the screen exists for - "did Ali get it, and if not, why".
 * Masking belongs in the LOGS, where `maskEmail` already does it.
 */
export function CampaignSendTable({
  rows,
  truncated,
}: {
  rows: CampaignSendRow[];
  /** True when the cap hid rows - the note under the table says so. */
  truncated: boolean;
}) {
  // Failures first, because that is the first question every time.
  const [filter, setFilter] = useState<Filter>(
    rows.some((r) => r.status === "failed") ? "failed" : "all",
  );

  const present = new Set(rows.map((r) => r.status));
  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "Tümü", count: rows.length },
    ...(["failed", "skipped", "queued", "sending", "sent"] as const)
      .filter((s) => present.has(s))
      .map((s) => ({
        id: s as Filter,
        label: STATUS_LABEL[s],
        count: rows.filter((r) => r.status === s).length,
      })),
  ];

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === f.id
                ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-white"
                : "border-[var(--admin-border)] text-neutral-600 hover:border-[var(--admin-primary)]"
            }`}
          >
            {f.label} · {f.count}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-neutral-500">Bu durumda kayıt yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-left">
                <Th>Adres</Th>
                <Th>Kaynak</Th>
                <Th>Durum</Th>
                <Th>Zaman</Th>
                <Th>Not</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.email}
                  className="border-b border-neutral-100 align-top"
                >
                  <td className="py-2 pr-3">
                    <span style={{ fontFamily: "var(--mono), monospace" }}>
                      {r.email}
                    </span>
                    {r.name && (
                      <span className="block text-xs text-neutral-500">
                        {r.name}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-neutral-600">
                    {KIND_LABEL[r.recipientKind] ?? r.recipientKind}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.16em] uppercase ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-neutral-600">
                    {r.sentAt ? formatDateTime(r.sentAt) : "-"}
                  </td>
                  <td className="py-2 text-xs break-words text-neutral-600">
                    {r.error ? (
                      <span className="text-red-600">{r.error}</span>
                    ) : r.providerId ? (
                      <span style={{ fontFamily: "var(--mono), monospace" }}>
                        {r.providerId}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {truncated && (
        <p className="text-xs text-neutral-500">
          Liste ilk kayıtlarla sınırlı; başarısız olanlar her zaman en üstte
          yer alır.
        </p>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="py-2 pr-3 text-[10px] font-normal tracking-[0.18em] text-neutral-500 uppercase"
      style={{ fontFamily: "var(--mono), monospace" }}
    >
      {children}
    </th>
  );
}
