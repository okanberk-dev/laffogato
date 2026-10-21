import { Card, formatDateTime, PageHeader } from "@/components/admin/forms";
import { Badge, EmptyState, PageShell } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { listFalReports } from "@/lib/mobile/fal";
import {
  FAL_REPORT_REASON_LABELS,
  falReportReason,
} from "@/lib/mobile/fal-core";

export const metadata = { title: "Admin · fA'L bildirimleri" };
export const dynamic = "force-dynamic";

/**
 * "Bu yorumu bildir" reports on fA'L's AI readings (docs/API-MOBILE.md §20).
 *
 * Read-only: the operator reads what the AI wrote and why a member flagged
 * it, and tightens the standing instructions (`FAL_INSTRUCTIONS`) or the
 * forbidden stems when a pattern shows. No address is shown - who flagged a
 * reading is not what the review needs. Rows go after ninety days
 * (`src/lib/retention.ts`, rule `fal-reports`).
 *
 * The newest SHOWN are listed; one more is read, so the page can say when
 * there are older ones it does not show (it used to stop at 200 without a
 * word).
 */
const SHOWN = 200;

export default async function AdminFalReportsPage() {
  await requireRole("mobileApp");
  const read = await listFalReports(SHOWN + 1);
  const capped = read.length > SHOWN;
  const reports = capped ? read.slice(0, SHOWN) : read;

  return (
    <PageShell width="list">
      <PageHeader
        title="fA'L bildirimleri"
        description="Üyelerin Bildir ile ilettiği yapay zekâ yorumları."
        help={
          <p>
            Fotoğraf saklanmaz; burada yalnızca yorumun metni, sebep ve model
            görünür. Kayıtlar 90 gün sonra silinir.
          </p>
        }
      />

      {reports.length === 0 ? (
        <EmptyState title="Bildirilmiş yorum yok." />
      ) : (
        <div className="grid gap-3">
          <p role="status" className="text-sm text-[var(--admin-text-soft)]">
            {capped
              ? `En yeni ${SHOWN} bildirim gösteriliyor; daha eskileri de var (90 gün dolunca silinir).`
              : `${reports.length} bildirim.`}
          </p>
          {reports.map((r, i) => (
            <Card key={r.id ?? `${r.createdAt}-${i}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">
                  {FAL_REPORT_REASON_LABELS[falReportReason(r.reason)]}
                </Badge>
                <span className="text-xs text-[var(--admin-text-soft)]">
                  {formatDateTime(r.createdAt)}
                  {r.model ? ` · ${r.model}` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-line text-[var(--admin-text)]">
                {r.text}
              </p>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
