"use client";

// The order screens' buttons, menus and modals: the order page header, the
// list's row "⋯" menus and the bulk bar draw from here, all off the same
// `orderActions` map the server actions check again (lib/admin/order-actions.ts).
// A disabled action is drawn with its reason, never hidden.

import { unstable_rethrow } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";

import {
  bulkOrdersAction,
  cancelOrderAction,
  checkPosAction,
  clearAttentionAction,
  findPosRefundAction,
  markPaidAction,
  recordOutsideRefundAction,
  refundOrderAction,
  releaseStockAction,
  saveOrderNoteAction,
  saveOrderTrackingAction,
  setItemStatusAction,
  shipOrderAction,
  transitionOrderAction,
  type NoteActionState,
} from "@/app/admin/siparisler/actions";
import type { ActionResult } from "@/lib/admin/action-result";
import {
  MANUAL_PAYMENT_LABELS,
  MANUAL_PAYMENT_METHODS,
  ORDER_NOTE_MAX,
  REFUND_DESTINATION_HINTS,
  REFUND_DESTINATION_LABELS,
  hasStockToReturn,
  isPosOrder,
  nextStep,
  orderActionLabel,
  refundableMinor,
  type OrderActionId,
  type OrderActionMap,
  type OrderActionState,
  type RefundDestination,
} from "@/lib/admin/order-actions";
import type { AdminOrder, AdminOrderItemStatus } from "@/lib/admin/store";

import { PANEL_ACTION_FAILED, runPanelAction } from "./action-form";
import {
  Checkbox,
  Field,
  Select,
  TextInput,
  Textarea,
  formatTRY,
} from "./forms";
import {
  ActionMenu,
  ActionMenuButton,
  ActionMenuLink,
  ActionMenuSeparator,
  ActionModal,
  ConfirmButton,
  FieldError,
  useToast,
  type ButtonVariant,
  type ModalAction,
} from "./ui";
import { BUTTON } from "./ui/styles";

/** The money facts the modals need, decided on the server (`orderMoney`). */
export interface OrderMoneyView {
  collected: boolean;
  collectedMinor: number | null;
  destination: RefundDestination;
}

/** What the controls read about one order. */
export interface OrderControlsProps {
  order: AdminOrder;
  money: OrderMoneyView;
  actions: OrderActionMap;
  /**
   * The one-time refund token for this render (minted on the server). A
   * successful refund refreshes the page and with it the token; a second
   * submit of the same modal is refused by the ledger.
   */
  refundToken: string;
}

// ── One-click runs ──────────────────────────────────────────────────────

/**
 * Runs a Server Action without a modal and shows its answer as a toast:
 * for moves that need no reason or choice ("Hazırlamaya başla", "POS'tan
 * kontrol et"). `onResult` sees every answer, ok or not. A thrown action
 * becomes the panel's "Bir hata oldu…" answer (runPanelAction).
 */
function useRunAction(
  action: ModalAction,
  onResult?: (result: ActionResult) => void,
) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const run = (fields: Record<string, string | number>) => {
    const formData = new FormData();
    for (const [k, v] of Object.entries(fields)) formData.set(k, String(v));
    startTransition(async () => {
      const result = await runPanelAction(action, null, formData);
      // An action that redirected answers nothing; its flash is the toast.
      if (!result) return;
      toast.fromResult(result);
      onResult?.(result);
    });
  };
  return { pending, run };
}

