"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  refundOrderAction,
  saveOrderNoteAction,
  setItemStatusAction,
  transitionOrderAction,
  type NoteActionState,
  type RefundActionState,
} from "@/app/admin/siparisler/actions";
import type {
  AdminOrder,
  AdminOrderItemStatus,
  AdminSettings,
  OrderTransition,
} from "@/lib/admin/store";

import { Card, formatDateTime, formatTRY } from "./forms";

const TRANSITION_LABEL: Record<OrderTransition, string> = {
  mark_paid: "Ödendi olarak işaretle",
  start_preparing: "Hazırlamaya başla",
  mark_shipped: "Kargoya ver",
  complete: "Tamamlandı",
  cancel: "İptal et",
};

const TRANSITION_TONE: Record<OrderTransition, string> = {
  mark_paid: "bg-blue-600 hover:bg-blue-700 text-white",
  start_preparing: "bg-purple-600 hover:bg-purple-700 text-white",
  mark_shipped: "bg-indigo-600 hover:bg-indigo-700 text-white",
  complete: "bg-green-600 hover:bg-green-700 text-white",
  cancel:
    "border border-red-200 bg-white text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white",
};

const ITEM_STATUS_LABEL: Record<AdminOrderItemStatus, string> = {
  pending: "Bekliyor",
  ready: "Hazır",
  cancelled: "İptal",
};

const ITEM_STATUS_TONE: Record<AdminOrderItemStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  ready: "bg-green-50 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-500 line-through",
};

const noteInitial: NoteActionState = {};
const refundInitial: RefundActionState = {};

interface Props {
  order: AdminOrder;
  settings: AdminSettings;
  transitions: OrderTransition[];
  statusLabel: string;
  statusTone: string;
  refundedMinor: number;
  remainingRefundableMinor: number;
}

