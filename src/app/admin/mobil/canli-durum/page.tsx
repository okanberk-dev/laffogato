import { Card, formatDateTime, PageHeader } from "@/components/admin/forms";
import { Badge } from "@/components/admin/ui";
import { getSettings } from "@/lib/admin/store";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import { getVenueStatus, isCafeOpenNow } from "@/lib/mobile/venue";

import { VenueStatusForm } from "./venue-status-form";

export const metadata = { title: "Admin · Canlı durum" };
export const dynamic = "force-dynamic";

/**
 * Live venue panel. Feeds GET /api/mobile/v1/live-status from the single
 * `venue_status` row; the open/closed decision combines the override chosen
 * here with Ayarlar → Saatler.
 *
 * Open to the köşk shift (`venue`, admin UI v2 decision D3); the table
 * count is read-only without `mobileApp`, and the action ignores it.
 */
export default async function AdminVenueStatusPage() {
  const session = await requireRole("venue");
  const canEditTotal = canAccess("mobileApp", session.role);
  const [status, settings] = await Promise.all([
    getVenueStatus(),
    getSettings(),
  ]);
  const openNow = isCafeOpenNow(settings.weeklyHours, status.manualOverride);

  return (
    // A form page at the form width (PAGE_WIDTHS.form): at 1280 px the
    // two-digit table counts sat in 440 px boxes.
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
      <PageHeader
        title="Canlı durum"
        description="Uygulamanın ana sayfasındaki açık/kapalı, boş masa, Wi-Fi ve gürültü bilgisi buradan güncellenir."
      />

      <div className="grid gap-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone={openNow ? "success" : "neutral"} dot>
              {openNow ? "Şu an açık görünüyor" : "Şu an kapalı görünüyor"}
            </Badge>
            <span className="text-[var(--admin-text-soft)]">
              {status.updatedAt
                ? `Son güncelleme: ${formatDateTime(status.updatedAt)}`
                : "Henüz hiç güncellenmedi - varsayılanlar gösteriliyor."}
            </span>
          </div>
        </Card>

        <VenueStatusForm
          canEditTotal={canEditTotal}
          defaults={{
            manualOverride: status.manualOverride,
            freeTables: status.freeTables,
            totalTables: status.totalTables,
            wifi: status.wifi,
            noise: status.noise,
            power: status.power,
            note: status.note,
          }}
        />
      </div>
    </main>
  );
}
