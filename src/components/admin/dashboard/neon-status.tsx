import { cx } from "@/components/laffogato/cx";
import {
  neonAdvice,
  neonSentence,
  type NeonUsageView,
} from "@/lib/admin/neon-usage-core";

import { TONE_RULE, TONE_SOFT } from "../ui/tone";

/**
 * The owner's band about Neon's monthly compute
 * (src/lib/admin/neon-usage-core.ts), drawn only when it needs someone:
 * from 80 % of the plan's hours, or when this pace spends them before the
 * period ends. Ayarlar → Sistem durumu always says the same sentence. It is
 * handed a view, never the read's source. Server-safe.
 */
export function NeonUsageLine({ view }: { view: NeonUsageView }) {
  return (
    <p
      data-testid="neon-usage-status"
      data-state={view.state}
      className={cx(
        "mb-4 rounded-lg border-l-4 px-3.5 py-2.5 text-sm",
        TONE_SOFT[view.tone],
        TONE_RULE[view.tone],
      )}
    >
      <strong>Neon işlem süresi:</strong> {neonSentence(view)}{" "}
      {neonAdvice(view)}
    </p>
  );
}
