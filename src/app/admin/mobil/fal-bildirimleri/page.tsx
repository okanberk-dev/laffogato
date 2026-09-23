import { Card, formatDateTime, PageHeader } from "@/components/admin/forms";
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
 */
export default async function AdminFalReportsPage() {
  await requireRole("mobileApp");
  const reports = await listFalReports();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · fA'L"
        title="fA'L bildirimleri"
        description="Üyelerin 'Bu yorumu bildir' ile ilettiği yapay zekâ yorumları. Fotoğraf saklanmaz; burada yalnızca yorumun metni, sebep ve model görünür. Kayıtlar 90 gün sonra silinir."
      />

      {reports.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Bildirilmiş yorum yok.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {reports.map((r, i) => (
            <Card key={r.id ?? `${r.createdAt}-${i}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  {FAL_REPORT_REASON_LABELS[falReportReason(r.reason)]}
                </span>
                <span className="text-xs text-neutral-400">
                  {formatDateTime(r.createdAt)}
                  {r.model ? ` · ${r.model}` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-line text-neutral-700">
                {r.text}
              </p>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
