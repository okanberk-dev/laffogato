import Link from "next/link";

import { Card, DangerButton, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { APP_SLIDE_TONE_LABELS, listAppSlides } from "@/lib/admin/store";

import { deleteSlideAction } from "./actions";

export const metadata = { title: "Admin · Uygulama Slaytları" };
export const dynamic = "force-dynamic";

/** Preview swatch so the tone is judged by eye, not by its name. */
const TONE_SWATCH: Record<string, string> = {
  premium: "#5C1626",
  inverse: "#1E3932",
  brand: "#006241",
  paper: "#FAF9F6",
};

export default async function AdminAppSlidesPage() {
  await requireRole("mobileApp");
  const slides = await listAppSlides();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Slaytlar"
        description="Uygulamanın ana sayfasındaki kayan kartlar. Buradaki değişiklik mağaza güncellemesi beklemeden telefonlara ulaşır."
        action={
          <Link
            href="/admin/mobil/slaytlar/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
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
              <div className="grid gap-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                <div
                  className="flex h-20 items-end rounded-lg border border-[var(--admin-border)] p-2"
                  style={{ background: TONE_SWATCH[s.tone] ?? "#FAF9F6" }}
                >
                  <span
                    className="text-[10px] tracking-widest uppercase"
                    style={{
                      color: s.tone === "paper" ? "#16211E" : "#FFFFFF",
                    }}
                  >
                    {s.tone}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] tracking-widest text-neutral-500 uppercase">
                    {s.eyebrow || "—"}
                  </p>
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="line-clamp-2 text-sm text-neutral-500">
                    {s.body}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Sıra {s.sortOrder} · {APP_SLIDE_TONE_LABELS[s.tone]}
                    {s.ctaLabel
                      ? ` · ${s.ctaLabel} → ${s.ctaRoute || "—"}`
                      : " · butonsuz"}
                    {s.isActive ? "" : " · YAYINDA DEĞİL"}
                    {s.startsAt || s.endsAt
                      ? ` · ${s.startsAt || "…"} → ${s.endsAt || "…"}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/mobil/slaytlar/${s.id}`}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--admin-border)] px-4 text-sm"
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
