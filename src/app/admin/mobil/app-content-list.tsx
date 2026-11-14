import { ActionButton } from "@/components/admin/action-form";
import { formatDateTime } from "@/components/admin/forms";
import { MoveButtons } from "@/components/admin/move-buttons";
import { Badge, type ModalAction, type StatusTab } from "@/components/admin/ui";
import Link from "@/components/link";
import {
  APP_PUBLISH_STATUS_LABELS,
  APP_PUBLISH_STATUS_TONES,
  APP_PUBLISH_STATUSES,
  appPublishStatus,
  type AppPublishStatus,
} from "@/lib/admin/app-content-schema";
import { parsePublishInstant } from "@/lib/admin/publish-window";

// What the slide, announcement and post lists share. Server-safe (no hooks):
// the list pages render on the server.

type Windowed = { isActive: boolean; startsAt: string; endsAt: string };

/**
 * What the delete dialogs say, on the list and in the edit page's header.
 * Not "hemen": phones read the home content through a shared cache
 * (`/api/mobile/v1/app-content`, s-maxage=60 plus stale-while-revalidate),
 * so a deleted card takes a few minutes to leave every phone.
 */
export const DELETE_TEXT = {
  slide:
    "Slayt kalıcı olarak silinir; uygulamanın ana sayfasından birkaç dakika içinde kalkar. Bir süreliğine kaldırmak için listedeki “Yayından kaldır”ı kullan.",
  announcement:
    "Duyuru kalıcı olarak silinir; uygulamadan birkaç dakika içinde kalkar. Bir süreliğine kaldırmak için listedeki “Yayından kaldır”ı kullan.",
  post: "Gönderi kalıcı olarak silinir; uygulamadan birkaç dakika içinde kalkar. Gönderilmiş e-posta geri alınmaz.",
} as const;

/**
 * The row's "Yayından kaldır" / "Yayına al" in its ⋯ menu: one click that
 * posts the state asked for (`active`), answered with a toast.
 */
export function PublishToggle({
  action,
  id,
  isActive,
  label,
}: {
  action: ModalAction;
  id: string;
  isActive: boolean;
  /** The row's title, for the screen reader's name. */
  label: string;
}) {
  const text = isActive ? "Yayından kaldır" : "Yayına al";
  return (
    <ActionButton
      action={action}
      hidden={{ id, active: isActive ? "0" : "1" }}
      variant="menu"
      ariaLabel={`${text}: ${label}`}
    >
      {text}
    </ActionButton>
  );
}

/**
 * The "Sıra" cell: ↑ / ↓ on the unfiltered list, the stored number on a
 * filtered one. A move swaps the row with its neighbour in the app's order,
 * and a filtered list may not show that neighbour.
 */
export function OrderCell<T extends { id: string; sortOrder: number }>({
  action,
  row,
  all,
  filtered,
  label,
}: {
  action: ModalAction;
  row: T;
  /** Every row, in the app's order. */
  all: readonly T[];
  filtered: boolean;
  label: string;
}) {
  if (filtered) return <span>{row.sortOrder}</span>;
  return (
    <MoveButtons
      action={action}
      id={row.id}
      index={all.indexOf(row)}
      count={all.length}
      label={label}
    />
  );
}

/** `?durum=` on the three lists: one publish state, or every row. */
export const PUBLISH_STATUS_PARAM = "durum";

/** `?durum=` to a state; anything else is "Tümü" (null). */
export function parsePublishFilter(raw: unknown): AppPublishStatus | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" &&
    (APP_PUBLISH_STATUSES as readonly string[]).includes(value)
    ? (value as AppPublishStatus)
    : null;
}

/**
 * The tabs over a list: Tümü and each state with its count. A state no row
 * is in is left out, except the one the address asks for (so a link to an
 * emptied tab still shows where the operator is).
 */
export function publishTabs(
  rows: readonly Windowed[],
  now: number,
  current: AppPublishStatus | null,
): StatusTab[] {
  const counts = new Map<AppPublishStatus, number>();
  for (const row of rows) {
    const st = appPublishStatus(row, now);
    counts.set(st, (counts.get(st) ?? 0) + 1);
  }
  return [
    { value: null, label: "Tümü", count: rows.length },
    ...APP_PUBLISH_STATUSES.filter(
      (st) => (counts.get(st) ?? 0) > 0 || st === current,
    ).map((st) => ({
      value: st,
      label: APP_PUBLISH_STATUS_LABELS[st],
      count: counts.get(st) ?? 0,
    })),
  ];
}

/**
 * One bound of a publish window as the panel reads it: the Istanbul wall
 * clock, or the stored text as it is when it is not a time.
 * `formatDateTime` throws on text that is not a time, and
 * `normalizePublishInstant` stores such text as typed, so calling it
 * blindly would have taken the whole list down for one bad row.
 */
function bound(value: string): { text: string; valid: boolean } {
  if (!value.trim()) return { text: "", valid: true };
  if (parsePublishInstant(value) === null) return { text: value, valid: false };
  return { text: formatDateTime(value), valid: true };
}

/**
 * The row's state as a badge, with its window under it in Istanbul time.
 * The list used to print the stored UTC text ("2026-10-17T06:00:00.000Z")
 * and only "YAYINDA DEĞİL" for an inactive row.
 */
export function PublishCell({ row, now }: { row: Windowed; now: number }) {
  const status = appPublishStatus(row, now);
  const from = bound(row.startsAt);
  const to = bound(row.endsAt);
  const line = "text-xs whitespace-nowrap text-[var(--admin-text-soft)]";
  return (
    <span className="grid justify-items-start gap-1">
      <Badge tone={APP_PUBLISH_STATUS_TONES[status]} dot>
        {APP_PUBLISH_STATUS_LABELS[status]}
      </Badge>
      {row.startsAt.trim() ? (
        <span className={line}>Başlangıç {from.text}</span>
      ) : null}
      {row.endsAt.trim() ? <span className={line}>Bitiş {to.text}</span> : null}
      {/* An inactive row reads "Kapalı"; a bad bound still needs saying. */}
      {status !== "invalid" && !(from.valid && to.valid) ? (
        <Badge tone="danger">geçersiz tarih</Badge>
      ) : null}
    </span>
  );
}

/** "← Slaytlar" above a new or edit page. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline pointer-fine:min-h-9"
    >
      ← {label}
    </Link>
  );
}
