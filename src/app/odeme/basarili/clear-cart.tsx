"use client";

import { useEffect } from "react";

const CART_STORAGE_KEY = "laffogato_cart_v1";

/**
 * Mounted on the order success page to empty the cart that LaffogatoApp
 * keeps in localStorage. Without this, navigating back to /magaza would
 * still show the just-purchased items.
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
  }, []);
  return null;
}
