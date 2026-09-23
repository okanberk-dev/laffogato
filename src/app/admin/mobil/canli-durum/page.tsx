import { Card, formatDateTime, PageHeader } from "@/components/admin/forms";
import { getSettings } from "@/lib/admin/store";
import { requireRole } from "@/lib/admin/auth";
import { getVenueStatus, isCafeOpenNow } from "@/lib/mobile/venue";

import { VenueStatusForm } from "./venue-status-form";

export const metadata = { title: "Admin · Canlı durum" };
export const dynamic = "force-dynamic";

/**
 * Live venue panel. Feeds GET /api/mobile/v1/live-status from the single
 * `venue_status` row; the open/closed decision combines the override chosen
 * here with Ayarlar → Saatler.
 */
export default async function AdminVenueStatusPage() {
  await requireRole("mobileApp");
  const [status, settings] = await Promise.all([
    getVenueStatus(),
    getSettings(),
  ]);
  const openNow = isCafeOpenNow(settings.weeklyHours, status.manualOverride);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Köşk"
        title="Canlı durum"
        description="Uygulamanın ana sayfasındaki açık/kapalı, boş masa, Wi-Fi ve gürültü bilgisi buradan güncellenir."
      />

      <div className="grid gap-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                openNow
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  openNow ? "bg-emerald-500" : "bg-neutral-400"
                }`}
              />
              {openNow ? "Şu an açık görünüyor" : "Şu an kapalı görünüyor"}
            </span>
            <span className="text-neutral-500">
              {status.updatedAt
                ? `Son güncelleme: ${formatDateTime(status.updatedAt)}`
                : "Henüz hiç güncellenmedi - varsayılanlar gösteriliyor."}
            </span>
          </div>
        </Card>

        <VenueStatusForm
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
