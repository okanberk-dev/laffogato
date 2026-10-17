// Client-safe (no server-only, no zod): how the karaoke panel reads a
// booking. One module decides which badge, which tab, which warning and which
// buttons a row gets, so the list, the booking's page, the dashboard card and
// the tests cannot disagree. The pages fetch; everything here is pure.

import type {
  KaraokePaymentStatus,
  KaraokeReservation,
  KaraokeReservationStatus,
} from "@/lib/mobile/karaoke-core";
import {
  formatReservationDate,
  formatReservationTime,
} from "@/lib/mobile/karaoke-format";
import {
  istanbulTimeLabel,
  KARAOKE_PAYMENT_GRACE_MINUTES,
  karaokeEndInstant,
} from "@/lib/mobile/karaoke-time";
import { formatTRYMinor } from "@/lib/utils/commerce";

import {
  firstParam,
  pageCount,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
  type SortState,
} from "./list-params";
import type { AdminTone } from "./tone";

/** The list's path; the booking's page is `${KARAOKE_PANEL_PATH}/${id}`. */
export const KARAOKE_PANEL_PATH = "/admin/mobil/karaoke";

export function karaokeDetailHref(id: string): string {
  return `${KARAOKE_PANEL_PATH}/${encodeURIComponent(id)}`;
}

// ─── Money and status ──────────────────────────────────────────────────────

const PAYMENT_STATES: readonly KaraokePaymentStatus[] = [
  "none",
  "pending",
  "paid",
  "refunding",
  "refunded",
  "expired",
];

/**
 * The row's payment state; an older row without the column reads `none`.
 * The same rule as karaoke-core's `paymentStatusOf`, repeated so this module
 * does not pull Zod into a client bundle (tests hold the two equal).
 */
export function moneyOf(
  r: Pick<KaraokeReservation, "paymentStatus">,
): KaraokePaymentStatus {
  const s = r.paymentStatus;
  return s && PAYMENT_STATES.includes(s) ? s : "none";
}

const GRACE_MS = KARAOKE_PAYMENT_GRACE_MINUTES * 60_000;

/**
 * A hold that lapsed unpaid (a checkout nobody finished), as opposed to one
 * the köşk cancelled.
 *
 * Both end as `cancelled` + `expired` and no column says who did it; the
 * audit log does. A panel cancel writes a `transition` row with
 * `by: "staff"` (cancelKaraokeReservation), the sweep and a payment page
 * that never opened write none. `staffReleased` is the ids of such rows
 * (`staffReleasedIds`). The panel used to hide every expired row as
 * "ödenmediği için düşen", so a hold the köşk cancelled vanished.
 */
export function isLapsedHold(
  r: Pick<KaraokeReservation, "id" | "status" | "paymentStatus">,
  staffReleased: ReadonlySet<string> = NO_IDS,
): boolean {
  return (
    r.status === "cancelled" &&
    moneyOf(r) === "expired" &&
    !staffReleased.has(r.id)
  );
}

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * The bookings whose unpaid hold a panel user let go, from their audit rows
 * (any rows: the ones that do not match are skipped).
 */
export function staffReleasedIds(
  audit: ReadonlyArray<
    Pick<KaraokeAuditRow, "entityId" | "action" | "payload">
  >,
): Set<string> {
  const ids = new Set<string>();
  for (const row of audit) {
    const p = row.payload ?? {};
    if (
      row.action === "transition" &&
      row.entityId &&
      p.by === "staff" &&
      p.status === "cancelled" &&
      p.paymentStatus === "expired"
    ) {
      ids.add(row.entityId);
    }
  }
  return ids;
}

/**
 * What the panel says goes back to the card when a paid booking is
 * cancelled or refunded: everything that was collected. The köşk's
 * cancellation always refunds in full (MSY m.16/4) and PayNkolay refunds
 * whole payments only; a refund policy set in the panel changes this one
 * place.
 */
export function refundAmountMinor(
  r: Pick<KaraokeReservation, "paidMinor" | "totalMinor">,
): number {
  return r.paidMinor && r.paidMinor > 0 ? r.paidMinor : r.totalMinor;
}

export const KARAOKE_STATUS_TEXT: Record<KaraokeReservationStatus, string> = {
  requested: "Talep",
  confirmed: "Onaylandı",
  cancelled: "İptal",
};

