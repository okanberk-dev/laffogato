import "server-only";

import type { CheckoutSavedCard } from "@/lib/checkout/start";
import { getCardUserKey } from "@/lib/customer/store";

import { getPaymentProvider } from "@/lib/payment";
import { PaynkolayPaymentProvider, type SavedCard } from "./paynkolay";

/**
 * A member's saved cards for the web checkout (docs/PAYNKOLAY.md §16).
 *
 * The cards stay at PayNkolay; this server keeps only the member's opaque
 * key (`customers."cardUserKey"`). The checkout page lists them with that
 * key and the browser gets the public part only - never the token. Paying
 * with one goes through the payment route, which looks the token up again
 * from the key sealed in the payment payload; deleting goes through
 * `deleteCheckoutSavedCard`, which derives the key from the signed-in member
 * on the server. Neither path takes a card number.
 */

/**
 * How long the checkout page waits for the list. The page renders without
 * the cards rather than keep a paying customer looking at a blank checkout;
 * a new card can always be typed.
 */
const PAGE_LIST_WAIT_MS = 3_000;

export interface CheckoutPaymentSetup {
  /**
   * `card`: the card is typed on /odeme and posted to /odeme/paynkolay
   * (PayNkolay in `direct` mode). `redirect`: the provider takes the card on
   * its own page (PayNkolay `hosted`, or the development mock).
   */
  mode: "card" | "redirect";
  savedCards: CheckoutSavedCard[];
  /** The list could not be read; the page says so quietly. */
  savedCardsUnavailable: boolean;
  /** "Bu kartı kaydet" may be offered with a new card. */
  canSave: boolean;
}

function directProvider(): PaynkolayPaymentProvider | null {
  try {
    const provider = getPaymentProvider();
    return provider instanceof PaynkolayPaymentProvider &&
      provider.checkoutMode === "direct"
      ? provider
      : null;
  } catch (err) {
    console.error(
      "[odeme] payment provider unavailable",
      err instanceof Error ? err.message : "unknown",
    );
    return null;
  }
}

function lastFour(maskedPan: string): string {
  return maskedPan.replace(/\D/g, "").slice(-4);
}

/** The browser's view of a saved card: masked, token-free. */
export function publicSavedCards(cards: SavedCard[]): CheckoutSavedCard[] {
  return cards.map((card) => ({
    tranId: card.tranId,
    last4: lastFour(card.maskedPan),
    bank: card.bank,
    brand: card.brand,
    alias: card.alias,
  }));
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** How /odeme takes the card, and the member's saved cards when it does. */
export async function checkoutPaymentSetup(
  email: string,
): Promise<CheckoutPaymentSetup> {
  const provider = directProvider();
  if (!provider) {
    return {
      mode: "redirect",
      savedCards: [],
      savedCardsUnavailable: false,
      canSave: false,
    };
  }
  // Card storage is granted per merchant by PayNkolay and stays off until it
  // is (`PAYNKOLAY_CARD_STORAGE`, docs/PAYNKOLAY.md §16): no list, no
  // "Bu kartı kaydet", no delete - and no POS call from this page at all.
  if (!provider.cardStorageEnabled) {
    return {
      mode: "card",
      savedCards: [],
      savedCardsUnavailable: false,
      canSave: false,
    };
  }
  // The key is created at the member's first payment (`ensureCardUserKey`
  // in the action), so every member paying here can save a card; without a
  // key there is simply nothing to list yet.
  let member = "";
  try {
    member = await getCardUserKey(email);
  } catch (err) {
    console.error(
      "[odeme] card key unreadable",
      err instanceof Error ? err.message : "unknown",
    );
    return {
      mode: "card",
      savedCards: [],
      savedCardsUnavailable: true,
      canSave: true,
    };
  }
  if (!member) {
    return {
      mode: "card",
      savedCards: [],
      savedCardsUnavailable: false,
      canSave: true,
    };
  }
  try {
    const cards = await withDeadline(
      provider.listSavedCards(member),
      PAGE_LIST_WAIT_MS,
    );
    return {
      mode: "card",
      savedCards: publicSavedCards(cards),
      savedCardsUnavailable: false,
      canSave: true,
    };
  } catch (err) {
    console.error(
      "[odeme] saved cards unreadable",
      err instanceof Error ? err.message : "unknown",
    );
    return {
      mode: "card",
      savedCards: [],
      savedCardsUnavailable: true,
      canSave: true,
    };
  }
}

export type SavedCardDeletion =
  | { ok: true; cards: CheckoutSavedCard[] }
  | { ok: false; reason: "not_found" | "failed" };

/**
 * Deletes one of the signed-in member's saved cards. The member's key comes
 * from the database row of the signed-in account, the card from a fresh
 * list read with that key, and the delete goes by the token from that list:
 * nothing the browser sends can point at another member's card.
 */
export async function deleteCheckoutSavedCard(
  email: string,
  tranId: string,
): Promise<SavedCardDeletion> {
  const provider = directProvider();
  if (!provider || !provider.cardStorageEnabled) {
    return { ok: false, reason: "not_found" };
  }
  try {
    const member = await getCardUserKey(email);
    if (!member) return { ok: false, reason: "not_found" };
    const cards = await provider.listSavedCards(member);
    const card = cards.find((c) => c.tranId === tranId);
    if (!card) return { ok: false, reason: "not_found" };
    await provider.deleteSavedCard(member, card.token);
    return {
      ok: true,
      cards: publicSavedCards(cards.filter((c) => c.token !== card.token)),
    };
  } catch (err) {
    console.error(
      "[odeme] saved card not deleted",
      err instanceof Error ? err.message : "unknown",
    );
    return { ok: false, reason: "failed" };
  }
}
