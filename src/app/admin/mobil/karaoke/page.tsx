import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { KaraokeWeekCalendar } from "@/components/admin/karaoke-calendar";
import { KaraokeTable } from "@/components/admin/karaoke-panel";
import {
  BUTTON,
  EmptyListActionLink,
  EmptyState,
  FilterBar,
  PageShell,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { SegmentedLinks } from "@/components/admin/ui/segmented";
import { requireRole } from "@/lib/admin/auth";
import {
  addDays,
  karaokeCalendarHref,
  karaokeListHref,
  karaokeListParams,
  KARAOKE_CALENDAR_VIEW,
  KARAOKE_VIEW_PARAM,
  KARAOKE_WEEK_PARAM,
  parseWeekParam,
  weekStart,
} from "@/lib/admin/karaoke-calendar-core";
import {
  listReleasedHolds,
  type KaraokeReleasedHolds,
} from "@/lib/admin/karaoke-audit";
import {
  defaultKaraokeSort,
  KARAOKE_FILTER_FIELDS,
  KARAOKE_PAGE_SIZE,
  KARAOKE_PANEL_PATH,
  KARAOKE_SORT_KEYS,
  KARAOKE_TAB_PARAM,
  KARAOKE_TABS,
  karaokeAttentionViews,
  karaokeList,
  karaokeRowViews,
  moneyOf,
  parseKaraokeTab,
} from "@/lib/admin/karaoke-panel";
import {
  firstParam,
  parseFilters,
  parsePage,
  parseSort,
  withParams,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { listSearchView } from "@/lib/admin/list-search";
import { canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import {
  KARAOKE_ADMIN_LIST_LIMIT,
  listKaraokeAttention,
  listReservationsForAdmin,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke";
import { DEFAULT_KARAOKE_RULES } from "@/lib/mobile/karaoke-core";
import { karaokeRoomCalendar } from "@/lib/mobile/karaoke-reschedule-core";
import { istanbulClock } from "@/lib/mobile/venue";

export const metadata = { title: "Admin · Karaoke" };

/** Ayarlar opens on its Karaoke tab (`?sekme=`, admin audit KAR-12). */
const KARAOKE_SETTINGS_HREF = "/admin/ayarlar?sekme=karaoke";
/** The manager has no site settings: the app's karaoke rules are hers. */
const KARAOKE_APP_SETTINGS_HREF = "/admin/mobil/ayarlar?bolum=karaoke";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The released holds a panel user let go, and those let go without the
 * POS's answer, so the list keeps both under İptal / İade. A failed read
 * hides them with the lapsed ones (the old behaviour) rather than taking
 * the page down.
 */
async function releasedHolds(
  rows: readonly KaraokeReservation[],
): Promise<KaraokeReleasedHolds> {
  const released = rows
    .filter((r) => r.status === "cancelled" && moneyOf(r) === "expired")
    .map((r) => r.id);
  if (released.length === 0) {
    return { staff: new Set(), unverified: new Set() };
  }
  try {
    return await listReleasedHolds(released);
  } catch (err) {
    console.error("[admin/karaoke] iptal kayıtları okunamadı", err);
    return { staff: new Set(), unverified: new Set() };
  }
}

/**
 * Dikkat's own rows, any day (`listKaraokeAttention`). A failed read falls
 * back to the list's rows (the old behaviour) rather than taking the page
 * down.
 */
async function attentionRows(
  today: string,
): Promise<KaraokeReservation[] | null> {
  try {
    return await listKaraokeAttention(today);
  } catch (err) {
    console.error("[admin/karaoke] dikkat listesi okunamadı", err);
    return null;
  }
}

/**
 * Karaoke bookings, Filament style: tabs with counts, a filter row, a table
 * (cards on phones) and a ⋯ menu per row; the booking's page has the rest.
 *
 * With prepayment on (Ayarlar → Karaoke) a booking is an unpaid hold until
 * its payment confirms it on its own; nobody confirms an unpaid one by hand.
 * Cancelling a paid booking refunds it in full, which needs the refunds
 * permission. A hold that lapsed unpaid was never a booking and shows only
 * when the payment filter asks for it; one a person cancelled, or one let go
 * without the POS's answer, stays under İptal / İade. Amounts were fixed at
 * booking time.
 */
/**
 * The header's view switch: the list (the page as it was) or the week.
 * Both carry the list's state, so switching never resets its tab, filters,
 * sort or page.
 */
function ViewSwitch({
  calendar,
  list,
  week,
}: {
  calendar: boolean;
  /** The address the list's state is read from. */
  list: SearchParamsInput;
  /** The week the calendar opens on, when not this one. */
  week?: string;
}) {
  return (
    <SegmentedLinks
      label="Görünüm"
      options={[
        { href: karaokeListHref(list), label: "Liste", current: !calendar },
        {
          href: karaokeCalendarHref(week, list),
          label: "Takvim",
          current: calendar,
        },
      ]}
    />
  );
}

export default async function AdminKaraokePage({ searchParams }: PageProps) {
  const session = await requireRole("karaoke");
  const raw = await searchParams;
  if (firstParam(raw, KARAOKE_VIEW_PARAM) === KARAOKE_CALENDAR_VIEW) {
    return <KaraokeCalendarPage role={session.role} params={raw} />;
  }
  // `sp` is the address (every link below, the booking pages' way back
  // too), `view` adds the remembered search text (what the list shows):
  // lib/admin/list-search-core.ts.
  const { url: sp, view } = await listSearchView(KARAOKE_PANEL_PATH, raw);
  const now = new Date();
  const today = istanbulClock(now).date;
  const filters = parseFilters(view, KARAOKE_FILTER_FIELDS);
  const tab = parseKaraokeTab(view);
  const sort = parseSort(view, KARAOKE_SORT_KEYS, defaultKaraokeSort(tab));

  const [rows, settings, attention] = await Promise.all([
    listReservationsForAdmin({ from: filters.bas, to: filters.bit }),
    getSettings(),
    attentionRows(today),
  ]);
  const released = await releasedHolds(rows);
  const ctx = {
    today,
    now,
    prepay: settings.karaokePrepay,
    canRefund: canAccess("refunds", session.role),
    staffReleased: released.staff,
    unverified: released.unverified,
  };
  const views = karaokeRowViews(rows, ctx);
  const list = karaokeList(views, {
    tab,
    filters,
    sort,
    page: parsePage(view),
    today,
    attention: attention ? karaokeAttentionViews(attention, ctx) : null,
  });
  // Dikkat reads its own rows, whatever the list's limit.
  const truncated =
    rows.length >= KARAOKE_ADMIN_LIST_LIMIT && !(tab === "dikkat" && attention);
  const tabValue = KARAOKE_TABS.find((t) => t.tab === tab)?.value ?? null;
  // The way out of an empty tab: a filtered list clears its filters and
  // the typed search (the tab stays); an empty tab leads back to today.
  const emptyAction =
    Object.keys(filters).length > 0
      ? {
          href: tabValue
            ? withParams(
                { [KARAOKE_TAB_PARAM]: tabValue },
                {},
                KARAOKE_PANEL_PATH,
              )
            : KARAOKE_PANEL_PATH,
          label: "Filtreyi temizle",
          clearsSearch: true,
        }
      : tabValue
        ? { href: KARAOKE_PANEL_PATH, label: "Bugünkü rezervasyonlar" }
        : null;

  return (
    <PageShell width="list">
      <PageHeader
        title="Karaoke"
        description={
          // One line (admin audit KAR-10): a phone sees the first booking
          // without scrolling. The rules are behind "Nasıl çalışır?"; the
          // refund warning is also on the cancel control itself.
          settings.karaokePrepay
            ? "Ön ödeme açık: ödenen rezervasyon kendiliğinden onaylanır."
            : "Ön ödeme kapalı: talepler köşkte ödenir, onayla ya da iptal et."
        }
        help={
          settings.karaokePrepay ? (
            <p>
              Ön ödeme açıkken rezervasyon, ödemesi onaylanana kadar ödenmemiş
              bir tutmadır; ödenmemiş olanı elle onaylayan olmaz. Ödenmişi iptal
              etmek tutarın tamamını iade eder.
            </p>
          ) : (
            <p>
              Ön ödeme kapalıyken talepler köşkte ödenir: onayla ya da iptal et.
            </p>
          )
        }
        action={
          <ViewSwitch
            calendar={false}
            list={sp}
            // A list filtered to another week opens the calendar on it.
            week={
              filters.bas && weekStart(filters.bas) !== weekStart(today)
                ? weekStart(filters.bas)
                : undefined
            }
          />
        }
        // One link per role: the owner's is the site's Karaoke tab (price,
        // prepay), the manager's the app's karaoke rules; staff get none.
        secondary={
          canAccess("settings", session.role)
            ? { href: KARAOKE_SETTINGS_HREF, label: "Karaoke ayarları" }
            : canAccess("mobileApp", session.role)
              ? { href: KARAOKE_APP_SETTINGS_HREF, label: "Karaoke ayarları" }
              : undefined
        }
      />

      {list.counts.dikkat > 0 && tab !== "dikkat" ? (
        <p
          role="status"
          className="mb-4 rounded-lg bg-[var(--admin-warning-soft)] px-4 py-3 text-sm text-[var(--admin-warning)]"
        >
          {list.counts.dikkat} rezervasyon bir işlem bekliyor.{" "}
          <Link
            href={withParams(
              sp,
              { [KARAOKE_TAB_PARAM]: "dikkat", sayfa: null },
              KARAOKE_PANEL_PATH,
            )}
            className="font-medium underline underline-offset-4"
          >
            Dikkat sekmesine git
          </Link>
        </p>
      ) : null}

      <StatusTabs
        tabs={KARAOKE_TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: list.counts[t.tab],
        }))}
        current={tabValue}
        searchParams={sp}
        pathname={KARAOKE_PANEL_PATH}
        param={KARAOKE_TAB_PARAM}
        label="Rezervasyon sekmeleri"
      />

      <div className="mb-4">
        <FilterBar
          fields={KARAOKE_FILTER_FIELDS}
          searchParams={sp}
          pathname={KARAOKE_PANEL_PATH}
          values={filters}
          views={{ key: "karaoke", tabParam: KARAOKE_TAB_PARAM }}
        />
      </div>

      <KaraokeTable
        views={list.rows}
        sort={sort}
        searchParams={sp}
        pathname={KARAOKE_PANEL_PATH}
        room={karaokeRoomCalendar(
          settings.mobileApp?.karaoke ?? DEFAULT_KARAOKE_RULES,
          today,
        )}
        empty={
          <EmptyState
            title="Bu sekmede rezervasyon yok."
            action={
              emptyAction ? (
                <EmptyListActionLink
                  action={emptyAction}
                  className={BUTTON.ghost}
                />
              ) : undefined
            }
          />
        }
      />

      {list.total > KARAOKE_PAGE_SIZE ? (
        <Pagination
          page={list.page}
          pageSize={KARAOKE_PAGE_SIZE}
          total={list.total}
          searchParams={sp}
          pathname={KARAOKE_PANEL_PATH}
        />
      ) : null}

      <div className="mt-4 flex flex-col gap-1 text-xs text-[var(--admin-text-soft)]">
        {list.hiddenLapsed > 0 && filters.odeme !== "expired" ? (
          <p>
            Ödenmediği için süresi dolan {list.hiddenLapsed} rezervasyon
            denemesi gizli.{" "}
            <Link
              href={withParams(
                sp,
                { odeme: "expired", [KARAOKE_TAB_PARAM]: "iptal", sayfa: null },
                KARAOKE_PANEL_PATH,
              )}
              className="underline underline-offset-4 hover:text-[var(--admin-primary)]"
            >
              Göster
            </Link>
          </p>
        ) : null}
        {truncated ? (
          <p>
            En yeni {KARAOKE_ADMIN_LIST_LIMIT} kayıt okundu; daha eskileri için
            tarih aralığı seç.
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}

/**
 * The karaoke page's week (Innex's calendar and list on one screen, 22 Eki
 * 2026): `?gorunum=takvim`, any week by `?hafta=`. It reads the week's
 * bookings only, and the Dikkat set for the band above it, so a booking
 * that needs a person is not missed from the calendar either. Every link
 * carries the list's state from the address (karaokeListParams), so the
 * way back to the list finds it as it was left.
 */
async function KaraokeCalendarPage({
  role,
  params,
}: {
  role: Parameters<typeof canAccess>[1];
  params: Record<string, string | string[] | undefined>;
}) {
  const now = new Date();
  const clock = istanbulClock(now);
  const today = clock.date;
  const monday = parseWeekParam(firstParam(params, KARAOKE_WEEK_PARAM), today);
  const [rows, settings, attention] = await Promise.all([
    listReservationsForAdmin({ from: monday, to: addDays(monday, 6) }),
    getSettings(),
    attentionRows(today),
  ]);
  const ctx = {
    today,
    now,
    prepay: settings.karaokePrepay,
    canRefund: canAccess("refunds", role),
  };
  const views = karaokeRowViews(rows, ctx);
  const waiting = attention ? karaokeAttentionViews(attention, ctx).length : 0;
  const thisWeek = weekStart(today);
  const here = karaokeCalendarHref(
    monday === thisWeek ? undefined : monday,
    params,
  );
  return (
    <PageShell width="list">
      <PageHeader
        title="Karaoke"
        description="Haftanın rezervasyonları: her blok bir rezervasyon, rengi parasının durumu."
        action={<ViewSwitch calendar list={params} />}
      />
      {waiting > 0 ? (
        <p
          role="status"
          className="mb-4 rounded-lg bg-[var(--admin-warning-soft)] px-4 py-3 text-sm text-[var(--admin-warning)]"
        >
          {waiting} rezervasyon bir işlem bekliyor.{" "}
          <Link
            href={withParams(
              karaokeListParams(params),
              { [KARAOKE_TAB_PARAM]: "dikkat", sayfa: null },
              KARAOKE_PANEL_PATH,
            )}
            className="font-medium underline underline-offset-4"
          >
            Dikkat sekmesine git
          </Link>
        </p>
      ) : null}
      <KaraokeWeekCalendar
        monday={monday}
        today={today}
        clock={{
          hour: Math.floor(clock.minutes / 60),
          minute: clock.minutes % 60,
        }}
        views={views}
        prevHref={karaokeCalendarHref(addDays(monday, -7), params)}
        nextHref={karaokeCalendarHref(addDays(monday, 7), params)}
        thisWeekHref={
          monday === thisWeek ? null : karaokeCalendarHref(undefined, params)
        }
        back={here}
      />
    </PageShell>
  );
}