export function OrderDetail({
  order,
  settings,
  transitions,
  statusLabel,
  statusTone,
  refundedMinor,
  remainingRefundableMinor,
}: Props) {
  const [refundOpen, setRefundOpen] = useState(false);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${statusTone}`}
                >
                  {statusLabel}
                </span>
                {order.refunds.length > 0 && (
                  <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-rose-700">
                    {formatTRY(refundedMinor)} iade
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              >
                🖨 Fiş yazdır
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {transitions.length === 0 ? (
                <span className="text-xs text-neutral-500">
                  Bu sipariş için aktif bir işlem yok.
                </span>
              ) : (
                transitions.map((t) => (
                  <form key={t} action={transitionOrderAction}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="transition" value={t} />
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (t === "cancel") {
                          if (
                            !confirm(
                              "Bu siparişi iptal etmek istediğine emin misin? İptal sonrası iade ayrıca başlatılır.",
                            )
                          ) {
                            e.preventDefault();
                          }
                        }
                      }}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium ${TRANSITION_TONE[t]}`}
                    >
                      {TRANSITION_LABEL[t]}
                    </button>
                  </form>
                ))
              )}
              {order.status !== "cancelled" &&
                remainingRefundableMinor > 0 && (
                  <button
                    type="button"
                    onClick={() => setRefundOpen(true)}
                    className="rounded-full border border-rose-200 bg-white px-4 py-1.5 text-xs font-medium text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white"
                  >
                    İade başlat
                  </button>
                )}
            </div>
          </Card>

          <Card>
            <SectionTitle>Kalemler</SectionTitle>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-2 pr-3">Ürün</th>
                  <th className="pr-3 text-right">Adet</th>
                  <th className="pr-3 text-right">Birim</th>
                  <th className="pr-3 text-right">Toplam</th>
                  <th className="pr-3">Durum</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-3 pr-3 text-neutral-900">
                      {it.productName}
                    </td>
                    <td
                      className="pr-3 text-right text-neutral-700"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      × {it.qty}
                    </td>
                    <td
                      className="pr-3 text-right text-neutral-700"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatTRY(it.unitPriceMinor)}
                    </td>
                    <td
                      className="pr-3 text-right text-neutral-900"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatTRY(it.unitPriceMinor * it.qty)}
                    </td>
                    <td className="pr-3">
                      <ItemStatusForm
                        orderId={order.id}
                        index={i}
                        currentStatus={it.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot
                className="text-sm"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-neutral-500">
                    Ara toplam
                  </td>
                  <td className="pt-3 text-right" colSpan={2}>
                    {formatTRY(order.subtotalMinor)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="text-right text-neutral-500">
                    Kargo
                  </td>
                  <td className="text-right" colSpan={2}>
                    {order.shippingMinor > 0
                      ? formatTRY(order.shippingMinor)
                      : "—"}
                  </td>
                </tr>
                <tr className="text-base">
                  <td colSpan={3} className="pt-2 text-right text-neutral-700">
                    Toplam
                  </td>
                  <td className="pt-2 text-right font-semibold" colSpan={2}>
                    {formatTRY(order.totalMinor)}
                  </td>
                </tr>
                {refundedMinor > 0 && (
                  <tr className="text-rose-700">
                    <td colSpan={3} className="text-right">
                      İade edilen
                    </td>
                    <td className="text-right" colSpan={2}>
                      −{formatTRY(refundedMinor)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </Card>

          {order.refunds.length > 0 && (
            <Card>
              <SectionTitle>İade hareketleri</SectionTitle>
              <ul className="divide-y divide-neutral-100">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <div>
                      <div className="text-neutral-900">{r.reason}</div>
                      <div
                        className="text-[10px] uppercase tracking-[0.18em] text-neutral-400"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatDateTime(r.createdAt)}
                      </div>
                    </div>
                    <div
                      className="text-rose-700"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      −{formatTRY(r.amountMinor)}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionTitle>İçsel not</SectionTitle>
            <NoteForm orderId={order.id} initial={order.internalNote} />
          </Card>
        </div>

        <aside className="grid gap-4">
          <Card>
            <SectionTitle>Müşteri</SectionTitle>
            <div className="grid gap-2 text-sm">
              <KV k="Ad">{order.customerName}</KV>
              <KV k="E-posta">
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-neutral-900 hover:underline"
                >
                  {order.customerEmail}
                </a>
              </KV>
              <KV k="Telefon">
                {order.customerPhone ? (
                  <a
                    href={`tel:${order.customerPhone.replace(/\s/g, "")}`}
                    className="text-neutral-900 hover:underline"
                  >
                    {order.customerPhone}
                  </a>
                ) : (
                  <span className="text-neutral-400">Toplanmadı</span>
                )}
              </KV>
            </div>
          </Card>

          <Card>
            <SectionTitle>Teslimat adresi</SectionTitle>
            {order.shippingAddress ? (
              <address
                className="whitespace-pre-line text-sm not-italic text-neutral-700"
              >
                {order.shippingAddress}
              </address>
            ) : (
              <p className="text-sm text-neutral-400">
                Teslimat adresi toplanmamış. (Müşteri checkout'unda alınacak.)
              </p>
            )}
          </Card>
        </aside>
      </div>

      {refundOpen && (
        <RefundModal
          orderId={order.id}
          remainingMinor={remainingRefundableMinor}
          onClose={() => setRefundOpen(false)}
        />
      )}

      {/* Print-only receipt — hidden in normal flow, revealed by @media print */}
      <PrintableReceipt
        order={order}
        settings={settings}
        refundedMinor={refundedMinor}
      />
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 text-[10px] uppercase tracking-[0.22em] text-neutral-500"
      style={{ fontFamily: "var(--mono), monospace" }}
    >
      {children}
    </h2>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <span
        className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {k}
      </span>
      <span className="text-neutral-800">{children}</span>
    </div>
  );
}

function ItemStatusForm({
  orderId,
  index,
  currentStatus,
}: {
  orderId: string;
  index: number;
  currentStatus: AdminOrderItemStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={setItemStatusAction}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="index" value={String(index)} />
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${ITEM_STATUS_TONE[currentStatus]}`}
      >
        {ITEM_STATUS_LABEL[currentStatus]}
      </span>
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs focus:border-neutral-900 focus:bg-white focus:outline-none"
        aria-label="Kalem durumu"
      >
        <option value="pending">Bekliyor</option>
        <option value="ready">Hazır</option>
        <option value="cancelled">İptal</option>
      </select>
    </form>
  );
}

function NoteForm({ orderId, initial }: { orderId: string; initial: string }) {
  const [state, formAction, pending] = useActionState(
    saveOrderNoteAction,
    noteInitial,
  );
  const [note, setNote] = useState(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (state.savedAt) setDirty(false);
  }, [state.savedAt]);

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={orderId} />
      <textarea
        name="note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setDirty(true);
        }}
        rows={4}
        placeholder="Ekip için not — hediye paketi, ek talep, alerji, vb. Müşteri görmez."
        className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-500">
          {state.error ? (
            <span className="text-red-600">{state.error}</span>
          ) : dirty ? (
            "Kaydedilmemiş değişiklik var."
          ) : state.savedAt ? (
            `Kaydedildi · ${new Date(state.savedAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          ) : initial ? (
            `${initial.length} karakter`
          ) : (
            "Henüz not yok."
          )}
        </span>
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          {pending ? "Kaydediliyor…" : "Notu kaydet"}
        </button>
      </div>
    </form>
  );
}

function RefundModal({
  orderId,
  remainingMinor,
  onClose,
}: {
  orderId: string;
  remainingMinor: number;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    refundOrderAction,
    refundInitial,
  );
  const defaultAmount = useMemo(
    () => (remainingMinor / 100).toFixed(2),
    [remainingMinor],
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  // Close on Escape; restore scroll on unmount.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (
      !confirm(
        "Bu iade tutarını kaydetmek istediğine emin misin? Sanal POS entegre edildiğinde bu işlem otomatik POS iadesini de tetikleyecek.",
      )
    ) {
      e.preventDefault();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 backdrop-blur-sm p-4 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3
          className="text-xl"
          style={{
            fontFamily: "var(--serif), 'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 500,
          }}
        >
          İade başlat
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Kalan iade edilebilir tutar:{" "}
          <span style={{ fontFamily: "var(--mono), monospace" }}>
            {formatTRY(remainingMinor)}
          </span>
        </p>

        <form action={formAction} onSubmit={onSubmit} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={orderId} />
          <label className="grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              İade tutarı (₺)
            </span>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              defaultValue={defaultAmount}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white"
              required
            />
          </label>
          <label className="grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Neden
            </span>
            <textarea
              name="reason"
              rows={3}
              placeholder="Hasarlı geldi · Yanlış ürün · Müşteri talebi…"
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white"
              required
              minLength={3}
            />
          </label>
          {state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {pending ? "Kaydediliyor…" : "İadeyi onayla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PrintableReceipt({
  order,
  settings,
  refundedMinor,
}: {
  order: AdminOrder;
  settings: AdminSettings;
  refundedMinor: number;
}) {
  return (
    <section
      data-print-receipt
      className="hidden print:block print:absolute print:inset-0 print:p-10 print:bg-white print:text-black"
    >
      <header className="mb-6 border-b border-neutral-300 pb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-medium italic">{settings.name}</div>
            <div className="text-xs text-neutral-600">{settings.tagline}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">
              Sipariş Fişi
            </div>
            <div className="text-lg font-mono">#{order.orderNo}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-neutral-600">
          {settings.address} · {settings.phone}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">
            Müşteri
          </div>
          <div className="mt-1 font-medium">{order.customerName}</div>
          <div className="text-neutral-700">{order.customerEmail}</div>
          {order.customerPhone && (
            <div className="text-neutral-700">{order.customerPhone}</div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">
            Teslimat
          </div>
          <address className="mt-1 whitespace-pre-line not-italic text-neutral-700">
            {order.shippingAddress || "—"}
          </address>
        </div>
      </div>

      <div className="mt-6 text-xs text-neutral-500">
        Sipariş tarihi: {formatDateTime(order.createdAt)}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-[0.18em] text-neutral-600">
            <th className="py-2">Ürün</th>
            <th className="text-right">Adet</th>
            <th className="text-right">Birim</th>
            <th className="text-right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-2">{it.productName}</td>
              <td className="text-right font-mono">× {it.qty}</td>
              <td className="text-right font-mono">
                {formatTRY(it.unitPriceMinor)}
              </td>
              <td className="text-right font-mono">
                {formatTRY(it.unitPriceMinor * it.qty)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="font-mono text-sm">
          <tr>
            <td colSpan={3} className="pt-3 text-right text-neutral-600">
              Ara toplam
            </td>
            <td className="pt-3 text-right">{formatTRY(order.subtotalMinor)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="text-right text-neutral-600">
              Kargo
            </td>
            <td className="text-right">
              {order.shippingMinor > 0 ? formatTRY(order.shippingMinor) : "—"}
            </td>
          </tr>
          <tr className="border-t border-neutral-400 text-base">
            <td colSpan={3} className="pt-2 text-right font-semibold">
              Toplam
            </td>
            <td className="pt-2 text-right font-semibold">
              {formatTRY(order.totalMinor)}
            </td>
          </tr>
          {refundedMinor > 0 && (
            <tr>
              <td colSpan={3} className="text-right text-neutral-600">
                İade edilen
              </td>
              <td className="text-right">−{formatTRY(refundedMinor)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <footer className="mt-10 border-t border-neutral-300 pt-4 text-center text-xs text-neutral-500">
        Teşekkür ederiz — buon appetito! · {settings.name}
      </footer>
    </section>
  );
}