export const KARAOKE_STATUS_TONE: Record<KaraokeReservationStatus, AdminTone> =
  {
    requested: "warning",
    confirmed: "success",
    cancelled: "neutral",
  };

export const KARAOKE_PAYMENT_TONE: Record<KaraokePaymentStatus, AdminTone> = {
  none: "neutral",
  pending: "warning",
  paid: "success",
  refunding: "danger",
  refunded: "info",
  expired: "neutral",
};

/**
 * The payment badge's text; a pending hold says until when, and a released
 * hold whether it lapsed (`lapsed`) or the köşk let it go.
 */
export function paymentLabel(
  r: Pick<KaraokeReservation, "paymentStatus" | "paymentDueAt">,
  lapsed = true,
): string {
  const money = moneyOf(r);
  switch (money) {
    case "none":
      return "Mekânda ödeme";
    case "pending": {
      const until = istanbulTimeLabel(r.paymentDueAt ?? "");
      return until ? `Ödeme bekleniyor · son ${until}` : "Ödeme bekleniyor";
    }
    case "paid":
      return "Ödendi";
    case "refunding":
      return "İade sonucu bekleniyor";
    case "refunded":
      return "İade edildi";
    case "expired":
      return lapsed ? "Ödenmedi, süresi doldu" : "Ödeme alınmamıştı";
  }
}

export const KARAOKE_CHANNEL_LABELS: Record<string, string> = {
  web: "Web",
  app: "Uygulama",
};

export function channelLabel(channel: string | undefined): string {
  return KARAOKE_CHANNEL_LABELS[channel ?? ""] ?? "Bilinmiyor";
}

/**
 * The POS reference with its middle hidden: enough to match a line in
 * PayNkolay's panel (with the date and amount), not a value to copy around.
 */
export function maskPaymentRef(ref: string | undefined): string {
  const v = (ref ?? "").trim();
  if (v.length <= 4) return v;
  if (v.length <= 8) return `…${v.slice(-4)}`;
  return `${v.slice(0, 2)}…${v.slice(-4)}`;
}

// ─── What needs a person ───────────────────────────────────────────────────

export type KaraokeAttention =
  /** Cancelled, and the köşk still holds the money. */
  | "refund_owed"
  /** A refund was sent and its answer never came. */
  | "refund_pending"
  /** Paid, but another confirmed booking holds the hour: never confirmed. */
  | "slot_lost"
  /** Paid, the hour is free, and the confirmation did not finish. */
  | "confirm_pending"
  /** Paid, never confirmed, and the evening is over: the money is still in. */
  | "paid_unconfirmed_past"
  /** A pay-at-the-venue request from before prepayment, while it is on. */
  | "venue_request"
  /** Prepayment off: a request waiting for Onayla. */
  | "awaiting_confirm"
  /** An unpaid hold past its page and grace, not yet swept. */
  | "hold_overdue";

export const KARAOKE_ATTENTION: Record<
  KaraokeAttention,
  { title: string; text: string; tone: AdminTone }
> = {
  refund_owed: {
    title: "İade borcu",
    text: "Rezervasyon iptal edildi ama ödeme hâlâ köşkte. İadeyi başlat; PayNkolay panelinden zaten iade ettiysen öyle işaretle.",
    tone: "danger",
  },
  refund_pending: {
    title: "İade sonucu bekleniyor",
    text: "İade POS'a gönderildi ama yanıt gelmedi. PayNkolay panelinde iadeyi görüyorsan \"İade POS'ta görüldü\" ile kaydet, görmüyorsan yeniden dene.",
    tone: "danger",
  },
  slot_lost: {
    title: "Ödendi, saat başkasında",
    text: "Ödeme geldi ama bu saat bu arada başka bir onaylı rezervasyona geçti, o yüzden onaylanamadı. İptal et: tutar karta iade edilir ve müşteriye e-posta gider.",
    tone: "danger",
  },
  confirm_pending: {
    title: "Ödendi, onay yarım kaldı",
    text: "Ödeme alındı ama onay tamamlanmadı. Saat boş: onaylayabilirsin.",
    tone: "warning",
  },
  paid_unconfirmed_past: {
    title: "Ödendi, onaylanmadan geçti",
    text: "Ödeme alındı ama rezervasyon hiç onaylanmadı ve saati geçti. Müşteri gelmediyse iptal et: tutar karta iade edilir.",
    tone: "danger",
  },
  venue_request: {
    title: "Eski mekânda ödeme talebi",
    text: "Bu talep ön ödeme açılmadan önce köşkte ödenecek diye alınmış. Ödemesi alınmamış rezervasyon onaylanmaz: müşteriyi arayıp online rezervasyon yapmasını iste, bu talebi iptal et.",
    tone: "warning",
  },
  awaiting_confirm: {
    title: "Onay bekliyor",
    text: "Ön ödeme kapalı, müşteri köşkte öder. Onayla ya da iptal et.",
    tone: "info",
  },
  hold_overdue: {
    title: "Ödeme süresi doldu",
    text: "Ödeme sayfası kapandı ve ödeme gelmedi. Sistem POS'a sorup saati kendisi bırakır; beklemeden bırakmak için iptal et.",
    tone: "warning",
  },
};

