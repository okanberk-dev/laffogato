"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
  saveVenueQuickAction,
  venueQuickSignalAction,
} from "@/app/admin/mobil/canli-durum/actions";
import type { ActionResult } from "@/lib/admin/action-result";
import {
  choiceAfterStep,
  quickChoiceOf,
  readVenueAnswer,
  stepFreeTables,
  VENUE_QUICK_CHOICES,
  VENUE_QUICK_LABELS,
  venueChipState,
  venueChipTitle,
  type VenueChipTone,
  type VenueQuickChoice,
  type VenueQuickStatus,
  type VenueSignalAnswer,
} from "@/lib/admin/venue-quick-core";

import { ADMIN_CHANGED_EVENT, announceAdminChange } from "./ui/admin-changed";
import { BUTTON, NUMERIC_STYLE } from "./ui/styles";
import { useHandPost, withPanelCatch } from "./ui/submit";
import { useToast } from "./ui/toast";

/**
 * The köşk chip: "Köşk: Açık" in the top bar's `actions` slot for the roles
 * with `venue` (owner, manager, Personel), and a popover that changes the
 * two things the shift changes all evening: open / busy / closed and the
 * free tables (admin UI v2, decision D3). Everything else (Wi-Fi, noise,
 * power, the note, the table count) stays on /admin/mobil/canli-durum.
 *
 * - The status is polled through a Server Action (no database read in the
 *   layout), now and once a minute while the tab is visible, and again
 *   after any panel save (`admin:changed`). Like the nav badges, each
 *   answer carries a cursor: while nothing was written and the hours have
 *   not turned, the answer is `{ unchanged: true }`, read without the
 *   database (src/lib/admin/venue-signal.ts), and the chip keeps its word.
 * - The popover is a native `<details>`: it opens before hydration too,
 *   and then links to the page. Esc, a click outside it and a save close
 *   it; the answer is a toast.
 * - Saving writes only those two columns, in one UPDATE
 *   (saveVenueQuickAction → patchVenueStatus): a colleague's Wi-Fi or note
 *   saved a second earlier is never put back. Yoğun writes the free tables
 *   alone (0); the open/closed stays as it is.
 * - No library code: this file is in every admin page's bundle, the Kasa
 *   included (CLAUDE.md, admin UI libraries).
 */

/** How often the chip asks again. The same minute as the nav badges. */
export const VENUE_POLL_MS = 60_000;

/**
 * The chip's poll: now, then every `intervalMs` while the tab is visible
 * (a hidden tab asks nothing), and again at once whenever the panel
 * announces a change. The nav badges' poll (startNavCountPoll,
 * admin-sidebar.tsx) for a status instead of a count:
 *
 * - each answer's cursor goes back with the next read; `{ unchanged: true }`
 *   (read without the database) keeps the status as it is;
 * - `admin:changed` drops the cursor, so the read after a save is a full
 *   one; a change that lands while a read is out is read again, in full,
 *   once that read is back (the read in flight may have started before it);
 * - a read that throws keeps what the chip shows.
 *
 * Returns the stop function.
 */
export function startVenuePoll({
  read,
  onStatus,
  intervalMs = VENUE_POLL_MS,
  target = window,
  isVisible = () => document.visibilityState === "visible",
}: {
  read: (cursor: string) => Promise<VenueSignalAnswer>;
  onStatus: (status: VenueQuickStatus | null) => void;
  intervalMs?: number;
  target?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  isVisible?: () => boolean;
}): () => void {
  let stopped = false;
  let busy = false;
  let again = false;
  let cursor = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick() {
    timer = undefined;
    if (stopped) return;
    if (isVisible()) {
      busy = true;
      try {
        const answer = readVenueAnswer(await read(cursor));
        if (!stopped && !("unchanged" in answer)) {
          // A change landed while this read was out: the next read is a
          // full one, whatever this answer's cursor says.
          cursor = again ? "" : answer.cursor;
          onStatus(answer.status);
        }
      } catch {
        // A background read never takes the panel down; the chip keeps
        // what it showed.
      } finally {
        busy = false;
      }
      if (stopped) return;
      if (again) {
        again = false;
        void tick();
        return;
      }
    }
    timer = setTimeout(tick, intervalMs);
  }

  const onChanged = () => {
    if (stopped) return;
    cursor = "";
    if (busy) {
      again = true;
      return;
    }
    if (timer) clearTimeout(timer);
    void tick();
  };

  target.addEventListener(ADMIN_CHANGED_EVENT, onChanged);
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    target.removeEventListener(ADMIN_CHANGED_EVENT, onChanged);
  };
}

