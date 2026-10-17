"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
import { MONO_STYLE } from "./ui/styles";

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
   * Poll for new arrivals: only on the plain, unfiltered first page. A new
   * order is never on page 3 or behind a filter, and "Listeyi yenile"
   * there would not show it.
   */
  live: boolean;
  sort: SortState;
  searchParams: Record<string, string | string[] | undefined>;
  pathname: string;
  /** Shown when there are no rows. */
  emptyTitle: string;
}

/**
 * How often the page asks whether anything arrived.
 *
 * Half a minute is the whole point of the feature - a gel-al member walks
 * from the app to the counter in about that - and the question is a single
 * `head: true` count, not a re-read of the list.
 */
const POLL_MS = 30_000;

/** Remembered per browser; a shared till screen and a back-office laptop want different answers. */
const SOUND_KEY = "laffogato.admin.orders.sound";

/**
 * The sound preference, read as an external store rather than mirrored into
 * React state.
 *
 * `localStorage` cannot be read while rendering on the server, so a
 * `useState` seeded from it either mismatches on hydration or has to be
 * corrected inside an effect - the cascading-render pattern React now warns
 * about. `useSyncExternalStore` is the sanctioned shape for exactly this: the
 * server snapshot is "off", the client reads the real value, and a change in
 * another tab arrives through the same `storage` event.
 */
const soundListeners = new Set<() => void>();

function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    // Private window, blocked storage: silence is the safe default.
    return false;
  }
}

function subscribeSound(onChange: () => void): () => void {
  soundListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    soundListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeSoundPref(next: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
  } catch {
    /* Not remembered next time; the toggle still works this session. */
  }
  for (const listener of soundListeners) listener();
}

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

function OrderNo({ order, isNew }: { order: AdminOrder; isNew: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" style={MONO_STYLE}>
      #{order.orderNo}
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

  const sound = useSyncExternalStore(
    subscribeSound,
    readSoundPref,
    () => false,
  );

  // Orders numbered above this get the "yeni" mark after a refresh; null
  // until the operator has actually refreshed once.
  const [markAfter, setMarkAfter] = useState<number | null>(null);
  const lastCount = useRef(0);

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
    if (!live) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (!cancelled && document.visibilityState === "visible") {
        try {
          const n = await newOrderCountAction(latestOrderNo);
          if (!cancelled && typeof n === "number") {
            setSignal({ since: latestOrderNo, count: n });
            // Only on the way up: a barista who left the tab open should hear
            // an arrival, not the same three orders every half minute.
            if (n > lastCount.current && readSoundPref()) beep(true);
            lastCount.current = n;
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

  // Seven columns at most, so the "⋯" column stays in view from lg up (the
  // sidebar takes 16rem there): the date sits under the number until xl,
  // the lines under the customer, payment and status share one column.
  const columns: DataTableColumn<OrderListRow>[] = [
    {
      key: "no",
      header: "No",
      sortable: true,
      firstDir: "desc",
      className: "whitespace-nowrap",
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
      cell: (r) => (
        <span className="flex max-w-[16rem] min-w-0 flex-col">
          <span className="truncate">{r.order.customerName}</span>
          <span className="truncate text-xs text-[var(--admin-text-soft)]">
            {r.order.customerEmail}
          </span>
          <span className="truncate text-xs text-[var(--admin-text-soft)]">
            {itemsSummary(r.order)}
          </span>
        </span>
      ),
    },
    {
      key: "kanal",
      header: "Kanal",
      hideBelow: "xl",
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
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
      className: "whitespace-nowrap",
      cell: (r) => <Amount order={r.order} />,
    },
    {
      key: "durum",
      header: "Durum",
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
          className="sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-warning)]/40 bg-[var(--admin-warning-soft)] px-4 py-2.5 text-sm text-[var(--admin-text)] shadow-sm"
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
            className={`rounded-full border px-3 py-1 text-[11px] tracking-[0.12em] uppercase ${
              sound
                ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-[var(--admin-border)] text-[var(--admin-text-soft)]"
            }`}
            style={MONO_STYLE}
          >
            Ses {sound ? "açık" : "kapalı"}
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
              <Link
                href={`/admin/siparisler/${r.order.id}`}
                className="font-medium text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
              >
                <OrderNo order={r.order} isNew={isNew(r.order)} />
              </Link>
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
        empty={<EmptyState title={emptyTitle} />}
        sort={sort}
        searchParams={searchParams}
        pathname={pathname}
      />

      <BulkActionBar
        selection={selection}
        pending={false}
        message={<span>Seçili siparişlere uygula:</span>}
      >
        <BulkOrderButtons
          ids={selection.ids}
          onSuccess={(result) => setState({ ok: result })}
        />
      </BulkActionBar>
    </>
  );
}
