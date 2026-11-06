import Link from "next/link";

import { ActionButton } from "@/components/admin/action-form";
import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import { MoveButtons } from "@/components/admin/move-buttons";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ActionModal,
  Badge,
  BUTTON,
  ConfirmButton,
  DataTable,
  EmptyState,
  PageShell,
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
      triggerVariant="menu"
      submitLabel="İçe aktar"
    />
  );

  return (
    <PageShell width="list">
      <PageHeader
        title="Slaytlar"
        description="Anasayfanın kampanya ve ürün slaytları."
        help={
          <p>
            Kaydettiğin değişiklik siteye hemen yansır. Varsayılan slaytları içe
            aktarmak, sitenin yerleşik slaytlarını bu listeye alıp buradan
            düzenlemeni sağlar.
          </p>
        }
        primary={{ href: `${PANEL}/yeni`, label: "Yeni slayt" }}
        menu={importButton}
      />

      {/* 6 Kas 2026: the home page opens on the coffee valley and draws no
          slides. The list, its data and every action still work, so the
          slides can come back without re-entering them; this line keeps
          the operator from editing them and wondering where they went. */}
      <Card className="mb-4">
        <p className="text-sm text-[var(--admin-text)]" role="note">
          Bu slaytlar şu an anasayfada gösterilmiyor; anasayfanın girişi kahve
          vadisi.
        </p>
      </Card>

      <Card className="mb-4">
        <p className="text-sm text-[var(--admin-text-soft)]" role="status">
          {live.size === 0 ? (
            <>
              <strong className="text-[var(--admin-text)]">
                Şu an yayında slayt yok:
              </strong>{" "}
              geri açıldığında yerleşik dört varsayılan slayt döner. Onları
              düzenlemek için ⋯ menüsünden &quot;Varsayılanları içe
              aktar&quot;a bas.
            </>
          ) : (
            <>
              <strong className="text-[var(--admin-text)]">
                {live.size} slayt yayında.
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
            description="Sitede yerleşik slaytlar dönüyor. Onları düzenlemek için sağ üstteki ⋯ menüsünden Varsayılanları içe aktar."
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
                      <span className="text-xs text-[var(--admin-text-mute)] max-md:line-clamp-2 md:block md:truncate">
                        {s.kicker}
                      </span>
                    ) : null}
                    <span className="font-medium max-md:line-clamp-2 md:block md:truncate">
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
            cell: (s) => (
              <MoveButtons
                action={moveHomeSlideAction}
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
              action={toggleHomeSlideAction}
              hidden={{ id: s.id, active: s.isActive ? "0" : "1" }}
              variant="menu"
              ariaLabel={`${s.isActive ? "Yayından kaldır" : "Yayına al"}: ${title(s)}`}
            >
              {s.isActive ? "Yayından kaldır" : "Yayına al"}
            </ActionButton>
            <ActionMenuSeparator />
            <ConfirmButton
              action={deleteHomeSlideAction}
              hidden={{ id: s.id }}
              label="Sil"
              ariaLabel={`Sil: ${title(s)}`}
              variant="menuDanger"
              title={`"${title(s)}" silinsin mi?`}
              description="Slayt anasayfadan hemen kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için “Yayından kaldır”ı kullan."
            />
          </ActionMenu>
        )}
      />
    </PageShell>
  );
}
