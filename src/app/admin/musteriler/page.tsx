import Link from "next/link";

import { EmailText } from "@/components/admin/ui/email-text";
import {
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  Badge,
  BUTTON,
  CardLink,
  DataTable,
  EmptyState,
  FilterBar,
  ListSearchButton,
  NUMERIC_STYLE,
  PageShell,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { cx } from "@/components/laffogato/cx";
import { requireRole } from "@/lib/admin/auth";
import { countCustomers, listCustomerPage } from "@/lib/admin/customer-list";
import {
  CUSTOMER_FILTER_FIELDS,
  CUSTOMER_LIST_PAGE_SIZE,
  CUSTOMER_LIST_PATH,
  CUSTOMER_TAB_PARAM,
  CUSTOMER_TABS,
  CUSTOMER_UNFILTERED,
  isUnfilteredQuery,
  parseCustomerListParams,
  type CustomerListRow,
  type CustomerSortKey,
} from "@/lib/admin/customer-list-core";
import { withParams } from "@/lib/admin/list-params";
import { listSearchView } from "@/lib/admin/list-search";
import { ORDER_LIST_PATH } from "@/lib/admin/order-filters";
import type { AdminTone } from "@/lib/admin/tone";
import {
  DELETION_ADMIN_PATH,
  deletionDayLabel,
  deletionDeadline,
  isDeletionOverdue,
} from "@/lib/customer/deletion-request-core";

export const metadata = { title: "Admin · Müşteriler" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** An address or a long name may break anywhere instead of overflowing. */
const WRAP = "[overflow-wrap:anywhere]";

/** The member page of a row (D14: still keyed by the address for now). */
function memberHref(c: CustomerListRow): string {
  return `${CUSTOMER_LIST_PATH}/${encodeURIComponent(c.email)}`;
}

/**
 * A row's state as badges, the exceptions only: a member who cannot sign
 * in, or whose address is not confirmed, stands out; "verified" is the
 * normal case and says nothing. Both in the warning tone: an unconfirmed
 * address cannot reach the checkout, and the lime accent it wore read as a
 * good sign (21 Oct 2026).
 */
function customerBadges(
  c: CustomerListRow,
): Array<{ label: string; tone: AdminTone }> {
  const out: Array<{ label: string; tone: AdminTone }> = [
    c.isMember
      ? { label: "Üye", tone: "primary" }
      : { label: "Misafir", tone: "neutral" },
  ];
  if (c.isMember && !c.isActive) out.push({ label: "Pasif", tone: "warning" });
  if (c.isMember && !c.emailVerified) {
    out.push({ label: "Doğrulanmamış", tone: "warning" });
  }
  return out;
}

function CustomerBadges({ row, now }: { row: CustomerListRow; now: Date }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {customerBadges(row).map((b) => (
        <Badge key={b.label} tone={b.tone}>
          {b.label}
        </Badge>
      ))}
      <DeletionBadge row={row} now={now} />
    </span>
  );
}

/**
 * An open web deletion request (/uye/hesap/sil): a short badge, and under
 * it the last day of its thirty or that they ran out. The date sits on its
 * own line: inside the pill it widened the column past a 1024 px screen.
 */
function DeletionBadge({ row, now }: { row: CustomerListRow; now: Date }) {
  if (!row.deletionRequestedAt) return null;
  const deadline = deletionDayLabel(deletionDeadline(row.deletionRequestedAt));
  return (
    <>
      <Badge tone="danger">Silme talebi</Badge>
      <span className="basis-full text-xs text-[var(--admin-danger-ink)]">
        {isDeletionOverdue(row.deletionRequestedAt, now)
          ? `Süre doldu (son gün ${deadline})`
          : `Son gün ${deadline}`}
      </span>
    </>
  );
}

/**
 * The open deletion requests across the whole list, whatever the tab or
 * filter shows: the team answers each within thirty days.
 */
function DeletionBanner({ count, oldest }: { count: number; oldest: string }) {
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-danger)]/30 bg-[var(--admin-danger-soft)] px-4 py-3 text-sm text-[var(--admin-danger-ink)]"
    >
      <span className="min-w-0">
        {count} açık hesap silme talebi var. En eskisinin son günü{" "}
        {deletionDayLabel(deletionDeadline(oldest))}.
      </span>
      <Link href={DELETION_ADMIN_PATH} className={BUTTON.danger}>
        Talepleri göster
      </Link>
    </div>
  );
}

/** When the customer last did something: an order, else signing up. */
function LastActivity({ row }: { row: CustomerListRow }) {
  if (!row.lastActivity) return <>-</>;
  return (
    <span className="text-xs whitespace-nowrap" style={MONO_STYLE}>
      {formatDateTime(row.lastActivity)}
      {!row.lastOrderAt ? (
        <span className="block text-[var(--admin-text-soft)]">
          üye oldu, sipariş yok
        </span>
      ) : null}
    </span>
  );
}

