import Link from "next/link";

import { ActionButton } from "@/components/admin/action-form";
import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ActionModal,
  Badge,
  ConfirmButton,
  DataTable,
  EmptyState,
} from "@/components/admin/ui";
import { SCENES } from "@/components/laffogato/scenes";
import { requireRole } from "@/lib/admin/auth";
import { homeSlidePhoto, listHomeHeroSlides } from "@/lib/admin/home-hero";
import {
  HOME_SLIDE_ACTION_LABELS,
  isHomeHeroScene,
  isHomeSlideAction,
  liveHomeHeroSlides,
  homeSlideOffReason,
  MAX_LIVE_HOME_SLIDES,
  type HomeHeroSlide,
} from "@/lib/admin/home-hero-core";
import type { AdminTone } from "@/lib/admin/tone";

import {
  deleteHomeSlideAction,
  importDefaultHomeSlidesAction,
  moveHomeSlideAction,
  toggleHomeSlideAction,
} from "./actions";

export const metadata = { title: "Admin · Anasayfa slaytları" };
export const dynamic = "force-dynamic";

const PANEL = "/admin/anasayfa-hero";

function title(s: HomeHeroSlide): string {
  return [s.titleLine1, s.titleLine2].filter(Boolean).join(" ");
}

function target(label: string, action: string, href: string): string | null {
  if (!label) return null;
  const to = isHomeSlideAction(action)
    ? HOME_SLIDE_ACTION_LABELS[action]
    : href;
  return `${label} → ${to}`;
}

function windowText(s: HomeHeroSlide): string | null {
  if (!s.startsAt && !s.endsAt) return null;
  const from = s.startsAt ? formatDateTime(s.startsAt) : "…";
  const to = s.endsAt ? formatDateTime(s.endsAt) : "…";
  return `${from} → ${to}`;
}

