import Link from "next/link";
import type { ReactNode } from "react";

import {
  cancelReservationAction,
  confirmReservationAction,
  retryKaraokeRefundAction,
  settleKaraokeRefundAction,
} from "@/app/admin/mobil/karaoke/actions";
import { cx } from "@/components/laffogato/cx";
import { karaokeInstantLabel } from "@/components/laffogato/karaoke-terms";
import {
  KARAOKE_ATTENTION,
  karaokeDetailHref,
  maskPaymentRef,
  refundOwedNowMinor,
  type KaraokeRowView,
} from "@/lib/admin/karaoke-panel";
import {
  withParams,
  type SearchParamsInput,
  type SortState,
} from "@/lib/admin/list-params";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";
import { needsCallHint } from "@/lib/mobile/karaoke-cancel-cause";
import { karaokeCancelDeadline } from "@/lib/mobile/karaoke-time";

import { formatTRY } from "./forms";
import { KaraokeRefundCancel } from "./karaoke-cancel-dialog";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  Badge,
  ConfirmButton,
  DataTable,
  EmptyState,
} from "./ui";
import { MONO_STYLE, NUMERIC_STYLE } from "./ui/styles";
import { TONE_INK, TONE_SOFT } from "./ui/tone";

// The karaoke panel's pieces (list rows, row menu, the booking's page).
// Server-safe: no hooks. Every action is its own kit dialog with its own
// state, so one action's answer can never be shown as another's (the old
// row merged four results and printed the first it found).

// In the list's table a long payment badge ("Ödeme bekleniyor · son 14:30",
// "İade sonucu bekleniyor") may break onto a second line: kept on one, it
// alone made the table wider than its card below 1280 px and put the
// amount behind the pinned ⋯ column (admin audit KAR-03).
const WRAPPING_BADGE = "rounded-xl! text-left whitespace-normal!";

/**
 * Status, payment, refund-owed and guest badges, in that order. `wrap`: the
 * list's table, where a long badge breaks rather than widen the column.
 */
export function KaraokeBadges({
  view,
  wrap = false,
}: {
  view: KaraokeRowView;
  wrap?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={view.statusTone} dot>
        {view.statusLabel}
      </Badge>
      <Badge
        tone={view.paymentTone}
        className={wrap ? WRAPPING_BADGE : undefined}
      >
        {view.paymentLabel}
      </Badge>
      {view.attention.includes("refund_owed") ? (
        <Badge tone="danger">İade borcu</Badge>
      ) : null}
      {view.attention.includes("share_owed") ? (
        <Badge tone="danger">Kısmi iade borcu</Badge>
      ) : null}
      {view.attention.includes("resale_owed") ? (
        <Badge tone="danger">Yeniden satış iadesi</Badge>
      ) : null}
      {view.makeGood === "open" ? <Badge tone="info">Telafi açık</Badge> : null}
      {view.r.makeGoodFor ? <Badge tone="info">Telafi saati</Badge> : null}
      {view.r.guest ? <Badge tone="accent">Üyeliksiz</Badge> : null}
    </span>
  );
}

/** The first thing that needs a person, as one short line. */
export function KaraokeAttentionLine({ view }: { view: KaraokeRowView }) {
  const first = view.attention[0];
  if (!first) return null;
  const a = KARAOKE_ATTENTION[first];
  return (
    <span className={cx("mt-1 block text-xs font-medium", TONE_INK[a.tone])}>
      {a.title}
    </span>
  );
}

/** Every warning on the booking's page, each with what to do. */
export function KaraokeAttentionNotices({ view }: { view: KaraokeRowView }) {
  if (view.attention.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {view.attention.map((key) => {
        const a = KARAOKE_ATTENTION[key];
        return (
          <div
            key={key}
            role={a.tone === "danger" ? "alert" : "status"}
            className={cx("rounded-xl px-4 py-3 text-sm", TONE_SOFT[a.tone])}
          >
            <strong className="font-semibold">{a.title}.</strong> {a.text}
          </div>
        );
      })}
    </div>
  );
}

const MONEY_REASON = {
  required: true,
  minLength: 3,
  maxLength: 500,
} as const;

/**
 * What the dialog's refund sends: everything still to go back, never what a
 * person already refunded by hand (a late share refunded before its hour
 * was sold again).
 */
function amount(view: KaraokeRowView): string {
  return formatTRY(refundOwedNowMinor(view.r));
}

