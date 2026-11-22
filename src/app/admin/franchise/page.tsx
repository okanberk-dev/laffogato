import { PageHeader, formatDateTime } from "@/components/admin/forms";
import {
  Badge,
  CardLink,
  DataTable,
  EmptyState,
  PageShell,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { firstParam } from "@/lib/admin/list-params";
import {
  BUDGET_OPTIONS,
  FRANCHISE_RETENTION_MONTHS,
  FRANCHISE_STATUS_LABELS,
  FRANCHISE_STATUSES,
  franchiseOptionLabel,
  LOCATION_OPTIONS,
  type FranchiseStatus,
} from "@/lib/franchise/franchise-core";
import {
  listFranchiseApplications,
  type FranchiseApplication,
} from "@/lib/franchise/store";

import {
  FRANCHISE_PATH,
  FRANCHISE_STATUS_TONES,
  FranchiseRowMenu,
  franchiseHref,
} from "./franchise-actions-ui";

export const metadata = { title: "Admin · Franchise başvuruları" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TAB_PARAM = "durum";

function isStatus(v: string | undefined): v is FranchiseStatus {
  return (FRANCHISE_STATUSES as readonly string[]).includes(v ?? "");
}

function StatusBadge({ status }: { status: FranchiseStatus }) {
  return (
    <Badge tone={FRANCHISE_STATUS_TONES[status]} dot>
      {FRANCHISE_STATUS_LABELS[status]}
    </Badge>
  );
}

function place(a: FranchiseApplication): string {
  return a.district ? `${a.city} / ${a.district}` : a.city;
}

/**
 * The /franchise form's applications (22 Kas 2026): tabs by status (Yeni
 * first, where the next call is), the place, the budget band and the
 * location answer at a glance; the application's page has the rest. Owner
 * and manager (section `leads`): the rows are people's contact details.
 */
export default async function FranchisePage({ searchParams }: PageProps) {
  await requireRole("leads");
  const sp = (await searchParams) ?? {};
  const raw = firstParam(sp, TAB_PARAM);
  const tab: FranchiseStatus | null = isStatus(raw) ? raw : null;
  const all = await listFranchiseApplications();
  const counts = Object.fromEntries(
    FRANCHISE_STATUSES.map((s) => [s, all.filter((a) => a.status === s).length]),
  ) as Record<FranchiseStatus, number>;
  const rows = tab ? all.filter((a) => a.status === tab) : all;

  return (
    <PageShell width="list">
      <PageHeader
        title="Franchise başvuruları"
        description="Sitedeki franchise formundan gelen başvurular."
        help={
          <p>
            Her yeni başvuru Ayarlar › Bildirimler&apos;deki operasyon
            adresine de e-postayla gelir. Başvurular{" "}
            {FRANCHISE_RETENTION_MONTHS} ay sonra kendiliğinden silinir.
          </p>
        }
      />

      {all.length === 0 ? (
        <EmptyState title="Henüz başvuru yok." />
      ) : (
        <>
          <StatusTabs
            tabs={[
              { value: null, label: "Tümü", count: all.length },
              ...FRANCHISE_STATUSES.map((s) => ({
                value: s,
                label: FRANCHISE_STATUS_LABELS[s],
                count: counts[s],
              })),
            ]}
            current={tab}
            searchParams={sp}
            pathname={FRANCHISE_PATH}
            param={TAB_PARAM}
            label="Başvuru sekmeleri"
          />

          <DataTable<FranchiseApplication>
            caption="Franchise başvuruları"
            rows={rows}
            rowKey={(a) => a.id}
            rowHref={(a) => franchiseHref(a.id)}
            empty={<EmptyState title="Bu sekmede başvuru yok." />}
            columns={[
              {
                key: "ad",
                header: "Başvuran",
                className: "min-w-[12rem]",
                cell: (a) => (
                  <span className="block min-w-0">
                    {a.name}
                    <span className="block text-xs font-normal text-[var(--admin-text-soft)] [overflow-wrap:anywhere]">
                      {a.email}
                    </span>
                  </span>
                ),
              },
              {
                key: "yer",
                header: "İl / ilçe",
                cell: (a) => <span className="text-sm">{place(a)}</span>,
              },
              {
                key: "butce",
                header: "Yatırım",
                hideBelow: "lg",
                cell: (a) => (
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    {franchiseOptionLabel(BUDGET_OPTIONS, a.budget)}
                  </span>
                ),
              },
              {
                key: "mekan",
                header: "Yer",
                hideBelow: "xl",
                cell: (a) => (
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    {franchiseOptionLabel(LOCATION_OPTIONS, a.locationStatus)}
                  </span>
                ),
              },
              {
                key: "durum",
                header: "Durum",
                cell: (a) => <StatusBadge status={a.status} />,
              },
              {
                key: "tarih",
                header: "Başvuru",
                hideBelow: "lg",
                cell: (a) => (
                  <span className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
                    {formatDateTime(a.createdAt)}
                  </span>
                ),
              },
            ]}
            rowActions={(a) => <FranchiseRowMenu app={a} />}
            mobileCard={(a) => (
              <div className="flex flex-col gap-1.5">
                <CardLink
                  href={franchiseHref(a.id)}
                  className="font-medium text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                >
                  {a.name}
                </CardLink>
                <span className="text-xs text-[var(--admin-text-soft)]">
                  {place(a)} ·{" "}
                  {franchiseOptionLabel(BUDGET_OPTIONS, a.budget)}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={a.status} />
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    {formatDateTime(a.createdAt)}
                  </span>
                </span>
              </div>
            )}
          />
        </>
      )}
    </PageShell>
  );
}
