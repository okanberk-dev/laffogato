"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  bulkOrdersAction,
  newOrderCountAction,
  type BulkOrderActionState,
} from "@/app/admin/siparisler/actions";
import type { AdminOrder, AdminOrderStatus } from "@/lib/admin/store";

import { beep } from "./beep";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  useSelection,
} from "./bulk";
import { formatDateTime, formatTRY } from "./forms";
import { OrderChannelBadges } from "./order-badges";

interface Props {
  orders: AdminOrder[];
  /** Every status, for the badge label. */
  statusOptions: Array<[AdminOrderStatus, string]>;
  /**
   * The subset the bulk tool may set. Narrower than `statusOptions`: the
   * dropdown used to offer `paid` and `refunded`, which the store refuses
   * because neither writes the ledger row that moves the money.
   */
  bulkStatusOptions: Array<[AdminOrderStatus, string]>;
  statusTone: Record<AdminOrderStatus, string>;
}

const initialBulkState: BulkOrderActionState = {};

/**
 * How often the page asks whether anything arrived.
 *
 * Half a minute is the whole point of the feature — a gel-al member walks
 * from the app to the counter in about that — and the question is a single
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
 * corrected inside an effect — the cascading-render pattern React now warns
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

export function OrdersList({
  orders,
  statusOptions,
  bulkStatusOptions,
  statusTone,
}: Props) {
  const selection = useSelection();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    bulkOrdersAction,
    initialBulkState,
  );
  const lastFlash = useRef<string>("");

  // The newest order on screen. Everything the poll reports is counted
  // strictly above it, so the answer is "how many has this page not seen".
  const latestOrderNo = orders.reduce((max, o) => Math.max(max, o.orderNo), 0);

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
   * Sleeps while the tab is hidden — a till screen left open overnight should
   * not spend the night counting.
   */
  useEffect(() => {
    lastCount.current = 0;
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
  }, [latestOrderNo]);

  const refreshNow = useCallback(() => {
    setMarkAfter(latestOrderNo);
    lastCount.current = 0;
    router.refresh();
  }, [latestOrderNo, router]);

  const toggleSound = useCallback(() => {
    const next = !readSoundPref();
    writeSoundPref(next);
    // Proof it works, on the click that turned it on — and the gesture a
    // browser wants before it will let a page make a sound at all.
    if (next) beep(true);
  }, []);

  useEffect(() => {
    if (state.ok && state.ok.updated >= 0) {
      const flashKey = `${state.ok.op}:${state.ok.updated}:${Date.now()}`;
      if (flashKey !== lastFlash.current) {
        lastFlash.current = flashKey;
        selection.clear();
      }
    }
  }, [state, selection]);

  const ids = orders.map((o) => o.id);
  const idsCsv = selection.ids.join(",");
  // The skipped count is the whole point of naming it: the machine refuses an
  // id whose current status cannot reach the target, and a silent "0 sipariş
  // güncellendi" left staff re-clicking.
  const flash = state.ok
    ? [
        `${state.ok.updated} sipariş güncellendi.`,
        state.ok.skipped > 0
          ? `${state.ok.skipped} sipariş bu durumda bu işleme uygun değildi, atlandı.`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : state.error;

  return (
    <>
      {flash && (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            state.error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {flash}
        </div>
      )}

      {newCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm"
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

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-[var(--admin-border)] bg-white px-4 py-2.5">
        <SelectAllCheckbox ids={ids} selection={selection} label="Tümünü seç" />
        <span
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          {orders.length} sipariş
        </span>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          title="Yeni sipariş geldiğinde kısa bir ses çalar."
          className={`ml-auto rounded-full border px-3 py-1 text-[11px] tracking-[0.12em] uppercase ${
            sound
              ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
              : "border-[var(--admin-border)] text-neutral-500"
          }`}
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Ses {sound ? "açık" : "kapalı"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((o) => {
          const statusLabel =
            statusOptions.find(([k]) => k === o.status)?.[1] ?? o.status;
          const tone = statusTone[o.status];
          const isSelected = selection.has(o.id);
          const isNew = markAfter !== null && o.orderNo > markAfter;
          return (
            <div
              key={o.id}
              className={`rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                isSelected
                  ? "border-neutral-900"
                  : isNew
                    ? "border-amber-300 ring-2 ring-amber-200"
                    : "border-[var(--admin-border)]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <RowCheckbox
                      id={o.id}
                      selection={selection}
                      label={`Sipariş ${o.orderNo}`}
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span
                        className="text-lg font-medium"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        #{o.orderNo}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.18em] uppercase ${tone}`}
                      >
                        {statusLabel}
                      </span>
                      {isNew && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] tracking-[0.18em] text-amber-800 uppercase">
                          Yeni
                        </span>
                      )}
                      <OrderChannelBadges order={o} />
                    </div>
                    <div className="mt-1 text-sm text-neutral-700">
                      {o.customerName}{" "}
                      <span className="text-neutral-400">·</span>{" "}
                      <span className="text-neutral-500">
                        {o.customerEmail}
                      </span>
                    </div>
                    <div
                      className="mt-1 text-[10px] tracking-[0.18em] text-neutral-400 uppercase"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-xl"
                    style={{
                      fontFamily: "var(--serif), 'Playfair Display', serif",
                      fontStyle: "italic",
                      fontWeight: 500,
                    }}
                  >
                    {formatTRY(o.totalMinor)}
                  </div>
                  <div
                    className="text-[10px] tracking-[0.18em] text-neutral-400 uppercase"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {o.items.length} kalem
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-neutral-100 pt-4">
                <ul className="grid gap-1 text-sm text-neutral-700">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between">
                      <span>
                        {it.productName}
                        {it.detail ? (
                          <span className="text-neutral-500">
                            {" "}
                            · {it.detail}
                          </span>
                        ) : null}{" "}
                        <span className="text-neutral-400">× {it.qty}</span>
                      </span>
                      <span style={{ fontFamily: "var(--mono), monospace" }}>
                        {formatTRY(it.unitPriceMinor * it.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                {o.refunds.length > 0 ? (
                  <span
                    className="text-[10px] tracking-[0.22em] text-rose-600 uppercase"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {o.refunds.length} iade kaydı
                  </span>
                ) : (
                  <span
                    className="text-[10px] tracking-[0.22em] text-neutral-400 uppercase"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    Detaylı yönetim için sipariş sayfasına git
                  </span>
                )}
                <Link
                  href={`/admin/siparisler/${o.id}`}
                  className="rounded-xl bg-[var(--admin-primary)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)]"
                >
                  Sipariş detayı →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <form action={formAction}>
        <input type="hidden" name="ids" value={idsCsv} />
        <input type="hidden" name="op" value="set_status" />
        <BulkActionBar
          selection={selection}
          pending={pending}
          message={<span>Seçili siparişlerin durumunu birlikte güncelle:</span>}
        >
          <select
            name="value"
            defaultValue=""
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-[var(--admin-primary)] focus:outline-none"
          >
            <option value="" disabled>
              Yeni durum…
            </option>
            {bulkStatusOptions.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--admin-primary)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)] disabled:opacity-40"
          >
            Uygula
          </button>
        </BulkActionBar>
      </form>
    </>
  );
}
