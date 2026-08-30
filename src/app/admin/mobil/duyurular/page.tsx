import Link from "next/link";

import { Card, DangerButton, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import {
  APP_ANNOUNCEMENT_KIND_LABELS,
  listAppAnnouncements,
} from "@/lib/admin/store";

import { deleteAnnouncementAction } from "./actions";

export const metadata = { title: "Admin · Uygulama Duyuruları" };
export const dynamic = "force-dynamic";

export default async function AdminAppAnnouncementsPage() {
  await requireRole("mobileApp");
  const rows = await listAppAnnouncements();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Duyurular"
        description="Ana sayfadaki kısa duyuru kartları. Kısa ömürlüdür; tarih aralığı verirsen kendiliğinden düşer."
        action={
          <Link
            href="/admin/mobil/duyurular/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni duyuru
          </Link>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Henüz duyuru yok.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((a) => (
            <Card key={a.id}>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-[11px] tracking-widest text-neutral-500 uppercase">
                    {APP_ANNOUNCEMENT_KIND_LABELS[a.kind]}
                  </p>
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="line-clamp-2 text-sm text-neutral-500">
                    {a.body}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Sıra {a.sortOrder}
                    {a.isActive ? "" : " · YAYINDA DEĞİL"}
                    {a.startsAt || a.endsAt
                      ? ` · ${a.startsAt || "…"} → ${a.endsAt || "…"}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/mobil/duyurular/${a.id}`}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--admin-border)] px-4 text-sm"
                  >
                    Düzenle
                  </Link>
                  <form action={deleteAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <DangerButton type="submit">Sil</DangerButton>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
