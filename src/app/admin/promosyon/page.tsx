import Link from "next/link";

import {
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import {
  Badge,
  BUTTON,
  CardLink,
  DataTable,
  EmptyListActionLink,
  EmptyState,
  FilterBar,
  NUMERIC_STYLE,
  PageShell,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { parseFilters, parsePage, parseSort } from "@/lib/admin/list-params";
import { listSearchView } from "@/lib/admin/list-search";
import {
  PROMO_DEFAULT_SORT,
  PROMO_FILTER_FIELDS,
  PROMO_PAGE_SIZE,
  PROMO_SORT_KEYS,
  PROMO_STATE_LABELS,
  PROMO_STATE_TONES,
  PROMO_TAB_PARAM,
  PROMO_TABS,
  PROMOS_PATH,
  parsePromoTab,
  promoHref,
  promoList,
  promoState,
} from "@/lib/admin/promo-list";
import { listPromos, type AdminPromo } from "@/lib/admin/store";

import { PromoActiveToggle, PromoRowMenu } from "./promo-actions-ui";

export const metadata = { title: "Admin · Promosyon Kodları" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function discountLabel(p: { kind: "pct" | "fixed"; value: number }): string {
  return p.kind === "pct" ? `%${p.value}` : `−${formatTRY(p.value)}`;
}

function StateBadge({ promo, now }: { promo: AdminPromo; now: number }) {
  const state = promoState(promo, now);
  return (
    <Badge tone={PROMO_STATE_TONES[state]} dot>
      {PROMO_STATE_LABELS[state]}
    </Badge>
  );
}

function Usage({ promo }: { promo: AdminPromo }) {
  return (
    <span style={NUMERIC_STYLE}>
      {promo.usageCount}
      {promo.usageLimit > 0 ? `/${promo.usageLimit}` : ""}
    </span>
  );
}

/**
 * Promo codes, Filament style (admin audit PEO-24): tabs by where a code
 * stands at the cart (Aktif, Pasif, Süresi dolmuş, Limit doldu) with
 * counts, a search on the code, sortable columns, numbered pages and a
 * view page per code with the orders it went into. The list used to be
 * every code in one unsorted table.
 */
export default async function PromoCodesPage({ searchParams }: PageProps) {
  await requireRole("promos");
  // `sp` is the address (every link below), `view` adds the remembered
  // search text (what the list shows): lib/admin/list-search-core.ts.
  const { url: sp, view } = await listSearchView(
    PROMOS_PATH,
    (await searchParams) ?? {},
  );
  const promos = await listPromos();
  const now = new Date().getTime();
  const filters = parseFilters(view, PROMO_FILTER_FIELDS);
  const tab = parsePromoTab(view);
  const sort = parseSort(view, PROMO_SORT_KEYS, PROMO_DEFAULT_SORT);
  const list = promoList(promos, {
    tab,
    filters,
    sort,
    page: parsePage(view),
    now,
  });
  const tabValue = PROMO_TABS.find((t) => t.tab === tab)?.value ?? null;

  return (
    <PageShell width="list">
      <PageHeader
        title="Promosyonlar"
        description="Sepette uygulanan indirim kodları."
        help={
          <p>
            Yüzde veya sabit tutar, minimum sepet, kullanım limiti ve son
            geçerlilik desteklenir.
          </p>
        }
        primary={{ href: `${PROMOS_PATH}/yeni`, label: "Yeni kod" }}
      />

      {promos.length === 0 ? (
        <EmptyState
          title="Henüz promosyon kodu yok."
          description="İlk kodu ekle; müşteri onu sepette yazar."
          action={
            <Link href={`${PROMOS_PATH}/yeni`} className={BUTTON.ghost}>
              Yeni kod
            </Link>
          }
        />
      ) : (
        <>
          <StatusTabs
            tabs={PROMO_TABS.map((t) => ({
              value: t.value,
              label: t.label,
              count: list.counts[t.tab],
            }))}
            current={tabValue}
            searchParams={sp}
            pathname={PROMOS_PATH}
            param={PROMO_TAB_PARAM}
            label="Kod sekmeleri"
          />

          <FilterBar
            fields={PROMO_FILTER_FIELDS}
            searchParams={sp}
            pathname={PROMOS_PATH}
            values={filters}
            views={{ key: "promos" }}
          />

          <DataTable<AdminPromo>
            caption="Promosyon kodları"
            rows={list.rows}
            rowKey={(p) => p.id}
            rowHref={(p) => promoHref(p.id)}
            rowClassName={(p) => !p.isActive && "opacity-70"}
            sort={sort}
            searchParams={sp}
            pathname={PROMOS_PATH}
            empty={
              <EmptyState
                title="Bu görünümde kod yok."
                action={
                  Object.keys(filters).length > 0 ? (
                    // The search too: it is not in the address.
                    <EmptyListActionLink
                      action={{
                        href: tabValue
                          ? `${PROMOS_PATH}?${PROMO_TAB_PARAM}=${tabValue}`
                          : PROMOS_PATH,
                        label: "Filtreyi temizle",
                        clearsSearch: true,
                      }}
                      className={BUTTON.ghost}
                    />
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "kod",
                header: "Kod",
                sortable: true,
                // Below xl the state rides under the code: beside the
                // sidebar (1024 px) the table had no room for its own
                // Durum column, and the badge hid behind the pinned actions.
                // A long code wraps instead of pushing the row past its card.
                className: "max-w-[13rem]",
                cell: (p) => (
                  <span className="inline-flex flex-col items-start gap-1">
                    <span className="break-all" style={NUMERIC_STYLE}>
                      {p.code}
                    </span>
                    <span className="xl:hidden">
                      <StateBadge promo={p} now={now} />
                    </span>
                  </span>
                ),
              },
              {
                key: "indirim",
                header: "İndirim",
                cell: (p) => (
                  <span className="whitespace-nowrap" style={NUMERIC_STYLE}>
                    {discountLabel(p)}
                  </span>
                ),
              },
              {
                key: "min",
                header: "Min. sepet",
                align: "right",
                // On the code's page; the table beside the sidebar has no
                // room for it until 2xl.
                className: "hidden 2xl:table-cell",
                cell: (p) => (
                  <span style={NUMERIC_STYLE}>
                    {p.minSubtotalMinor > 0
                      ? formatTRY(p.minSubtotalMinor)
                      : "-"}
                  </span>
                ),
              },
              {
                key: "kullanim",
                header: "Kullanım",
                align: "right",
                sortable: true,
                firstDir: "desc",
                cell: (p) => <Usage promo={p} />,
              },
              {
                key: "gecerlilik",
                header: "Geçerlilik",
                sortable: true,
                cell: (p) => (
                  <span className="text-xs whitespace-nowrap">
                    {p.expiresAt ? formatDateTime(p.expiresAt) : "Süresiz"}
                  </span>
                ),
              },
              {
                key: "durum",
                header: "Durum",
                hideBelow: "xl",
                cell: (p) => <StateBadge promo={p} now={now} />,
              },
            ]}
            rowActions={(p) => (
              <div className="flex items-center justify-end gap-2">
                <PromoActiveToggle promo={p} />
                <PromoRowMenu promo={p} />
              </div>
            )}
            mobileCard={(p) => (
              <div className="flex flex-col gap-1.5">
                <CardLink
                  href={promoHref(p.id)}
                  className="font-medium break-all text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                  style={NUMERIC_STYLE}
                >
                  {p.code}
                </CardLink>
                <span className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-text-soft)]">
                  <StateBadge promo={p} now={now} />
                  <span style={NUMERIC_STYLE}>{discountLabel(p)}</span>
                  <span>
                    Kullanım <Usage promo={p} />
                  </span>
                </span>
                <span className="text-xs text-[var(--admin-text-soft)]">
                  {p.expiresAt
                    ? `Son geçerlilik ${formatDateTime(p.expiresAt)}`
                    : "Süresiz"}
                </span>
              </div>
            )}
          />

          {list.total > PROMO_PAGE_SIZE ? (
            <Pagination
              page={list.page}
              pageSize={PROMO_PAGE_SIZE}
              total={list.total}
              searchParams={sp}
              pathname={PROMOS_PATH}
            />
          ) : null}
        </>
      )}
    </PageShell>
  );
}
