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
  APP_ANNOUNCEMENT_KIND_LABELS,
  listAppAnnouncements,
  type AdminAppAnnouncement,
} from "@/lib/admin/store";

import {
  DELETE_TEXT,
  parsePublishFilter,
  PublishCell,
  PUBLISH_STATUS_PARAM,
  publishTabs,
} from "../app-content-list";
import { deleteAnnouncementAction } from "./actions";

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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Duyurular"
        description="Ana sayfadaki kısa duyuru kartları. Kısa ömürlüdür; tarih aralığı verirsen kendiliğinden düşer."
        action={
          <Link
            href={`${PANEL}/yeni`}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni duyuru
          </Link>
        }
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
              description="Yeni bir duyuru ekleyerek başla."
            />
          ) : (
            <EmptyState title="Bu durumda duyuru yok." />
          )
        }
        columns={[
          {
            key: "announcement",
            header: "Duyuru",
            cell: (a) => (
              <span className="block min-w-0">
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
            cell: (a) => a.sortOrder,
          },
        ]}
        rowActions={(a) => (
          <ActionMenu label={`${a.title} işlemleri`}>
            <ActionMenuLink href={`${PANEL}/${encodeURIComponent(a.id)}`}>
              Düzenle
            </ActionMenuLink>
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
    </main>
  );
}
