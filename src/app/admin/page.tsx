import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { PageShell } from "@/components/admin/ui";
import { KaraokeTodayCard } from "@/components/admin/karaoke-today-card";
import { KeepaliveStatusLine } from "@/components/admin/dashboard/keepalive-status";
import { KpiStrip } from "@/components/admin/dashboard/kpi-strip";
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
  dashboardRevenue,
  getDashboardStats,
  getSettings,
  listOrderMoney,
  listRecentOrders,
  type AdminOrder,
} from "@/lib/admin/store";
import { emailHealth, type EmailHealth } from "@/lib/email/health";
import { loadIysAttention, type IysAttention } from "@/lib/iys/store";
import { earsivConfigStatus } from "@/lib/invoice/config";
import { INVOICES_PATH, invoiceDashboardAlert } from "@/lib/invoice/panel-core";
import { listAttentionInvoices } from "@/lib/invoice/store";
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

/**
 * What İYS asks of a person (registration deadlines, a stale refusal check
 * while a campaign waits), for the roles that run the bulletin; null when
 * nothing does or it could not be read. Reads only.
 */
async function readIysAttention(now: Date): Promise<IysAttention | null> {
  try {
    return await loadIysAttention(now);
  } catch (err) {
    console.error(
      "[admin] İYS durumu okunamadı",
      err instanceof Error ? err.message.replace(/\S+@\S+/g, "***") : "",
    );
    return null;
  }
}

/**
 * The e-Arşiv rows that need a person, for the roles with Faturalar, while
 * the automation is on. A failed read is a line of its own, not a broken
 * landing page.
 */
