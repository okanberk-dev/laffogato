import Link from "next/link";

import { Card, PageHeader } from "@/components/admin/forms";
import { BUTTON, ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { imageVersion } from "@/lib/admin/image-bytes";
import { heroImagePath, servedImage } from "@/lib/admin/image-url";
import { listShopHeroSlides, type AdminShopHeroSlide } from "@/lib/admin/store";

import { deleteSlideAction } from "./actions";

export const metadata = { title: "Admin · Mağaza vitrini" };
export const dynamic = "force-dynamic";

/**
 * The thumbnail's address. An upload is stored as a data URL of up to 4 MB:
 * inlined, every slide's photo went into the page (and into a style
 * attribute) on each visit. /gorsel/hero/<id> serves it, inactive slides
 * included, and caches it by its stamp (admin audit CAT-08).
 */
function thumb(s: AdminShopHeroSlide): string {
  return servedImage(s.imageUrl, heroImagePath(s.id, imageVersion(s.imageUrl)));
}

export default async function AdminShopHeroPage() {
  await requireRole("shopHero");
  const slides = await listShopHeroSlides();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Mağaza vitrini"
        title="Mağaza vitrini"
        description="Mağaza sayfasının en üstündeki kayan alan: her slaytın başlığı, alt yazısı, görseli ve düğmesi. Kaydettiğin değişiklik mağazaya hemen yansır."
        action={
          <Link
            href="/admin/magaza-hero/yeni"
            className={`${BUTTON.primary} w-full sm:w-auto`}
          >
            + Yeni slayt
          </Link>
        }
      />

      {slides.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--admin-text-soft)]">
            Henüz slayt yok; mağaza sayfası vitrinsiz açılır. “+ Yeni slayt” ile
            ekle.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {slides.map((s) => (
            <Card key={s.id}>
              <div className="grid gap-4 sm:grid-cols-[120px_1fr_auto] sm:items-center">
                <div className="relative h-24 w-full overflow-hidden rounded-lg border border-[var(--admin-border)] bg-gradient-to-br from-amber-100 to-amber-300 sm:h-20">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb(s)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-xs tracking-widest text-amber-900 uppercase">
                      görsel yok
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs tracking-widest text-[var(--admin-text-mute)] uppercase">
                      Sıra {s.sortOrder}
                    </span>
                    {s.isActive ? (
                      <span className="rounded-full bg-[var(--admin-success-soft)] px-2 py-0.5 font-mono text-[10px] tracking-widest text-[var(--admin-success)] uppercase">
                        Aktif
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--admin-neutral-soft)] px-2 py-0.5 font-mono text-[10px] tracking-widest text-[var(--admin-text-mute)] uppercase">
                        Pasif
                      </span>
                    )}
                    <span className="rounded-full bg-[var(--admin-neutral-soft)] px-2 py-0.5 font-mono text-[10px] tracking-widest text-[var(--admin-text-soft)] uppercase">
                      {s.textTheme === "light" ? "Açık yazı" : "Koyu yazı"}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg leading-tight font-medium break-words">
                    {s.title || "(başlıksız)"}
                  </h3>
                  {s.subtitle && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--admin-text-soft)]">
                      {s.subtitle}
                    </p>
                  )}
                  {s.ctaLabel && (
                    <p className="mt-1 text-xs break-all text-[var(--admin-text-mute)]">
                      Düğme: {s.ctaLabel} → {s.ctaHref}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/magaza-hero/${encodeURIComponent(s.id)}`}
                    className={BUTTON.ghost}
                    aria-label={`Düzenle: ${s.title || s.id}`}
                  >
                    Düzenle
                  </Link>
                  <ConfirmButton
                    action={deleteSlideAction}
                    hidden={{ id: s.id }}
                    label="Sil"
                    ariaLabel={`Sil: ${s.title || s.id}`}
                    title={`"${s.title}" silinsin mi?`}
                    description="Slayt mağaza sayfasının karuselinden hemen kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için Düzenle'den pasif yap."
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
