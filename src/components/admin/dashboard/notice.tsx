import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";
import type { AdminTone } from "@/lib/admin/tone";

import { TONE_SOFT } from "../ui/tone";

/** A band above the dashboard's tiles, in the kit's tones. Server-safe. */
export function DashboardNotice({
  tone,
  children,
}: {
  tone: AdminTone;
  children: ReactNode;
}) {
  return (
    <div className={cx("mb-4 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone])}>
      {children}
    </div>
  );
}
