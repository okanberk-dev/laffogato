import { PageHeader } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ConfirmButton,
  BUTTON,
  DataTable,
  EmptyState,
  PageShell,
  StatusTabs,
} from "@/components/admin/ui";
import Link from "@/components/link";
import { appPublishStatus } from "@/lib/admin/app-content-schema";
import { requireRole } from "@/lib/admin/auth";
import {
  APP_ANNOUNCEMENT_KIND_LABELS,
  listAppAnnouncements,
  type AdminAppAnnouncement,
} from "@/lib/admin/store";

import {
  DELETE_TEXT,
  OrderCell,
  parsePublishFilter,
  PublishCell,
  PublishToggle,
  PUBLISH_STATUS_PARAM,
  publishTabs,
} from "../app-content-list";
import {
  deleteAnnouncementAction,
  moveAnnouncementAction,
  setAnnouncementActiveAction,
} from "./actions";

export const metadata = { title: "Admin · Uygulama Duyuruları" };
export const dynamic = "force-dynamic";

const PANEL = "/admin/mobil/duyurular";

export default async function AdminAppAnnouncementsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("mobileApp");
  const [all, sp] = await Promise.all([
    listAppAnnouncements(),
    searchParams ?? Promise.resolve({}),
  ]);
  // One reading of the clock for the whole list, tabs and badges alike.
  const now = new Date().getTime();
  const filter = parsePublishFilter(
    (sp as Record<string, unknown>)[PUBLISH_STATUS_PARAM],
  );
  const rows = filter
    ? all.filter((a) => appPublishStatus(a, now) === filter)
    : all;

  return (
    <PageShell width="list">
      <PageHeader
        title="Duyurular"
        description="Uygulamanın ana sayfasındaki kısa duyuru kartları."
        help={
          <p>
            Duyurular kısa ömürlüdür; tarih aralığı verirsen kendiliğinden
            düşer.
          </p>
        }
        primary={{ href: `${PANEL}/yeni`, label: "Yeni duyuru" }}
      />

      {all.length > 0 ? (
        <StatusTabs
          tabs={publishTabs(all, now, filter)}
          current={filter}
          searchParams={sp}
          pathname={PANEL}
          param={PUBLISH_STATUS_PARAM}
          label="Yayın durumu"
        />
      ) : null}

      <DataTable<AdminAppAnnouncement>
        caption="Uygulama duyuruları"
        rows={rows}
        rowKey={(a) => a.id}
        rowHref={(a) => `${PANEL}/${encodeURIComponent(a.id)}`}
        empty={
          all.length === 0 ? (
            <EmptyState
              title="Henüz duyuru yok."
              action={
                <Link href={`${PANEL}/yeni`} className={BUTTON.ghost}>
                  Yeni duyuru
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="Bu durumda duyuru yok."
              action={
                <Link href={PANEL} className={BUTTON.ghost}>
                  Filtreyi temizle
                </Link>
              }
            />
          )
        }
        columns={[
          {
            key: "announcement",
            header: "Duyuru",
            cell: (a) => (
              <span className="block min-w-0 md:max-w-[18rem] xl:max-w-[28rem]">
                <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                  {APP_ANNOUNCEMENT_KIND_LABELS[a.kind]}
                </span>
                <span className="block truncate font-medium">{a.title}</span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Durum",
            cell: (a) => <PublishCell row={a} now={now} />,
          },
          {
            key: "order",
            header: "Sıra",
            align: "right",
            cell: (a) => (
              <OrderCell
                action={moveAnnouncementAction}
                row={a}
                all={all}
                filtered={filter !== null}
                label={a.title}
              />
            ),
          },
        ]}
        rowActions={(a) => (
          <ActionMenu label={`${a.title} işlemleri`}>
            <ActionMenuLink href={`${PANEL}/${encodeURIComponent(a.id)}`}>
              Düzenle
            </ActionMenuLink>
            <PublishToggle
              action={setAnnouncementActiveAction}
              id={a.id}
              isActive={a.isActive}
              label={a.title}
            />
            <ActionMenuSeparator />
            <ConfirmButton
              action={deleteAnnouncementAction}
              hidden={{ id: a.id }}
              label="Sil"
              variant="menuDanger"
              ariaLabel={`Sil: ${a.title}`}
              title={`"${a.title}" silinsin mi?`}
              description={DELETE_TEXT.announcement}
            />
          </ActionMenu>
        )}
      />
    </PageShell>
  );
}