export default async function AdminHomeHeroPage() {
  await requireRole("content");
  const slides = await listHomeHeroSlides();
  // One reading of the clock for the whole list: "Sitede" and the reasons
  // beside the other rows must agree on what "now" is.
  const now = new Date().getTime();
  const live = new Set(liveHomeHeroSlides(slides, now).map((s) => s.id));

  const status = (s: HomeHeroSlide): { label: string; tone: AdminTone } => {
    if (live.has(s.id)) return { label: "Sitede", tone: "success" };
    const off = homeSlideOffReason(s, now);
    if (off) return { label: off, tone: s.isActive ? "warning" : "neutral" };
    return {
      label: `Sırada (sitede en çok ${MAX_LIVE_HOME_SLIDES})`,
      tone: "info",
    };
  };

  const importButton = (
    <ActionModal
      action={importDefaultHomeSlidesAction}
      title="Varsayılan slaytlar içe aktarılsın mı?"
      description="Sitenin yerleşik dört slaytı (karaoke dahil) bu listeye eklenir ve buradan düzenlenir. Listede zaten olan bir varsayılana dokunulmaz; sildiğin bir varsayılan geri gelir."
      trigger="Varsayılanları içe aktar"
      submitLabel="İçe aktar"
      triggerClassName="w-full sm:w-auto"
    />
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Anasayfa"
        title="Anasayfa slaytları"
        description="Anasayfanın en üstündeki kayan alan: kampanya ve ürün slaytları. Kaydettiğin değişiklik siteye hemen yansır."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            {importButton}
            <Link
              href={`${PANEL}/yeni`}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
            >
              + Yeni slayt
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <p className="text-sm text-[var(--admin-text-soft)]" role="status">
          {live.size === 0 ? (
            <>
              <strong className="text-[var(--admin-text)]">
                Şu an yayında slayt yok:
              </strong>{" "}
              sitede yerleşik dört varsayılan slayt dönüyor. Onları düzenlemek
              için &quot;Varsayılanları içe aktar&quot;a bas.
            </>
          ) : (
            <>
              <strong className="text-[var(--admin-text)]">
                Sitede {live.size} slayt dönüyor.
              </strong>{" "}
              Sıradaki ilk {MAX_LIVE_HOME_SLIDES} yayındaki slayt gösterilir.
              Hiçbiri yayında olmazsa site yerleşik slaytlara döner.
            </>
          )}{" "}
          Metinde {"{kapasite}"} ve {"{kapanis}"} karaoke odasının ayarlardaki
          kapasitesi ve kapanış saatiyle dolar.
        </p>
      </Card>

      <DataTable
        caption="Anasayfa slaytları"
        rows={slides}
        rowKey={(s) => s.id}
        rowHref={(s) => `${PANEL}/${encodeURIComponent(s.id)}`}
        empty={
          <EmptyState
            title="Henüz panelden eklenmiş slayt yok."
            description="Sitede yerleşik slaytlar dönüyor. Onları buraya almak için “Varsayılanları içe aktar”, yeni bir kampanya için “+ Yeni slayt”."
          />
        }
        columns={[
          {
            key: "slide",
            header: "Slayt",
            cell: (s) => {
              const scene =
                SCENES[isHomeHeroScene(s.scene) ? s.scene : "latte"];
              const photo = homeSlidePhoto(s);
              return (
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-14 w-12 shrink-0 place-items-end overflow-hidden rounded-lg border border-[var(--admin-border)]"
                    style={{
                      background: `radial-gradient(circle at 50% 40%, ${scene.core} 0%, ${scene.edge} 75%)`,
                    }}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt=""
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    {s.kicker ? (
                      <span className="block truncate text-xs text-[var(--admin-text-mute)]">
                        {s.kicker}
                      </span>
                    ) : null}
                    <span className="block truncate font-medium">
                      {title(s) || "(başlıksız)"}
                    </span>
                  </span>
                </span>
              );
            },
          },
          {
            key: "buttons",
            header: "Düğmeler",
            hideBelow: "lg",
            cell: (s) => {
              const lines = [
                target(s.primaryLabel, s.primaryAction, s.primaryHref),
                target(s.secondaryLabel, s.secondaryAction, s.secondaryHref),
              ].filter(Boolean);
              return lines.length ? (
                <span className="grid gap-0.5 text-xs text-[var(--admin-text-soft)]">
                  {lines.map((l) => (
                    <span key={l} className="block max-w-[260px] truncate">
                      {l}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-[var(--admin-text-mute)]">
                  Düğmesiz
                </span>
              );
            },
          },
          {
            key: "status",
            header: "Durum",
            cell: (s) => {
              const st = status(s);
              const range = windowText(s);
              return (
                <span className="grid justify-items-start gap-1">
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                  {range ? (
                    <span className="text-xs text-[var(--admin-text-mute)]">
                      {range}
                    </span>
                  ) : null}
                </span>
              );
            },
          },
          {
            key: "order",
            header: "Sıra",
            align: "right",
            cell: (s) => {
              const i = slides.indexOf(s);
              // The first row has no "up" and the last no "down"; a blank of
              // the same width keeps the arrows in their columns.
              const spacer = (
                <span aria-hidden="true" className="inline-block w-[44px]" />
              );
              return (
                <span className="inline-flex items-center gap-1">
                  {i > 0 ? (
                    <ActionButton
                      action={moveHomeSlideAction}
                      hidden={{ id: s.id, direction: "up" }}
                      ariaLabel={`Öne al: ${title(s)}`}
                      title="Bir öne al"
                      className="min-w-[44px]"
                    >
                      <span aria-hidden="true">↑</span>
                    </ActionButton>
                  ) : (
                    spacer
                  )}
                  {i < slides.length - 1 ? (
                    <ActionButton
                      action={moveHomeSlideAction}
                      hidden={{ id: s.id, direction: "down" }}
                      ariaLabel={`Geriye al: ${title(s)}`}
                      title="Bir geriye al"
                      className="min-w-[44px]"
                    >
                      <span aria-hidden="true">↓</span>
                    </ActionButton>
                  ) : (
                    spacer
                  )}
                  <span className="sr-only">
                    {i + 1}. sırada, toplam {slides.length}
                  </span>
                </span>
              );
            },
          },
        ]}
        rowActions={(s) => (
          <ActionMenu label={`${title(s)} işlemleri`}>
            <ActionMenuLink href={`${PANEL}/${encodeURIComponent(s.id)}`}>
              Düzenle
            </ActionMenuLink>
            <ActionButton
              action={toggleHomeSlideAction}
              hidden={{ id: s.id, active: s.isActive ? "0" : "1" }}
              variant="menu"
            >
              {s.isActive ? "Yayından kaldır" : "Yayına al"}
            </ActionButton>
            <ActionMenuSeparator />
            <ConfirmButton
              action={deleteHomeSlideAction}
              hidden={{ id: s.id }}
              label="Sil"
              variant="menuDanger"
              title={`"${title(s)}" silinsin mi?`}
              description="Slayt anasayfadan hemen kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için “Yayından kaldır”ı kullan."
            />
          </ActionMenu>
        )}
      />
    </main>
  );
}
