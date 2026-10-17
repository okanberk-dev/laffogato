import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { KaraokeTable } from "@/components/admin/karaoke-panel";
import {
  EmptyState,
  FilterBar,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { listStaffReleasedHolds } from "@/lib/admin/karaoke-audit";
import {
  defaultKaraokeSort,
  KARAOKE_FILTER_FIELDS,
  KARAOKE_PAGE_SIZE,
  KARAOKE_PANEL_PATH,
  KARAOKE_SORT_KEYS,
  KARAOKE_TAB_PARAM,
  KARAOKE_TABS,
  karaokeList,
  karaokeRowViews,
  moneyOf,
  parseKaraokeTab,
} from "@/lib/admin/karaoke-panel";
import {
  parseFilters,
  parsePage,
  parseSort,
  withParams,
} from "@/lib/admin/list-params";
import { canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import {
  KARAOKE_ADMIN_LIST_LIMIT,
  listReservationsForAdmin,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke";
import { istanbulClock } from "@/lib/mobile/venue";

export const metadata = { title: "Admin · Karaoke" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The released holds a panel user let go, so the list keeps them under
 * İptal / İade. A failed read hides them with the lapsed ones (the old
 * behaviour) rather than taking the page down.
 */
async function staffReleased(
  rows: readonly KaraokeReservation[],
): Promise<Set<string>> {
  const released = rows
    .filter((r) => r.status === "cancelled" && moneyOf(r) === "expired")
    .map((r) => r.id);
  if (released.length === 0) return new Set();
  try {
    return await listStaffReleasedHolds(released);
  } catch (err) {
    console.error("[admin/karaoke] iptal kayıtları okunamadı", err);
    return new Set();
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
 * when the payment filter asks for it; one a person cancelled stays under
 * İptal / İade. Amounts were fixed at booking time.
 */
export default async function AdminKaraokePage({ searchParams }: PageProps) {
  const session = await requireRole("karaoke");
  const sp = await searchParams;
  const now = new Date();
  const today = istanbulClock(now).date;
  const filters = parseFilters(sp, KARAOKE_FILTER_FIELDS);
  const tab = parseKaraokeTab(sp);
  const sort = parseSort(sp, KARAOKE_SORT_KEYS, defaultKaraokeSort(tab));

  const [rows, settings] = await Promise.all([
    listReservationsForAdmin({ from: filters.bas, to: filters.bit }),
    getSettings(),
  ]);
  const views = karaokeRowViews(rows, {
    today,
    now,
    prepay: settings.karaokePrepay,
    canRefund: canAccess("refunds", session.role),
    staffReleased: await staffReleased(rows),
  });
  const list = karaokeList(views, {
    tab,
    filters,
    sort,
    page: parsePage(sp),
    today,
  });
  const truncated = rows.length >= KARAOKE_ADMIN_LIST_LIMIT;
  const tabValue = KARAOKE_TABS.find((t) => t.tab === tab)?.value ?? null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Rezervasyon"
        title="Karaoke"
        description={
          settings.karaokePrepay
            ? "Ön ödeme açık: rezervasyon ödenince kendiliğinden onaylanır, ödenmemiş rezervasyon onaylanmaz. Ödenmiş rezervasyonu iptal etmek tutarın tamamını karta iade eder."
            : "Ön ödeme kapalı: talepler köşkte ödenir, onayla ya da iptal et."
        }
        action={
          canAccess("settings", session.role) ? (
            <Link
              href="/admin/ayarlar"
              className="text-sm text-[var(--admin-text-soft)] underline underline-offset-4 hover:text-[var(--admin-primary)]"
            >
              Fiyat ve ön ödeme: Ayarlar → Karaoke
            </Link>
          ) : undefined
        }
      />

      {list.counts.dikkat > 0 && tab !== "dikkat" ? (
        <p
          role="status"
          className="mb-4 rounded-xl bg-[var(--admin-warning-soft)] px-4 py-3 text-sm text-[var(--admin-warning)]"
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
        />
      </div>

      <KaraokeTable
        views={list.rows}
        sort={sort}
        searchParams={sp}
        pathname={KARAOKE_PANEL_PATH}
        empty={
          <EmptyState
            title="Bu sekmede rezervasyon yok."
            description={
              Object.keys(filters).length > 0
                ? "Filtreleri değiştir ya da sıfırla."
                : undefined
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
    </main>
  );
}
