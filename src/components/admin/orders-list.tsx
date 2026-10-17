"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { newOrderCountAction } from "@/app/admin/siparisler/actions";
import type { ActionResult } from "@/lib/admin/action-result";
import type { SortState } from "@/lib/admin/list-params";
import type { OrderActionMap } from "@/lib/admin/order-actions";
import { orderStatusLabel } from "@/lib/admin/order-ui";
import type { AdminOrder } from "@/lib/admin/store";
import type { AdminTone } from "@/lib/admin/tone";

import { beep } from "./beep";
import { BulkActionBar, useSelection } from "./bulk";
import { formatDateTime, formatTRY } from "./forms";
import { OrderChannelBadges } from "./order-badges";
import {
  BulkOrderButtons,
  OrderActionMenu,
  type OrderMoneyView,
} from "./order-actions-ui";
import {
  Badge,
  DataTable,
  EmptyState,
  OrderStatusBadge,
  type DataTableColumn,
} from "./ui";
import {
  orderAlertsMounted,
  readSoundPref,
  shouldListBeep,
  useSoundPref,
  writeSoundPref,
} from "./sound-pref";
import { BUTTON, MONO_STYLE } from "./ui/styles";

/** One row of the order list, decided on the server. */
export interface OrderListRow {
  order: AdminOrder;
  money: OrderMoneyView;
  /** `orderActions(order, role, collected)`: what the row menu offers. */
  actions: OrderActionMap;
  /** The payment column (`orderPaymentState`). */
  payment: { label: string; tone: AdminTone };
  refundToken: string;
}

interface Props {
  rows: OrderListRow[];
  /** The signed-in role may refund (the cancel modal's refund box). */
  mayRefund: boolean;
  /**
   * Poll for new arrivals (`ParsedOrderList.live`): every order on the
   * plain first page, open orders on the plain "Açık" tab, nothing behind a
   * filter, a sort, on page 2 or another tab.
   */
  live: "all" | "open" | null;
  sort: SortState;
  searchParams: Record<string, string | string[] | undefined>;
  pathname: string;
  /** Shown when there are no rows. */
  emptyTitle: string;
  /**
   * The way out of an empty list: "Filtreleri temizle" behind a filter,
   * "+ Yeni sipariş" when there is no order at all (admin audit ORD-25).
   */
  emptyAction?: { href: string; label: string } | null;
}

/**
 * How often the page asks whether anything arrived.
 *
 * Half a minute is the whole point of the feature - a gel-al member walks
 * from the app to the counter in about that - and the question is a single
 * `head: true` count, not a re-read of the list.
 */
const POLL_MS = 30_000;

/**
 * The sound toggle's name. It stays the same whatever the state: the state
 * is `aria-pressed` (and the dot), so a screen reader hears "Yeni sipariş
 * sesi, basılı" rather than "Ses kapalı, basılı değil" (admin audit ORD-27).
 */
export const SOUND_TOGGLE_LABEL = "Yeni sipariş sesi";

function itemsSummary(order: AdminOrder): string {
  const names = order.items.map(
    (it) =>
      `${it.qty > 1 ? `${it.qty}× ` : ""}${it.productName}${it.detail ? ` (${it.detail})` : ""}`,
  );
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
}

function refundedMinorOf(order: AdminOrder): number {
  return order.refunds.reduce((s, r) => s + r.amountMinor, 0);
}

function Amount({ order }: { order: AdminOrder }) {
  const refunded = refundedMinorOf(order);
  return (
    <span className="inline-flex flex-col items-end" style={MONO_STYLE}>
      <span>{formatTRY(order.totalMinor - refunded)}</span>
      {refunded > 0 ? (
        <span className="text-[11px] text-[var(--admin-danger-ink)]">
          {formatTRY(refunded)} iade
        </span>
      ) : null}
    </span>
  );
}

/** The payment badge, left out where it would repeat the status ("Ödendi"). */
function PaymentBadge({ row }: { row: OrderListRow }) {
  if (row.payment.label === orderStatusLabel(row.order)) return null;
  return <Badge tone={row.payment.tone}>{row.payment.label}</Badge>;
}

/** The number and its marks. The marks wrap under a long number. */
function OrderNo({ order, isNew }: { order: AdminOrder; isNew: boolean }) {
  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"
      style={MONO_STYLE}
    >
      <span className="whitespace-nowrap">#{order.orderNo}</span>
      {order.attention ? (
        <Badge tone="danger" title="Dikkat: sipariş sayfasındaki banda bak">
          Dikkat
        </Badge>
      ) : null}
      {isNew ? <Badge tone="warning">Yeni</Badge> : null}
    </span>
  );
}

