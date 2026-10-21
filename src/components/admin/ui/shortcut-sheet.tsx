"use client";

import { useRef, type ReactNode, type Ref } from "react";

import { goShortcutsFor, markedFormsOf } from "@/lib/admin/shortcut-core";
import type { AdminRole } from "@/lib/admin/roles";

import { SwitchMark } from "./switch-mark";

/*
 * "Klavye kısayolları" (admin UI v2, UI-8): the panel's keys, in a native
 * modal <dialog> (the kit's one modal system), opened with `?` or from the
 * palette's Komutlar. The `g` pages are the role's own. Its switch is the
 * user menu's: off, the single keys stop and only ⌘K / Ctrl K remains.
 */

export interface ShortcutSheetProps {
  role: AdminRole;
  /** "⌘K" on an Apple keyboard, "Ctrl K" elsewhere. */
  paletteKey: string;
  /** The "Tek tuş kısayolları" switch (per browser). */
  enabled: boolean;
  /** On the Kasa the single keys rest whatever the switch says. */
  pausedHere?: boolean;
  onToggle: () => void;
  /** The dialog closed (Esc, Kapat, the backdrop). */
  onClose: () => void;
  dialogRef?: Ref<HTMLDialogElement>;
}

const KBD =
  "inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[var(--admin-border-strong)] bg-[var(--admin-surface-2)] px-1.5 text-xs leading-none font-medium text-[var(--admin-text)]";

/** One key, or `g` then a letter. */
function Keys({ keys }: { keys: readonly string[] }) {
  const out: ReactNode[] = [];
  keys.forEach((k, i) => {
    if (i > 0) {
      out.push(
        <span key={`s${i}`} className="text-xs text-[var(--admin-text-mute)]">
          sonra
        </span>,
      );
    }
    out.push(
      <kbd key={k} className={KBD} style={{ fontFamily: "inherit" }}>
        {k}
      </kbd>,
    );
  });
  return <span className="flex shrink-0 items-center gap-1.5">{out}</span>;
}

function Row({
  keys,
  children,
}: {
  keys: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-1.5">
      <dt className="min-w-0 text-sm text-[var(--admin-text)]">{children}</dt>
      <dd>
        <Keys keys={keys} />
      </dd>
    </div>
  );
}

const HEADING = "mb-1 text-xs font-medium text-[var(--admin-text-mute)]";

export function ShortcutSheet({
  role,
  paletteKey,
  enabled,
  pausedHere = false,
  onToggle,
  onClose,
  dialogRef,
}: ShortcutSheetProps) {
  const downOnBackdrop = useRef(false);
  const targets = goShortcutsFor(role);
  // The role's own letters that a marked one also stands for: "s yerine ş".
  const marked = targets.flatMap((t) =>
    markedFormsOf(t.key).map((m) => `${t.key} yerine ${m}`),
  );
  const single = enabled && !pausedHere;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="admin-shortcut-sheet-title"
      data-admin-shortcut-sheet=""
      onClose={onClose}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) {
          e.currentTarget.close();
        }
        downOnBackdrop.current = false;
      }}
      className="fixed inset-x-0 top-3 bottom-auto mx-auto my-0 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop:bg-[rgba(23,23,23,0.32)] open:flex sm:top-[10vh] sm:max-h-[min(80dvh,720px)] print:hidden"
      style={{ fontFamily: "var(--font-geist-sans), var(--sans)" }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--admin-border)] py-2 pr-2 pl-5">
        <h2
          id="admin-shortcut-sheet-title"
          className="text-base font-semibold text-[var(--admin-text)]"
        >
          Klavye kısayolları
        </h2>
        {/* Closes without JavaScript's help too. */}
        <form method="dialog">
          <button
            type="submit"
            aria-label="Kapat"
            className="grid h-11 w-11 place-items-center rounded-lg text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-5">
        <section aria-labelledby="admin-shortcut-sheet-any">
          <h3 id="admin-shortcut-sheet-any" className={HEADING}>
            Her sayfada
          </h3>
          <dl className="divide-y divide-[var(--admin-border)]">
            <Row keys={[paletteKey]}>Paleti aç (yazarken de)</Row>
            <Row keys={["Esc"]}>Pencereyi kapat</Row>
          </dl>
        </section>

        <section aria-labelledby="admin-shortcut-sheet-single" className="mt-4">
          <h3 id="admin-shortcut-sheet-single" className={HEADING}>
            Tek tuş
          </h3>
          <dl className="divide-y divide-[var(--admin-border)]">
            <Row keys={["/"]}>Listenin arama kutusu; yoksa palet</Row>
            <Row keys={["n"]}>Sayfanın Yeni düğmesi; yoksa Oluştur</Row>
            <Row keys={["?"]}>Kısayol listesi</Row>
            {targets.map((t) => (
              <Row key={t.key} keys={["g", t.key]}>
                {t.label}
              </Row>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-5 text-[var(--admin-text-soft)]">
            İkinci harfe 1,5 saniye içinde bas
            {marked.length > 0 ? `; ${marked.join(", ")} de olur` : ""}.
            Yazarken, bir pencere açıkken ve Kasa&apos;da tek tuşlar çalışmaz;
            kaydedilmemiş bir form varken sayfadan çıkmaz.
          </p>
        </section>

        <div className="mt-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-1">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={onToggle}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-[var(--admin-text)] hover:text-[var(--admin-primary)]"
          >
            <span className="flex-1">Tek tuş kısayolları</span>
            <SwitchMark on={enabled} />
          </button>
        </div>
        <p
          role="status"
          className="mt-2 text-xs leading-5 text-[var(--admin-text-soft)]"
        >
          {single
            ? "Açık. Aynı düğme menünün altındaki Hesap bölümünde de var."
            : enabled
              ? "Kasa'da kapalı: okutulan ve yazılan kodlar buraya gelir."
              : `Kapalı. ${paletteKey} çalışmaya devam eder.`}
        </p>
      </div>
    </dialog>
  );
}