/**
 * The title and text of an unpaid booking's cancel dialog. An evening
 * already over is written off without a mail (karar D7), and its dialog
 * says so. Exported for tests: a closed dialog renders no text.
 */
export function unpaidCancelText(
  cancel: NonNullable<KaraokeRowView["plan"]["cancel"]>,
): { title: string; description: string } {
  if (cancel.kind === "hold") {
    return {
      title: "Rezervasyonu iptal et",
      description:
        "Ödeme bekleyen bir rezervasyon. Önce POS'a ödenip ödenmediği sorulur: ödenmemişse saat boşa çıkar ve müşteriye iptal e-postası gider. Bu arada ödenmişse iptal edilmez, sana söylenir.",
    };
  }
  if (cancel.ended) {
    return {
      title: "Geçmiş rezervasyonu iptal et",
      description:
        "Saati geçmiş, köşkte ödenecek bir rezervasyon; iade yok. İptal olarak kaydedilir (ör. müşteri gelmedi), müşteriye e-posta gitmez.",
    };
  }
  return {
    title: "Rezervasyonu iptal et",
    description:
      "Ödeme alınmamıştı, iade yok. Saat boşa çıkar ve müşteriye iptal e-postası gider.",
  };
}

/**
 * The booking's actions as kit dialogs: `menu` rows for the list's ⋯ menu,
 * `page` buttons for the booking's page. Which ones exist, and which are
 * shown off with a reason, is `view.plan` (lib/admin/karaoke-panel.ts).
 * Every one asks first; the ones that move money ask for a reason too.
 */
export function KaraokeActions({
  view,
  layout,
}: {
  view: KaraokeRowView;
  layout: "menu" | "page";
}) {
  const { plan, r } = view;
  const menu = layout === "menu";
  const items: ReactNode[] = [];

  if (plan.confirm) {
    items.push(
      <ConfirmButton
        key="confirm"
        action={confirmReservationAction}
        hidden={{ id: r.id }}
        label="Onayla"
        title="Rezervasyonu onayla"
        description={
          view.money === "paid"
            ? "Ödeme alınmış. Onaylanınca saat ayrılır ve müşteriye onay e-postası gider."
            : "Ön ödeme kapalı, müşteri köşkte öder. Onaylanınca saat ayrılır ve müşteriye onay e-postası gider."
        }
        tone="default"
        variant={menu ? "menu" : "primary"}
        disabledReason={plan.confirm.disabledReason}
      />,
    );
  }

  if (plan.cancel?.kind === "refund") {
    // A paid booking's cancel names its reason from a fixed list; a guest's
    // own request also its channel and instant (karaoke-cancel-dialog.tsx).
    // The request's instant defaults to when the dialog opens
    // (karaokeRequestDefault), never to when this page was drawn.
    const now = new Date();
    items.push(
      <KaraokeRefundCancel
        key="cancel"
        id={r.id}
        amount={amount(view)}
        freeUntil={karaokeInstantLabel(karaokeCancelDeadline(r))}
        callHint={needsCallHint(r, now)}
        confirmed={r.status === "confirmed"}
        serverNow={now.getTime()}
        bookedAt={toDateTimeLocalInput(r.createdAt)}
        variant={menu ? "menuDanger" : "danger"}
        disabledReason={plan.cancel.disabledReason}
      />,
    );
  } else if (plan.cancel) {
    items.push(
      <ConfirmButton
        key="cancel"
        action={cancelReservationAction}
        hidden={{ id: r.id, beklenen: "odenmemis" }}
        label="İptal et"
        {...unpaidCancelText(plan.cancel)}
        variant={menu ? "menuDanger" : "danger"}
        reason={{ required: false, maxLength: 500 }}
        disabledReason={plan.cancel.disabledReason}
      />,
    );
  }

  if (plan.refund) {
    const first = plan.refund.kind === "first";
    items.push(
      <ConfirmButton
        key="refund"
        action={retryKaraokeRefundAction}
        hidden={{ id: r.id }}
        label={first ? "İadeyi başlat" : "İadeyi yeniden dene"}
        title={first ? "İadeyi başlat" : "İadeyi yeniden dene"}
        description={
          first
            ? `Rezervasyon zaten iptal; ${amount(view)} POS üzerinden karta iade edilir ve müşteriye e-posta gider. PayNkolay panelinden zaten iade ettiysen bunu değil "PayNkolay'da iade edildi"yi seç.`
            : `İlk iadenin yanıtı gelmedi. Önce PayNkolay panelinde bu rezervasyona bak: iade orada görünüyorsa "İade POS'ta görüldü"yü seç. Görünmüyorsa ${amount(view)} için POS'a yeniden iade isteği gider.`
        }
        confirmLabel={first ? "İade et" : "Yeniden dene"}
        variant={menu ? "menuDanger" : "danger"}
        reason={MONEY_REASON}
        disabledReason={plan.refund.disabledReason}
      />,
    );
  }

  if (plan.settle) {
    const kind = plan.settle.kind;
    const label =
      kind === "share"
        ? "Elle iade edildi"
        : kind === "after_cancel"
          ? "PayNkolay'da iade edildi"
          : "İade POS'ta görüldü";
    items.push(
      <ConfirmButton
        key="settle"
        action={settleKaraokeRefundAction}
        hidden={{ id: r.id }}
        label={label}
        title={label}
        description={
          kind === "share" && (r.resaleRefundMinor ?? 0) > 0
            ? `Geç iptal edilen saat yeniden satıldı: misafirde kalan tutardan ${amount(view)} iade edilecek. Bu tutarı PayNkolay panelinden karta iade ettiysen kaydet: rezervasyon iade edildi olarak işaretlenir ve müşteriye e-posta gider. POS'a bir şey gönderilmez.`
            : kind === "share"
              ? `Geç iptalin iadesi: ödemenin tamamı değil, rezervasyonun kuralına göre ${amount(view)}. Bu tutarı PayNkolay panelinden karta iade ettiysen kaydet: rezervasyon iade edildi olarak işaretlenir ve müşteriye e-posta gider. POS'a bir şey gönderilmez.`
              : kind === "after_cancel"
                ? `${amount(view)} tutarını PayNkolay panelinden iade ettiysen kaydet: rezervasyon iade edildi olarak işaretlenir ve müşteriye e-posta gider. POS'a bir şey gönderilmez.`
                : `PayNkolay panelinde bu iadeyi (${amount(view)}) gördüysen iade yapılmış olarak kaydedilir ve müşteriye iade e-postası gider. POS'a bir şey gönderilmez.`
        }
        confirmLabel="Kaydet"
        tone="default"
        variant={menu ? "menu" : kind === "share" ? "primary" : "ghost"}
        reason={{
          ...MONEY_REASON,
          placeholder:
            kind === "share"
              ? "Ör. PayNkolay panelinden 18 Eki 14:05 kısmi iade yapıldı"
              : "Ör. PayNkolay panelinde 17 Eki 21:10 iadesi görüldü",
        }}
        disabledReason={plan.settle.disabledReason}
      />,
    );
  }

  if (items.length === 0) return null;
  return <>{items}</>;
}

