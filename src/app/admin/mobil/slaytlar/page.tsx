import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ConfirmButton,
  DataTable,
  EmptyState,
  StatusTabs,
} from "@/components/admin/ui";
import { appPublishStatus } from "@/lib/admin/app-content-schema";
import { requireRole } from "@/lib/admin/auth";
import {
  APP_SLIDE_ROUTE_LABELS,
  APP_SLIDE_TONE_LABELS,
  isAppSlideRoute,
  listAppSlides,
  type AdminAppSlide,
} from "@/lib/admin/store";

import {
  DELETE_TEXT,
  parsePublishFilter,
  PublishCell,
  PUBLISH_STATUS_PARAM,
  publishTabs,
} from "../app-content-list";
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

const PANEL = "/admin/mobil/slaytlar";

function routeLabel(route: string): string {
  return isAppSlideRoute(route) ? APP_SLIDE_ROUTE_LABELS[route] : "-";
}

export default async function AdminAppSlidesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("mobileApp");
  const [slides, sp] = await Promise.all([
    listAppSlides(),
    searchParams ?? Promise.resolve({}),
  ]);
  // One reading of the clock for the whole list, tabs and badges alike.
  const now = new Date().getTime();
  const filter = parsePublishFilter(
    (sp as Record<string, unknown>)[PUBLISH_STATUS_PARAM],
  );
  const rows = filter
    ? slides.filter((s) => appPublishStatus(s, now) === filter)
    : slides;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Slaytlar"
        description="Uygulamanın ana sayfasındaki kayan kartlar. Buradaki değişiklik mağaza güncellemesi beklemeden, birkaç dakika içinde telefonlara ulaşır."
        action={
          <Link
            href={`${PANEL}/yeni`}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni slayt
          </Link>
        }
      />

      {slides.length > 0 ? (
        <StatusTabs
          tabs={publishTabs(slides, now, filter)}
          current={filter}
          searchParams={sp}
          pathname={PANEL}
          param={PUBLISH_STATUS_PARAM}
          label="Yayın durumu"
        />
      ) : null}

      <DataTable<AdminAppSlide>
        caption="Uygulama slaytları"
        rows={rows}
        rowKey={(s) => s.id}
        rowHref={(s) => `${PANEL}/${encodeURIComponent(s.id)}`}
        empty={
          slides.length === 0 ? (
            <EmptyState
              title="Henüz slayt yok."
              description="Yeni bir slayt ekleyerek başla."
            />
          ) : (
            <EmptyState title="Bu durumda slayt yok." />
          )
        }
        columns={[
          {
            key: "slide",
            header: "Slayt",
            cell: (s) => (
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-12 w-16 shrink-0 rounded-lg border border-[var(--admin-border)]"
                  style={{
                    // The image sits over the tone exactly as on the phone,
                    // so a slide whose picture fails to load still previews
                    // as its ground rather than as a broken-image icon.
                    backgroundColor: TONE_SWATCH[s.tone] ?? TONE_SWATCH.paper,
                    backgroundImage: s.image ? `url("${s.image}")` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <span className="min-w-0 md:max-w-[14rem] xl:max-w-[22rem]">
                  {s.eyebrow ? (
                    <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                      {s.eyebrow}
                    </span>
                  ) : null}
                  <span className="block truncate font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                    {APP_SLIDE_TONE_LABELS[s.tone]}
                    {s.image ? " · görselli" : ""}
                  </span>
                </span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Durum",
            cell: (s) => <PublishCell row={s} now={now} />,
          },
          {
            key: "cta",
            header: "Buton",
            hideBelow: "xl",
            cell: (s) =>
              s.ctaLabel ? (
                <span className="block max-w-[220px] truncate text-xs text-[var(--admin-text-soft)]">
                  {s.ctaLabel} → {routeLabel(s.ctaRoute)}
                </span>
              ) : (
                <span className="text-xs text-[var(--admin-text-soft)]">
                  Butonsuz
                </span>
              ),
          },
          {
            key: "order",
            header: "Sıra",
            align: "right",
            cell: (s) => s.sortOrder,
          },
        ]}
        rowActions={(s) => (
          <ActionMenu label={`${s.title} işlemleri`}>
            <ActionMenuLink href={`${PANEL}/${encodeURIComponent(s.id)}`}>
              Düzenle
            </ActionMenuLink>
            <ActionMenuSeparator />
            <ConfirmButton
              action={deleteSlideAction}
              hidden={{ id: s.id }}
              label="Sil"
              variant="menuDanger"
              ariaLabel={`Sil: ${s.title}`}
              title={`"${s.title}" silinsin mi?`}
              description={DELETE_TEXT.slide}
            />
          </ActionMenu>
        )}
      />
    </main>
  );
}
