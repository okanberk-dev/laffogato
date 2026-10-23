import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";

import { CARD, NUMERIC_STYLE } from "./styles";

/** A small figure beside the hero ("Tahsil edilen ₺500,00"). */
export interface SummaryChip {
  label: string;
  tone?: "success" | "warning" | "danger";
}

/**
 * The left column's first card on a record's page (Innex's three-zone
 * detail, innex-01/02: one big figure that says what to do, 22 Eki 2026):
 * the hero (İade edilecek in red, Ödeme bekleniyor in orange, else the
 * total), the other amounts as chips under it, and the record's few facts
 * as label / value lines. The order page drew it first; a karaoke booking
 * and a customer read the same way. Server-safe.
 */
export function SummaryCard({
  label,
  value,
  tone,
  chips = [],
  facts = [],
  ariaLabel = "Tutar",
  children,
}: {
  /** What the hero figure is ("İade edilecek", "Toplam harcama"). */
  label: string;
  /** The figure, formatted. */
  value: ReactNode;
  /** Red for what is owed back, orange for what is awaited. */
  tone?: "danger" | "warning";
  chips?: readonly SummaryChip[];
  facts?: ReadonlyArray<readonly [string, ReactNode]>;
  ariaLabel?: string;
  /** Under the facts (a record's own controls). */
  children?: ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} className={cx(CARD, "p-4 sm:p-5")}>
      <div className="rounded-[10px] bg-[var(--admin-surface-2)] p-4">
        <p className="text-[13px] font-medium text-[var(--admin-text-mute)]">
          {label}
        </p>
        <p
          className={cx(
            "mt-1 text-[1.75rem] leading-tight font-bold tracking-[-0.01em] [overflow-wrap:anywhere]",
            tone === "danger"
              ? "text-[var(--admin-danger-ink)]"
              : tone === "warning"
                ? "text-[var(--admin-warning)]"
                : "text-[var(--admin-text)]",
          )}
          style={NUMERIC_STYLE}
        >
          {value}
        </p>
        {chips.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip.label}
                className={cx(
                  "rounded-md border px-2 py-0.5 text-xs font-medium",
                  chip.tone === "success"
                    ? "border-transparent bg-[var(--admin-success-soft)] text-[var(--admin-success)]"
                    : chip.tone === "warning"
                      ? "border-transparent bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
                      : chip.tone === "danger"
                        ? "border-transparent bg-[var(--admin-danger-soft)] text-[var(--admin-danger-ink)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)]",
                )}
                style={NUMERIC_STYLE}
              >
                {chip.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {facts.length > 0 ? (
        <dl className="mt-4 flex flex-col gap-2.5 text-sm">
          {facts.map(([factLabel, factValue]) => (
            <div
              key={factLabel}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="shrink-0 text-[var(--admin-text-mute)]">
                {factLabel}
              </dt>
              <dd className="min-w-0 text-right [overflow-wrap:anywhere] text-[var(--admin-text)]">
                {factValue}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </section>
  );
}