export interface KaraokePanelContext {
  /** Today on the köşk's calendar (YYYY-MM-DD). */
  today: string;
  now: Date;
  /** `settings.karaokePrepay`. */
  prepay: boolean;
  /** `canAccess("refunds", role)`: may send money back. */
  canRefund: boolean;
  /** Holds a panel user let go (`staffReleasedIds`); others lapsed. */
  staffReleased?: ReadonlySet<string>;
}

type Slot = Pick<
  KaraokeReservation,
  "id" | "date" | "startHour" | "hours" | "status"
>;

/** Another confirmed booking on the same day overlaps this one. */
export function hourTakenByOther(r: Slot, sameDay: readonly Slot[]): boolean {
  const end = r.startHour + r.hours;
  return sameDay.some(
    (o) =>
      o.id !== r.id &&
      o.date === r.date &&
      o.status === "confirmed" &&
      r.startHour < o.startHour + o.hours &&
      o.startHour < end,
  );
}

export function karaokeAttention(
  r: KaraokeReservation,
  ctx: Pick<KaraokePanelContext, "now" | "prepay">,
  sameDay: readonly Slot[] = [],
): KaraokeAttention[] {
  const money = moneyOf(r);
  const ended = karaokeEndInstant(r).getTime() <= ctx.now.getTime();
  const out: KaraokeAttention[] = [];
  if (money === "refunding") out.push("refund_pending");
  if (money === "paid" && r.status === "cancelled") out.push("refund_owed");
  if (money === "paid" && r.status === "requested") {
    out.push(
      ended
        ? "paid_unconfirmed_past"
        : hourTakenByOther(r, sameDay)
          ? "slot_lost"
          : "confirm_pending",
    );
  }
  if (!ended && r.status === "requested" && money === "none") {
    out.push(ctx.prepay ? "venue_request" : "awaiting_confirm");
  }
  if (
    !ended &&
    money === "pending" &&
    Date.parse(r.paymentDueAt ?? "") + GRACE_MS < ctx.now.getTime()
  ) {
    out.push("hold_overdue");
  }
  return out;
}

// ─── Which buttons ─────────────────────────────────────────────────────────

export const REFUND_PERMISSION_REASON =
  "İade yetkisi gerekiyor: sahip ya da yönetici yapar.";

export interface KaraokeActionPlan {
  /** Onayla; `disabledReason` when it is shown but cannot work. */
  confirm: { disabledReason?: string } | null;
  /**
   * İptal. `refund`: paid, so the money goes back first (needs refunds);
   * `hold`: an unpaid hold, the POS is asked first; `plain`: pay at venue.
   */
  cancel: { kind: "refund" | "hold" | "plain"; disabledReason?: string } | null;
  /** `first`: a cancelled booking still paid; `retry`: an unanswered refund. */
  refund: { kind: "first" | "retry"; disabledReason?: string } | null;
  /** Record a refund someone saw (or did) in PayNkolay's panel. */
  settle: {
    kind: "after_cancel" | "pending_answer";
    disabledReason?: string;
  } | null;
}

/**
 * The actions a booking offers. Mirrors the server: `setReservationStatus`
 * confirms only a paid booking, or a pay-at-the-venue one while prepayment is
 * off; `cancelKaraokeReservation` refunds a paid one and asks the POS about
 * an unpaid hold; `retryKaraokeRefund` / `settleKaraokeRefundByHand` take a
 * `refunding` row or a cancelled one that is still `paid`.
 */
