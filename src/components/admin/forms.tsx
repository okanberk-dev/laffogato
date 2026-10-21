import Link from "next/link";
import { isValidElement, useId, type ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";
import { parsePublishInstant } from "@/lib/admin/publish-window";

import { ActionMenu } from "./ui/action-menu";
import { BUTTON, COMPACT, HEADER_EYEBROW } from "./ui/styles";

// AkmanOS's field label: 13px, sentence case (it was 10px spaced capitals).
const FIELD_LABEL = "text-[13px] font-medium text-[var(--admin-text-soft)]";
const FIELD_LABEL_STYLE = { fontFamily: "var(--mono), monospace" } as const;
const FIELD_HINT = "text-xs text-[var(--admin-text-mute)]";

/**
 * A labelled control with an optional hint.
 *
 * - Default (`as="label"`): one `<label>` around the caption, the control
 *   and the hint, which is how a TextInput or Select inside gets its name.
 * - `as="fieldset"`: a `<fieldset>` and `<legend>`, for a group that holds
 *   a checkbox, a switch or an uploader. Inside a label, a click anywhere
 *   on the caption, the hint or the empty row toggled the checkbox (the
 *   label's first control): "Online mağaza açık" and "Üyelere e-posta"
 *   flipped when someone tapped their explanation. The hint is tied to the
 *   group with aria-describedby instead.
 */
export function Field({
  label,
  hint,
  children,
  as = "label",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  as?: "label" | "fieldset";
}) {
  const hintId = useId();
  if (as === "fieldset") {
    return (
      <fieldset
        className="flex min-w-0 flex-col gap-2"
        aria-describedby={hint ? hintId : undefined}
      >
        <legend className={`mb-2 ${FIELD_LABEL}`} style={FIELD_LABEL_STYLE}>
          {label}
        </legend>
        {children}
        {hint && (
          <span id={hintId} className={FIELD_HINT}>
            {hint}
          </span>
        )}
      </fieldset>
    );
  }
  return (
    <label className="flex flex-col gap-2">
      <span className={FIELD_LABEL} style={FIELD_LABEL_STYLE}>
        {label}
      </span>
      {children}
      {hint && <span className={FIELD_HINT}>{hint}</span>}
    </label>
  );
}

// The panel's field: the outline is --admin-border-field (3:1 against the
// white card and the field's own fill, so an empty field can be found) and
// the placeholder is the full label ink, not a faded one (it was 2.41:1).
export const FIELD_INPUT = `w-full rounded-xl border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-base text-[var(--admin-text)] outline-none transition-[border-color,background-color,box-shadow] placeholder:text-[var(--admin-text-mute)] focus:border-[var(--admin-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--admin-accent)]/25 sm:text-sm ${COMPACT.fieldPy}`;

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${FIELD_INPUT} ${props.className ?? ""}`} />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`${FIELD_INPUT} min-h-[100px] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${FIELD_INPUT} ${props.className ?? ""}`} />
  );
}

export function Checkbox({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cx(
        "flex min-h-[44px] cursor-pointer items-center gap-3 py-2 text-sm text-[var(--admin-text-soft)]",
        COMPACT.minH9,
      )}
    >
      {/* shrink-0: a label that wraps to two lines (the allergen boxes)
          squeezed the 20px box. */}
      <input
        type="checkbox"
        {...rest}
        className="h-5 w-5 shrink-0 rounded-md border-[var(--admin-border-strong)] accent-[var(--admin-primary)]"
      />
      {label}
    </label>
  );
}

export function PrimaryButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white transition-[color,background-color,border-color,transform] hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-colors motion-reduce:active:scale-100 ${COMPACT.minH9} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-4 py-2 text-sm text-[var(--admin-text-soft)] transition-[color,background-color,border-color,transform] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-colors motion-reduce:active:scale-100 ${COMPACT.minH9} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--admin-danger)]/35 bg-[var(--admin-surface)] px-4 py-2 text-sm text-[var(--admin-danger-ink)] transition-[color,background-color,border-color,transform] hover:border-[var(--admin-danger)] hover:bg-[var(--admin-danger)] hover:text-white active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-colors motion-reduce:active:scale-100 ${COMPACT.minH9} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-3xl bg-[var(--admin-panel)] p-4 sm:p-6 print:border print:border-[var(--admin-border-strong)] print:bg-white ${COMPACT.p4} ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

/** A header button: a link drawn by the kit, or an element of the page's own. */
export type PageHeaderAction = { href: string; label: string } | ReactNode;

function isLinkAction(
  value: PageHeaderAction,
): value is { href: string; label: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !isValidElement(value) &&
    typeof (value as { href?: unknown }).href === "string" &&
    typeof (value as { label?: unknown }).label === "string"
  );
}

export interface PageHeaderProps {
  /**
   * A short line above the title. Not the nav group ("Katalog"): the
   * sidebar and the breadcrumbs already say where the page is.
   */
  eyebrow?: string;
  /** The nav label, or the record's name. */
  title: string;
  /** One line, at most 12 words: what the page is for. */
  description?: string;
  /** The old free slot on the right; new pages use primary / secondary / menu. */
  action?: ReactNode;
  /**
   * Rules, caveats and policy text, behind a closed "Nasıl çalışır?"
   * disclosure under the header: there when wanted, not read on every
   * visit. Money caveats stay next to the control they belong to.
   */
  help?: ReactNode;
  /**
   * Record facts (date, SKU, order number) on a record page. Drawn in the
   * eyebrow's place; with `meta` set, `eyebrow` is not drawn.
   */
  meta?: ReactNode;
  /** Status badges on the title's line. */
  badges?: ReactNode;
  /**
   * The one solid button of the screen. `{ href, label }` is drawn as a
   * BUTTON.primary link; an element (a submit, an ActionModal) is drawn
   * as given. Either way it carries `data-admin-new`, which the `n`
   * shortcut clicks (the link itself, or the first link or button inside
   * the element's wrapper).
   */
  primary?: PageHeaderAction;
  /** A quieter action before the primary; a link is drawn as BUTTON.ghost. */
  secondary?: PageHeaderAction;
  /**
   * The "⋯" overflow: ActionMenuLink, ActionMenuButton and the like, for
   * the rare and destructive actions (CSV indir, İçe aktar, Yazdır, Sil).
   */
  menu?: ReactNode;
  /** The overflow's accessible name; default "Diğer işlemler". */
  menuLabel?: string;
  /** Extra classes on the `<header>` (a record page hides it in print). */
  className?: string;
}

/**
 * The top of every panel page: title, one line on what the page is for,
 * and its buttons ([secondary] [Primary] [⋯]) on the right, wrapping under
 * the title on a phone. `eyebrow`, `title`, `description` and `action`
 * draw what they always did; everything else is optional and drawn only
 * when given. Server-safe: the "⋯" is the kit's ActionMenu, which works
 * before hydration.
 *
 * @example
 * <PageHeader
 *   title="Ürünler"
 *   description="Online mağazada satılan ürünler."
 *   help={<p>Stok, varyantlı üründe varyantların toplamıdır.</p>}
 *   primary={{ href: "/admin/urunler/yeni", label: "Yeni ürün" }}
 *   menu={<ActionMenuLink href="/admin/urunler/ice-aktar">İçe aktar</ActionMenuLink>}
 * />
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  help,
  meta,
  badges,
  primary,
  secondary,
  menu,
  menuLabel = "Diğer işlemler",
  className,
}: PageHeaderProps) {
  const heading = (
    <h1
      className="text-2xl leading-8 text-[var(--admin-text)] sm:text-[28px] sm:leading-9"
      style={{
        fontFamily: "var(--font-geist-sans), var(--sans)",
        fontWeight: 600,
        letterSpacing: "-0.025em",
      }}
    >
      {title}
    </h1>
  );
  const buttons = Boolean(primary || secondary || menu);
  return (
    <header
      className={cx(
        "mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {meta ? (
          <div
            className={cx(
              "mb-2 flex flex-wrap items-center gap-x-3 gap-y-1",
              HEADER_EYEBROW,
            )}
          >
            {meta}
          </div>
        ) : eyebrow ? (
          <div className={cx("mb-2", HEADER_EYEBROW)}>{eyebrow}</div>
        ) : null}
        {badges ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {heading}
            {badges}
          </div>
        ) : (
          heading
        )}
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-[var(--admin-text-soft)]">
            {description}
          </p>
        )}
      </div>
      {buttons ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {action}
          {secondary ? (
            isLinkAction(secondary) ? (
              <Link
                href={secondary.href}
                className={cx(BUTTON.ghost, "flex-1 sm:flex-none")}
              >
                {secondary.label}
              </Link>
            ) : (
              secondary
            )
          ) : null}
          {primary ? (
            isLinkAction(primary) ? (
              <Link
                href={primary.href}
                data-admin-new=""
                // The shortcut layer writes aria-keyshortcuts="n" here once
                // the shell has hydrated, which can be before this page has.
                suppressHydrationWarning
                className={cx(BUTTON.primary, "flex-1 sm:flex-none")}
              >
                {primary.label}
              </Link>
            ) : (
              <div data-admin-new="" className="contents">
                {primary}
              </div>
            )
          ) : null}
          {menu ? (
            <ActionMenu label={menuLabel} framed>
              {menu}
            </ActionMenu>
          ) : null}
        </div>
      ) : (
        action && <div className="w-full sm:w-auto">{action}</div>
      )}
      {help ? (
        <details className="group -mt-2 w-full sm:-mt-3">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 rounded-md text-sm text-[var(--admin-primary)] select-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            {/* A drawn chevron: Poppins has no arrow glyphs. */}
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 -rotate-45 border-r-[1.5px] border-b-[1.5px] border-current transition-transform group-open:rotate-45"
            />
            Nasıl çalışır?
          </summary>
          <div className="mt-1 max-w-2xl rounded-2xl bg-[var(--admin-panel)] p-4 text-sm text-[var(--admin-text-soft)] [&_p+p]:mt-2">
            {help}
          </div>
        </details>
      ) : null}
    </header>
  );
}

export function formatTRY(amountMinor: number): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(major);
}

/**
 * An instant as the panel's reader means it: the Istanbul wall clock. Without
 * `timeZone` the server (UTC on Vercel) printed a promo that ends at 23:59 in
 * Tuzla as "20:59", inviting an admin to "fix" it by three hours.
 *
 * An offsetless value ("2026-09-30T23:59", what older promo rows hold) is
 * read the way the store reads it - as Istanbul wall clock - via
 * parsePublishInstant; everything else is an ISO instant with its own offset.
 */
export function formatDateTime(value: string): string {
  const at = parsePublishInstant(value);
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at === null ? new Date(value) : new Date(at));
}
