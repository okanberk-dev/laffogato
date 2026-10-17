import Link from "next/link";

import { Card, PageHeader } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import {
  APP_SLIDE_ROUTE_LABELS,
  APP_SLIDE_TONE_LABELS,
  isAppSlideRoute,
  listAppSlides,
} from "@/lib/admin/store";

import { deleteSlideAction } from "./actions";

export const metadata = { title: "Admin · Uygulama Slaytları" };
export const dynamic = "force-dynamic";

/**
 * Preview swatch so the tone is judged by eye, not by its name.
 *
 * Values mirror what the app PAINTS for each tone (lafmobil
 * `src/components/home/season-hero.tsx` GROUND, colours from its
 * `src/theme/tokens.ts`, karar 149's livelier green and bordo of 23 Sep 2026):
 *
 *   premium → the bordo card (`bg.velvet`)
 *   inverse → green running into night; the swatch shows the night end,
 *             because that is what tells it apart from `brand` (`bg.night`)
 *   brand   → the flat structure green (`bg.inverse` = `brand.primary`)
 *   paper   → the white card (`bg.surface`)
 *
 * The previous values had drifted: `inverse` showed the pressed green the app
 * never draws a slide in, `paper` the page's cream rather than the card's
 * white. A swatch that does not match the phone makes an operator pick a
 * tone that looks nothing like what the member sees.
 */
const TONE_SWATCH: Record<string, string> = {
  premium: "#9D2543",
  inverse: "#0E2F23",
  brand: "#1D6D56",
  paper: "#FFFFFF",
};

/** app `text.primary` - the only tone whose label needs dark ink. */
const PAPER_INK = "#1D1C1C";

function routeLabel(route: string): string {
  return isAppSlideRoute(route) ? APP_SLIDE_ROUTE_LABELS[route] : "-";
}

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
                  style={{
                    // The image sits over the tone exactly as on the phone, so
                    // a slide whose picture fails to load still previews as
                    // its ground rather than as a broken-image icon.
                    backgroundColor: TONE_SWATCH[s.tone] ?? TONE_SWATCH.paper,
                    backgroundImage: s.image ? `url("${s.image}")` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  title={s.image || undefined}
                >
                  <span
                    className="rounded px-1 text-[10px] tracking-widest uppercase"
                    style={{
                      color: s.tone === "paper" ? PAPER_INK : "#FFFFFF",
                      backgroundColor: s.image
                        ? (TONE_SWATCH[s.tone] ?? TONE_SWATCH.paper)
                        : undefined,
                    }}
                  >
                    {s.tone}
                    {s.image ? " · görsel" : ""}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] tracking-widest text-neutral-500 uppercase">
                    {s.eyebrow || "-"}
                  </p>
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="line-clamp-2 text-sm text-neutral-500">
                    {s.body}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Sıra {s.sortOrder} · {APP_SLIDE_TONE_LABELS[s.tone]}
                    {s.image ? " · görselli" : ""}
                    {s.ctaLabel
                      ? ` · ${s.ctaLabel} → ${routeLabel(s.ctaRoute)}`
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
                  <ConfirmButton
                    action={deleteSlideAction}
                    hidden={{ id: s.id }}
                    label="Sil"
                    title={`"${s.title}" silinsin mi?`}
                    description="Slayt uygulamanın ana sayfasından hemen kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için Düzenle'den yayından al."
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