const DOT: Record<VenueChipTone, string> = {
  success: "bg-[var(--admin-success)]",
  warning: "bg-[var(--admin-warning)]",
  neutral: "bg-[var(--admin-text-mute)]",
};

/** The answer to a save that threw: the row may or may not have changed. */
const QUICK_FAILED =
  "Bir hata oldu, kayıt yarıda kalmış olabilir. Sayfayı yenileyip durumu kontrol et.";

const PAGE_HREF = "/admin/mobil/canli-durum";

export function VenueQuick({
  initialStatus = null,
  initialOpen = false,
}: {
  /** The first status before the poll answers (tests, screenshots). */
  initialStatus?: VenueQuickStatus | null;
  /** Rendered open (tests, screenshots). */
  initialOpen?: boolean;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  const [status, setStatus] = useState<VenueQuickStatus | null>(initialStatus);
  const [answered, setAnswered] = useState(initialStatus !== null);
  const [open, setOpen] = useState(initialOpen);
  // A new form each time the popover opens, from the latest status.
  const [round, setRound] = useState(0);

  // One poll for the tab's life: the layout stays mounted across pages, and
  // a page change writes nothing the chip shows (a save says so itself,
  // through `admin:changed`).
  useEffect(
    () =>
      startVenuePoll({
        read: venueQuickSignalAction,
        onStatus: (value) => {
          setStatus(value);
          setAnswered(true);
        },
      }),
    [],
  );

  const close = (focusSummary: boolean) => {
    const details = ref.current;
    if (!details?.open) return;
    details.open = false;
    if (focusSummary) details.querySelector("summary")?.focus();
  };

  // Another page: the popover does not follow the operator there.
  useEffect(() => {
    const details = ref.current;
    if (details?.open) details.open = false;
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const details = ref.current;
      if (details && !details.contains(e.target as Node)) details.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const chip = status ? venueChipState(status) : null;

  return (
    <details
      ref={ref}
      open={initialOpen || undefined}
      data-admin-venue-quick=""
      // Below sm the popover hangs from the top bar (the sticky header is
      // its containing block) across the phone's width; from sm on, under
      // the chip.
      className="max-sm:static sm:relative print:hidden"
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        setOpen(isOpen);
        if (isOpen) setRound((n) => n + 1);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close(true);
      }}
    >
      <summary
        title={status ? venueChipTitle(status) : undefined}
        className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-2.5 text-xs whitespace-nowrap text-[var(--admin-text)] hover:border-[var(--admin-primary)] sm:gap-2 sm:px-3 sm:text-sm [&::-webkit-details-marker]:hidden"
      >
        {chip ? (
          <>
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${DOT[chip.tone]}`}
            />
            <span>
              <span className="max-sm:sr-only">Köşk: </span>
              <span className="font-medium">{chip.label}</span>
            </span>
          </>
        ) : (
          <span>Köşk</span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="hidden shrink-0 text-[var(--admin-text-soft)] sm:block"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <section
        aria-label="Köşk durumu"
        className="absolute top-full z-40 mt-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm whitespace-normal text-[var(--admin-text)] shadow-[0_8px_24px_rgba(44,29,17,0.14)] max-sm:inset-x-2 sm:right-0 sm:w-80"
      >
        <p className="font-semibold">Köşk durumu</p>
        <p className="mt-0.5 text-xs text-[var(--admin-text-soft)]">
          Uygulamanın ana sayfası en geç 30 saniyede görür.
        </p>
        {open && status ? (
          <VenueQuickForm
            key={round}
            status={status}
            onDone={() => close(true)}
          />
        ) : (
          <p className="mt-3 text-sm text-[var(--admin-text-soft)]">
            {answered ? "Durum şu an okunamadı." : "Durum okunuyor…"}{" "}
            <Link
              href={PAGE_HREF}
              className="text-[var(--admin-primary)] underline underline-offset-4"
              onClick={() => close(false)}
            >
              Canlı durum sayfası
            </Link>
          </p>
        )}
      </section>
    </details>
  );
}

function StepIcon({ plus }: { plus: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      {plus ? <path d="M12 5v14" /> : null}
    </svg>
  );
}

/**
 * The popover's form: four radios and the free-table stepper, posted by
 * hand (useHandPost), so a refusal keeps the choice and a second press
 * before the answer is dropped.
 */
export function VenueQuickForm({
  status,
  onDone,
}: {
  status: VenueQuickStatus;
  onDone: () => void;
}) {
  const toast = useToast();
  const id = useId();
  const total = status.totalTables;
  const [choice, setChoice] = useState<VenueQuickChoice>(() =>
    quickChoiceOf(status),
  );
  const [free, setFree] = useState(() =>
    stepFreeTables(status.freeTables, 0, total),
  );

  const [state, dispatch, pending] = useActionState<
    ActionResult | null,
    FormData
  >(
    withPanelCatch<ActionResult | null>(
      async (prev, formData) => {
        const result = await saveVenueQuickAction(prev, formData);
        if (result.ok) {
          toast.fromResult(result);
          announceAdminChange();
          onDone();
        }
        return result;
      },
      () => ({ ok: false, error: QUICK_FAILED }),
    ),
    null,
  );
  const post = useHandPost(dispatch, pending);
  const error = state && !state.ok ? state.error : null;

  const pick = (next: VenueQuickChoice) => {
    setChoice(next);
    if (next === "busy") setFree(0);
  };
  const step = (delta: number) => {
    const next = stepFreeTables(free, delta, total);
    setFree(next);
    setChoice((c) => choiceAfterStep(c, next, status.manualOverride));
  };

  return (
    <form action={post.action} onSubmit={post.onSubmit} className="mt-3">
      <fieldset>
        <legend className="text-xs font-medium text-[var(--admin-text-soft)]">
          Durum
        </legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {VENUE_QUICK_CHOICES.map((c) => (
            <label
              key={c}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:bg-[var(--admin-surface-2)] has-[:checked]:border-[var(--admin-primary)] has-[:checked]:bg-[var(--admin-primary-soft)]"
            >
              <input
                type="radio"
                name="status"
                value={c}
                checked={choice === c}
                onChange={() => pick(c)}
                className="h-5 w-5 shrink-0 accent-[var(--admin-primary)]"
              />
              <span className="min-w-0 leading-tight">
                <span className="block font-medium">
                  {VENUE_QUICK_LABELS[c].label}
                </span>
                <span className="block text-xs text-[var(--admin-text-soft)]">
                  {VENUE_QUICK_LABELS[c].hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span
          id={`${id}-free`}
          className="text-xs font-medium text-[var(--admin-text-soft)]"
        >
          Boş masa
        </span>
        <div
          role="group"
          aria-labelledby={`${id}-free`}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            className={BUTTON.icon}
            aria-label="Bir boş masa az"
            onClick={() => step(-1)}
            disabled={free <= 0}
          >
            <StepIcon plus={false} />
          </button>
          <output
            aria-live="polite"
            className="min-w-[4.5rem] text-center text-base font-semibold"
            style={NUMERIC_STYLE}
          >
            {free} / {total}
          </output>
          <button
            type="button"
            className={BUTTON.icon}
            aria-label="Bir boş masa fazla"
            onClick={() => step(1)}
            disabled={free >= total}
          >
            <StepIcon plus />
          </button>
        </div>
        <input type="hidden" name="freeTables" value={free} />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-[var(--admin-danger-ink)]">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--admin-border)] pt-3">
        <Link href={PAGE_HREF} className={BUTTON.link}>
          Diğer ayarlar
        </Link>
        <button
          type="submit"
          className={BUTTON.primary}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </form>
  );
}
