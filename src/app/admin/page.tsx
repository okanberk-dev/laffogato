import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { PageShell } from "@/components/admin/ui";
import { KaraokeTodayCard } from "@/components/admin/karaoke-today-card";
import { KeepaliveStatusLine } from "@/components/admin/dashboard/keepalive-status";
import { LowStockWidget } from "@/components/admin/dashboard/low-stock-widget";
import { DashboardNotice } from "@/components/admin/dashboard/notice";
import { OpenOrdersWidget } from "@/components/admin/dashboard/open-orders-widget";
import {
  QuickCreate,
  quickCreateEntries,
} from "@/components/admin/dashboard/quick-create";
import {
  RecentOrders,
  type RecentOrderRow,
} from "@/components/admin/dashboard/recent-orders";
import { RevenueWidget } from "@/components/admin/dashboard/revenue-widget";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import type { AdminHue } from "@/components/admin/ui/hues";
import type { AdminIconName } from "@/components/admin/ui/icons";
import { settingsTabHref } from "@/app/admin/ayarlar/settings-core";
import { requireRole } from "@/lib/admin/auth";
import {
  dashboardDateLabel,
  dashboardGreeting,
  dashboardTiles,
  stockLinks,
} from "@/lib/admin/dashboard-core";
import { loadKaraokeTodayCard } from "@/lib/admin/karaoke-today";
import { canAccess } from "@/lib/admin/roles";
import { loadSupabaseKeepalive } from "@/lib/admin/supabase-keepalive";
import {
  keepaliveView,
  readKeepaliveFor,
} from "@/lib/admin/supabase-keepalive-core";
import {
  getDashboardStats,
  getSettings,
  listOrderMoney,
  listRecentOrders,
  revenueBuckets,
  type AdminOrder,
} from "@/lib/admin/store";
import { emailHealth, type EmailHealth } from "@/lib/email/health";
import { istanbulClock } from "@/lib/mobile/venue";

export const metadata = { title: "Admin · Genel Bakış" };
export const dynamic = "force-dynamic";

/**
 * The mail check, or null when it could not run. It reads the settings
 * (the sender) before asking Resend, and a failure there used to take the
 * whole landing page down for a banner (admin audit SHE-29).
 */
async function readMailHealth(): Promise<EmailHealth | null> {
  try {
    return await emailHealth();
  } catch (err) {
    console.error("[admin] e-posta durumu okunamadı", err);
    return null;
  }
}

/** The newest orders with whether money was taken for each. */
async function withMoney(orders: AdminOrder[]): Promise<RecentOrderRow[]> {
  const money = await listOrderMoney(orders);
  return orders.map((order) => ({
    order,
    collected: money.get(order.id)?.collected ?? Boolean(order.paidAt),
  }));
}

/** Each tile's icon, by its key (dashboard-core's dashboardTiles). */
const TILE_ICONS: Record<string, AdminIconName> = {
  open: "orders",
  attention: "attention",
  soldOut: "soldOut",
  revenue: "revenue",
};

/**
 * Each tile's soft colour (ui/hues.ts): the orders' blue, rose for what
 * asks for a person (its figure turns danger red), amber for the empty
 * shelf (its figure turns warning orange), green for the day's money. Each
 * tone's ink clears AA on its tile's ground (tests/admin-ui-kit.test.ts).
 */
const TILE_HUES: Record<string, AdminHue> = {
  open: "blue",
  attention: "rose",
  soldOut: "amber",
  revenue: "green",
};

/** Tile columns by how many tiles the role gets. */
const TILE_GRID: Record<number, string> = {
  4: "grid-cols-2 xl:grid-cols-4",
  3: "grid-cols-2 md:grid-cols-3",
};

/**
 * The panel's landing page (decision D38): tiles that lead to the lists
 * they count, by role; for owner and manager the last 14 days of revenue;
 * the open orders by status, today's karaoke and what waits for a person,
 * the shelves running low and the newest orders. Every widget is its own
 * component (components/admin/dashboard), so another screen can reuse it.
 */
