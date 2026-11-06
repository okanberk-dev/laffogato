"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ackTableCallAction } from "@/app/admin/siparisler/call-actions";
import { orderAlertTime } from "@/lib/admin/order-alerts-core";
import {
  TABLE_CALL_REASON_LABELS,
  type TableCallReason,
} from "@/lib/admin/table-calls-core";

import { announceAdminChange } from "./ui/admin-changed";
import { BUTTON, NUMERIC_STYLE } from "./ui/styles";
import { useToast } from "./ui/toast";

/** One open call, as the page hands it over: no guest. */
export interface TableCallListItem {
  id: string;
  /** "Masa 4". */
  label: string;
  reason: TableCallReason;
  createdAt: string;
}

/**
 * "Masa çağrıları" at the top of Siparişler, while a table has called
 * ("Garson çağır" from the app, 6 Kas 2026). Each row's "Gördüm" answers
 * the call (`ackTableCallAction`): it leaves this list, the bell, the bar
 * screen, and the guest's app reads it as seen. Rendered only while there
 * is something in it; the bell rings for new ones.
 */
export function TableCallList({ calls }: { calls: TableCallListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [answered, setAnswered] = useState<string[]>([]);

  const shown = calls.filter((c) => !answered.includes(c.id));
  if (shown.length === 0) return null;

  const answer = async (id: string) => {
    if (busy) return;
    setBusy(id);
    const fd = new FormData();
    fd.set("id", id);
    try {
      const res = await ackTableCallAction(null, fd);
      toast.fromResult(res);
      if (res.ok) {
        setAnswered((prev) => [...prev, id]);
        announceAdminChange();
        router.refresh();
      }
    } catch {
      toast.fromResult({
        ok: false,
        error: "Bağlantı kurulamadı. Tekrar dene.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-label="Masa çağrıları"
      data-table-calls=""
      className="mb-4 rounded-xl border border-l-4 border-[var(--admin-border)] border-l-[var(--admin-danger)] bg-[var(--admin-surface)] p-3 shadow-sm sm:p-4"
    >
      <h2 className="text-sm font-semibold text-[var(--admin-text)]">
        Masa çağrıları{" "}
        <span className="text-[var(--admin-text-soft)]">({shown.length})</span>
      </h2>
      <ul className="mt-2 flex flex-col divide-y divide-[var(--admin-border)]">
        {shown.map((call) => (
          <li
            key={call.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <p className="min-w-0 text-sm text-[var(--admin-text)]">
              <span className="font-semibold">{call.label}</span>
              {" · "}
              {TABLE_CALL_REASON_LABELS[call.reason]}
              <span
                className="ml-2 text-xs text-[var(--admin-text-soft)]"
                style={NUMERIC_STYLE}
              >
                {orderAlertTime(call.createdAt)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void answer(call.id)}
              disabled={busy !== null}
              aria-busy={busy === call.id || undefined}
              className={BUTTON.primary}
            >
              {busy === call.id ? "Kaydediliyor…" : "Gördüm"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
