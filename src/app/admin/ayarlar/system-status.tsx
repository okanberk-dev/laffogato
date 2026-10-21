import type { ReactNode } from "react";

import {
  KEEPALIVE_WARNING_ADVICE,
  keepaliveSentence,
} from "@/components/admin/dashboard/keepalive-status";
import { AdminIcon } from "@/components/admin/ui/icons";
import { TONE_DOT } from "@/components/admin/ui/tone";
import { cx } from "@/components/laffogato/cx";
import type { KeepaliveView } from "@/lib/admin/supabase-keepalive-core";
import type { AdminTone } from "@/lib/admin/tone";

/**
 * Ayarlar's "Sistem durumu": what the deploy and the daily cron are doing,
 * which nothing else on any screen says. Closed while all is well, a line
 * that says so; open when a row needs someone. It used to be two coloured
 * bands, one here and one on Genel bakış (operator, 21 Oct 2026: the
 * routine line does not belong on the dashboard). Server-safe.
 */
export function SystemStatus({
  attention,
  children,
}: {
  /** Whether any row is a warning: then it opens by itself. */
  attention: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={attention}
      data-testid="system-status"
      className="group mb-5 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-2.5 text-sm select-none group-open:rounded-b-none hover:bg-[var(--admin-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className={cx(
            "h-2 w-2 shrink-0 rounded-full",
            TONE_DOT[attention ? "warning" : "success"],
          )}
        />
        <span className="font-medium text-[var(--admin-text)]">
          Sistem durumu
        </span>
        <span className="min-w-0 truncate text-[var(--admin-text-soft)]">
          {attention ? "Dikkat istiyor" : "Her şey yolunda"}
        </span>
        <AdminIcon
          name="chevron"
          size={16}
          className="ml-auto shrink-0 text-[var(--admin-text-mute)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ul className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
        {children}
      </ul>
    </details>
  );
}

/** One row: a dot in its tone, the fact in bold, what it means after it. */
export function StatusRow({
  tone,
  testId,
  state,
  children,
}: {
  tone: AdminTone;
  testId: string;
  state?: string;
  children: ReactNode;
}) {
  return (
    <li
      data-testid={testId}
      data-state={state}
      data-tone={tone}
      className="flex gap-3 px-4 py-3 text-sm text-[var(--admin-text-soft)]"
    >
      <span
        aria-hidden="true"
        className={cx("mt-[7px] h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])}
      />
      <p className="min-w-0">{children}</p>
    </li>
  );
}

/** The tone of a keep-alive row: green while it works, grey before the first record. */
function keepaliveTone(view: KeepaliveView): AdminTone {
  if (view.tone === "warning") return "warning";
  return view.state === "fresh" ? "success" : "neutral";
}

/** The daily Supabase ping, as a Sistem durumu row (owner only). */
export function KeepaliveStatusRow({ view }: { view: KeepaliveView }) {
  return (
    <StatusRow
      tone={keepaliveTone(view)}
      testId="supabase-keepalive-status"
      state={view.state}
    >
      <strong className="font-medium text-[var(--admin-text)]">
        Supabase uyanık tutma:
      </strong>{" "}
      {keepaliveSentence(view)}
      {view.tone === "warning" ? <> {KEEPALIVE_WARNING_ADVICE}</> : null}
    </StatusRow>
  );
}
