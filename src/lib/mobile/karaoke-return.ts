import "server-only";

import { isClosedAccountEmail } from "@/lib/admin/store";
import { rememberCardUserKey } from "@/lib/customer/store";
import type {
  PaymentProvider,
  ReturnConfirmation,
} from "@/lib/payment/provider";

import { appKaraokeDeepLink } from "./deep-link";
import { getReservation } from "./karaoke";
import { paymentStatusOf, type KaraokeReservation } from "./karaoke-core";
import { KARAOKE_LINK_PATH } from "./karaoke-link";
import { applyKaraokePaymentSucceeded } from "./karaoke-payment";
import { isIssuedCheckoutRef } from "./checkout-ref";

/**
 * The karaoke half of `/odeme/donus` - the browser coming back from the bank
 * for a `krk-` reference (docs/API-MOBILE.md §7).
 *
 * What the return may do, and what it may not:
 *
 * - It may BOOK a payment, and only one the POS confirmed when asked
 *   (`confirmReturn` queries PaymentList; the POSTed body is never trusted).
 * - It never cancels or expires anything: the POST arrives cross-site without
 *   a cookie and can be forged for any id (CLAUDE.md rule 29). An unpaid hold
 *   is the sweep's to release.
 * - It never hands out a booking: no signed link is minted here, and the web
 *   page it redirects to shows details only to the signed-in owner or to the
 *   browser holding the booking's own link cookie (set by the booking form).
 * - Where it lands is decided by the ROW (`channel`), never by a query string,
 *   and the app is told what the row says, not what the bank said.
 */

async function safeReservation(id: string): Promise<KaraokeReservation | null> {
  try {
    return await getReservation(id);
  } catch (err) {
    console.error("[odeme/donus] karaoke lookup failed", err);
    return null;
  }
}

/** Books a confirmed payment for a booking. Never throws. */
export async function settleKaraokeReturn(
  result: ReturnConfirmation,
  provider: Pick<PaymentProvider, "name">,
): Promise<void> {
  if (result.status !== "succeeded") return;
  try {
    const applied = await applyKaraokePaymentSucceeded({
      reservationId: result.orderId,
      provider: provider.name,
      providerRef: result.providerRef,
      amountMinor: result.amountMinor,
      currency: result.currency,
      raw: result.raw,
      trxDate: result.trxDate,
    });
    if (!applied.ok) {
      console.error("[odeme/donus] karaoke apply failed", applied.error);
      return;
    }
    // "Kartımı kaydet" for a member's booking, as for an order. A guest has
    // no account to keep a card key on.
    const r = applied.reservation;
    // Not onto a closed account: a late charge on a booking DELETE /me
    // cancelled carries the anonymised placeholder, as an order does.
    if (result.cardUserKey && !r.guest && r.customerEmail && !isClosedAccountEmail(r.customerEmail)) {
      await rememberCardUserKey(r.customerEmail, result.cardUserKey).catch(
        (err: unknown) =>
          console.error("[odeme/donus] karaoke cardUserKey not stored", err),
      );
    }
  } catch (err) {
    console.error("[odeme/donus] karaoke apply threw", err);
  }
}

/**
 * The dev-only mock return (GET): settles only for the signed-in member who
 * owns the booking, or with the exact reference this server opened for it.
 * True when that proof held (the destination may then trust the row).
 */
export async function settleKaraokeMockReturn(args: {
  ref: string;
  providerRef: string;
  provider: Pick<PaymentProvider, "name">;
  customerEmail: string | null;
}): Promise<boolean> {
  if (args.provider.name !== "mock") return false;
  const r = await safeReservation(args.ref);
  if (!r || paymentStatusOf(r) !== "pending") return false;
  const owned =
    !!args.customerEmail &&
    !r.guest &&
    r.customerEmail.toLowerCase() === args.customerEmail.toLowerCase();
  const issued = await isIssuedCheckoutRef(
    r.id,
    args.provider.name,
    args.providerRef,
  );
  if (!owned && !issued) return false;
  const applied = await applyKaraokePaymentSucceeded({
    reservationId: r.id,
    provider: args.provider.name,
    providerRef: args.providerRef || `mock_${r.id}`,
    amountMinor: r.totalMinor,
    currency: "TRY",
    raw: { source: "mock_return" },
  });
  if (!applied.ok) {
    console.error("[odeme/donus] karaoke mock confirm failed", applied.error);
  }
  return true;
}

/** Paid, or confirmed: what the app may call a success. */
function settled(r: KaraokeReservation | null): boolean {
  if (!r) return false;
  const money = paymentStatusOf(r);
  return money === "paid" || r.status === "confirmed";
}

/**
 * Where the browser goes next: the app, or the booking's web page.
 *
 * `verified` is true only after the POS itself was asked about this
 * reference (`confirmReturn`). Without that - the confirmation threw, no
 * provider, a hand-made GET - the app is told "failed" whatever the row says:
 * otherwise anyone could post a sequential id and read off whether that
 * evening was paid. The app reads its bookings back before it says anything,
 * and the web page shows details only to the owner, so nobody real is misled.
 */
export async function karaokeReturnDestination(
  ref: string,
  base: string,
  verified = false,
): Promise<string> {
  const r = await safeReservation(ref);
  const ok = verified && settled(r);
  if (r?.channel === "app") {
    return appKaraokeDeepLink(ref, ok ? "success" : "failed");
  }
  const url = new URL(KARAOKE_LINK_PATH, base);
  url.searchParams.set("ref", ref);
  url.searchParams.set("odeme", ok ? "basarili" : "sonuc");
  return url.toString();
}
