"use client";

import { useEffect } from "react";

import { CHECKOUT_SESSION_KEYS } from "@/lib/checkout/session-keys";

const CART_STORAGE_KEY = "laffogato_cart_v1";

/**
 * Mounted on the order success page to empty the cart that LaffogatoApp
 * keeps in localStorage. Without this, navigating back to /magaza would
 * still show the just-purchased items. The checkout's own tab memory (the
 * pending order a retry would reuse, the delivery draft) goes too: that
 * order is done.
 */
export function ClearCart() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      // The header's cart count listens for `storage`, which the browser
      // only fires in OTHER tabs - so this page kept showing the basket it
      // had just emptied. Tell this tab too.
      window.dispatchEvent(
        new StorageEvent("storage", { key: CART_STORAGE_KEY }),
      );
    } catch {
      // localStorage may be unavailable - silent no-op.
    }
    for (const key of CHECKOUT_SESSION_KEYS) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // sessionStorage may be unavailable - nothing was kept then.
      }
    }
  }, []);
  return null;
}
