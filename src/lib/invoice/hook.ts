import "server-only";

import { after } from "next/server";

import { earsivConfigStatus } from "./config";

/** The hook's share of the function's time after the response. */
export const HOOK_BUDGET_MS = 25_000;

/**
 * Asks the e-Arşiv run to look at one order once the response is out: when
 * it is paid, shipped/served, completed or refunded (src/lib/admin/store.ts).
 * Never awaited by the order's own work, never able to fail or delay it:
 * off (EARSIV_MODE unset) it returns before touching anything, outside a
 * request it does nothing, and every error is logged and swallowed. The
 * daily cron catches whatever a hook missed.
 */
export function scheduleInvoiceWork(orderId: string): void {
  try {
    if (earsivConfigStatus(process.env).mode === "off") return;
    after(async () => {
      try {
        const { runInvoices } = await import("./run");
        await runInvoices({
          budgetMs: HOOK_BUDGET_MS,
          limit: 3,
          orderId,
          reason: "hook",
        });
      } catch (err) {
        console.error(
          `[earsiv] hook order=${orderId}`,
          err instanceof Error ? err.message.slice(0, 200) : "error",
        );
      }
    });
  } catch (err) {
    console.warn(
      `[earsiv] hook not scheduled order=${orderId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
