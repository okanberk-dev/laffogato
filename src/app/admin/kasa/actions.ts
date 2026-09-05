"use server";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { isDbUnreachable } from "@/lib/db/health";
import {
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
 */

const KINDS: readonly CounterRedeemKind[] = ["token", "code", "email"];

export interface TillRedeemInput {
  kind: string;
  value: string;
  stamps: number;
  note?: string;
}

export interface TillRedeemResult {
  /** The member's name; empty when the account has none. */
  name: string;
  /** As much as the cashier may see: masked on the QR and code paths. */
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
}

const MSG = {
  badKind: "Geçersiz okutma yolu.",
  empty: "Önce bir QR okut, kod yaz ya da e-posta gir.",
  dbDown: "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
  failed: "Damga verilemedi. Tekrar dene.",
} as const;

export async function redeemCounterTokenAction(
  input: TillRedeemInput,
): Promise<TillState> {
  const session = await requireRole("till");

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
  if (!result.ok) return { error: result.message };

  const { redemption } = result;
  await logAudit({
    action: "update",
    entity: "counter_token",
    // There is only a code on the QR/code paths; the e-mail path leaves the
    // masked label.
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