function RunButton({
  action,
  fields,
  children,
  variant,
  state,
  pendingLabel = "İşleniyor…",
}: {
  action: ModalAction;
  fields: Record<string, string | number>;
  children: ReactNode;
  variant: ButtonVariant;
  state?: OrderActionState;
  pendingLabel?: string;
}) {
  const { pending, run } = useRunAction(action);
  const reasonId = useId();
  const reason = state && !state.enabled ? state.reason : undefined;
  if (variant === "menu" || variant === "menuDanger") {
    return (
      <ActionMenuButton
        tone={variant === "menuDanger" ? "danger" : "default"}
        disabledReason={reason}
        onClick={() => {
          if (!pending) run(fields);
        }}
      >
        {pending ? pendingLabel : children}
      </ActionMenuButton>
    );
  }
  if (reason) {
    return (
      <span className="inline-flex flex-col">
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={reasonId}
          className={BUTTON[variant]}
        >
          {children}
        </button>
        <span
          id={reasonId}
          className="mt-1 text-xs text-[var(--admin-text-soft)]"
        >
          {reason}
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => run(fields)}
      className={BUTTON[variant]}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function reasonOf(state: OrderActionState | undefined): string | undefined {
  return state && !state.enabled ? state.reason : undefined;
}

// ── The moves ───────────────────────────────────────────────────────────

/** Hazırlamaya başla / Hazır / Kuryeye ver / Masaya götürüldü / Tamamlandı. */
function MoveButton({
  order,
  id,
  state,
  variant,
}: {
  order: AdminOrder;
  id: "start_preparing" | "mark_shipped" | "complete";
  state: OrderActionState;
  variant: ButtonVariant;
}) {
  return (
    <RunButton
      action={transitionOrderAction}
      fields={{ id: order.id, transition: id }}
      variant={variant}
      state={state}
    >
      {orderActionLabel(id, order)}
    </RunButton>
  );
}

function CheckPosButton({
  order,
  state,
  variant,
}: {
  order: AdminOrder;
  state: OrderActionState;
  variant: ButtonVariant;
}) {
  return (
    <RunButton
      action={checkPosAction}
      fields={{ id: order.id }}
      variant={variant}
      state={state}
      pendingLabel="POS'a soruluyor…"
    >
      POS&apos;tan kontrol et
    </RunButton>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────

function stockLines(order: AdminOrder) {
  return order.items
    .map((it, index) => ({
      index,
      name: it.detail ? `${it.productName} (${it.detail})` : it.productName,
      max: Math.max(0, it.qty - (it.restockedQty ?? 0)),
      productId: it.productId ?? "",
    }))
    .filter((l) => l.productId && l.max > 0);
}

function DestinationNote({
  destination,
  amountMinor,
}: {
  destination: RefundDestination;
  amountMinor: number;
}) {
  return (
    <div className="rounded-xl bg-[var(--admin-surface-2)] px-3.5 py-2.5 text-sm">
      <div className="font-medium text-[var(--admin-text)]">
        {formatTRY(amountMinor)} · {REFUND_DESTINATION_LABELS[destination]}
      </div>
      <p className="mt-0.5 text-[var(--admin-text-soft)]">
        {REFUND_DESTINATION_HINTS[destination]}
      </p>
    </div>
  );
}

/** The optional per-line "back to stock" counts of a refund. */
function RestockLines({ order }: { order: AdminOrder }) {
  const lines = stockLines(order);
  if (lines.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm text-[var(--admin-text-soft)]">
        Stoğa geri alınacak adet (isteğe bağlı)
      </legend>
      {lines.map((l) => (
        <label
          key={l.index}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="min-w-0 truncate">{l.name}</span>
          <TextInput
            type="number"
            name={`restock_${l.index}`}
            min={0}
            max={l.max}
            step={1}
            defaultValue={0}
            aria-label={`${l.name}: stoğa geri alınacak adet, en fazla ${l.max}`}
            className="w-24 text-right"
          />
        </label>
      ))}
    </fieldset>
  );
}

/** Two radios, so "no decision" is visible as such for a parcel on the road. */
function RestockChoice({ shipped }: { shipped: boolean }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm text-[var(--admin-text-soft)]">
        {shipped
          ? "Paket yola çıkmış. Stok ne olsun?"
          : "Ürünler stoğa dönsün mü?"}
      </legend>
      <label className="flex min-h-[44px] items-center gap-3 text-sm">
        <input
          type="radio"
          name="restock"
          value="1"
          defaultChecked={!shipped}
          required
          className="h-5 w-5 accent-[var(--admin-primary)]"
        />
        {shipped ? "Stoğa geri al (paket geri geldi)" : "Stoğa geri al"}
      </label>
      <label className="flex min-h-[44px] items-center gap-3 text-sm">
        <input
          type="radio"
          name="restock"
          value="0"
          className="h-5 w-5 accent-[var(--admin-primary)]"
        />
        {shipped ? "Stoğa alma (paket hâlâ kargoda)" : "Stoğa alma"}
      </label>
      <FieldError name="restock" />
    </fieldset>
  );
}

function CancelOrderModal({
  order,
  money,
  state,
  refundToken,
  mayRefund,
  triggerVariant,
}: {
  order: AdminOrder;
  money: OrderMoneyView;
  state: OrderActionState;
  refundToken: string;
  mayRefund: boolean;
  triggerVariant: ButtonVariant;
}) {
  const due = refundableMinor(order, money.collected, money.collectedMinor);
  const askPos = order.status === "pending_payment" && isPosOrder(order);
  // The same rule the server asks the stock question by.
  const askStock = hasStockToReturn(order);
  return (
    <ActionModal
      action={cancelOrderAction}
      title={`Sipariş #${order.orderNo} iptal edilsin mi?`}
      description={
        askPos
          ? "Önce POS'a sorulur: ödeme görünürse sipariş iptal edilmez."
          : "Müşteriye iptal e-postası gider (mağaza siparişinde)."
      }
      trigger="İptal et"
      triggerVariant={triggerVariant}
      disabledReason={reasonOf(state)}
      tone="danger"
      submitLabel="İptal et"
      confirmPhrase={money.collected ? String(order.orderNo) : undefined}
      hidden={{
        id: order.id,
        token: refundToken,
        destination: money.destination,
      }}
    >
      {({ fieldErrors, errorId }) => (
        <>
          <div className="flex flex-col gap-1.5">
            <Field label="Neden">
              <Textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                placeholder="Müşteri vazgeçti · Stokta yok · Adres hatalı…"
                aria-invalid={fieldErrors.reason ? true : undefined}
                aria-describedby={
                  fieldErrors.reason ? errorId("reason") : undefined
                }
                className="min-h-[80px]"
              />
            </Field>
            <FieldError name="reason" />
          </div>
          {askStock ? (
            <RestockChoice shipped={order.status === "shipped"} />
          ) : null}
          {due > 0 && mayRefund ? (
            <div className="flex flex-col gap-2">
              <Checkbox
                name="refund"
                value="1"
                defaultChecked
                label="Tutarın tamamını şimdi iade et"
              />
              <DestinationNote
                destination={money.destination}
                amountMinor={due}
              />
            </div>
          ) : null}
        </>
      )}
    </ActionModal>
  );
}

function RefundOrderModal({
  order,
  money,
  state,
  refundToken,
  triggerVariant,
}: {
  order: AdminOrder;
  money: OrderMoneyView;
  state: OrderActionState;
  refundToken: string;
  triggerVariant: ButtonVariant;
}) {
  const due = refundableMinor(order, money.collected, money.collectedMinor);
  return (
    <ActionModal
      action={refundOrderAction}
      title={`Sipariş #${order.orderNo} iadesi`}
      description={`İade edilebilir: ${formatTRY(due)}`}
      trigger="İade başlat"
      triggerVariant={triggerVariant}
      disabledReason={reasonOf(state)}
      tone="danger"
      submitLabel="İadeyi yap"
      confirmPhrase={String(order.orderNo)}
      hidden={{
        id: order.id,
        token: refundToken,
        destination: money.destination,
      }}
      size="md"
    >
      {({ fieldErrors, errorId }) => (
        <>
          <DestinationNote destination={money.destination} amountMinor={due} />
          <div className="flex flex-col gap-1.5">
            <Field label="Tutar (₺)">
              <TextInput
                name="amount"
                inputMode="decimal"
                required
                defaultValue={(due / 100).toFixed(2).replace(".", ",")}
                aria-invalid={fieldErrors.amount ? true : undefined}
                aria-describedby={
                  fieldErrors.amount ? errorId("amount") : undefined
                }
              />
            </Field>
            <FieldError name="amount" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Field label="Neden">
              <Textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                placeholder="Hasarlı geldi · Yanlış ürün · Müşteri talebi…"
                aria-invalid={fieldErrors.reason ? true : undefined}
                aria-describedby={
                  fieldErrors.reason ? errorId("reason") : undefined
                }
                className="min-h-[80px]"
              />
            </Field>
            <FieldError name="reason" />
          </div>
          <RestockLines order={order} />
        </>
      )}
    </ActionModal>
  );
}

/**
 * "PayNkolay'da iade ettim": the money already went back from PayNkolay's
 * merchant panel. Recorded only; the POS is not asked again.
 */
function OutsideRefundModal({
  order,
  money,
  state,
  refundToken,
  triggerVariant,
}: {
  order: AdminOrder;
  money: OrderMoneyView;
  state: OrderActionState;
  refundToken: string;
  triggerVariant: ButtonVariant;
}) {
  const due = refundableMinor(order, money.collected, money.collectedMinor);
  return (
    <ActionModal
      action={recordOutsideRefundAction}
      title={`Sipariş #${order.orderNo}: PayNkolay'da yapılan iade`}
      description={`Parayı PayNkolay işyeri panelinden kendin iade ettiysen burada kaydet. POS'a istek gönderilmez; sipariş iade edildi olur, müşteriye iade e-postası gider. Kaydedilebilir en çok: ${formatTRY(due)}.`}
      trigger="PayNkolay'da iade ettim"
      triggerVariant={triggerVariant}
      disabledReason={reasonOf(state)}
      submitLabel="Kaydet"
      confirmPhrase={String(order.orderNo)}
      hidden={{ id: order.id, token: refundToken }}
      size="md"
    >
      {({ fieldErrors, errorId }) => (
        <>
          <div className="flex flex-col gap-1.5">
            <Field
              label="PayNkolay'da iade edilen tutar (₺)"
              hint="PayNkolay panelinde gördüğün tutar. Kısmi iadeyse yalnız o kısmı yaz."
            >
              <TextInput
                name="amount"
                inputMode="decimal"
                required
                defaultValue={(due / 100).toFixed(2).replace(".", ",")}
                aria-invalid={fieldErrors.amount ? true : undefined}
                aria-describedby={
                  fieldErrors.amount ? errorId("amount") : undefined
                }
              />
            </Field>
            <FieldError name="amount" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Field label="Neden">
              <Textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                defaultValue="PayNkolay panelinden iade edildi."
                aria-invalid={fieldErrors.reason ? true : undefined}
                aria-describedby={
                  fieldErrors.reason ? errorId("reason") : undefined
                }
                className="min-h-[80px]"
              />
            </Field>
            <FieldError name="reason" />
          </div>
          <RestockLines order={order} />
        </>
      )}
    </ActionModal>
  );
}

function MarkPaidModal({
  order,
  state,
  triggerVariant,
}: {
  order: AdminOrder;
  state: OrderActionState;
  triggerVariant: ButtonVariant;
}) {
  return (
    <ActionModal
      action={markPaidAction}
      title={`Sipariş #${order.orderNo} ödendi mi?`}
      description={
        isPosOrder(order)
          ? "Önce POS'a sorulur. Kartla ödenmişse öyle işlenir; değilse ödeme kasada alındı diye kaydedilir."
          : "Ödeme kasada alındı diye kaydedilir."
      }
      trigger="Ödendi olarak işaretle"
      triggerVariant={triggerVariant}
      disabledReason={reasonOf(state)}
      submitLabel="Ödendi olarak işaretle"
      hidden={{ id: order.id }}
      size="sm"
    >
      {({ fieldErrors, errorId }) => (
        <>
          <div className="flex flex-col gap-1.5">
            <Field label="Nasıl ödendi?">
              <Select
                name="method"
                required
                defaultValue=""
                aria-invalid={fieldErrors.method ? true : undefined}
                aria-describedby={
                  fieldErrors.method ? errorId("method") : undefined
                }
              >
                <option value="" disabled>
                  Seç…
                </option>
                {MANUAL_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {MANUAL_PAYMENT_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <FieldError name="method" />
          </div>
          <Checkbox name="alsoPrepare" value="1" label="Hazırlamaya da başla" />
        </>
      )}
    </ActionModal>
  );
}

function TrackingFields({ order }: { order: AdminOrder }) {
  return (
    <>
      <Field label="Kargo firması">
        <TextInput
          name="carrier"
          defaultValue={order.carrier ?? ""}
          maxLength={80}
          placeholder="Yurtiçi, Aras, MNG…"
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <Field label="Takip numarası">
          <TextInput
            name="trackingNumber"
            required
            maxLength={120}
            autoComplete="off"
            defaultValue={order.trackingNumber ?? ""}
            style={{ fontFamily: "var(--mono), monospace" }}
          />
        </Field>
        <FieldError name="trackingNumber" />
      </div>
    </>
  );
}

function ShipParcelModal({
  order,
  state,
  triggerVariant,
}: {
  order: AdminOrder;
  state: OrderActionState;
  triggerVariant: ButtonVariant;
}) {
  return (
    <ActionModal
      action={shipOrderAction}
      title={`Sipariş #${order.orderNo} kargoya ver`}
      description="Müşteriye takip numarasıyla e-posta gider."
      trigger="Kargoya ver"
      triggerVariant={triggerVariant}
      disabledReason={reasonOf(state)}
      submitLabel="Kargoya ver"
      hidden={{ id: order.id }}
      size="sm"
    >
      <TrackingFields order={order} />
    </ActionModal>
  );
}

function EditTrackingModal({
  order,
  state,
  triggerVariant,
}: {
  order: AdminOrder;
  state: OrderActionState;
  triggerVariant: ButtonVariant;
}) {
  return (
    <ActionModal
      action={saveOrderTrackingAction}
      title="Kargo bilgisini düzelt"
      description="Yeni bir numara müşteriye yeniden e-postayla gider."
      trigger="Kargo bilgisini düzelt"
      triggerVariant={triggerVariant}
      disabledReason={reasonOf(state)}
      submitLabel="Kaydet"
      hidden={{ id: order.id }}
      size="sm"
    >
      <TrackingFields order={order} />
    </ActionModal>
  );
}

// ── Menus ───────────────────────────────────────────────────────────────

/**
 * Every action of one order in a "⋯" menu: the list row's menu, and the
 * order page's menu (minus the primary button, `skip`).
 */
export function OrderActionMenu({
  order,
  money,
  actions,
  refundToken,
  mayRefund,
  openLink = false,
  skip = null,
  children,
  framed = false,
}: OrderControlsProps & {
  mayRefund: boolean;
  /** Start with "Siparişi aç" (the list's row menu). */
  openLink?: boolean;
  /** The action already shown as the page's primary button. */
  skip?: OrderActionId | null;
  /** Extra rows at the end ("Fiş yazdır"). */
  children?: ReactNode;
  /** The page's menu, beside its primary button (ActionMenu `framed`). */
  framed?: boolean;
}) {
  const a = actions;
  const show = (id: OrderActionId) => id !== skip && a[id] !== undefined;
  const moves = (
    ["start_preparing", "mark_shipped", "complete"] as const
  ).filter(show);
  return (
    <ActionMenu label={`Sipariş ${order.orderNo} işlemleri`} framed={framed}>
      {openLink ? (
        <ActionMenuLink href={`/admin/siparisler/${order.id}`}>
          Siparişi aç
        </ActionMenuLink>
      ) : null}
      {moves.map((id) => (
        <MoveButton
          key={id}
          order={order}
          id={id}
          state={a[id] as OrderActionState}
          variant="menu"
        />
      ))}
      {show("ship") ? (
        <ShipParcelModal order={order} state={a.ship!} triggerVariant="menu" />
      ) : null}
      {show("check_pos") ? (
        <CheckPosButton order={order} state={a.check_pos!} variant="menu" />
      ) : null}
      {show("mark_paid") ? (
        <MarkPaidModal
          order={order}
          state={a.mark_paid!}
          triggerVariant="menu"
        />
      ) : null}
      {show("edit_tracking") ? (
        <EditTrackingModal
          order={order}
          state={a.edit_tracking!}
          triggerVariant="menu"
        />
      ) : null}
      {show("refund") ? (
        <RefundOrderModal
          order={order}
          money={money}
          state={a.refund!}
          refundToken={refundToken}
          triggerVariant="menu"
        />
      ) : null}
      {show("refund") && money.destination === "card" ? (
        <>
          <RunButton
            action={findPosRefundAction}
            fields={{ id: order.id }}
            variant="menu"
            state={a.refund}
            pendingLabel="PayNkolay'a soruluyor…"
          >
            PayNkolay&apos;dan iadeyi bul
          </RunButton>
          <OutsideRefundModal
            order={order}
            money={money}
            state={a.refund!}
            refundToken={refundToken}
            triggerVariant="menu"
          />
        </>
      ) : null}
      {show("release_stock") ? (
        <ConfirmButton
          action={releaseStockAction}
          hidden={{ id: order.id }}
          label="Stoğu geri al"
          title="Stok geri alınsın mı?"
          description="Bu iptalde ürünler stoğa dönmemiş görünüyor. Dönmeyen adetler şimdi stoğa eklenir, kupon geri verilir. Stoğu elle düzelttiysen yapma."
          tone="default"
          variant="menu"
          disabledReason={reasonOf(a.release_stock)}
        />
      ) : null}
      {show("clear_attention") ? (
        <ConfirmButton
          action={clearAttentionAction}
          hidden={{ id: order.id }}
          label="Dikkat işaretini kaldır"
          title="Dikkat işareti kaldırılsın mı?"
          description="Sorunu çözdüysen kaldır. Olay kaydına yazılır."
          tone="default"
          variant="menu"
          reason={{ label: "Ne yapıldı? (isteğe bağlı)" }}
          disabledReason={reasonOf(a.clear_attention)}
        />
      ) : null}
      {children}
      {show("cancel") ? (
        <>
          <ActionMenuSeparator />
          <CancelOrderModal
            order={order}
            money={money}
            state={a.cancel!}
            refundToken={refundToken}
            mayRefund={mayRefund}
            triggerVariant="menuDanger"
          />
        </>
      ) : null}
    </ActionMenu>
  );
}

/**
 * The order page's header actions: one primary "next step" button, and the
 * rest in the "⋯" menu with "Fiş yazdır" at its end.
 */
export function OrderHeaderActions(
  props: OrderControlsProps & { mayRefund: boolean },
) {
  const { order, actions } = props;
  const primary = nextStep(order, actions);
  return (
    <div className="flex flex-wrap items-start gap-2 print:hidden">
      {primary ? <PrimaryAction {...props} id={primary} /> : null}
      <OrderActionMenu {...props} skip={primary} framed>
        <ActionMenuButton onClick={() => window.print()}>
          Fiş yazdır
        </ActionMenuButton>
      </OrderActionMenu>
    </div>
  );
}

function PrimaryAction({
  order,
  actions,
  id,
}: OrderControlsProps & { id: OrderActionId }) {
  const state = actions[id];
  if (!state) return null;
  if (id === "ship") {
    return (
      <ShipParcelModal order={order} state={state} triggerVariant="primary" />
    );
  }
  if (id === "mark_paid") {
    return (
      <MarkPaidModal order={order} state={state} triggerVariant="primary" />
    );
  }
  if (id === "check_pos") {
    return <CheckPosButton order={order} state={state} variant="primary" />;
  }
  if (id === "start_preparing" || id === "mark_shipped" || id === "complete") {
    return <MoveButton order={order} id={id} state={state} variant="primary" />;
  }
  return null;
}

// ── Lines ───────────────────────────────────────────────────────────────

const ITEM_STATUS_OPTIONS: Array<[AdminOrderItemStatus, string]> = [
  ["pending", "Bekliyor"],
  ["ready", "Hazır"],
  ["cancelled", "İptal"],
];

/**
 * One line's status, saved on change. Shows what was saved: a refused or
 * failed save puts the old value back (and the toast says why).
 */
export function ItemStatusSelect({
  orderId,
  index,
  status,
  productName,
  disabledReason,
}: {
  orderId: string;
  index: number;
  status: AdminOrderItemStatus;
  productName: string;
  disabledReason?: string;
}) {
  const [shown, setShown] = useState(status);
  const [seen, setSeen] = useState(status);
  if (status !== seen) {
    setSeen(status);
    setShown(status);
  }
  const { pending, run } = useRunAction(setItemStatusAction, (result) => {
    if (!result.ok) setShown(status);
  });
  return (
    <select
      value={shown}
      disabled={pending || Boolean(disabledReason)}
      title={disabledReason}
      aria-label={`${productName}: kalem durumu`}
      onChange={(e) => {
        const next = e.target.value as AdminOrderItemStatus;
        setShown(next);
        run({ id: orderId, index, status: next });
      }}
      className="min-h-[36px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1 text-xs text-[var(--admin-text)] focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none disabled:opacity-60 pointer-coarse:min-h-11"
    >
      {ITEM_STATUS_OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

// ── Note ────────────────────────────────────────────────────────────────

const noteInitial: NoteActionState = {};

export function OrderNoteForm({
  orderId,
  initial,
}: {
  orderId: string;
  initial: string;
}) {
  const toast = useToast();
  const [state, setState] = useState<NoteActionState>(noteInitial);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(initial);
  const [dirty, setDirty] = useState(false);

  const save = (formData: FormData) => {
    startTransition(async () => {
      let next: NoteActionState;
      try {
        next = await saveOrderNoteAction(state, formData);
      } catch (err) {
        unstable_rethrow(err);
        next = { error: PANEL_ACTION_FAILED };
      }
      setState(next);
      if (next.savedAt) {
        setDirty(false);
        toast.show({ message: "Not kaydedildi." });
      } else if (next.error) {
        toast.show({ message: next.error, tone: "danger" });
      }
    });
  };

  return (
    <form
      // The action is React's guard for an Enter before hydration; the
      // post itself is onSubmit's (ui/submit.ts).
      action={save}
      onSubmit={(e) => {
        e.preventDefault();
        save(new FormData(e.currentTarget));
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="id" value={orderId} />
      <Textarea
        name="note"
        value={note}
        maxLength={ORDER_NOTE_MAX}
        aria-label="İç not"
        onChange={(e) => {
          setNote(e.target.value);
          setDirty(true);
        }}
        rows={4}
        placeholder="Ekip için not: hediye paketi, ek talep, alerji… Müşteri görmez."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="text-xs text-[var(--admin-text-soft)]"
          aria-live="polite"
        >
          {state.error ? (
            <span className="text-[var(--admin-danger-ink)]">
              {state.error}
            </span>
          ) : dirty ? (
            "Kaydedilmemiş değişiklik var."
          ) : (
            `${note.length} / ${ORDER_NOTE_MAX}`
          )}
        </span>
        <button
          type="submit"
          disabled={pending || !dirty}
          className={BUTTON.primary}
        >
          {pending ? "Kaydediliyor…" : "Notu kaydet"}
        </button>
      </div>
    </form>
  );
}

// ── Bulk ────────────────────────────────────────────────────────────────

const BULK_BUTTONS: Array<{
  value: "preparing" | "shipped" | "completed" | "cancelled";
  label: string;
}> = [
  { value: "preparing", label: "Hazırlamaya başla" },
  // `shipped` is a different word per order (lib/admin/order-channel.ts):
  // "Kargoda / Hazır" left the courier and the table orders out.
  { value: "shipped", label: "Hazır / yolda" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal et" },
];

const BULK_DESCRIPTION: Record<(typeof BULK_BUTTONS)[number]["value"], string> =
  {
    preparing: "Bu duruma geçemeyenler atlanır ve sonuçta numarasıyla yazılır.",
    shipped:
      "Gel-al sipariş Hazır, kuryeli olan Kuryede, masa siparişi Masada, paket Kargoda olur. Takip numarası olmayan paket ve bu duruma geçemeyenler atlanır, sonuçta numarasıyla yazılır.",
    completed: "Bu duruma geçemeyenler atlanır ve sonuçta numarasıyla yazılır.",
    cancelled:
      "Her sipariş tek tek iptal edilir: stok ve kupon geri döner, bekleyen kart ödemesi önce POS'a sorulur. Ödemesi alınmış olanların iadesini sonra sipariş sayfasından yap.",
  };

/**
 * The bulk bar's buttons. Each opens a modal; a cancel asks for a reason
 * and the number of selected orders typed out. The answer names every
 * skipped order and why; a success clears the selection.
 *
 * Below sm the four fold into one "Toplu işlem" menu, so the bar is a
 * single row: four buttons wrapped it to 237 px on a 390 px phone, over
 * the pagination and the last card (admin audit ORD-06). The menu rows
 * open the same modals.
 */
export function BulkOrderButtons({
  ids,
  onSuccess,
}: {
  ids: readonly string[];
  /** After a run: the list clears its selection (`useSelection` resetOn). */
  onSuccess: (result: ActionResult) => void;
}) {
  return (
    <>
      <div className="hidden sm:contents">
        <BulkModals ids={ids} onSuccess={onSuccess} menu={false} />
      </div>
      <div className="sm:hidden">
        <ActionMenu label="Toplu işlem" showLabel>
          <BulkModals ids={ids} onSuccess={onSuccess} menu />
        </ActionMenu>
      </div>
    </>
  );
}

function BulkModals({
  ids: selected,
  onSuccess,
  menu,
}: {
  ids: readonly string[];
  onSuccess: (result: ActionResult) => void;
  /** Drawn as ActionMenu rows rather than bar buttons. */
  menu: boolean;
}) {
  const count = selected.length;
  const ids = selected.join(",");
  return (
    <>
      {BULK_BUTTONS.map((b) => {
        const cancel = b.value === "cancelled";
        return (
          <ActionModal
            key={b.value}
            action={bulkOrdersAction}
            title={`${count} sipariş: ${b.label}`}
            description={BULK_DESCRIPTION[b.value]}
            trigger={b.label}
            triggerVariant={
              menu
                ? cancel
                  ? "menuDanger"
                  : "menu"
                : cancel
                  ? "danger"
                  : "ghost"
            }
            tone={cancel ? "danger" : "default"}
            submitLabel={b.label}
            confirmPhrase={cancel ? String(count) : undefined}
            confirmLabel={cancel ? `Onaylamak için ${count} yaz` : undefined}
            hidden={{ ids, op: "set_status", value: b.value }}
            onSuccess={onSuccess}
            size="sm"
          >
            {cancel ? (
              <div className="flex flex-col gap-1.5">
                <Field label="Neden">
                  <Textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    className="min-h-[80px]"
                  />
                </Field>
                <FieldError name="reason" />
              </div>
            ) : null}
          </ActionModal>
        );
      })}
    </>
  );
}
