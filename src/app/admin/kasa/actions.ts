"use server";

import { logAudit, type LogAuditInput } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { isDbUnreachable } from "@/lib/db/health";
import {
  COUNTER_EMAIL_REFUSED,
  redeemCounterToken,
  type CounterRedeemKind,
} from "@/lib/mobile/counter";

/**
 * The till action opens its own role gate.
 *
 * The page's `requireRole` does NOT protect it: a Server Action is a POST
 * endpoint that can be called without the page. Without the gate here,
 * somebody who never opened the panel could write any member any number of
 * stamps.
 *
 * Two ways in, both a single-use token the member's own app minted: the
 * scanned QR and its eight-character code. The typed address went on
 * 21 Ekim 2026 (decision ASK-LOYALTY): it named a member who showed nothing.
 * A request that still asks for it (an open tab with the old till) gets the
 * refusal below and writes nothing.
 */

const KINDS: readonly CounterRedeemKind[] = ["token", "code"];

export interface TillRedeemInput {
  kind: string;
  value: string;
  stamps: number;
  note?: string;
}

export interface TillRedeemResult {
  /** The member's name; empty when the account has none. */
  name: string;
  /** As much as the cashier may see: the masked address. */
  memberLabel: string;
  code: string;
  stampsGiven: number;
  stamps: number;
  stampTarget: number;
  rewardsReady: number;
}

export interface TillState {
  error?: string;
  result?: TillRedeemResult;
  /**
   * Something may have been given (the code burned, stamps sent) before the
   * failure: the till treats the scan as spent and waits for "Yeni işlem".
   */
  partial?: boolean;
}

/**
 * The audit row of stamps that are already written: never throws (the
 * `safeAudit` rule, lib/admin/audit.ts). A throw here reached the till as
 * the panel's error page and the cashier stamped again (admin audit
 * ORD-12). Logged without the row's id or the member's address (CLAUDE.md
 * rule 9).
 */
async function auditGiven(input: LogAuditInput): Promise<void> {
  try {
    await logAudit(input);
  } catch (err) {
    console.error(
      "[admin/kasa] audit row not written",
      JSON.stringify(input.payload ?? {}),
      err,
    );
  }
}

const MSG = {
  badKind: "Geçersiz okutma yolu.",
  email: COUNTER_EMAIL_REFUSED,
  empty: "Önce bir QR okut ya da kod yaz.",
  dbDown: "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
  failed: "Damga verilemedi. Tekrar dene.",
} as const;

export async function redeemCounterTokenAction(
  input: TillRedeemInput,
): Promise<TillState> {
  const session = await requireRole("till");

  // Before anything else: no member lookup, no stamp, no audit row.
  if (input.kind === "email") return { error: MSG.email };
  const kind = KINDS.find((k) => k === input.kind);
  if (!kind) return { error: MSG.badKind };
  const value = String(input.value ?? "").trim();
  if (!value) return { error: MSG.empty };
  // The range is not clamped here: clamping would silently hand a
  // hand-crafted request the highest stamp count allowed. `redeemCounterToken`
  // is the single point of validation and returns its own refusal message.
  const stamps = Math.trunc(Number(input.stamps));

  let result;
  try {
    result = await redeemCounterToken({
      kind,
      value,
      stamps,
      actor: session.email,
      note: String(input.note ?? ""),
    });
  } catch (err) {
    if (isDbUnreachable(err)) return { error: MSG.dbDown };
    console.error("[admin/kasa] redeem failed", err);
    return { error: MSG.failed };
  }
  if (!result.ok) {
    if (result.error !== "partial") return { error: result.message };
    // The code is burned and stamps were sent: "Tekrar dene" would answer
    // "already used" on the QR.
    console.error("[admin/kasa] redeem stopped after stamping", result.cause);
    await auditGiven({
      action: "update",
      entity: "counter_token",
      entityId: result.code || result.memberLabel,
      payload: {
        kind,
        stamps: result.stampsWritten,
        asked: result.stampsAsked,
        partial: true,
      },
    });
    return { error: result.message, partial: true };
  }

  const { redemption } = result;
  // After the stamps: an audit insert that fails must not turn a given
  // stamp into the panel's error page, and a cashier's retry (ORD-12).
  await auditGiven({
    action: "update",
    entity: "counter_token",
    entityId: redemption.code || redemption.memberLabel,
    payload: { kind, stamps: redemption.stampsGiven },
  });

  return {
    result: {
      name: redemption.name,
      memberLabel: redemption.memberLabel,
      code: redemption.code,
      stampsGiven: redemption.stampsGiven,
      stamps: redemption.loyalty.stamps,
      stampTarget: redemption.loyalty.stampTarget,
      rewardsReady: redemption.loyalty.rewardsReady,
    },
  };
}