/** True when the booking offers any action at all. */
function hasActions(view: KaraokeRowView): boolean {
  const p = view.plan;
  return Boolean(p.confirm || p.cancel || p.refund || p.settle);
}

/**
 * The list row's ⋯ menu: the booking's page, then its actions. `back` is
 * the list's own address, so the page's back link returns to it.
 */
export function KaraokeRowMenu({
  view,
  back,
}: {
  view: KaraokeRowView;
  back?: string;
}) {
  return (
    <ActionMenu label={`${view.r.id} işlemleri`}>
      <ActionMenuLink href={karaokeDetailHref(view.r.id, back)}>
        Detay
      </ActionMenuLink>
      {hasActions(view) ? (
        <>
          <ActionMenuSeparator />
          <KaraokeActions view={view} layout="menu" />
        </>
      ) : null}
    </ActionMenu>
  );
}

// A truncated span still adds its whole text to an auto-layout table
// cell's width; the max width is what lets a long e-mail shorten instead
// of pushing the row past its card (admin audit KAR-03).
const CUSTOMER_WIDTH = "md:max-w-[12rem] xl:max-w-[14rem]";

function customerLine(view: KaraokeRowView): ReactNode {
  const r = view.r;
  const email = r.contactEmail || r.customerEmail;
  return (
    <span className="block min-w-0">
      <span
        className={cx(
          "block truncate font-medium text-[var(--admin-text)]",
          CUSTOMER_WIDTH,
        )}
        title={r.customerName || undefined}
      >
        {r.customerName || "İsimsiz"}
      </span>
      <span
        className={cx(
          "block truncate text-xs text-[var(--admin-text-soft)]",
          CUSTOMER_WIDTH,
        )}
        title={email || undefined}
      >
        {email}
      </span>
      {r.contactPhone ? (
        <a
          href={`tel:${r.contactPhone}`}
          className="text-xs text-[var(--admin-text-soft)] underline underline-offset-2 hover:text-[var(--admin-primary)]"
          style={MONO_STYLE}
        >
          {r.contactPhone}
        </a>
      ) : null}
    </span>
  );
}

