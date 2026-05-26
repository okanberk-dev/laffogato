import Link from "next/link";

import {
  Card,
  DangerButton,
  PageHeader,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listShopHeroSlides } from "@/lib/admin/store";

import { deleteSlideAction } from "./actions";

export const metadata = { title: "Admin · Mağaza Hero" };
export const dynamic = "force-dynamic";

export default async function AdminShopHeroPage() {
  await requireRole("shopHero");
  const slides = await listShopHeroSlides();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Shop · Hero slider"
        title="Mağaza Hero"
        description="Mağaza sayfasının en üstündeki slider — başlık, küçük yazı, görsel ve CTA."
        action={
          <Link
            href="/admin/magaza-hero/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 sm:w-auto"
          >
            + Yeni slayt
          </Link>
        }
      />

      {slides.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            Henüz slayt yok. Yeni bir slayt ekleyerek başla.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {slides.map((s) => (
            <Card key={s.id}>
              <div className="grid gap-4 sm:grid-cols-[120px_1fr_auto] sm:items-center">
                <div
                  className="relative h-24 w-full overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-amber-100 to-amber-300 sm:h-20"
                  style={
                    s.imageUrl
                      ? {
                          backgroundImage: `url(${s.imageUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!s.imageUrl && (
                    <span className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-amber-900/70">
                      görsel yok
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-widest text-neutral-500">
                      #{s.sortOrder}
                    </span>
                    {s.isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-emerald-700">
                        Aktif
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                        Pasif
                      </span>
                    )}
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                      Tema: {s.textTheme === "light" ? "Açık metin" : "Koyu metin"}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-medium leading-tight">{s.title}</h3>
                  {s.subtitle && (
                    <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{s.subtitle}</p>
                  )}
                  {s.ctaLabel && (
                    <p className="mt-1 font-mono text-xs uppercase tracking-widest text-neutral-500">
                      CTA: {s.ctaLabel} → {s.ctaHref}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/magaza-hero/${s.id}`}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full border border-neutral-200 px-4 text-sm hover:border-neutral-900"
                  >
                    Düzenle
                  </Link>
                  <form action={deleteSlideAction}>
                    <input type="hidden" name="id" value={s.id} />
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
