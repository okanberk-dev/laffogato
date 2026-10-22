import { PageHeader, formatDateTime } from "@/components/admin/forms";
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
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { parseFilters, parsePage, parseSort } from "@/lib/admin/list-params";
import { listSearchView } from "@/lib/admin/list-search";
import {
  NEWSLETTER_PATH,
  SUBSCRIBER_DEFAULT_SORT,
  SUBSCRIBER_FILTER_FIELDS,
  SUBSCRIBER_PAGE_SIZE,
  SUBSCRIBER_SORT_KEYS,
  SUBSCRIBER_STATE_LABELS,
  SUBSCRIBER_STATE_TONES,
  SUBSCRIBER_TAB_PARAM,
  SUBSCRIBER_TABS,
  parseSubscriberTab,
  sourceLabel,
  subscriberHref,
  subscriberList,
  subscriberState,
} from "@/lib/admin/newsletter-list";
import {
  listNewsletterSubscribers,
  type NewsletterSubscriber,
} from "@/lib/newsletter/store";

import { SubscriberRowMenu } from "./subscriber-actions-ui";

export const metadata = { title: "Admin · Bülten Aboneleri" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function StateBadge({ s }: { s: NewsletterSubscriber }) {
  const state = subscriberState(s);
  return (
    <Badge tone={SUBSCRIBER_STATE_TONES[state]} dot>
      {SUBSCRIBER_STATE_LABELS[state]}
    </Badge>
  );
}

/**
 * When and from where consent was given; the wording is on the view page.
 * In the table the IP goes under the date, on a card after it.
 */
function Consent({
  s,
  inline = false,
}: {
  s: NewsletterSubscriber;
  inline?: boolean;
}) {
  if (!s.consentAt) {
    return (
      <span className="text-xs text-[var(--admin-warning)]">Kayıt yok</span>
    );
  }
  const line = inline ? "" : "block";
  return (
    <span className="text-xs text-[var(--admin-text-soft)]">
      <span className={`${line} whitespace-nowrap`}>
        {formatDateTime(s.consentAt)}
      </span>
      {s.consentIp ? (
        <span className={line} style={NUMERIC_STYLE}>
          {inline ? " · " : ""}
          {s.consentIp}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Newsletter subscribers, Filament style (admin audit PEO-14): tabs (Aktif,
 * Onay bekliyor, Pasif) with counts, a search on the address or the name, a
 * source filter, numbered pages, cards on phones, and a page per subscriber
 * that shows the consent record whole: the 6563 wording used to sit only in
 * a hover tooltip, out of reach on a phone, a keyboard or a screen reader.
 */
export default async function NewsletterPage({ searchParams }: PageProps) {
  await requireRole("newsletter");
  // `sp` is the address (every link below), `view` adds the remembered
  // search text (what the list shows): lib/admin/list-search-core.ts.
  const { url: sp, view } = await listSearchView(
    NEWSLETTER_PATH,
    (await searchParams) ?? {},
  );
  const subscribers = await listNewsletterSubscribers();
  const filters = parseFilters(view, SUBSCRIBER_FILTER_FIELDS);
  const tab = parseSubscriberTab(view);
  const sort = parseSort(view, SUBSCRIBER_SORT_KEYS, SUBSCRIBER_DEFAULT_SORT);
  const list = subscriberList(subscribers, {
    tab,
    filters,
    sort,
    page: parsePage(view),
  });
  const tabValue = SUBSCRIBER_TABS.find((t) => t.tab === tab)?.value ?? null;
  const activeEmails = subscribers
    .filter((s) => s.isActive)
    .map((s) => s.email);

  return (
    <PageShell width="list">
      <PageHeader
        title="Aboneler"
        description="Site formu, kayıt ve hesap tercihlerinden gelen aboneler."
        help={
          <p>
            Bülteni yalnız Aktif aboneler alır; onay bekleyen, e-postasındaki
            bağlantıya basınca Aktif olur.
          </p>
        }
      />

      {subscribers.length === 0 ? (
        <EmptyState title="Henüz abone yok." />
      ) : (
        <>
          <StatusTabs
            tabs={SUBSCRIBER_TABS.map((t) => ({
              value: t.value,
              label: t.label,
              count: list.counts[t.tab],
            }))}
            current={tabValue}
            searchParams={sp}
            pathname={NEWSLETTER_PATH}
            param={SUBSCRIBER_TAB_PARAM}
            label="Abone sekmeleri"
          />

          <FilterBar
            fields={SUBSCRIBER_FILTER_FIELDS}
            searchParams={sp}
            pathname={NEWSLETTER_PATH}
            values={filters}
          />

          <DataTable<NewsletterSubscriber>
            caption="Bülten aboneleri"
            rows={list.rows}
            rowKey={(s) => s.id}
            rowHref={(s) => subscriberHref(s.id)}
            sort={sort}
            searchParams={sp}
            pathname={NEWSLETTER_PATH}
            empty={
              <EmptyState
                title="Bu görünümde abone yok."
                action={
                  Object.keys(filters).length > 0 ? (
                    // The search too: it is not in the address.
                    <EmptyListActionLink
                      action={{
                        href: tabValue
                          ? `${NEWSLETTER_PATH}?${SUBSCRIBER_TAB_PARAM}=${tabValue}`
                          : NEWSLETTER_PATH,
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
                key: "eposta",
                header: "E-posta",
                sortable: true,
                // Room for an ordinary address on one line; a long one
                // breaks where it must instead of widening the table.
                className: "min-w-[14rem] max-w-[22rem]",
                cell: (s) => (
                  <span className="block min-w-0 [overflow-wrap:anywhere]">
                    {s.email}
                    {s.name ? (
                      <span className="block text-xs font-normal text-[var(--admin-text-soft)]">
                        {s.name}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "kaynak",
                header: "Kaynak",
                cell: (s) => (
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    {sourceLabel(s.source)}
                  </span>
                ),
              },
              {
                key: "durum",
                header: "Durum",
                cell: (s) => <StateBadge s={s} />,
              },
              {
                key: "tarih",
                header: "Kayıt",
                sortable: true,
                firstDir: "desc",
                hideBelow: "xl",
                cell: (s) => (
                  <span className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
                    {s.createdAt ? formatDateTime(s.createdAt) : "-"}
                  </span>
                ),
              },
              {
                key: "onay",
                header: "Onay (6563)",
                cell: (s) => <Consent s={s} />,
              },
            ]}
            rowActions={(s) => <SubscriberRowMenu subscriber={s} />}
            mobileCard={(s) => (
              <div className="flex flex-col gap-1.5">
                <CardLink
                  href={subscriberHref(s.id)}
                  className="font-medium break-all text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                >
                  {s.email}
                </CardLink>
                {s.name ? (
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    {s.name}
                  </span>
                ) : null}
                <span className="flex flex-wrap items-center gap-2">
                  <StateBadge s={s} />
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    {sourceLabel(s.source)}
                  </span>
                </span>
                <span className="text-xs text-[var(--admin-text-soft)]">
                  Onay: <Consent s={s} inline />
                </span>
              </div>
            )}
          />

          {list.total > SUBSCRIBER_PAGE_SIZE ? (
            <Pagination
              page={list.page}
              pageSize={SUBSCRIBER_PAGE_SIZE}
              total={list.total}
              searchParams={sp}
              pathname={NEWSLETTER_PATH}
            />
          ) : null}

          {activeEmails.length > 0 ? (
            <details className="mt-6 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <summary
                className={`${EYEBROW} flex min-h-11 cursor-pointer items-center pointer-fine:min-h-9`}
                style={MONO_STYLE}
              >
                Aktif adresleri kopyala ({activeEmails.length})
              </summary>
              <textarea
                readOnly
                aria-label="Aktif abonelerin e-postaları"
                defaultValue={activeEmails.join(", ")}
                rows={4}
                className="mt-2 w-full rounded-lg border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3 py-2 text-xs text-[var(--admin-text)]"
                style={MONO_STYLE}
              />
            </details>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