export default async function AdminDashboardPage() {
  const session = await requireRole("dashboard");
  const now = new Date();
  const role = session.role;
  const showOrders = canAccess("orders", role);
  const showRevenue = canAccess("reports", role);
  const showStock = canAccess("products", role) || canAccess("stock", role);

  const settingsRead = getSettings();
  // The karaoke card needs the prepay switch; it waits for the settings and
  // nothing else, and comes back null rather than throwing.
  const karaokeRead = canAccess("karaoke", role)
    ? settingsRead.then((settings) =>
        loadKaraokeTodayCard({
          today: istanbulClock(now).date,
          now,
          prepay: settings.karaokePrepay,
          canRefund: canAccess("refunds", role),
        }),
      )
    : null;
  // The settings read is awaited for its failure only: the header no longer
  // prints the café's name.
  const [stats, recent, , mail, revenue, karaoke, keepalive] =
    await Promise.all([
      getDashboardStats(),
      // Five rows, read as five rows: this used to be every order in the
      // table, sliced here (WP1). Their payment rows too, so the payment
      // badge says what the order list says.
      showOrders ? listRecentOrders(5).then(withMoney) : [],
      settingsRead,
      readMailHealth(),
      // Revenue is read only for the roles that may see it (D1).
      showRevenue ? revenueBuckets("day", 14) : null,
      karaokeRead,
      // The daily Supabase ping's record, for the owner alone: for any
      // other role the read is never made (null), not merely not shown.
      readKeepaliveFor(role, loadSupabaseKeepalive),
    ]);
  const keepaliveAlarm = keepalive ? keepaliveView(keepalive, now) : null;

  const tiles = dashboardTiles(
    {
      openOrderCount: stats.openOrderCount,
      attentionOrderCount: stats.attentionOrderCount,
      outOfStockCount: stats.outOfStockCount,
      revenue: revenue
        ? {
            todayMinor: revenue.at(-1)?.revenueMinor ?? 0,
            periodMinor: revenue.reduce((s, b) => s + b.revenueMinor, 0),
          }
        : null,
    },
    role,
  );
  const stock = stockLinks(role);

  const quickCreate = quickCreateEntries(role);

  return (
    <PageShell width="list">
      <PageHeader
        title="Genel bakış"
        description={`${dashboardGreeting(now)}. ${dashboardDateLabel(now)}: kartlar saydıkları listeyi açar.`}
      />

      {/* `?denied=1` is answered by the shell, on every landing page
          (admin-sidebar.tsx DeniedNotice), not only here. */}

      {/*
        An unverified sending domain is not a degraded feature, it is a closed
        till: /odeme refuses an order from a member whose address is unverified,
        and the verification link is itself an e-mail. Nothing else on any
        screen would say so - the send paths swallow failures on purpose - so
        the one place it can surface is here, before anyone thinks to ask.
      */}
      {mail && !mail.ok && mail.message && (
        <DashboardNotice tone="danger">
          <strong>E-posta gönderilemiyor.</strong> {mail.message}{" "}
          {canAccess("settings", role) && (
            <Link
              href={settingsTabHref("email")}
              className="font-medium underline underline-offset-4"
            >
              Ayarlar → E-posta
            </Link>
          )}
        </DashboardNotice>
      )}

      {/*
        The daily ping that keeps the free-plan Supabase project awake, and
        only when it stopped getting through (owner only, see above): the
        project pauses after 7 quiet days and every sign-in fails. While it
        works the line stays in Ayarlar → Sistem durumu (operator, 21 Oct
        2026: the routine line does not belong here).
      */}
      {keepaliveAlarm?.tone === "warning" ? (
        <KeepaliveStatusLine view={keepaliveAlarm} />
      ) : null}

      <div
        className={`grid gap-3 sm:gap-4 ${TILE_GRID[tiles.length] ?? "grid-cols-2"}`}
      >
        {tiles.map((t) => (
          <StatCard
            key={t.key}
            label={t.label}
            value={t.value}
            hint={t.hint}
            href={t.href}
            tone={t.tone}
            money={t.money}
            icon={TILE_ICONS[t.key]}
            hue={TILE_HUES[t.key]}
          />
        ))}
      </div>

      <QuickCreate entries={quickCreate} />

      {/* Two columns from xl only: beside the sidebar at 1024 px the side
          column was 224 px and cut every product name short. Below xl the
          side widgets sit two abreast under the main ones. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {revenue ? <RevenueWidget buckets={revenue} /> : null}
          {karaokeRead ? (
            <KaraokeTodayCard
              today={karaoke?.today ?? null}
              attention={karaoke?.attention ?? null}
              now={now}
            />
          ) : null}
        </div>
        <div className="grid min-w-0 content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
          {showOrders ? (
            <OpenOrdersWidget openByStatus={stats.openByStatus} />
          ) : null}
          {showStock ? (
            <LowStockWidget
              rows={stats.lowStock}
              count={stats.lowStockCount}
              productHref={stock.product}
              allHref={stock.all}
            />
          ) : null}
        </div>
      </div>

      {showOrders ? (
        <div className="mt-6">
          <RecentOrders rows={recent} />
        </div>
      ) : null}
    </PageShell>
  );
}