export function karaokeActionPlan(
  r: KaraokeReservation,
  ctx: Pick<KaraokePanelContext, "now" | "prepay" | "canRefund">,
  sameDay: readonly Slot[] = [],
): KaraokeActionPlan {
  const money = moneyOf(r);
  const ended = karaokeEndInstant(r).getTime() <= ctx.now.getTime();
  const noRefund = ctx.canRefund
    ? {}
    : { disabledReason: REFUND_PERMISSION_REASON };

  let confirm: KaraokeActionPlan["confirm"] = null;
  if (r.status === "requested" && !ended) {
    if (money === "paid") {
      confirm = hourTakenByOther(r, sameDay)
        ? { disabledReason: "Bu saat başka bir onaylı rezervasyonda." }
        : {};
    } else if (money === "none" && !ctx.prepay) {
      confirm = {};
    }
  }

  let cancel: KaraokeActionPlan["cancel"] = null;
  if (r.status !== "cancelled") {
    if (money === "paid") cancel = { kind: "refund", ...noRefund };
    else if (money === "pending") cancel = { kind: "hold" };
    else if (money === "none") cancel = { kind: "plain" };
  }

  const heldAfterCancel = money === "paid" && r.status === "cancelled";
  const refund: KaraokeActionPlan["refund"] =
    money === "refunding"
      ? { kind: "retry", ...noRefund }
      : heldAfterCancel
        ? { kind: "first", ...noRefund }
        : null;
  const settle: KaraokeActionPlan["settle"] =
    money === "refunding"
      ? { kind: "pending_answer", ...noRefund }
      : heldAfterCancel
        ? { kind: "after_cancel", ...noRefund }
        : null;

  return { confirm, cancel, refund, settle };
}

// ─── One row, read once ────────────────────────────────────────────────────

export interface KaraokeRowView {
  r: KaraokeReservation;
  money: KaraokePaymentStatus;
  /** Not cancelled: still holds its hour. */
  live: boolean;
  lapsed: boolean;
  /** "20:00 - 22:00". */
  time: string;
  /** "17 Ekim 2026". */
  day: string;
  statusLabel: string;
  statusTone: AdminTone;
  paymentLabel: string;
  paymentTone: AdminTone;
  /** Cancelled or refunding with the money not back yet. */
  refundOwed: boolean;
  attention: KaraokeAttention[];
  plan: KaraokeActionPlan;
}

export function karaokeRowView(
  r: KaraokeReservation,
  ctx: KaraokePanelContext,
  sameDay: readonly Slot[] = [],
): KaraokeRowView {
  const money = moneyOf(r);
  const attention = karaokeAttention(r, ctx, sameDay);
  const lapsed = isLapsedHold(r, ctx.staffReleased);
  return {
    r,
    money,
    live: r.status !== "cancelled",
    lapsed,
    time: formatReservationTime(r.startHour, r.hours),
    day: formatReservationDate(r.date),
    statusLabel: KARAOKE_STATUS_TEXT[r.status] ?? r.status,
    statusTone: KARAOKE_STATUS_TONE[r.status] ?? "neutral",
    paymentLabel: paymentLabel(r, lapsed),
    paymentTone: KARAOKE_PAYMENT_TONE[money],
    refundOwed:
      attention.includes("refund_owed") || attention.includes("refund_pending"),
    attention,
    plan: karaokeActionPlan(r, ctx, sameDay),
  };
}

/** Views for a list, each row checked against the other rows of its day. */
export function karaokeRowViews(
  rows: readonly KaraokeReservation[],
  ctx: KaraokePanelContext,
): KaraokeRowView[] {
  const byDate = new Map<string, KaraokeReservation[]>();
  for (const r of rows) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }
  return rows.map((r) => karaokeRowView(r, ctx, byDate.get(r.date) ?? []));
}

// ─── Tabs, filters, search, sort ───────────────────────────────────────────

export type KaraokeTab = "bugun" | "yaklasan" | "gecmis" | "iptal" | "dikkat";

/** The URL param of the tabs; Bugün is the tab without it. */
export const KARAOKE_TAB_PARAM = "sekme";