function amountCell(view: KaraokeRowView): ReactNode {
  const r = view.r;
  return (
    <span className="whitespace-nowrap" style={NUMERIC_STYLE}>
      {formatTRY(r.totalMinor)}
      {r.discountMinor > 0 ? (
        <span className="block text-xs text-[var(--admin-text-soft)]">
          indirim {formatTRY(r.discountMinor)}
        </span>
      ) : null}
    </span>
  );
}

/** The booking code asked at the door, in the list's own figures. */
function codeLine(view: KaraokeRowView): ReactNode {
  return (
    <span
      className="block text-xs font-normal text-[var(--admin-text-soft)]"
      style={NUMERIC_STYLE}
    >
      {view.r.id}
    </span>
  );
}

/**
 * The list: a table from `md`, a card per booking on phones. The booking
 * code is in the first cell and on the card at every width (staff read it
 * at the door; it used to show from 1280 px only), and guests and hours
 * join the first cell where their own column is hidden: below 1280 px,
 * where the sidebar leaves the table about 720 px (KAR-11, KAR-03).
 */
export function KaraokeTable({
  views,
  sort,
  searchParams,
  pathname,
  empty,
}: {
  views: readonly KaraokeRowView[];
  sort: SortState;
  searchParams?: SearchParamsInput;
  pathname: string;
  empty?: ReactNode;
}) {
  // The list as it stands (tab, filters, sort, page), for the way back.
  const back = withParams(searchParams, {}, pathname);
  return (
    <DataTable<KaraokeRowView>
      caption="Karaoke rezervasyonları"
      rows={views}
      rowKey={(v) => v.r.id}
      rowHref={(v) => karaokeDetailHref(v.r.id, back)}
      sort={sort}
      searchParams={searchParams}
      pathname={pathname}
      empty={empty ?? <EmptyState title="Bu sekmede rezervasyon yok." />}
      columns={[
        {
          key: "tarih",
          header: "Saat",
          sortable: true,
          cell: (v) => (
            <span className="block whitespace-nowrap">
              <span className="block">{v.time}</span>
              <span className="block text-xs font-normal text-[var(--admin-text-soft)]">
                {v.day}
              </span>
              {codeLine(v)}
              <span className="block text-xs font-normal text-[var(--admin-text-soft)] xl:hidden">
                {v.r.guests} kişi · {v.r.hours} saat
              </span>
            </span>
          ),
        },
        { key: "musteri", header: "Müşteri", cell: customerLine },
        {
          key: "kisi",
          header: "Kişi · süre",
          hideBelow: "xl",
          cell: (v) => (
            <span className="whitespace-nowrap">
              {v.r.guests} kişi · {v.r.hours} saat
            </span>
          ),
        },
        {
          key: "durum",
          header: "Durum",
          cell: (v) => (
            <>
              <KaraokeBadges view={v} wrap />
              <KaraokeAttentionLine view={v} />
            </>
          ),
        },
        {
          key: "tutar",
          header: "Tutar",
          align: "right",
          sortable: true,
          firstDir: "desc",
          cell: amountCell,
        },
        {
          key: "pos",
          header: "POS",
          hideBelow: "xl",
          cell: (v) =>
            v.r.paymentRef ? (
              <span
                className="block text-xs whitespace-nowrap text-[var(--admin-text-soft)]"
                style={NUMERIC_STYLE}
                title="POS referansı, ortası gizli"
              >
                {maskPaymentRef(v.r.paymentRef)}
              </span>
            ) : null,
        },
      ]}
      rowActions={(v) => <KaraokeRowMenu view={v} back={back} />}
      mobileCard={(v) => (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <Link
              href={karaokeDetailHref(v.r.id, back)}
              className="font-medium text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
            >
              {v.time}
            </Link>
            <span className="text-xs text-[var(--admin-text-soft)]">
              {v.day} · <span style={NUMERIC_STYLE}>{v.r.id}</span>
            </span>
          </div>
          {customerLine(v)}
          <KaraokeBadges view={v} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="text-[var(--admin-text-soft)]">
              {v.r.guests} kişi · {v.r.hours} saat
            </span>
            {amountCell(v)}
          </div>
          <KaraokeAttentionLine view={v} />
        </div>
      )}
    />
  );
}