function RowMenu({ row }: { row: CustomerListRow }) {
  return (
    <ActionMenu label={`${row.name || row.email} işlemleri`}>
      <ActionMenuLink href={memberHref(row)}>Müşteri sayfası</ActionMenuLink>
      {row.lastOrderAt ? (
        // The address goes in the post's body, not in `?q=` (the
        // address bar, the history, the request log).
        <ListSearchButton
          href={ORDER_LIST_PATH}
          terms={{ q: row.email }}
          className={BUTTON.menu}
        >
          Siparişleri
        </ListSearchButton>
      ) : null}
      {row.isMember ? (
        <ActionMenuLink href={`${memberHref(row)}/duzenle`}>
          Düzenle
        </ActionMenuLink>
      ) : null}
    </ActionMenu>
  );
}

/** A phone's card: who, their state, how to reach them, what they spent. */
function MobileCard({ row, now }: { row: CustomerListRow; now: Date }) {
  return (
    <div className="min-w-0">
      <CardLink
        href={memberHref(row)}
        className="font-medium [overflow-wrap:anywhere] text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
      >
        {row.name || <EmailText value={row.email} />}
      </CardLink>
      <div className="mt-1.5">
        <CustomerBadges row={row} now={now} />
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {row.name ? (
          <>
            <dt className={EYEBROW} style={MONO_STYLE}>
              E-posta
            </dt>
            <dd className="min-w-0 [overflow-wrap:anywhere] text-[var(--admin-text)]">
              <EmailText value={row.email} />
            </dd>
          </>
        ) : null}
        {row.phone ? (
          <>
            <dt className={EYEBROW} style={MONO_STYLE}>
              Telefon
            </dt>
            <dd className="min-w-0 text-[var(--admin-text)]">{row.phone}</dd>
          </>
        ) : null}
        <dt className={EYEBROW} style={MONO_STYLE}>
          Sipariş
        </dt>
        <dd className="min-w-0 text-[var(--admin-text)]" style={NUMERIC_STYLE}>
          {row.orderCount}
        </dd>
        <dt className={EYEBROW} style={MONO_STYLE}>
          Harcama
        </dt>
        <dd className="min-w-0 text-[var(--admin-text)]" style={NUMERIC_STYLE}>
          {formatTRY(row.lifetimeValueMinor)}
        </dd>
        <dt className={EYEBROW} style={MONO_STYLE}>
          Son hareket
        </dt>
        <dd className="min-w-0 text-[var(--admin-text)]">
          <LastActivity row={row} />
        </dd>
      </dl>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className={EYEBROW} style={MONO_STYLE}>
        {label}
      </div>
      {/* Smaller on a phone: "₺5.088.337,30" filled a half-width tile. */}
      <div
        className="mt-1 text-base text-[var(--admin-text)] sm:text-xl"
        style={NUMERIC_STYLE}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * The customer list (Filament's table): member accounts and guest buyers in
 * one list, tabs with counts, a filter row, sortable columns and numbered
 * pages. Everything is in the URL (lib/admin/customer-list-core.ts), and the
 * database does the merge, search, sort and paging
 * (lib/admin/customer-list.ts): one page of rows, never the table.
 */
export default async function CustomersPage({ searchParams }: PageProps) {
  // Names, addresses and phones: the gate comes before any read.
  await requireRole("customers");
  // `sp` is the address (every link below), `view` adds the remembered
  // search text (what the list shows): lib/admin/list-search-core.ts.
  const { url: sp, view } = await listSearchView(
    CUSTOMER_LIST_PATH,
    await searchParams,
  );
  const parsed = parseCustomerListParams(view);
  const kind = parsed.tab ?? "all";
  const unfiltered = isUnfilteredQuery(parsed.query);
  const [rows, counts, wholeList] = await Promise.all([
    listCustomerPage({
      query: parsed.query,
      kind,
      sort: {
        key: parsed.sort.key as CustomerSortKey,
        dir: parsed.sort.dir,
      },
      page: parsed.page,
      pageSize: CUSTOMER_LIST_PAGE_SIZE,
    }),
    countCustomers(parsed.query),
    // The deletion banner counts every open request, not the filtered few:
    // a second roll-up only when a filter narrows the list.
    unfiltered ? null : countCustomers(CUSTOMER_UNFILTERED),
  ]);
  const openRequests = (wholeList ?? counts).deletion;
  const deletionTab = kind === "deletion";
  const now = new Date();
  // Tiles, tab badge and pager all count the list as it stands: this tab
  // under these filters.
  const totals = counts[kind];
  const tabs = CUSTOMER_TABS.map((t) => ({
    ...t,
    count: counts[t.value ?? "all"].customers,
  }));

  const empty =
    totals.customers > 0 ? (
      <EmptyState
        title="Bu sayfada müşteri yok."
        action={
          <Link
            href={withParams(sp, { sayfa: null }, CUSTOMER_LIST_PATH)}
            className={BUTTON.ghost}
          >
            İlk sayfaya dön
          </Link>
        }
      />
    ) : parsed.narrowed ? (
      <EmptyState
        title="Bu süzgece uyan müşteri yok."
        action={
          // The search too: it is not in the address a link could drop.
          <ListSearchButton
            href={CUSTOMER_LIST_PATH}
            intent="reset"
            className={BUTTON.ghost}
          >
            Filtreyi temizle
          </ListSearchButton>
        }
      />
    ) : (
      <EmptyState title="Henüz üye hesabı ya da sipariş yok." />
    );

  return (
    <PageShell width="list">
      <PageHeader
        title="Müşteriler"
        description="Üye hesapları ve misafir siparişlerinden çıkan müşteriler."
        help={
          <p>
            Sipariş sayısı ve toplam harcama Raporlar&apos;la aynı kuralla
            sayılır: ödemesi beklenen ve iptal edilen siparişler girmez.
          </p>
        }
      />

      {openRequests.customers > 0 && !deletionTab ? (
        <DeletionBanner
          count={openRequests.customers}
          oldest={openRequests.oldestDeletionAt}
        />
      ) : null}

      <StatusTabs
        tabs={tabs}
        current={parsed.tab}
        searchParams={sp}
        pathname={CUSTOMER_LIST_PATH}
        param={CUSTOMER_TAB_PARAM}
        label="Müşteri türü"
      />

      <FilterBar
        fields={CUSTOMER_FILTER_FIELDS}
        values={parsed.values}
        searchParams={sp}
        pathname={CUSTOMER_LIST_PATH}
        label="Müşteri filtreleri"
      />

      <section
        aria-label="Bu listenin özeti"
        className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <Tile label="Müşteri" value={String(totals.customers)} />
        <Tile label="Ödenen sipariş" value={String(totals.orderCount)} />
        <Tile
          label="Toplam harcama"
          value={formatTRY(totals.lifetimeValueMinor)}
        />
        <Tile
          label="İade"
          value={
            totals.refundedMinor > 0 ? formatTRY(totals.refundedMinor) : "-"
          }
        />
      </section>

      <DataTable
        caption="Müşteriler"
        rows={rows}
        rowKey={(c) => c.email.toLowerCase()}
        rowHref={memberHref}
        // The deletion tab runs oldest request first (SQL), not by a column.
        sort={deletionTab ? null : parsed.sort}
        searchParams={sp}
        pathname={CUSTOMER_LIST_PATH}
        empty={empty}
        mobileCard={(c) => <MobileCard row={c} now={now} />}
        rowActions={(c) => <RowMenu row={c} />}
        columns={[
          {
            // Who and how to reach them in one cell (the row's link): a
            // separate contact column pushed the money off a 1024 px
            // screen.
            key: "ad",
            header: "Müşteri",
            sortable: !deletionTab,
            className: "min-w-[13rem]",
            cell: (c) => (
              <span className="block">
                <span className={cx("block", !c.name && WRAP)}>
                  {c.name || c.email}
                </span>
                {c.name ? (
                  <span
                    className={cx(
                      "block text-xs font-normal text-[var(--admin-text-soft)]",
                      WRAP,
                    )}
                  >
                    {c.email}
                  </span>
                ) : null}
                {c.phone ? (
                  <span className="block text-xs font-normal text-[var(--admin-text-soft)]">
                    {c.phone}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: "durum",
            header: "Durum",
            cell: (c) => <CustomerBadges row={c} now={now} />,
          },
          {
            key: "siparis",
            header: "Sipariş",
            sortable: !deletionTab,
            firstDir: "desc",
            align: "right",
            cell: (c) => <span style={NUMERIC_STYLE}>{c.orderCount}</span>,
          },
          {
            key: "harcama",
            header: "Toplam harcama",
            sortable: !deletionTab,
            firstDir: "desc",
            align: "right",
            cell: (c) => (
              <span className="whitespace-nowrap" style={NUMERIC_STYLE}>
                {formatTRY(c.lifetimeValueMinor)}
              </span>
            ),
          },
          {
            key: "hareket",
            header: "Son hareket",
            sortable: !deletionTab,
            firstDir: "desc",
            hideBelow: "xl",
            cell: (c) => <LastActivity row={c} />,
          },
        ]}
      />

      <div className="mt-6">
        <Pagination
          page={parsed.page}
          pageSize={CUSTOMER_LIST_PAGE_SIZE}
          total={totals.customers}
          searchParams={sp}
          pathname={CUSTOMER_LIST_PATH}
          label="Müşteri sayfaları"
        />
      </div>
    </PageShell>
  );
}
