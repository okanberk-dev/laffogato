import Link from "next/link";

import { Card, DangerButton, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { APP_POST_KIND_LABELS, listAppPosts } from "@/lib/admin/store";

import { deletePostAction } from "./actions";

export const metadata = { title: "Admin · Uygulama Gönderileri" };
export const dynamic = "force-dynamic";

interface PageProps {
  /** Written by the save actions' redirect: the automatic e-mail's outcome. */
  searchParams: Promise<{ eposta?: string; adet?: string; kampanya?: string }>;
}

/**
 * The one thing a void form action cannot say is what happened to its side
 * effect, so the save actions say it here, in the URL they redirect to. The
 * post itself is saved in every case; this is only about the mail.
 */
function MailOutcomeBanner({
  eposta,
  adet,
  kampanya,
}: {
  eposta?: string;
  adet?: string;
  kampanya?: string;
}) {
  if (eposta === "kuyrukta") {
    const n = parseInt(adet ?? "", 10);
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Gönderi kaydedildi.{" "}
        {Number.isFinite(n) && n > 0
          ? `${n} üyeye kampanya e-postası kuyruğa alındı; gönderim arka planda sürüyor.`
          : "Pazarlama izni olan üye bulunamadı; e-posta çıkmadı."}{" "}
        <Link href="/admin/bulten/kampanya" className="underline">
          Kampanya e-postası
        </Link>
      </div>
    );
  }
  if (eposta === "hata") {
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Gönderi kaydedildi ama kampanya e-postası kuyruğa alınamadı.{" "}
        {kampanya ? (
          <>
            Taslak oluşturuldu; eksik alanı{" "}
            <Link
              href={`/admin/bulten/kampanya/${encodeURIComponent(kampanya)}`}
              className="underline"
            >
              kampanya sayfasında
            </Link>{" "}
            tamamlayıp oradan gönderin.
          </>
        ) : (
          <>
            Kampanya oluşturulamadı;{" "}
            <Link href="/admin/bulten/kampanya/yeni" className="underline">
              Kampanya e-postası
            </Link>{" "}
            sayfasından elle açabilirsiniz.
          </>
        )}
      </div>
    );
  }
  return null;
}

export default async function AdminAppPostsPage({ searchParams }: PageProps) {
  await requireRole("mobileApp");
  const sp = await searchParams;
  const rows = await listAppPosts();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Gönderiler"
        description="Ana sayfada yatay kaydırılan kartlar: kampanyalar, iş birlikleri ve etkinlikler. Tarih aralığı verirsen kendiliğinden düşer."
        action={
          <Link
            href="/admin/mobil/gonderiler/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni gönderi
          </Link>
        }
      />

      <MailOutcomeBanner
        eposta={sp.eposta}
        adet={sp.adet}
        kampanya={sp.kampanya}
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Henüz gönderi yok.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-[11px] tracking-widest text-neutral-500 uppercase">
                    {APP_POST_KIND_LABELS[p.kind]}
                  </p>
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="line-clamp-2 text-sm text-neutral-500">
                    {p.body}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Sıra {p.sortOrder}
                    {p.isActive ? "" : " · YAYINDA DEĞİL"}
                    {p.image ? " · görselli" : " · marka zemini"}
                    {p.linkUrl ? " · bağlantılı" : ""}
                    {p.startsAt || p.endsAt
                      ? ` · ${p.startsAt || "…"} → ${p.endsAt || "…"}`
                      : ""}
                    {p.emailCampaignId ? " · e-posta gönderildi" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/mobil/gonderiler/${p.id}`}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--admin-border)] px-4 text-sm"
                  >
                    Düzenle
                  </Link>
                  <form action={deletePostAction}>
                    <input type="hidden" name="id" value={p.id} />
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
