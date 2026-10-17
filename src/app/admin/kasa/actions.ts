"use server";

import { logAudit, type LogAuditInput } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { getCustomerByEmail } from "@/lib/customer/store";
import { isDbUnreachable } from "@/lib/db/health";
import {
  redeemCounterToken,
  type CounterRedeemKind,
} from "@/lib/mobile/counter";
import { listStamps } from "@/lib/mobile/loyalty";

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
  /**
   * E-mail path only: the cashier ticked "Tekrar ver", a second counter
   * stamp for the same member inside the repeat window is meant.
   */
  repeat?: boolean;
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
  /**
   * The refusal was the repeat guard: the e-mail form offers "Tekrar ver".
   */
  repeat?: boolean;
  /**
   * Something may have been given (the code burned, stamps sent) before the
   * failure: the till treats the scan as spent and waits for "Yeni işlem".
   */
  partial?: boolean;
}

/**
 * Two counter stamps for the same member inside this window is a double
 * submit (the customer page's own guard, musteriler/[email]/actions.ts).
 */
const REPEAT_WINDOW_MS = 3 * 60 * 1000;

/**
 * The audit row of stamps that are already written: never throws (the
 * `safeAudit` rule, lib/admin/audit.ts). A throw here reached the till as
 * the panel's error page and the cashier stamped again (admin audit
 * ORD-12). Logged without the row's id: on the e-mail path that is the
 * member's address (CLAUDE.md rule 9).
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
  empty: "Önce bir QR okut, kod yaz ya da e-posta gir.",
  dbDown: "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
  failed: "Damga verilemedi. Tekrar dene.",
  noMember:
    "Bu adrese ait üye hesabı yok. Adresi kontrol et ya da üyeden QR'ını açmasını iste.",
  closedMember:
    "Bu üye hesabı kapalı; damga işlenmez. Üyeden hesabını açmasını iste.",
  repeat:
    "Bu üyeye son 3 dakikada kasa damgası verildi. Gerçekten yeni bir damga gerekiyorsa “Tekrar ver” kutusunu işaretle.",
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
    // The QR and the code carry a member with them - the token row names the
    // account it was minted for. A TYPED ADDRESS carries nobody: without this
    // check `uye@gmial.com` passes the format test, gets its own ledger rows
    // and comes back as a green receipt, while the member it was meant for
    // sees no stamp and the rows sit under an address that belongs to no one.
    if (kind === "email") {
      const member = await getCustomerByEmail(value);
      if (!member) return { error: MSG.noMember };
      if (!member.isActive) return { error: MSG.closedMember };
      // A typed address burns no single-use code: a second click or Enter
      // after the green receipt gave the member another 1-5 stamps (free
      // drinks, admin audit ORD-13). Refused inside the window unless the
      // cashier says it is meant.
      if (input.repeat !== true) {
        const recent = await listStamps(member.email || value);
        const last = recent.find(
          (st) => st.kind === "earn" && st.source === "counter",
        );
        if (
          last &&
          Date.now() - Date.parse(last.createdAt) < REPEAT_WINDOW_MS
        ) {
          return { error: MSG.repeat, repeat: true };
        }
      }
    }

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
    // The code is burned or stamps were sent: "Tekrar dene" would stamp
    // the e-mail path twice and answer "already used" on the QR.
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