async function readInvoiceAlert(
  role: Parameters<typeof canAccess>[1],
  now: Date,
) {
  if (!canAccess("invoices", role)) return null;
  const config = earsivConfigStatus(process.env);
  if (config.mode === "off") return null;
  try {
    return invoiceDashboardAlert(await listAttentionInvoices(), now, config);
  } catch (err) {
    console.error("[admin] e-Arşiv faturaları okunamadı", err);
    return { tone: "warning" as const, parts: ["fatura kayıtları okunamadı"] };
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
  revenue: "revenue",
  orders: "orders",
  open: "till",
  attention: "attention",
  soldOut: "soldOut",
};

/**
 * Each tile's soft colour (ui/hues.ts): green for the day's money, the
 * orders' blue for the day's orders and for the ones still open, rose for
 * what asks for a person (its figure turns danger red), amber for the
 * empty shelf (its figure turns warning orange). Each tone's ink clears AA
 * on its tile's ground (tests/admin-ui-kit.test.ts).
 */
const TILE_HUES: Record<string, AdminHue> = {
  revenue: "green",
  orders: "blue",
  open: "violet",
  attention: "rose",
  soldOut: "amber",
};

/**
 * The panel's landing page (decision D38; Innex, 22 Eki 2026): one strip of
 * the day's figures, each read against a reference and leading to the list
 * it counts, by role; for owner and manager the last 14 days of revenue;
 * the newest orders under it; beside them the open orders by status,
 * today's karaoke and the shelves running low. A new record starts from the
 * header's "Yeni". Every widget is its own component
 * (components/admin/dashboard), so another screen can reuse it.
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
  const [stats, recent, , mail, revenue, karaoke, keepalive, iys, invoiceAlert] =
    await Promise.all([
      getDashboardStats(),
      // Five rows, read as five rows: this used to be every order in the
      // table, sliced here (WP1). Their payment rows too, so the payment
      // badge says what the order list says.
      showOrders ? listRecentOrders(5).then(withMoney) : [],
      settingsRead,
      readMailHealth(),
      // Revenue is read only for the roles that may see it (D1).
      showRevenue ? dashboardRevenue(now) : null,
      karaokeRead,
      // The daily Supabase ping's record, for the owner alone: for any
      // other role the read is never made (null), not merely not shown.
      readKeepaliveFor(role, loadSupabaseKeepalive),
      // İYS deadlines, for the roles that run the bulletin (owner, manager).
      canAccess("newsletter", role) ? readIysAttention(now) : null,
      readInvoiceAlert(role, now),
    ]);
  const keepaliveAlarm = keepalive ? keepaliveView(keepalive, now) : null;

  const today = revenue?.buckets.at(-1);
  const tiles = dashboardTiles(
    {
      openOrderCount: stats.openOrderCount,
      openByKind: stats.openByKind,
      oldestCafeWaitingAt: stats.oldestCafeWaitingAt,
      attentionOrderCount: stats.attentionOrderCount,
      outOfStockCount: stats.outOfStockCount,
      lowStockCount: stats.lowStockCount,
      revenue: revenue
        ? {
            todayMinor: today?.revenueMinor ?? 0,
            todayOrders: today?.orderCount ?? 0,
            lastWeekMinor: revenue.lastWeek.revenueMinor,
            lastWeekOrders: revenue.lastWeek.orderCount,
          }
        : null,
      now,
    },
    role,
  );
  const stock = stockLinks(role);

  const quickCreate = quickCreateEntries(role);

  return (
    <PageShell width="list">
      <PageHeader
        title="Genel bakış"
        description={`${dashboardGreeting(now)}. ${dashboardDateLabel(now)}: her rakam saydığı listeyi açar.`}
        action={<QuickCreate entries={quickCreate} />}
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
      {/*
        e-Arşiv (docs/EARSIV.md): an invoice later than 7 days after delivery
        counts as never cut (VUK m.231/5), so the deadlines are said here,
        two days ahead and loudly after.
      */}
      {invoiceAlert ? (
        <DashboardNotice tone={invoiceAlert.tone}>
          <strong>e-Arşiv:</strong> {invoiceAlert.parts.join("; ")}.{" "}
          <Link
            href={`${INVOICES_PATH}?durum=dikkat`}
            className="font-medium underline underline-offset-4"
          >
            Faturalar
          </Link>
        </DashboardNotice>
      ) : null}

      {keepaliveAlarm?.tone === "warning" ? (
        <KeepaliveStatusLine view={keepaliveAlarm} />
      ) : null}

      {/*
        İYS (docs/IYS.md): a consent not registered within three business
        days cannot be relied on, a refusal must reach İYS within three, and
        no commercial mail leaves while the refusal check is stale. Each of
        those waits for a person on /admin/iys.
      */}
      {iys && (iys.overdue > 0 || iys.dueSoon > 0) ? (
        <DashboardNotice tone={iys.overdue > 0 ? "danger" : "warning"}>
          <strong>
            {iys.overdue > 0
              ? `İYS: ${iys.overdue} kaydın 3 iş günlük süresi geçti.`
              : `İYS: ${iys.dueSoon} kaydın süresi 1 iş günü içinde doluyor.`}
          </strong>{" "}
          {iys.overdue > 0 && iys.dueSoon > 0
            ? `${iys.dueSoon} kaydın süresi de 1 iş günü içinde doluyor. `
            : ""}
          <Link
            href="/admin/iys"
            className="font-medium underline underline-offset-4"
          >
            Bülten → İYS
          </Link>
        </DashboardNotice>
      ) : null}
      {iys?.staleWithPendingCampaign ? (
        <DashboardNotice tone="warning">
          <strong>Bekleyen kampanya gönderilemiyor:</strong> İYS&apos;deki
          retler son 3 iş günü içinde kontrol edilmedi.{" "}
          <Link
            href="/admin/iys"
            className="font-medium underline underline-offset-4"
          >
            Bülten → İYS
          </Link>
        </DashboardNotice>
      ) : null}

      <KpiStrip
        label="Bugünün özeti"
        cells={tiles.map((t) => ({
          ...t,
          icon: TILE_ICONS[t.key],
          hue: TILE_HUES[t.key],
        }))}
      />

      {/* Two columns from xl only: beside the sidebar at 1024 px the side
          column was 224 px and cut every product name short. Below xl the
          side widgets sit two abreast under the main ones. The main column
          is Innex's: the chart, then the compact table of the newest
          orders; the side one what waits for the shift. */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          {revenue ? <RevenueWidget buckets={revenue.buckets} /> : null}
          {showOrders ? <RecentOrders rows={recent} /> : null}
        </div>
        <div className="grid min-w-0 content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          {showOrders ? (
            <OpenOrdersWidget openByStatus={stats.openByStatus} />
          ) : null}
          {karaokeRead ? (
            <KaraokeTodayCard
              today={karaoke?.today ?? null}
              attention={karaoke?.attention ?? null}
              now={now}
            />
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
    </PageShell>
  );
}