export const KARAOKE_TABS: ReadonlyArray<{
  tab: KaraokeTab;
  /** `null` for the default tab (param removed). */
  value: string | null;
  label: string;
}> = [
  { tab: "bugun", value: null, label: "Bugün" },
  { tab: "yaklasan", value: "yaklasan", label: "Yaklaşan" },
  { tab: "gecmis", value: "gecmis", label: "Geçmiş" },
  { tab: "iptal", value: "iptal", label: "İptal / İade" },
  { tab: "dikkat", value: "dikkat", label: "Dikkat" },
];

export function parseKaraokeTab(sp: SearchParamsInput): KaraokeTab {
  const raw = firstParam(sp, KARAOKE_TAB_PARAM) ?? "";
  return KARAOKE_TABS.find((t) => t.value === raw)?.tab ?? "bugun";
}

/**
 * Which rows a tab holds. Bugün, Yaklaşan and Geçmiş are the bookings that
 * stand, by day; İptal / İade is every cancelled one and every refund, any
 * day; Dikkat is whatever waits for a person, any day and any tab.
 */
export function inKaraokeTab(
  v: KaraokeRowView,
  tab: KaraokeTab,
  today: string,
): boolean {
  switch (tab) {
    case "bugun":
      return v.live && v.r.date === today;
    case "yaklasan":
      return v.live && v.r.date > today;
    case "gecmis":
      return v.live && v.r.date < today;
    case "iptal":
      return !v.live || v.money === "refunding" || v.money === "refunded";
    case "dikkat":
      return v.attention.length > 0;
  }
}

/** `odeme` filter values beside the payment states. */
export const KARAOKE_OWED_FILTER = "borc";

export const KARAOKE_FILTER_FIELDS: readonly FilterField[] = [
  {
    type: "search",
    name: "q",
    label: "Ara",
    placeholder: "Ad, telefon, e-posta ya da kod",
  },
  { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
  {
    type: "select",
    name: "odeme",
    label: "Ödeme",
    options: [
      { value: "paid", label: "Ödendi" },
      { value: "pending", label: "Ödeme bekleniyor" },
      { value: "none", label: "Mekânda ödeme" },
      { value: KARAOKE_OWED_FILTER, label: "İade borcu" },
      { value: "refunding", label: "İade sonucu bekleniyor" },
      { value: "refunded", label: "İade edildi" },
      { value: "expired", label: "Ödenmedi (süresi doldu)" },
    ],
  },
];

const TR_FOLD: Record<string, string> = {
  ı: "i",
  ş: "s",
  ç: "c",
  ğ: "g",
  ö: "o",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/**
 * Lower case the Turkish way, then without the Turkish letters: "IŞIK",
 * "ışık" and "isik" all find "Işık", and "ILKAY@" finds "ilkay@…".
 */
function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[ışçğöüâîû]/g, (c) => TR_FOLD[c] ?? c);
}

/** "0532 123", "+90 532…", "532…" all compare as the national number. */
function phoneDigits(s: string): string {
  return s.replace(/\D/g, "").replace(/^(?:90|0)/, "");
}

/** krk-00042, KRK-42, krk42, or plain 42: the booking number. */
function codeNumber(s: string): number | null {
  const m = /^(?:krk-?)?0*(\d{1,12})$/i.exec(s.trim());
  return m ? Number(m[1]) : null;
}

/**
 * The search box: name, either e-mail (account or form), phone (any
 * spelling), or the booking code. Case-insensitive the Turkish way.
 */
export function matchesKaraokeSearch(
  r: Pick<
    KaraokeReservation,
    "id" | "customerName" | "customerEmail" | "contactEmail" | "contactPhone"
  >,
  query: string,
): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const texts = [r.customerName, r.customerEmail, r.contactEmail ?? "", r.id];
  if (texts.some((t) => fold(t ?? "").includes(q))) return true;
  const wanted = codeNumber(q);
  const own = codeNumber(r.id);
  if (wanted !== null && own !== null && wanted === own) return true;
  const digits = phoneDigits(q);
  if (digits.length >= 3 && /^[\d\s()+-]+$/.test(q)) {
    return phoneDigits(r.contactPhone ?? "").includes(digits);
  }
  return false;
}

