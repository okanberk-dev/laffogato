import type { ReactNode } from "react";

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
        className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base outline-none transition-colors focus:border-neutral-900 focus:bg-white sm:text-sm";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={`${baseInput} ${props.className ?? ""}`} />;
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
  return <select {...props} className={`${baseInput} ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 py-2 text-sm text-neutral-700">
      <input
        type="checkbox"
        {...rest}
        className="h-5 w-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-700"
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 ${rest.className ?? ""}`}
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50 ${rest.className ?? ""}`}
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50 ${rest.className ?? ""}`}
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
      className={`rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6 ${className ?? ""}`}
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
            className="mb-2 text-[10px] uppercase tracking-[0.22em] text-neutral-500"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="text-2xl sm:text-3xl"
          style={{
            fontFamily: "var(--serif), 'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 500,
            letterSpacing: "-0.018em",
          }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">{description}</p>
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

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
