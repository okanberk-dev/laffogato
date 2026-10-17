import Link from "next/link";
import type { ReactNode } from "react";

import {
  cancelReservationAction,
  confirmReservationAction,
  retryKaraokeRefundAction,
  settleKaraokeRefundAction,
} from "@/app/admin/mobil/karaoke/actions";
import { cx } from "@/components/laffogato/cx";
import {
  KARAOKE_ATTENTION,
  karaokeDetailHref,
  maskPaymentRef,
  refundAmountMinor,
  type KaraokeRowView,
} from "@/lib/admin/karaoke-panel";
import type { SearchParamsInput, SortState } from "@/lib/admin/list-params";

import { formatTRY } from "./forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  Badge,
  ConfirmButton,
  DataTable,
  EmptyState,
} from "./ui";
import { MONO_STYLE } from "./ui/styles";
import { TONE_INK, TONE_SOFT } from "./ui/tone";

// The karaoke panel's pieces (list rows, row menu, the booking's page).
// Server-safe: no hooks. Every action is its own kit dialog with its own
// state, so one action's answer can never be shown as another's (the old
// row merged four results and printed the first it found).

/** Status, payment, refund-owed and guest badges, in that order. */
export function KaraokeBadges({ view }: { view: KaraokeRowView }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={view.statusTone} dot>
        {view.statusLabel}
      </Badge>
      <Badge tone={view.paymentTone}>{view.paymentLabel}</Badge>
      {view.attention.includes("refund_owed") ? (
        <Badge tone="danger">İade borcu</Badge>
      ) : null}
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

function amount(view: KaraokeRowView): string {
  return formatTRY(refundAmountMinor(view.r));
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
    items.push(
      <ConfirmButton
        key="cancel"
        action={cancelReservationAction}
        hidden={{ id: r.id, beklenen: "iade" }}
        label="İptal et ve iade et"
        title="İptal et ve iade et"
        description={`${amount(view)} karta iade edilir, rezervasyon iptal olur ve müşteriye e-posta gider. İade geri alınamaz.`}
        variant={menu ? "menuDanger" : "danger"}
        reason={{
          ...MONEY_REASON,
          placeholder: "Ör. oda arızalı, müşteri istedi",
        }}
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
    const after = plan.settle.kind === "after_cancel";
    items.push(
      <ConfirmButton
        key="settle"
        action={settleKaraokeRefundAction}
        hidden={{ id: r.id }}
        label={after ? "PayNkolay'da iade edildi" : "İade POS'ta görüldü"}
        title={after ? "PayNkolay'da iade edildi" : "İade POS'ta görüldü"}
        description={
          after
            ? `${amount(view)} tutarını PayNkolay panelinden iade ettiysen kaydet: rezervasyon iade edildi olarak işaretlenir ve müşteriye e-posta gider. POS'a bir şey gönderilmez.`
            : `PayNkolay panelinde bu iadeyi (${amount(view)}) gördüysen iade yapılmış olarak kaydedilir ve müşteriye iade e-postası gider. POS'a bir şey gönderilmez.`
        }
        confirmLabel="Kaydet"
        tone="default"
        variant={menu ? "menu" : "ghost"}
        reason={{
          ...MONEY_REASON,
          placeholder: "Ör. PayNkolay panelinde 17 Eki 21:10 iadesi görüldü",
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

/** The list row's ⋯ menu: the booking's page, then its actions. */
export function KaraokeRowMenu({ view }: { view: KaraokeRowView }) {
  return (
    <ActionMenu label={`${view.r.id} işlemleri`}>
      <ActionMenuLink href={karaokeDetailHref(view.r.id)}>Detay</ActionMenuLink>
      {hasActions(view) ? (
        <>
          <ActionMenuSeparator />
          <KaraokeActions view={view} layout="menu" />
        </>
      ) : null}
    </ActionMenu>
  );
}

function customerLine(view: KaraokeRowView): ReactNode {
  const r = view.r;
  const email = r.contactEmail || r.customerEmail;
  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium text-[var(--admin-text)]">
        {r.customerName || "İsimsiz"}
      </span>
      <span className="block truncate text-xs text-[var(--admin-text-soft)]">
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
    <span className="whitespace-nowrap" style={MONO_STYLE}>
      {formatTRY(r.totalMinor)}
      {r.discountMinor > 0 ? (
        <span className="block text-xs text-[var(--admin-text-soft)]">
          indirim {formatTRY(r.discountMinor)}
        </span>
      ) : null}
    </span>
  );
}

/** The list: a table from `md`, a card per booking on phones. */
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
  return (
    <DataTable<KaraokeRowView>
      caption="Karaoke rezervasyonları"
      rows={views}
      rowKey={(v) => v.r.id}
      rowHref={(v) => karaokeDetailHref(v.r.id)}
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
            </span>
          ),
        },
        { key: "musteri", header: "Müşteri", cell: customerLine },
        {
          key: "kisi",
          header: "Kişi · süre",
          hideBelow: "lg",
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
              <KaraokeBadges view={v} />
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
          key: "kod",
          header: "Kod · POS",
          hideBelow: "xl",
          cell: (v) => (
            <span
              className="block text-xs text-[var(--admin-text-soft)]"
              style={MONO_STYLE}
            >
              <span className="block">{v.r.id}</span>
              {v.r.paymentRef ? (
                <span className="block" title="POS referansı, ortası gizli">
                  {maskPaymentRef(v.r.paymentRef)}
                </span>
              ) : null}
            </span>
          ),
        },
      ]}
      rowActions={(v) => <KaraokeRowMenu view={v} />}
      mobileCard={(v) => (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <Link
              href={karaokeDetailHref(v.r.id)}
              className="font-medium text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
            >
              {v.time}
            </Link>
            <span className="text-xs text-[var(--admin-text-soft)]">
              {v.day}
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