export function matchesKaraokeFilters(
  v: KaraokeRowView,
  filters: FilterValues,
): boolean {
  if (filters.q && !matchesKaraokeSearch(v.r, filters.q)) return false;
  if (filters.bas && v.r.date < filters.bas) return false;
  if (filters.bit && v.r.date > filters.bit) return false;
  const pay = filters.odeme;
  if (pay) {
    if (pay === KARAOKE_OWED_FILTER) {
      if (!v.refundOwed) return false;
    } else if (v.money !== pay) {
      return false;
    }
  }
  // A lapsed hold was a checkout nobody finished, not a booking: it shows
  // only when asked for by name.
  if (v.lapsed && pay !== "expired") return false;
  return true;
}

export const KARAOKE_SORT_KEYS = ["tarih", "tutar", "olusturma"] as const;

/** Each tab's own order when the URL names none. */
export function defaultKaraokeSort(tab: KaraokeTab): SortState {
  return tab === "gecmis" || tab === "iptal"
    ? { key: "tarih", dir: "desc" }
    : { key: "tarih", dir: "asc" };
}

function compareRows(a: KaraokeRowView, b: KaraokeRowView, sort: SortState) {
  let d = 0;
  if (sort.key === "tutar") d = a.r.totalMinor - b.r.totalMinor;
  else if (sort.key === "olusturma")
    d = a.r.createdAt.localeCompare(b.r.createdAt);
  if (d === 0) {
    d = a.r.date.localeCompare(b.r.date) || a.r.startHour - b.r.startHour;
  }
  if (d === 0) d = a.r.id.localeCompare(b.r.id);
  return sort.dir === "asc" ? d : -d;
}

export const KARAOKE_PAGE_SIZE = 50;

export interface KaraokeListResult {
  rows: KaraokeRowView[];
  /** The page shown (a page past the end shows the last one). */
  page: number;
  /** Rows in the current tab with the filters applied. */
  total: number;
  counts: Record<KaraokeTab, number>;
  /** Lapsed holds left out (filters applied); shown with odeme=expired. */
  hiddenLapsed: number;
}

export function karaokeList(
  views: readonly KaraokeRowView[],
  opts: {
    tab: KaraokeTab;
    filters: FilterValues;
    sort: SortState;
    page: number;
    pageSize?: number;
    today: string;
  },
): KaraokeListResult {
  const size = opts.pageSize ?? KARAOKE_PAGE_SIZE;
  const counts: Record<KaraokeTab, number> = {
    bugun: 0,
    yaklasan: 0,
    gecmis: 0,
    iptal: 0,
    dikkat: 0,
  };
  const shown: KaraokeRowView[] = [];
  let hiddenLapsed = 0;
  for (const v of views) {
    if (!matchesKaraokeFilters(v, opts.filters)) {
      if (
        v.lapsed &&
        matchesKaraokeFilters(v, { ...opts.filters, odeme: "expired" })
      ) {
        hiddenLapsed += 1;
      }
      continue;
    }
    for (const t of KARAOKE_TABS) {
      if (inKaraokeTab(v, t.tab, opts.today)) counts[t.tab] += 1;
    }
    if (inKaraokeTab(v, opts.tab, opts.today)) shown.push(v);
  }
  shown.sort((a, b) => compareRows(a, b, opts.sort));
  const pages = pageCount(shown.length, size);
  const page = Math.min(Math.max(1, opts.page), pages);
  return {
    rows: shown.slice((page - 1) * size, page * size),
    page,
    total: shown.length,
    counts,
    hiddenLapsed,
  };
}

// ─── History ───────────────────────────────────────────────────────────────

