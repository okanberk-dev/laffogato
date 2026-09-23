import type { ReactNode } from "react";

import { parsePublishInstant } from "@/lib/admin/publish-window";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span
        className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-xs text-[var(--admin-text-mute)]">{hint}</span>
      )}
    </label>
  );
}

const baseInput =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3.5 py-2.5 text-base text-[var(--admin-text)] outline-none transition-[border-color,background-color,box-shadow] placeholder:text-[var(--admin-text-mute)]/70 focus:border-[var(--admin-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--admin-accent)]/25 sm:text-sm";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${baseInput} ${props.className ?? ""}`} />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`${baseInput} min-h-[100px] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${baseInput} ${props.className ?? ""}`} />
  );
}

export function Checkbox({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 py-2 text-sm text-[var(--admin-text-soft)]">
      <input
        type="checkbox"
        {...rest}
        className="h-5 w-5 rounded-md border-[var(--admin-border-strong)] accent-[var(--admin-primary)]"
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:opacity-50 ${rest.className ?? ""}`}
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-4 py-2 text-sm text-[var(--admin-text-soft)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30 focus-visible:outline-none disabled:opacity-50 ${rest.className ?? ""}`}
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--admin-danger)]/35 bg-[var(--admin-surface)] px-4 py-2 text-sm text-[var(--admin-danger)] transition-colors hover:border-[var(--admin-danger)] hover:bg-[var(--admin-danger)] hover:text-white disabled:opacity-50 ${rest.className ?? ""}`}
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
      className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[0_1px_3px_rgba(68,48,28,0.06)] sm:p-6 ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div
            className="mb-2 text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="text-2xl text-[var(--admin-text)] sm:text-3xl"
          style={{
            fontFamily: "var(--font-poppins), var(--sans)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-[var(--admin-text-soft)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="w-full sm:w-auto">{action}</div>}
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
 * read the way the store reads it — as Istanbul wall clock — via
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
