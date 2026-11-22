import { Card, PageHeader } from "@/components/admin/forms";
import { PageShell } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import {
  listSiteImageRowsLive,
  resolveSiteImages,
} from "@/lib/admin/site-images";
import {
  SITE_IMAGE_GROUPS,
  SITE_IMAGE_SLOTS,
} from "@/lib/admin/site-images-core";

import { SiteImageCard } from "./site-image-card";

export const metadata = { title: "Admin · Görseller" };
export const dynamic = "force-dynamic";

/**
 * Görseller (operator, 22 Kas 2026): every photograph of the site the panel
 * can change, by where it shows. An upload replaces the bundled photograph
 * at once; "Varsayılana dön" brings the bundled one back.
 */
export default async function AdminSiteImagesPage() {
  await requireRole("content");
  const rows = await listSiteImageRowsLive();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const resolved = resolveSiteImages(rows);
  return (
    <PageShell width="form">
      <PageHeader
        title="Görseller"
        description="Sitedeki fotoğraflar: sayfa açılışları, karaoke, anasayfa, ziyaret ve menü panelleri."
        help={
          <p>
            Bir fotoğraf yükleyip kaydettiğinde site o alanda hemen yeni
            fotoğrafı gösterir. Yüklenen fotoğraf küçültülüp saklanır. Başka bir
            markanın ya da hakkı sende olmayan bir fotoğrafı yükleme.
            &quot;Varsayılana dön&quot; sitenin kendi fotoğrafını geri getirir.
          </p>
        }
      />
      <div className="grid gap-6">
        {SITE_IMAGE_GROUPS.map((group) => (
          <Card key={group}>
            <h2 className="mb-4 text-base font-semibold tracking-tight text-[var(--admin-text)]">
              {group}
            </h2>
            <div className="grid gap-4">
              {SITE_IMAGE_SLOTS.filter((s) => s.group === group).map((slot) => {
                const row = byKey.get(slot.key);
                const current = resolved[slot.key]?.src ?? "";
                return (
                  <SiteImageCard
                    key={slot.key}
                    slot={slot}
                    current={current}
                    // The served path, never the stored bytes: a page of
                    // 23 uploads would otherwise carry megabytes of base64.
                    uploaded={row?.imageUrl ? current : ""}
                    alt={row?.alt ?? ""}
                  />
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