/** An audit row as the history needs it (lib/admin/audit.ts AdminAuditLog). */
export interface KaraokeAuditRow {
  id: string;
  /** The booking's id (`krk-00042`). */
  entityId?: string;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface KaraokeHistoryItem {
  id: string;
  at: string;
  title: string;
  description?: string;
  actor?: string;
  tone?: AdminTone;
}

const ACTOR_LABELS: Record<string, string> = {
  system: "Sistem",
  customer: "Üye",
  "guest-link": "Misafir (e-postadaki bağlantı)",
  "account-closure": "Hesap kapatma",
  anonymous: "Bilinmiyor",
};

export function auditActorLabel(actor: string): string {
  return ACTOR_LABELS[actor] ?? actor;
}

/** Money events the system writes (`alertMoney`), in plain words. */
const EVENT_TITLES: Record<string, string> = {
  payment_amount_mismatch: "Tahsilat tutarı rezervasyonla uyuşmadı",
  late_payment_refunded: "Geç gelen ödeme otomatik iade edildi",
  late_payment_refund_refused: "Geç gelen ödemenin iadesi reddedildi",
  late_payment_refund_unknown: "Geç gelen ödemenin iade sonucu belirsiz",
  second_charge_refunded: "İkinci tahsilat otomatik iade edildi",
  second_charge_refund_refused: "İkinci tahsilatın iadesi reddedildi",
  second_charge_refund_unknown: "İkinci tahsilatın iade sonucu belirsiz",
  cancel_refund_refused: "İptalde iade reddedildi",
  cancel_refund_unknown: "İptalde iade sonucu belirsiz",
  hold_released_payment_unknown:
    "Ödemesi doğrulanamayan rezervasyon serbest bırakıldı",
  refund_without_payment_row: "İade edilecek ödeme kaydı bulunamadı",
  account_closed_late_paid_booking:
    "Hesap kapandı, 2 saatten az kalan ödenmiş rezervasyon duruyor",
  account_closed_payment_unknown:
    "Hesap kapandı, ödeme durumu sorulamadan saat bırakıldı",
};

const RETRY_OUTCOME: Record<string, { title: string; tone: AdminTone }> = {
  refunded: { title: "İade yeniden denendi: yapıldı", tone: "info" },
  refused: { title: "İade yeniden denendi: POS reddetti", tone: "danger" },
  unknown: { title: "İade yeniden denendi: sonuç belirsiz", tone: "warning" },
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function auditEntry(row: KaraokeAuditRow): KaraokeHistoryItem {
  const p = row.payload ?? {};
  const event = str(p.event);
  const reason = str(p.reason);
  const amount =
    typeof p.amountMinor === "number" && p.amountMinor > 0
      ? formatTRYMinor(p.amountMinor)
      : "";
  let title: string;
  let tone: AdminTone = "neutral";
  if (event === "refund_retry") {
    const o = RETRY_OUTCOME[str(p.outcome)] ?? RETRY_OUTCOME.unknown;
    title = o.title;
    tone = o.tone;
  } else if (event === "refund_settled_by_hand") {
    title = "İade elle kaydedildi (PayNkolay panelinde görüldü)";
    tone = "info";
  } else if (event) {
    title = EVENT_TITLES[event] ?? event;
    tone = /refused|unknown|mismatch|without/.test(event)
      ? "danger"
      : "warning";
  } else if (row.action === "refund") {
    title = "İptal edildi, ödeme karta iade edildi";
    tone = "info";
  } else if (p.status === "confirmed") {
    title = "Onaylandı";
    tone = "success";
  } else if (p.status === "cancelled") {
    title =
      p.paymentStatus === "expired"
        ? "İptal edildi (ödeme alınmamıştı)"
        : "İptal edildi";
  } else {
    title = row.action;
  }
  const parts = [
    amount,
    reason ? `Neden: ${reason}` : "",
    str(p.message),
  ].filter(Boolean);
  return {
    id: row.id,
    at: row.createdAt,
    title,
    description: parts.length ? parts.join(" · ") : undefined,
    actor: auditActorLabel(row.actor),
    tone,
  };
}

/**
 * The booking's history: the moments its own columns stamp (made, paid,
 * refunded) and every audit row about it. Unsorted; the Timeline sorts.
 */
export function karaokeHistory(
  r: KaraokeReservation,
  audit: readonly KaraokeAuditRow[],
): KaraokeHistoryItem[] {
  const items: KaraokeHistoryItem[] = [
    {
      id: "row-created",
      at: r.createdAt,
      title: "Rezervasyon alındı",
      description: `${channelLabel(r.channel)}${r.guest ? ", üyeliksiz" : ""}`,
    },
  ];
  if (r.paidAt) {
    items.push({
      id: "row-paid",
      at: r.paidAt,
      title: "Ödeme alındı",
      description: formatTRYMinor(r.paidMinor ?? r.totalMinor),
      tone: "success",
    });
  }
  if (r.refundedAt) {
    items.push({
      id: "row-refunded",
      at: r.refundedAt,
      title: "Ödeme iade edildi",
      description: formatTRYMinor(r.paidMinor ?? r.totalMinor),
      tone: "info",
    });
  }
  for (const row of audit) items.push(auditEntry(row));
  return items;
}
