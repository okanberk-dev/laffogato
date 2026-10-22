import "server-only";

import {
  iysStaleMessage,
  maskIysEmail,
  type IysCheckFreshness,
} from "./iys-core";
import { iysCheckNow, reconcileIys } from "./store";

/**
 * The send gate's application half. The database half is the audience: no
 * commercial e-mail to an address İYS is not known to hold ONAY for
 * (20261022180100_iys_send_gate.sql). This half: no commercial e-mail at
 * all while the last İYS refusal check is older than three business days,
 * because a refusal the person made on İYS itself reaches us only through
 * that check (iys-core.ts `iysCheckFreshness`).
 *
 * Callers: `queueCampaignEmail` refuses with the message, the runner leaves
 * a queued campaign alone until the check is fresh, the birthday cron still
 * grants the coupon (an account right, not a message) and skips the mail.
 * Transactional mail (orders, shipping, password) never comes here.
 */

/** A commercial send refused because the İYS check is stale. */
export class IysGateError extends Error {
  readonly check: IysCheckFreshness;
  constructor(check: IysCheckFreshness) {
    super(iysStaleMessage(check));
    this.name = "IysGateError";
    this.check = check;
  }
}

export function isIysGateError(err: unknown): err is IysGateError {
  return err instanceof IysGateError;
}

/** Whether a commercial send may go now, and why not. Throws on a db error. */
export async function iysSendGate(
  now: Date = new Date(),
): Promise<IysCheckFreshness & { message: string }> {
  const check = await iysCheckNow(now);
  const freshness: IysCheckFreshness = {
    fresh: check.fresh,
    lastCheckAt: check.lastCheckAt,
    expiresAt: check.expiresAt,
  };
  return {
    ...freshness,
    message: freshness.fresh ? "" : iysStaleMessage(freshness),
  };
}

/** Throws IysGateError while the check is stale. */
export async function assertIysSendable(now: Date = new Date()): Promise<void> {
  const gate = await iysSendGate(now);
  if (!gate.fresh) throw new IysGateError(gate);
}

/**
 * Reconcile before a campaign is queued, so the panel's outbox is current
 * when the operator looks. Never throws: the audience reads İYS's state
 * whether or not this ran, so a failure here cannot let a message through.
 */
export async function reconcileIysQuietly(
  now: Date = new Date(),
): Promise<boolean> {
  try {
    await reconcileIys(now);
    return true;
  } catch (err) {
    console.error(
      "[iys] eşitleme yapılamadı",
      err instanceof Error
        ? err.message.replace(/\S+@\S+/g, maskIysEmail)
        : err,
    );
    return false;
  }
}
