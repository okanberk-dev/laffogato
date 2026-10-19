import {
  CAMPAIGN_SENDS_PAGE_SIZE,
  countCampaignSends,
  listCampaignSendsPage,
  type CampaignSendRow,
  type CampaignSendTally,
} from "@/lib/admin/campaign-sends";
import {
  CAMPAIGN_SEND_FILTER_FIELDS,
  CAMPAIGN_SEND_TAB_PARAM,
  campaignSendTabs,
  parseCampaignSendTab,
} from "@/lib/admin/campaign-sends-core";
import { pageCount, parseFilters, parsePage } from "@/lib/admin/list-params";

import { CampaignSendTable } from "./campaign-send-table";
import { FilterBar, Pagination, Section, StatusTabs } from "./ui";

/**
 * "Kime gitti" - the campaign's send log, on screen.
 *
 * The detail page used to show three numbers and stop there, so "Gönderildi
 * 363 · Başarısız 37" named nobody: the operator could not answer a member
 * asking why they got the mail, or why they did not, and under 6563 the proof
 * is the sender's to produce. The rows have been written since the feature
 * shipped; this only reads them.
 *
 * Every recipient can be reached now (admin audit PEO-15): tabs per status
 * counted in SQL over the whole campaign, a search on the address or the
 * name, numbered pages. It used to stop at the first 200 rows and count
 * those, so its chips disagreed with the campaign's own "Alıcı".
 *
 * A read that throws is caught here rather than left to the error boundary -
 * a send log that cannot be read must not take down the page that can still
 * queue, resume and preview the campaign.
 */
export async function CampaignSendLog({
  campaignId,
  searchParams,
  pathname,
}: {
  campaignId: string;
  searchParams: Record<string, string | string[] | undefined>;
  /** The campaign's page: the tabs, the search and the pages link to it. */
  pathname: string;
}) {
  const filters = parseFilters(searchParams, CAMPAIGN_SEND_FILTER_FIELDS);
  const status = parseCampaignSendTab(searchParams);
  const asked = parsePage(searchParams);

  let tally: CampaignSendTally;
  let rows: CampaignSendRow[];
  let page = asked;
  try {
    [tally, rows] = await Promise.all([
      countCampaignSends(campaignId, { search: filters.q }),
      listCampaignSendsPage(campaignId, {
        status,
        search: filters.q,
        page: asked,
      }),
    ]);
    // A page past the end (a link kept from a bigger search) shows the last.
    const last = pageCount(
      status ? tally[status] : tally.total,
      CAMPAIGN_SENDS_PAGE_SIZE,
    );
    if (asked > last) {
      page = last;
      rows = await listCampaignSendsPage(campaignId, {
        status,
        search: filters.q,
        page,
      });
    }
  } catch (err) {
    console.error("[admin/kampanya] gönderim defteri okunamadı", err);
    return (
      <Section title="Gönderim defteri" className="mt-4">
        <p role="alert" className="text-sm text-[var(--admin-danger-ink)]">
          Gönderim defteri şu an okunamadı. Sayfayı yenilemeyi dene.
        </p>
      </Section>
    );
  }

  if (tally.total === 0 && !filters.q) {
    return (
      <Section title="Gönderim defteri" className="mt-4">
        <p className="text-sm text-[var(--admin-text-soft)]">
          Bu kampanya henüz kuyruğa alınmadı; alıcı kaydı oluşmadı.
        </p>
      </Section>
    );
  }

  const inTab = status ? tally[status] : tally.total;
  return (
    <section aria-labelledby="gonderim-defteri" className="mt-4">
      <h2
        id="gonderim-defteri"
        className="mb-3 text-base font-semibold text-[var(--admin-text)]"
      >
        Gönderim defteri
      </h2>
      <StatusTabs
        tabs={campaignSendTabs(tally, status)}
        current={status}
        searchParams={searchParams}
        pathname={pathname}
        param={CAMPAIGN_SEND_TAB_PARAM}
        label="Alıcı durumları"
      />
      <FilterBar
        fields={CAMPAIGN_SEND_FILTER_FIELDS}
        searchParams={searchParams}
        pathname={pathname}
        values={filters}
        label="Alıcı arama"
      />
      <CampaignSendTable rows={rows} />
      {inTab > CAMPAIGN_SENDS_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={CAMPAIGN_SENDS_PAGE_SIZE}
          total={inTab}
          searchParams={searchParams}
          pathname={pathname}
          label="Gönderim defteri sayfaları"
        />
      ) : null}
    </section>
  );
}
