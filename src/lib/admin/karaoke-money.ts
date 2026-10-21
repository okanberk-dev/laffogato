// Client-safe (no server-only): what one prepaid karaoke booking's payment
// leaves with the köşk. Raporlar and Gün sonu (`karaokeRevenueFrom`,
// store.ts) and the köşk panel's sales export
// (src/lib/panel/sales-export-core.ts) count karaoke money through this one
// function, so the three figures cannot disagree.

/** The payment states that mean money reached the POS. */
export const KARAOKE_COLLECTED = ["paid", "refunding", "refunded"] as const;

/** The karaoke columns the revenue figures read. */
export interface KaraokeRevenueRow {
  paymentStatus?: string | null;
  paidMinor?: number | null;
  /** A late cancel's share owed / refunded; null = the whole payment. */
  refundMinor?: number | null;
  /**
   * The part of `refundMinor` that had already gone back when an hour sold
   * again made the booking owe money again (karaoke-make-good-core.ts).
   */
  refundSettledMinor?: number | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface KaraokeMoney {
  /** What the POS collected. */
  paidMinor: number;
  /** What the köşk keeps of it: the revenue. */
  keptMinor: number;
  /** Owed back and not gone yet (a `refunding` row); inside `keptMinor`. */
  refundPendingMinor: number;
}

/**
 * The money of one booking, or null when none reached the POS. A
 * `refunded` row keeps what its late cancel did not give back (`refundMinor`,
 * P2a; the whole payment when it is null). A `refunding` row still keeps it
 * all, but for what had already gone back by hand before an hour sold again
 * made it owe more (`refundSettledMinor`): the money owed has not gone back
 * (CLAUDE.md rule 29) and is reported apart as "iadesi bekleyen".
 */
export function karaokeMoneyOf(r: KaraokeRevenueRow): KaraokeMoney | null {
  const status = r.paymentStatus ?? "";
  if (!(KARAOKE_COLLECTED as readonly string[]).includes(status)) return null;
  const paid = Math.max(0, Math.round(Number(r.paidMinor) || 0));
  if (paid === 0) return null;
  // What goes (or went) back: a late cancel's share, else everything.
  const share =
    typeof r.refundMinor === "number" && r.refundMinor >= 0
      ? Math.min(paid, Math.round(r.refundMinor))
      : paid;
  // Of a share still owed, what had already gone back (a late share
  // refunded before its hour was sold again).
  const settled =
    typeof r.refundMinor === "number" &&
    typeof r.refundSettledMinor === "number" &&
    r.refundSettledMinor > 0
      ? Math.min(share, Math.round(r.refundSettledMinor))
      : 0;
  const kept =
    status === "refunded"
      ? paid - share
      : status === "refunding"
        ? paid - settled
        : paid;
  return {
    paidMinor: paid,
    keptMinor: kept,
    refundPendingMinor: status === "refunding" ? share - settled : 0,
  };
}
