"use client";

import { useEffect, useEffectEvent } from "react";

import {
  fireOnce,
  navigateAfterPixel,
  shopParams,
  trackPixel,
  type PixelEventName,
  type PixelParams,
  type PixelShopLine,
} from "@/lib/consent/meta-pixel";

import type { CartItem } from "./ui";

/** The localStorage key that remembers a conversion already counted. */
function conversionKey(eventId: string): string {
  return `laffogato_meta_${eventId}`;
}

/**
 * A confirmed sale or booking, reported once (docs/META-PIXEL.md).
 *
 * Rendered by a page only when the payment is confirmed: the karaoke booking
 * pages after a verified return (`?odeme=basarili` on a paid row) and the
 * order page for an order the bank settled. `eventId` is the deduplication id
 * (`purchase_<code>`); the same id marks the reported sale in localStorage, so
 * a refreshed page does not count it twice. Nothing is sent without the
 * visitor's marketing consent; the key is then left unset.
 */
export function PixelConversion({
  eventId,
  events,
  params,
}: {
  eventId: string;
  events: PixelEventName[];
  params: PixelParams;
}) {
  const report = useEffectEvent(() => {
    fireOnce(conversionKey(eventId), () => {
      let sent = false;
      for (const event of events) {
        if (trackPixel(event, params, eventId)) sent = true;
      }
      return sent;
    });
  });
  useEffect(() => {
    report();
  }, []);
  return null;
}

/** A cart line as the pixel sees it: id, name, quantity and unit price (₺). */
export function cartLine(item: CartItem, qty?: number): PixelShopLine | null {
  const id = item.productId;
  if (!id) return null;
  return {
    id,
    name: item.name,
    quantity: qty ?? item.qty ?? 1,
    price: item.price,
  };
}

/** AddToCart for one or more units of an item put in the cart by a click. */
export function trackCartAdd(item: CartItem, qty = 1): void {
  const line = cartLine(item, qty);
  if (line) trackPixel("AddToCart", shopParams([line]));
}

/**
 * InitiateCheckout for the cart, then a full page load to the checkout. The
 * checkout is a document of its own (a hard load, by design), so the request
 * to Meta is given a moment to leave before the page goes.
 */
export function checkoutFromCart(items: readonly CartItem[]): void {
  const lines = items.flatMap((it) => cartLine(it) ?? []);
  const sent =
    lines.length > 0 && trackPixel("InitiateCheckout", shopParams(lines));
  navigateAfterPixel("/odeme", sent);
}