export function OrdersList({
  rows,
  mayRefund,
  live,
  sort,
  searchParams,
  pathname,
  emptyTitle,
  emptyAction = null,
}: Props) {
  const router = useRouter();
  // The last bulk answer that succeeded: each new one clears the selection
  // once (bulk.tsx useSelection), so the bar closes after a bulk action.
  const [state, setState] = useState<{ ok?: ActionResult }>({});
  const selection = useSelection({ resetOn: state.ok });

  // The newest order on screen. Everything the poll reports is counted
  // strictly above it, so the answer is "how many has this page not seen".
  const latestOrderNo = rows.reduce(
    (max, r) => Math.max(max, r.order.orderNo),
    0,
  );

  // The poll's answer, stamped with the orderNo it was asked about. Stamped
  // rather than reset in an effect: after a refresh the rendered list is
  // newer than the answer, and a stale count is simply not this page's count.
  const [signal, setSignal] = useState({ since: 0, count: 0 });
  const newCount = signal.since === latestOrderNo ? signal.count : 0;

  // The panel's one sound switch (sound-pref.ts), shared with the
  // new-order alert in the top bar.
  const sound = useSoundPref();

  // Orders numbered above this get the "yeni" mark after a refresh; null
  // until the operator has actually refreshed once.
  const [markAfter, setMarkAfter] = useState<number | null>(null);
  const lastCount = useRef(0);
  const lastShop = useRef(0);

  /**
   * The poll.
   *
   * It asks for a COUNT and never re-renders the list on its own: an order
   * list that reorders itself under the cursor while the operator is reading
   * row three is worse than one that is briefly stale. The refresh is the
   * operator's click.
   *
   * Sleeps while the tab is hidden - a till screen left open overnight should
   * not spend the night counting.
   */
  useEffect(() => {
    lastCount.current = 0;
    lastShop.current = 0;
    if (!live) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (!cancelled && document.visibilityState === "visible") {
        try {
          const n =
            live === "open"
              ? await newOrderCountAction(latestOrderNo, "open")
              : await newOrderCountAction(latestOrderNo);
          if (!cancelled && typeof n === "number") {
            setSignal({ since: latestOrderNo, count: n });
            // Only on the way up: a barista who left the tab open should hear
            // an arrival, not the same three orders every half minute. Beside
            // the panel-wide alert, only for a shop order: the alert rings
            // for the cafe orders itself.
            const grew = n > lastCount.current;
            lastCount.current = n;
            const decision = await shouldListBeep({
              grew,
              soundOn: readSoundPref(),
              alertsMounted: orderAlertsMounted(),
              lastShop: lastShop.current,
              countShop: () =>
                newOrderCountAction(
                  latestOrderNo,
                  live === "open" ? "open" : undefined,
                  "shop",
                ),
            });
            if (cancelled) return;
            if (decision.shop !== null) lastShop.current = decision.shop;
            if (decision.beep) beep(true);
          }
        } catch {
          // A failed poll is not an error the operator has to read; the next
          // one in half a minute either works or the page is already broken.
        }
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    }

    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [latestOrderNo, live]);

  const refreshNow = useCallback(() => {
    setMarkAfter(latestOrderNo);
    lastCount.current = 0;
    lastShop.current = 0;
    router.refresh();
  }, [latestOrderNo, router]);

  const toggleSound = useCallback(() => {
    const next = !readSoundPref();
    writeSoundPref(next);
    // Proof it works, on the click that turned it on - and the gesture a
    // browser wants before it will let a page make a sound at all.
    if (next) beep(true);
  }, []);

  const isNew = (o: AdminOrder) => markAfter !== null && o.orderNo > markAfter;

  // The table fits its card from md up (admin audit ORD-02: at 768-1366
  // px it was 50-130 px wider, the "⋯" column off screen). The No cell
  // wraps (its marks, and the date that sits under it until xl), the
  // customer column is 12rem, the cells are a little tighter below xl
  // (768 and 1024 leave the table the same 718 px), and the channel pills
  // ride under the customer until 2xl, where they get their own column,
  // capped at 14rem. The "⋯" column is pinned (ui/data-table.tsx) for
  // whatever still scrolls.
  const TIGHT = "max-xl:px-3";
  const columns: DataTableColumn<OrderListRow>[] = [
    {
      key: "no",
      header: "No",
      sortable: true,
      firstDir: "desc",
      className: TIGHT,
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <OrderNo order={r.order} isNew={isNew(r.order)} />
          <span className="text-xs font-normal text-[var(--admin-text-soft)] xl:hidden">
            {formatDateTime(r.order.createdAt)}
          </span>
        </span>
      ),
    },
    {
      key: "tarih",
      header: "Tarih",
      sortable: true,
      firstDir: "desc",
      hideBelow: "xl",
      className: "whitespace-nowrap",
      cell: (r) => (
        <span className="text-xs text-[var(--admin-text-soft)]">
          {formatDateTime(r.order.createdAt)}
        </span>
      ),
    },
    {
      key: "musteri",
      header: "Müşteri",
      sortable: true,
      className: TIGHT,
      cell: (r) => (
        <span className="flex max-w-[12rem] min-w-0 flex-col">
          <span className="truncate">{r.order.customerName}</span>
          <span className="truncate text-xs text-[var(--admin-text-soft)]">
            {r.order.customerEmail}
          </span>
          <span className="truncate text-xs text-[var(--admin-text-soft)]">
            {itemsSummary(r.order)}
          </span>
          <span className="mt-1 flex flex-wrap gap-1 2xl:hidden">
            <OrderChannelBadges order={r.order} />
          </span>
        </span>
      ),
    },
    {
      key: "kanal",
      header: "Kanal",
      // From 2xl only (DataTable's hideBelow stops at xl); the pills sit
      // under the customer below that.
      className: "hidden 2xl:table-cell",
      cell: (r) => (
        <span className="flex max-w-[14rem] flex-col items-start gap-1">
          <OrderChannelBadges order={r.order} />
        </span>
      ),
    },
    {
      key: "tutar",
      header: "Tutar",
      sortable: true,
      firstDir: "desc",
      align: "right",
      className: `whitespace-nowrap ${TIGHT}`,
      cell: (r) => <Amount order={r.order} />,
    },
    {
      key: "durum",
      header: "Durum",
      className: TIGHT,
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <OrderStatusBadge order={r.order} />
          <PaymentBadge row={r} />
        </span>
      ),
    },
  ];

  return (
    <>
      {newCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          // Below lg the panel's top bar is sticky too (about 61 px):
          // stuck at top-2, the sentence slid under it (admin audit ORD-10).
          className="sticky top-[4.25rem] z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-warning)]/40 bg-[var(--admin-warning-soft)] px-4 py-2.5 text-sm text-[var(--admin-text)] shadow-sm lg:top-2"
        >
          <span>
            <strong>{newCount} yeni sipariş</strong> geldi. Liste, sen
            yenileyene kadar yerinde kalır.
          </span>
          <button
            type="button"
            onClick={refreshNow}
            className="rounded-xl bg-[var(--admin-primary)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)]"
          >
            Listeyi yenile
          </button>
        </div>
      )}

      {live ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            title="Yeni sipariş geldiğinde kısa bir ses çalar."
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 text-sm transition-colors ${
              sound
                ? "border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
                : "border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full border ${
                sound
                  ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
                  : "border-[var(--admin-text-mute)] bg-transparent"
              }`}
            />
            {SOUND_TOGGLE_LABEL}
          </button>
        </div>
      ) : null}

      <DataTable
        caption="Siparişler"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.order.id}
        rowHref={(r) => `/admin/siparisler/${r.order.id}`}
        rowLabel={(r) => `Sipariş ${r.order.orderNo}`}
        selection={selection}
        rowClassName={(r) =>
          isNew(r.order) ? "ring-2 ring-[var(--admin-warning)]/40" : null
        }
        rowActions={(r) => (
          <OrderActionMenu
            order={r.order}
            money={r.money}
            actions={r.actions}
            refundToken={r.refundToken}
            mayRefund={mayRefund}
            openLink
          />
        )}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* The way into the order on a phone, so it looks like one:
                  the number was plain text until hovered, and touch has no
                  hover (admin audit ORD-25). */}
              <Link
                href={`/admin/siparisler/${r.order.id}`}
                className="inline-flex min-h-[44px] items-center font-medium whitespace-nowrap text-[var(--admin-text)] underline decoration-[var(--admin-border-strong)] underline-offset-4 hover:text-[var(--admin-primary)] hover:decoration-[var(--admin-primary)]"
                style={MONO_STYLE}
              >
                #{r.order.orderNo}
              </Link>
              {r.order.attention ? (
                <Badge
                  tone="danger"
                  title="Dikkat: sipariş sayfasındaki banda bak"
                >
                  Dikkat
                </Badge>
              ) : null}
              {isNew(r.order) ? <Badge tone="warning">Yeni</Badge> : null}
              <OrderStatusBadge order={r.order} />
              <PaymentBadge row={r} />
            </div>
            <div className="text-sm">{r.order.customerName}</div>
            <div className="flex flex-wrap gap-1">
              <OrderChannelBadges order={r.order} />
            </div>
            <div className="text-xs text-[var(--admin-text-soft)]">
              {itemsSummary(r.order)}
            </div>
            <div className="flex items-end justify-between gap-2 text-sm">
              <span className="text-xs text-[var(--admin-text-soft)]">
                {formatDateTime(r.order.createdAt)}
              </span>
              <Amount order={r.order} />
            </div>
          </div>
        )}
        empty={
          <EmptyState
            title={emptyTitle}
            action={
              emptyAction ? (
                <Link href={emptyAction.href} className={BUTTON.ghost}>
                  {emptyAction.label}
                </Link>
              ) : null
            }
          />
        }
        sort={sort}
        searchParams={searchParams}
        pathname={pathname}
      />

      <BulkActionBar
        selection={selection}
        pending={false}
        // A phone has room for one row: the count, "Seçimi temizle" and the
        // one menu the four buttons fold into (BulkOrderButtons).
        message={
          <span className="hidden sm:inline">Seçili siparişlere uygula:</span>
        }
      >
        <BulkOrderButtons
          ids={selection.ids}
          onSuccess={(result) => setState({ ok: result })}
        />
      </BulkActionBar>
    </>
  );
}
