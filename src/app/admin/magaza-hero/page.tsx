import { ActionButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/forms";
import { MoveButtons } from "@/components/admin/move-buttons";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  Badge,
  BUTTON,
  ConfirmButton,
  DataTable,
  EmptyState,
  PageShell,
} from "@/components/admin/ui";
import Link from "@/components/link";
import { requireRole } from "@/lib/admin/auth";
import { imageVersion } from "@/lib/admin/image-bytes";
import { heroImagePath, servedImage } from "@/lib/admin/image-url";
import { listShopHeroSlides, type AdminShopHeroSlide } from "@/lib/admin/store";

import {
  deleteSlideAction,
  moveSlideAction,
  setSlideActiveAction,
} from "./actions";

export const metadata = { title: "Admin · Mağaza vitrini" };
export const dynamic = "force-dynamic";

const PANEL = "/admin/magaza-hero";

/**
 * The thumbnail's address. An upload is stored as a data URL of up to 4 MB:
 * inlined, every slide's photo went into the page (and into a style
 * attribute) on each visit. /gorsel/hero/<id> serves it, inactive slides
 * included, and caches it by its stamp (admin audit CAT-08).
 */
function thumb(s: AdminShopHeroSlide): string {
  return servedImage(s.imageUrl, heroImagePath(s.id, imageVersion(s.imageUrl)));
}

function title(s: AdminShopHeroSlide): string {
  return s.title || "(başlıksız)";
}

/**
 * The shop's carousel, as the home page's slides are listed: the table, a
 * badge for the state, ↑ / ↓ for the order, and the row's ⋯ with
 * Düzenle, Yayına al / Yayından kaldır and Sil. It used to be hand-built
 * cards with Düzenle and Sil on every row, and the only way to take a
 * slide off for a while was the form's checkbox.
 */
export default async function AdminShopHeroPage() {
  await requireRole("shopHero");
  const slides = await listShopHeroSlides();
  const live = slides.filter((s) => s.isActive).length;

  return (
    <PageShell width="list">
      <PageHeader
        title="Slaytlar"
        description="Mağaza sayfasının en üstünde dönen slaytlar."
        help={
          <p>
            Her slaytın başlığı, alt yazısı, görseli ve düğmesi burada durur.
            Kaydettiğin değişiklik mağazaya hemen yansır. Sırayı ↑ / ↓ ile,
            görünürlüğü satırın ⋯ menüsündeki &quot;Yayından kaldır&quot; ile
            değiştirirsin.
          </p>
        }
        primary={{ href: `${PANEL}/yeni`, label: "Yeni slayt" }}
      />

      {slides.length > 0 ? (
        <p className="mb-4 text-sm text-[var(--admin-text-soft)]" role="status">
          {live === 0
            ? "Yayında slayt yok: mağaza sayfası vitrinsiz açılıyor."
            : `Mağazada ${live} slayt dönüyor.`}
        </p>
      ) : null}

      <DataTable
        caption="Mağaza slaytları"
        rows={slides}
        rowKey={(s) => s.id}
        rowHref={(s) => `${PANEL}/${encodeURIComponent(s.id)}`}
        empty={
          <EmptyState
            title="Henüz slayt yok."
            description="Mağaza sayfası vitrinsiz açılır."
            action={
              <Link href={`${PANEL}/yeni`} className={BUTTON.ghost}>
                Yeni slayt
              </Link>
            }
          />
        }
        columns={[
          {
            key: "slide",
            header: "Slayt",
            cell: (s) => (
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="relative grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--admin-border)] bg-gradient-to-br from-amber-100 to-amber-300"
                >
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
                    <span className="text-[11px] text-[var(--admin-warning)]">
                      Görsel yok
                    </span>
                  )}
                </span>
                {/* Capped like the app's slides: the order buttons and the
                    ⋯ menu keep their room beside the sidebar. */}
                {/* Two lines on a phone card, where one cut the subtitle
                    at "500₺ üzeri ücretsi…"; one line in the table. */}
                <span className="min-w-0 md:max-w-[14rem] xl:max-w-[20rem] 2xl:max-w-[28rem]">
                  <span className="font-medium max-md:line-clamp-2 md:block md:truncate">
                    {title(s)}
                  </span>
                  {s.subtitle ? (
                    <span className="text-xs text-[var(--admin-text-mute)] max-md:line-clamp-2 md:block md:truncate">
                      {s.subtitle}
                    </span>
                  ) : null}
                </span>
              </span>
            ),
          },
          {
            key: "cta",
            header: "Düğme",
            hideBelow: "xl",
            cell: (s) =>
              s.ctaLabel ? (
                <span className="block max-w-[200px] truncate text-xs text-[var(--admin-text-soft)]">
                  {s.ctaLabel} → {s.ctaHref}
                </span>
              ) : (
                <span className="text-xs text-[var(--admin-text-mute)]">
                  Düğmesiz
                </span>
              ),
          },
          {
            key: "status",
            header: "Durum",
            cell: (s) => (
              <span className="grid justify-items-start gap-1">
                <Badge tone={s.isActive ? "success" : "neutral"} dot>
                  {s.isActive ? "Mağazada" : "Yayında değil"}
                </Badge>
                <span className="text-xs text-[var(--admin-text-mute)]">
                  {s.textTheme === "light" ? "Açık yazı" : "Koyu yazı"}
                </span>
              </span>
            ),
          },
          {
            key: "order",
            header: "Sıra",
            align: "right",
            cell: (s) => (
              <MoveButtons
                action={moveSlideAction}
                id={s.id}
                index={slides.indexOf(s)}
                count={slides.length}
                label={title(s)}
              />
            ),
          },
        ]}
        rowActions={(s) => (
          <ActionMenu label={`${title(s)} işlemleri`}>
            <ActionMenuLink href={`${PANEL}/${encodeURIComponent(s.id)}`}>
              Düzenle
            </ActionMenuLink>
            <ActionButton
              action={setSlideActiveAction}
              hidden={{ id: s.id, active: s.isActive ? "0" : "1" }}
              variant="menu"
              ariaLabel={`${s.isActive ? "Yayından kaldır" : "Yayına al"}: ${title(s)}`}
            >
              {s.isActive ? "Yayından kaldır" : "Yayına al"}
            </ActionButton>
            <ActionMenuSeparator />
            <ConfirmButton
              action={deleteSlideAction}
              hidden={{ id: s.id }}
              label="Sil"
              ariaLabel={`Sil: ${title(s)}`}
              variant="menuDanger"
              title={`"${title(s)}" silinsin mi?`}
              description="Slayt mağaza sayfasının karuselinden hemen kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için “Yayından kaldır”ı kullan."
            />
          </ActionMenu>
        )}
      />
    </PageShell>
  );
}
