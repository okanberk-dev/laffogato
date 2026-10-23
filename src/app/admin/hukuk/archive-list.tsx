import Link from "next/link";

import { Card, formatDateTime } from "@/components/admin/forms";
import {
  Badge,
  BUTTON,
  ConfirmButton,
  EmptyState,
} from "@/components/admin/ui";
import { findLegalDoc } from "@/lib/legal/documents";
import type { LegalOverrideArchiveSummary } from "@/lib/legal/store";

import { restoreLegalDocAction } from "./actions";

const REASON: Record<string, string> = {
  reset: "Varsayılana döndürüldü",
  replaced: "Üzerine kaydedildi",
};

/**
 * The archive of replaced and reset legal texts, newest first, each with a
 * preview and "Geri yükle". `showDoc` names the document on each row (the
 * list page shows every document's; the editor only its own).
 */
export function LegalArchiveList({
  rows,
  showDoc,
  description,
}: {
  rows: LegalOverrideArchiveSummary[];
  showDoc: boolean;
  description: string;
}) {
  return (
    <Card className="mt-6">
      <h2 className="text-base font-semibold text-[var(--admin-text)]">
        Arşiv
      </h2>
      <p className="mt-1 mb-4 text-sm text-[var(--admin-text-soft)]">
        {description}
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="Arşivde metin yok"
          description="Bir metni varsayılana döndürdüğünde ya da üzerine kaydettiğinde önceki metin burada durur."
        />
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => {
            const docTitle = findLegalDoc(row.slug)?.title ?? row.slug;
            const when = formatDateTime(row.archivedAt);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] p-3"
              >
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words text-[var(--admin-text)]">
                      {showDoc ? docTitle : row.title || docTitle}
                    </span>
                    <Badge
                      tone={row.reason === "reset" ? "warning" : "neutral"}
                    >
                      {REASON[row.reason] ?? row.reason}
                    </Badge>
                    <Badge tone={row.isPublished ? "success" : "neutral"}>
                      {row.isPublished ? "O an yayındaydı" : "Taslaktı"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--admin-text-soft)]">
                    Yürürlük: {row.effectiveDate || "yazılmamış"} · Arşivlendi:{" "}
                    {when}
                    {row.archivedBy ? ` · ${row.archivedBy}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/hukuk/${row.slug}/onizle?arsiv=${row.id}`}
                    className={BUTTON.ghost}
                    aria-label={`Önizle: ${docTitle}, ${when}`}
                  >
                    Önizle
                  </Link>
                  <ConfirmButton
                    action={restoreLegalDocAction}
                    hidden={{ id: row.id }}
                    label="Geri yükle"
                    tone="default"
                    ariaLabel={`Geri yükle: ${docTitle}, ${when}`}
                    title="Bu metin geri yüklensin mi?"
                    description={`${docTitle} bu arşivdeki metinle değişir; o an yayındaysa yayına, taslaksa taslak olarak döner. Şu anki özel metin varsa o da arşive alınır.`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
