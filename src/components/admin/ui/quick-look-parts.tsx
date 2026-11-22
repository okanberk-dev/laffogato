import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";
import { foldChips } from "@/lib/admin/quick-look-core";

import { HUE_TILE, type AdminHue } from "./hues";
import { AdminIcon, type AdminIconName } from "./icons";
import { EYEBROW, NUMERIC_STYLE } from "./styles";

// The pieces of a quick look's body (ui/quick-look.tsx draws the drawer),
// after Innex's right drawer (innex-15): the photo, the record's two states
// side by side, its chips with "Tümünü göster", the ACTIONS list (grey
// well, white rows, a coloured icon tile, a title, a line and `›`) and the
// RECENT ACTIVITY list. Server-safe: a page draws them with its data.

/** The record's photo, or a grey tile with its section's icon. */
export function QuickLookPhoto({
  src,
  fallback,
}: {
  /** A served image URL, or "" for none. */
  src: string;
  fallback: AdminIconName;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="aspect-[16/10] w-full rounded-xl object-cover ring-1 ring-[var(--admin-border)]"
      />
    );
  }
  // No photo: a low tile, not a photo-sized hole above everything else.
  return (
    <div className="flex h-24 w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-surface-2)] text-sm text-[var(--admin-text-mute)] ring-1 ring-[var(--admin-border)]">
      <AdminIcon name={fallback} size={22} strokeWidth={1.5} />
      Görsel yok
    </div>
  );
}

/** One of the record's states: a name, and what it is now. */
export interface QuickLookState {
  label: string;
  value: ReactNode;
  /** A line under the value ("Eşik 5"). */
  hint?: ReactNode;
}

/**
 * Innex's room card shows two states at once (clean / occupied); a product
 * has "Satış durumu" and "Stok durumu" the same way, side by side.
 */
export function QuickLookStates({
  items,
}: {
  items: readonly QuickLookState[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-border)]">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-col gap-1 bg-[var(--admin-surface)] px-3.5 py-3"
        >
          <dt className="text-xs text-[var(--admin-text-soft)]">
            {item.label}
          </dt>
          <dd className="min-w-0 text-sm font-medium text-[var(--admin-text)]">
            {item.value}
          </dd>
          {item.hint ? (
            <dd className="text-xs text-[var(--admin-text-soft)]">
              {item.hint}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** A titled part of the body: "İşlemler", "Son hareketler". */
export function QuickLookSection({
  title,
  action,
  children,
}: {
  title: string;
  /** Right of the title: "Tümü ›". */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={EYEBROW}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Chips with Innex's "Show all 8": the first few, the rest behind
 * "Tümünü göster (n)" (a native disclosure: no script, a screen reader
 * hears it expand).
 */
export function QuickLookChips({
  chips,
  limit = 4,
}: {
  chips: ReadonlyArray<{ key: string; chip: ReactNode }>;
  limit?: number;
}) {
  const { shown, folded } = foldChips(chips, limit);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((c) => (
        <span key={c.key} className="contents">
          {c.chip}
        </span>
      ))}
      {folded.length > 0 ? (
        // `contents` down to the slot, so the folded chips wrap in the same
        // line as the others; each hides itself while the disclosure is
        // shut (a slot with no box of its own hides nothing).
        // Open, the control stays (at the row's end) and says how to fold
        // them back: hiding the focused summary dropped the keyboard on
        // the page (review of #231).
        <details className="group contents details-content:contents">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-md px-1.5 text-xs font-medium text-[var(--admin-primary)] select-none group-open:order-last hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">
              Tümünü göster ({shown.length + folded.length})
            </span>
            <span className="hidden group-open:inline">Daha az göster</span>
          </summary>
          {folded.map((c) => (
            <span key={c.key} className="hidden group-open:contents">
              {c.chip}
            </span>
          ))}
        </details>
      ) : null}
    </div>
  );
}

/** Innex's action list: a grey well, a white row per step. */
export function QuickLookActions({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-col gap-1.5 rounded-xl bg-[var(--admin-panel)] p-1.5">
      {children}
    </ul>
  );
}

/**
 * A row of the action list, a link or a button alike: the white row, its
 * hover and its focus ring. A button is ActionButton's `bare` look.
 */
export const QUICK_LOOK_ACTION_ROW =
  "flex min-h-14 w-full items-center gap-3 rounded-lg bg-[var(--admin-surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--admin-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/** What a row says: the coloured tile, the step, a line and `›`. */
export function QuickLookActionBody({
  icon,
  hue,
  title,
  description,
  external = false,
  disclosure = false,
}: {
  icon: AdminIconName;
  hue: AdminHue;
  title: ReactNode;
  description?: ReactNode;
  /** Opens a new tab: the `›` is the external-link glyph. */
  external?: boolean;
  /** A `<summary>`'s row: the `›` turns down while its form is open. */
  disclosure?: boolean;
}) {
  return (
    <>
      <span
        className={cx(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          HUE_TILE[hue],
        )}
        aria-hidden="true"
      >
        <AdminIcon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--admin-text)]">
          {title}
        </span>
        {description ? (
          <span className="block text-xs text-[var(--admin-text-soft)]">
            {description}
          </span>
        ) : null}
      </span>
      <AdminIcon
        name={external ? "external" : "chevronRight"}
        size={16}
        className={cx(
          "text-[var(--admin-text-mute)]",
          disclosure &&
            "transition-transform group-open:rotate-90 motion-reduce:transition-none",
        )}
      />
    </>
  );
}

/** A step that is a page: "Fiyatı değiştir", "Stok hareketleri". */
export function QuickLookActionLink({
  href,
  external = false,
  ...body
}: {
  href: string;
  external?: boolean;
  icon: AdminIconName;
  hue: AdminHue;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <li>
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={QUICK_LOOK_ACTION_ROW}
        >
          <QuickLookActionBody {...body} external />
          <span className="sr-only"> (yeni sekmede açılır)</span>
        </a>
      ) : (
        <Link href={href} className={QUICK_LOOK_ACTION_ROW}>
          <QuickLookActionBody {...body} />
        </Link>
      )}
    </li>
  );
}

/** One line of the activity list. */
export interface QuickLookEvent {
  key: string;
  /** What happened ("Sipariş · −2"). */
  title: ReactNode;
  /** When and who ("3 gün önce · owner@…"). */
  meta: ReactNode;
  /** A figure on the right ("Stok 23"). */
  figure?: ReactNode;
}

/** Innex's RECENT ACTIVITY: newest first, a hairline between. */
export function QuickLookActivity({
  events,
  empty,
}: {
  events: readonly QuickLookEvent[];
  empty: string;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-[var(--admin-text-soft)]">{empty}</p>;
  }
  return (
    <ol className="flex flex-col divide-y divide-[var(--admin-divider)] rounded-xl border border-[var(--admin-card-border)]">
      {events.map((e) => (
        <li key={e.key} className="flex items-start gap-3 px-3.5 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-[var(--admin-text)]">
              {e.title}
            </span>
            <span className="block text-xs text-[var(--admin-text-soft)]">
              {e.meta}
            </span>
          </span>
          {e.figure !== undefined ? (
            <span
              className="shrink-0 text-xs text-[var(--admin-text-soft)]"
              style={NUMERIC_STYLE}
            >
              {e.figure}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
